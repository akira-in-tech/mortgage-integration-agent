import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { ProviderOperationIntent as ProviderOperationIntentEntity } from '../database/entities/provider-operation-intent.entity';
import {
  ProviderCapabilityStatus,
  ProviderOperationIntentStatus,
} from '../database/enums/provider-platform.enum';
import {
  ProviderCapability,
  ProviderEffectClass,
  ProviderOperationIntent,
} from './types';
import { runInTenantContext } from '../database/tenant-context';

export interface PrepareIntentInput {
  tenantId: string;
  caseId: string;
  providerId: string;
  capability: ProviderCapability;
  effectClass: ProviderEffectClass;
  authorizationGrantId: string;
  /** Content that makes this request logically unique — hashed into `requestFingerprint`, never stored raw (Section 11.5). */
  requestPayloadForFingerprint: Record<string, unknown>;
}

function toIntentValue(
  entity: ProviderOperationIntentEntity,
): ProviderOperationIntent {
  return {
    id: entity.id,
    tenantId: entity.tenantId,
    caseId: entity.caseId,
    providerId: entity.providerId,
    capability: entity.capability as unknown as ProviderCapability,
    effectClass: entity.effectClass as ProviderEffectClass,
    requestFingerprint: entity.requestFingerprint,
    idempotencyKey: entity.idempotencyKey,
    authorizationGrantId: entity.authorizationGrantId,
    state: entity.state as unknown as ProviderOperationIntent['state'],
  };
}

/**
 * Section 11.5: "The platform persists the operation intent before
 * dispatch." One row per real attempt — `prepare()` is called before the
 * adapter's `submit()` runs; the `mark*()` methods record the real
 * outcome once known. `CANCELLED` is declared (matching the charter's
 * full state enum) but nothing in this codebase transitions an intent
 * into it yet — no cancellation caller exists (Known gap, honestly
 * undriven rather than faked; `cancel()` is optional on `ProviderAdapter`
 * and no current adapter implements it). `RECONCILING` is real as of
 * M5-027 — see `ProviderReconciliationService`.
 */
@Injectable()
export class ProviderOperationIntentService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async prepare(input: PrepareIntentInput): Promise<ProviderOperationIntent> {
    const requestFingerprint = createHash('sha256')
      .update(JSON.stringify(input.requestPayloadForFingerprint))
      .digest('hex');
    const entity = await runInTenantContext(
      this.dataSource,
      input.tenantId,
      (manager) => {
        const repo = manager.getRepository(ProviderOperationIntentEntity);
        return repo.save(
          repo.create({
            tenantId: input.tenantId,
            caseId: input.caseId,
            providerId: input.providerId,
            capability: input.capability as unknown as ProviderCapabilityStatus,
            effectClass: input.effectClass,
            requestFingerprint,
            idempotencyKey: randomUUID(),
            authorizationGrantId: input.authorizationGrantId,
          }),
        );
      },
    );
    return toIntentValue(entity);
  }

  private setState(
    tenantId: string,
    id: string,
    state: ProviderOperationIntentStatus,
  ): Promise<void> {
    return runInTenantContext(this.dataSource, tenantId, async (manager) => {
      await manager
        .getRepository(ProviderOperationIntentEntity)
        .update({ id }, { state });
    });
  }

  async markDispatched(tenantId: string, id: string): Promise<void> {
    await this.setState(tenantId, id, ProviderOperationIntentStatus.DISPATCHED);
  }

  async markSucceeded(tenantId: string, id: string): Promise<void> {
    await this.setState(tenantId, id, ProviderOperationIntentStatus.SUCCEEDED);
  }

  async markFailedFinal(tenantId: string, id: string): Promise<void> {
    await this.setState(
      tenantId,
      id,
      ProviderOperationIntentStatus.FAILED_FINAL,
    );
  }

  /** Section 11.5: "After an ambiguous timeout, the state becomes OUTCOME_UNKNOWN." Our synthetic transient-failure injection is this codebase's own analog of that ambiguity. */
  async markOutcomeUnknown(tenantId: string, id: string): Promise<void> {
    await this.setState(
      tenantId,
      id,
      ProviderOperationIntentStatus.OUTCOME_UNKNOWN,
    );
  }

  /** `ProviderReconciliationService`'s own transition — an `OUTCOME_UNKNOWN` intent old enough that automatic resolution (this codebase has none — see that service's own comment) won't come; flagged for a human to investigate out of band. */
  async markReconciling(tenantId: string, id: string): Promise<void> {
    await this.setState(
      tenantId,
      id,
      ProviderOperationIntentStatus.RECONCILING,
    );
  }

  /**
   * A real, human, out-of-band manual resolution — an operator
   * investigated a `RECONCILING`/`OUTCOME_UNKNOWN` intent against the
   * real provider's own records (outside this codebase, e.g. a
   * provider's own dashboard) and is now recording what actually
   * happened. Only callable from those two states — a `SUCCEEDED`/
   * `FAILED_FINAL` intent already has its own real outcome and does not
   * need a second, conflicting one.
   */
  async resolveManually(
    tenantId: string,
    id: string,
    outcome:
      | ProviderOperationIntentStatus.SUCCEEDED
      | ProviderOperationIntentStatus.FAILED_FINAL
      | ProviderOperationIntentStatus.CANCELLED,
    resolvedBy: string,
    resolutionNote: string,
  ): Promise<ProviderOperationIntentEntity> {
    return runInTenantContext(this.dataSource, tenantId, async (manager) => {
      const repo = manager.getRepository(ProviderOperationIntentEntity);
      const current = await repo.findOneByOrFail({ id, tenantId });
      if (
        current.state !== ProviderOperationIntentStatus.OUTCOME_UNKNOWN &&
        current.state !== ProviderOperationIntentStatus.RECONCILING
      ) {
        throw new Error(
          `intent ${id} is not in a reconcilable state (current: ${current.state})`,
        );
      }
      await repo.update({ id }, { state: outcome, resolvedBy, resolutionNote });
      return repo.findOneByOrFail({ id });
    });
  }

  /**
   * Every provider-call intent this tenant hasn't gotten a clear answer
   * for yet ("OUTCOME_UNKNOWN" or "RECONCILING"), across every case, so
   * a reviewer can look at one list instead of checking case by case.
   * Oldest first, so the longest-waiting one shows up at the top.
   */
  async listNeedingReconciliation(
    tenantId: string,
    limit = 50,
  ): Promise<ProviderOperationIntentEntity[]> {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    return runInTenantContext(this.dataSource, tenantId, (manager) =>
      manager.getRepository(ProviderOperationIntentEntity).find({
        where: [
          { tenantId, state: ProviderOperationIntentStatus.OUTCOME_UNKNOWN },
          { tenantId, state: ProviderOperationIntentStatus.RECONCILING },
        ],
        order: { createdAt: 'ASC' },
        take: boundedLimit,
      }),
    );
  }
}
