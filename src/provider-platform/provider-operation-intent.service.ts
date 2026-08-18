import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
 * outcome once known. `RECONCILING`/`CANCELLED` are declared (matching
 * the charter's full state enum) but nothing in this codebase transitions
 * an intent into either yet — no reconciliation worker or cancellation
 * caller exists (Known gap, honestly undriven rather than faked).
 */
@Injectable()
export class ProviderOperationIntentService {
  constructor(
    @InjectRepository(ProviderOperationIntentEntity)
    private readonly intentRepository: Repository<ProviderOperationIntentEntity>,
  ) {}

  async prepare(input: PrepareIntentInput): Promise<ProviderOperationIntent> {
    const requestFingerprint = createHash('sha256')
      .update(JSON.stringify(input.requestPayloadForFingerprint))
      .digest('hex');
    const entity = await this.intentRepository.save(
      this.intentRepository.create({
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
    return toIntentValue(entity);
  }

  async markDispatched(id: string): Promise<void> {
    await this.intentRepository.update(
      { id },
      { state: ProviderOperationIntentStatus.DISPATCHED },
    );
  }

  async markSucceeded(id: string): Promise<void> {
    await this.intentRepository.update(
      { id },
      { state: ProviderOperationIntentStatus.SUCCEEDED },
    );
  }

  async markFailedFinal(id: string): Promise<void> {
    await this.intentRepository.update(
      { id },
      { state: ProviderOperationIntentStatus.FAILED_FINAL },
    );
  }

  /** Section 11.5: "After an ambiguous timeout, the state becomes OUTCOME_UNKNOWN." Our synthetic transient-failure injection is this codebase's own analog of that ambiguity. */
  async markOutcomeUnknown(id: string): Promise<void> {
    await this.intentRepository.update(
      { id },
      { state: ProviderOperationIntentStatus.OUTCOME_UNKNOWN },
    );
  }
}
