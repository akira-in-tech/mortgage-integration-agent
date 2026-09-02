import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
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
import {
  runInTenantContext,
  runWithRlsBypass,
} from '../database/tenant-context';
import { SensitiveJsonCipher } from './sensitive-json-cipher';

export interface PrepareIntentInput {
  tenantId: string;
  caseId: string;
  providerId: string;
  capability: ProviderCapability;
  effectClass: ProviderEffectClass;
  authorizationGrantId: string;
  /** Stable for one logical effect across retries; must change for a genuinely new provider operation. */
  logicalOperationKey: string;
  /** Content that makes this request logically unique — hashed into `requestFingerprint`, never stored raw (Section 11.5). */
  requestPayloadForFingerprint: Record<string, unknown>;
}

export class ProviderIntentConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderIntentConflictError';
  }
}

export class ProviderIntentTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderIntentTransitionError';
  }
}

/** JSON canonicalization makes semantically identical object payloads hash identically even when key insertion order differs. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function toIntentValue(
  entity: ProviderOperationIntentEntity,
  cipher: SensitiveJsonCipher,
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
    logicalOperationKey: entity.logicalOperationKey,
    authorizationGrantId: entity.authorizationGrantId,
    state: entity.state as unknown as ProviderOperationIntent['state'],
    providerReceipt:
      entity.providerReceipt === null
        ? undefined
        : cipher.decrypt(
            entity.providerReceipt,
            `${entity.tenantId}:${entity.id}:receipt`,
          ),
    normalizedFinding:
      entity.normalizedFinding === null
        ? undefined
        : cipher.decrypt(
            entity.normalizedFinding,
            `${entity.tenantId}:${entity.id}:finding`,
          ),
  };
}

/**
 * Section 11.5: "The platform persists the operation intent before
 * dispatch." One row per logical effect — `prepare()` reuses it across
 * workflow retries, rejects a changed request under the same logical key,
 * and preserves one provider idempotency key. The `mark*()` methods use
 * compare-and-swap state transitions so a late writer cannot regress a
 * terminal result. `CANCELLED` is declared (matching the charter's
 * full state enum) but nothing in this codebase transitions an intent
 * into it yet — no cancellation caller exists (Known gap, honestly
 * undriven rather than faked; `cancel()` is optional on `ProviderAdapter`
 * and no current adapter implements it). `RECONCILING` is real as of
 * M5-027 — see `ProviderReconciliationService`.
 */
@Injectable()
export class ProviderOperationIntentService {
  private readonly cipher = new SensitiveJsonCipher();

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async prepare(input: PrepareIntentInput): Promise<ProviderOperationIntent> {
    const requestFingerprint = createHash('sha256')
      .update(canonicalJson(input.requestPayloadForFingerprint))
      .digest('hex');
    const entity = await runInTenantContext(
      this.dataSource,
      input.tenantId,
      async (manager) => {
        const repo = manager.getRepository(ProviderOperationIntentEntity);
        const identity = {
          tenantId: input.tenantId,
          providerId: input.providerId,
          capability: input.capability as unknown as ProviderCapabilityStatus,
          logicalOperationKey: input.logicalOperationKey,
        };
        let existing = await repo.findOneBy(identity);
        if (!existing) {
          try {
            return await repo.save(
              repo.create({
                ...identity,
                caseId: input.caseId,
                effectClass: input.effectClass,
                requestFingerprint,
                idempotencyKey: randomUUID(),
                authorizationGrantId: input.authorizationGrantId,
                providerReceipt: null,
                normalizedFinding: null,
              }),
            );
          } catch (error) {
            // A concurrent retry can win the unique insert. Reloading the
            // winner turns that race into the same deterministic reuse path.
            if ((error as { code?: string }).code !== '23505') {
              throw error;
            }
            existing = await repo.findOneByOrFail(identity);
          }
        }
        if (
          existing.caseId !== input.caseId ||
          existing.requestFingerprint !== requestFingerprint ||
          existing.effectClass !== input.effectClass
        ) {
          throw new ProviderIntentConflictError(
            `logical provider operation "${input.logicalOperationKey}" was reused with a changed case, payload, or effect class`,
          );
        }
        if (existing.state === ProviderOperationIntentStatus.PREPARED) {
          await repo.update(
            { id: existing.id, state: ProviderOperationIntentStatus.PREPARED },
            { authorizationGrantId: input.authorizationGrantId },
          );
          existing.authorizationGrantId = input.authorizationGrantId;
        }
        return existing;
      },
    );
    return toIntentValue(entity, this.cipher);
  }

  private async transition(
    tenantId: string,
    id: string,
    from: ProviderOperationIntentStatus[],
    state: ProviderOperationIntentStatus,
    values: Partial<ProviderOperationIntentEntity> = {},
  ): Promise<void> {
    await runInTenantContext(this.dataSource, tenantId, async (manager) => {
      const result = await manager
        .getRepository(ProviderOperationIntentEntity)
        .update({ id, tenantId, state: In(from) }, {
          state,
          ...values,
        } as never);
      if (result.affected !== 1) {
        const current = await manager
          .getRepository(ProviderOperationIntentEntity)
          .findOneBy({ id, tenantId });
        throw new ProviderIntentTransitionError(
          `intent ${id} cannot transition from ${current?.state ?? 'NOT_FOUND'} to ${state}`,
        );
      }
    });
  }

