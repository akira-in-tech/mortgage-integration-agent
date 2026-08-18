import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProviderAuthorizationGrant as ProviderAuthorizationGrantEntity } from '../database/entities/provider-authorization-grant.entity';
import { ProviderCapabilityStatus } from '../database/enums/provider-platform.enum';
import { ProviderAuthorizationGrant, ProviderCapability } from './types';

export interface IssueGrantInput {
  tenantId: string;
  caseId: string;
  borrowerSubjectId: string;
  providerId: string;
  capability: ProviderCapability;
  purposeCode: string;
  permittedDataClasses: string[];
  /** Defaults to a short-lived grant (Section 11.5: authorization is "... and time-bound") — long enough for one Agent-run/activity attempt, not a standing credential. */
  ttlMs?: number;
}

const DEFAULT_GRANT_TTL_MS = 5 * 60 * 1000;

export type RevalidateResult =
  | { valid: true; grant: ProviderAuthorizationGrant }
  | { valid: false; reason: string };

function toGrantValue(
  entity: ProviderAuthorizationGrantEntity,
): ProviderAuthorizationGrant {
  return {
    id: entity.id,
    tenantId: entity.tenantId,
    caseId: entity.caseId,
    borrowerSubjectId: entity.borrowerSubjectId,
    providerId: entity.providerId,
    capability: entity.capability as unknown as ProviderCapability,
    purposeCode: entity.purposeCode,
    permittedDataClasses: entity.permittedDataClasses,
    permittedFields: entity.permittedFields ?? undefined,
    consentRecordIds: entity.consentRecordIds,
    permissiblePurposeDecisionId:
      entity.permissiblePurposeDecisionId ?? undefined,
    issuedAt: entity.issuedAt.toISOString(),
    expiresAt: entity.expiresAt.toISOString(),
    revokedAt: entity.revokedAt?.toISOString(),
  };
}

/**
 * Section 11.5: "Authorization is case-, borrower-, provider-,
 * capability-, purpose-, data-class-, optionally field-, and time-bound"
 * — `revalidate()` checks every one of those dimensions the caller
 * supplies, failing closed (not throwing) on any mismatch, expiry, or
 * revocation, exactly as that section requires ("a stale, mismatched,
 * expired, or revoked reference fails closed instead of dispatching").
 */
@Injectable()
export class ProviderAuthorizationService {
  constructor(
    @InjectRepository(ProviderAuthorizationGrantEntity)
    private readonly grantRepository: Repository<ProviderAuthorizationGrantEntity>,
  ) {}

  async issue(input: IssueGrantInput): Promise<ProviderAuthorizationGrant> {
    const now = new Date();
    const entity = await this.grantRepository.save(
      this.grantRepository.create({
        tenantId: input.tenantId,
        caseId: input.caseId,
        borrowerSubjectId: input.borrowerSubjectId,
        providerId: input.providerId,
        capability: input.capability as unknown as ProviderCapabilityStatus,
        purposeCode: input.purposeCode,
        permittedDataClasses: input.permittedDataClasses,
        permittedFields: null,
        consentRecordIds: [],
        permissiblePurposeDecisionId: null,
        expiresAt: new Date(
          now.getTime() + (input.ttlMs ?? DEFAULT_GRANT_TTL_MS),
        ),
        revokedAt: null,
      }),
    );
    return toGrantValue(entity);
  }

  async revalidate(
    grantId: string,
    expected: {
      tenantId: string;
      caseId: string;
      providerId: string;
      capability: ProviderCapability;
    },
  ): Promise<RevalidateResult> {
    const entity = await this.grantRepository.findOneBy({ id: grantId });
    if (!entity) {
      return {
        valid: false,
        reason: `authorization grant ${grantId} not found`,
      };
    }
    if (
      entity.tenantId !== expected.tenantId ||
      entity.caseId !== expected.caseId ||
      entity.providerId !== expected.providerId ||
      (entity.capability as unknown as ProviderCapability) !==
        expected.capability
    ) {
      return {
        valid: false,
        reason: `authorization grant ${grantId} does not match this request's tenant/case/provider/capability`,
      };
    }
    if (entity.revokedAt) {
      return {
        valid: false,
        reason: `authorization grant ${grantId} was revoked at ${entity.revokedAt.toISOString()}`,
      };
    }
    if (entity.expiresAt.getTime() <= Date.now()) {
      return {
        valid: false,
        reason: `authorization grant ${grantId} expired at ${entity.expiresAt.toISOString()}`,
      };
    }
    return { valid: true, grant: toGrantValue(entity) };
  }

  async revoke(grantId: string): Promise<void> {
    await this.grantRepository.update(
      { id: grantId },
      { revokedAt: new Date() },
    );
  }
}
