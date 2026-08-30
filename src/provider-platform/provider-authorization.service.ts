import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ProviderAuthorizationGrant as ProviderAuthorizationGrantEntity } from '../database/entities/provider-authorization-grant.entity';
import { ProviderCapabilityStatus } from '../database/enums/provider-platform.enum';
import { ProviderAuthorizationGrant, ProviderCapability } from './types';
import { ConsentService } from '../consent/consent.service';
import { runInTenantContext } from '../database/tenant-context';

export interface IssueGrantInput {
  tenantId: string;
  caseId: string;
  borrowerSubjectId: string;
  providerId: string;
  capability: ProviderCapability;
  purposeCode: string;
  permittedDataClasses: string[];
  /** Section 11.5: "field-... bound" (M5-028). Optional — when unset, `dispatch-provider-request.ts` returns a provider's normalized finding unfiltered, exactly as before this field existed. When set, only these top-level keys of the finding survive `dispatchProviderRequest()`'s own post-`normalize()` filtering. */
  permittedFields?: string[];
  /** Defaults to a short-lived grant (Section 11.5: authorization is "... and time-bound") — long enough for one Agent-run/activity attempt, not a standing credential. */
  ttlMs?: number;
  /** The case's own purpose-bound consent record(s). A lower-level caller may persist an incomplete grant for diagnostics, but `revalidate()` always rejects it. */
  consentRecordIds?: string[];
  permissiblePurposeDecisionId?: string;
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
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly consentService: ConsentService,
  ) {}

  async issue(input: IssueGrantInput): Promise<ProviderAuthorizationGrant> {
    const now = new Date();
    const entity = await runInTenantContext(
      this.dataSource,
      input.tenantId,
      (manager) => {
        const repo = manager.getRepository(ProviderAuthorizationGrantEntity);
        return repo.save(
          repo.create({
            tenantId: input.tenantId,
            caseId: input.caseId,
            borrowerSubjectId: input.borrowerSubjectId,
            providerId: input.providerId,
            capability: input.capability as unknown as ProviderCapabilityStatus,
            purposeCode: input.purposeCode,
            permittedDataClasses: input.permittedDataClasses,
            permittedFields: input.permittedFields ?? null,
            consentRecordIds: input.consentRecordIds ?? [],
            permissiblePurposeDecisionId:
              input.permissiblePurposeDecisionId ?? null,
            expiresAt: new Date(
              now.getTime() + (input.ttlMs ?? DEFAULT_GRANT_TTL_MS),
            ),
            revokedAt: null,
          }),
        );
      },
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
    const entity = await runInTenantContext(
      this.dataSource,
      expected.tenantId,
      (manager) =>
        manager
          .getRepository(ProviderAuthorizationGrantEntity)
          .findOneBy({ id: grantId }),
    );
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
    // Section 11.5: "Revalidation also confirms every referenced consent
    // record is still granted and unrevoked; a stale, mismatched,
    // expired, or revoked reference fails closed instead of dispatching."
    if (entity.consentRecordIds.length === 0) {
      return {
        valid: false,
        reason: `authorization grant ${grantId} has no purpose-bound consent record`,
      };
    }
    for (const consentRecordId of entity.consentRecordIds) {
      const stillValid = await this.consentService.isRecordValid(
        consentRecordId,
        {
          tenantId: entity.tenantId,
          caseId: entity.caseId,
          purpose: entity.purposeCode,
          dataClasses: entity.permittedDataClasses,
        },
      );
      if (!stillValid) {
        return {
          valid: false,
          reason: `authorization grant ${grantId} references consent record ${consentRecordId}, which is no longer granted and unrevoked`,
        };
      }
    }
    return { valid: true, grant: toGrantValue(entity) };
  }

  /** No caller exists yet (Known gap, same shape as `ProviderOperationIntentService`'s undriven `RECONCILING`/`CANCELLED` states) — `tenantId` is still required, matching this service's every other method, so a future caller can never accidentally revoke another tenant's grant. */
  async revoke(tenantId: string, grantId: string): Promise<void> {
    await runInTenantContext(this.dataSource, tenantId, (manager) =>
      manager
        .getRepository(ProviderAuthorizationGrantEntity)
        .update({ id: grantId }, { revokedAt: new Date() }),
    );
  }
}