  async markDispatched(tenantId: string, id: string): Promise<void> {
    await this.transition(
      tenantId,
      id,
      [ProviderOperationIntentStatus.PREPARED],
      ProviderOperationIntentStatus.DISPATCHED,
    );
  }

  async markSucceeded(
    tenantId: string,
    id: string,
    providerReceipt: unknown,
    normalizedFinding: unknown,
  ): Promise<void> {
    await this.transition(
      tenantId,
      id,
      [ProviderOperationIntentStatus.DISPATCHED],
      ProviderOperationIntentStatus.SUCCEEDED,
      {
        providerReceipt: this.cipher.encrypt(
          providerReceipt,
          `${tenantId}:${id}:receipt`,
        ),
        normalizedFinding: this.cipher.encrypt(
          normalizedFinding,
          `${tenantId}:${id}:finding`,
        ),
      },
    );
  }

  async markFailedFinal(
    tenantId: string,
    id: string,
    providerReceipt?: unknown,
  ): Promise<void> {
    await this.transition(
      tenantId,
      id,
      [
        ProviderOperationIntentStatus.PREPARED,
        ProviderOperationIntentStatus.DISPATCHED,
      ],
      ProviderOperationIntentStatus.FAILED_FINAL,
      providerReceipt === undefined
        ? {}
        : {
            providerReceipt: this.cipher.encrypt(
              providerReceipt,
              `${tenantId}:${id}:receipt`,
            ),
          },
    );
  }

  /** Section 11.5: "After an ambiguous timeout, the state becomes OUTCOME_UNKNOWN." Our synthetic transient-failure injection is this codebase's own analog of that ambiguity. */
  async markOutcomeUnknown(tenantId: string, id: string): Promise<void> {
    await this.transition(
      tenantId,
      id,
      [ProviderOperationIntentStatus.DISPATCHED],
      ProviderOperationIntentStatus.OUTCOME_UNKNOWN,
    );
  }

  /** `ProviderReconciliationService`'s own transition — an `OUTCOME_UNKNOWN` intent old enough that automatic resolution (this codebase has none — see that service's own comment) won't come; flagged for a human to investigate out of band. */
  async markReconciling(tenantId: string, id: string): Promise<void> {
    await this.transition(
      tenantId,
      id,
      [ProviderOperationIntentStatus.OUTCOME_UNKNOWN],
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
      const result = await repo.update(
        {
          id,
          tenantId,
          state: In([
            ProviderOperationIntentStatus.OUTCOME_UNKNOWN,
            ProviderOperationIntentStatus.RECONCILING,
          ]),
        },
        { state: outcome, resolvedBy, resolutionNote },
      );
      if (result.affected !== 1) {
        const current = await repo.findOneBy({ id, tenantId });
        throw new ProviderIntentTransitionError(
          `intent ${id} is not in a reconcilable state (current: ${current?.state ?? 'NOT_FOUND'})`,
        );
      }
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

  /** Tenant-scoped decrypted read used by safe replay and operator detail views. */
  async get(
    tenantId: string,
    id: string,
  ): Promise<ProviderOperationIntent | null> {
    const entity = await runInTenantContext(
      this.dataSource,
      tenantId,
      (manager) =>
        manager.getRepository(ProviderOperationIntentEntity).findOneBy({
          id,
          tenantId,
        }),
    );
    return entity ? toIntentValue(entity, this.cipher) : null;
  }

  /** Administrative legacy backfill and key rotation; plaintext is never logged. */
  async rotateSensitivePayloadEncryption(): Promise<{
    scanned: number;
    rewritten: number;
  }> {
    return runWithRlsBypass(this.dataSource, async (manager) => {
      const repo = manager.getRepository(ProviderOperationIntentEntity);
      const rows = await repo.find();
      let rewritten = 0;
      for (const row of rows) {
        const values: Partial<ProviderOperationIntentEntity> = {};
        if (row.providerReceipt !== null) {
          const plaintext = this.cipher.isEnvelope(row.providerReceipt)
            ? this.cipher.decrypt(
                row.providerReceipt,
                `${row.tenantId}:${row.id}:receipt`,
              )
            : row.providerReceipt;
          values.providerReceipt = this.cipher.encrypt(
            plaintext,
            `${row.tenantId}:${row.id}:receipt`,
          );
        }
        if (row.normalizedFinding !== null) {
          const plaintext = this.cipher.isEnvelope(row.normalizedFinding)
            ? this.cipher.decrypt(
                row.normalizedFinding,
                `${row.tenantId}:${row.id}:finding`,
              )
            : row.normalizedFinding;
          values.normalizedFinding = this.cipher.encrypt(
            plaintext,
            `${row.tenantId}:${row.id}:finding`,
          );
        }
        if (Object.keys(values).length > 0) {
          await repo.update({ id: row.id }, values as never);
          rewritten += 1;
        }
      }
      return { scanned: rows.length, rewritten };
    });
  }
}
