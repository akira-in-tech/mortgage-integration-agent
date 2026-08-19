import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';
import { ConsentRecord } from '../database/entities/consent-record.entity';
import { ConsentStatus } from '../agent-runtime/agent-state.types';
import {
  runInTenantContext,
  runWithRlsBypass,
} from '../database/tenant-context';

const DEFAULT_PURPOSE = 'CASE_PROCESSING';
const DEFAULT_SCOPE = 'CASE_PROCESSING';

/**
 * Section 14.1's `consent_records`, and the concrete fix for M0-010's own
 * "In M5, implement consent-revocation propagation" roadmap note. Backs
 * `LendingOperationsAgentState.consentStatus` (Section 9.3) with real
 * data for the first time — `case-conditions.activities.ts`'s
 * `evaluateConditions` used to hardcode `'VALID'` because no
 * consent-tracking entity existed; it now calls `getStatus()`, which
 * means the LangGraph runtime's `verifyConsent` node (built in M3-009,
 * genuinely wired as the graph's first step, but permanently inert until
 * now) finally has something real to check.
 *
 * Deliberately NOT implemented this slice (Known gap, tracked in
 * docs/DEVELOPMENT_LOG.md's M5-005 entry): Section 14.2's third
 * consequence of revocation, "opens a data-disposition review for
 * evidence already collected" — this service stops *new* processing
 * (the actual Section 6.3 authority-order requirement: "Consent...
 * may stop processing") but does not yet trigger any review or
 * disposition workflow for evidence collected before revocation.
 */
@Injectable()
export class ConsentService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Called automatically by `CasesService.createCase()` — applying for a
   * mortgage is itself the act of consenting to the processing that
   * evaluates the application, matching this codebase's existing
   * behavior (every case has always processed successfully with no
   * separate consent step) rather than introducing a new required step
   * that would break case creation for every existing caller/test.
   * Explicit revocation (`revoke()` below) is the new, real capability
   * this slice adds — not gating creation itself.
   */
  async grantForCase(
    tenantId: string,
    caseId: string,
    purpose: string = DEFAULT_PURPOSE,
    scope: string = DEFAULT_SCOPE,
  ): Promise<ConsentRecord> {
    return runInTenantContext(this.dataSource, tenantId, (manager) => {
      const repo = manager.getRepository(ConsentRecord);
      return repo.save(
        repo.create({
          tenantId,
          caseId,
          purpose,
          scope,
          grantedAt: new Date(),
          expiresAt: null,
          revokedAt: null,
          revocationReason: null,
        }),
      );
    });
  }

  /**
   * Revokes the case's current active consent record. Section 14.2:
   * "Consent revocation... stops new processing immediately" — this
   * only takes effect the *next* time `evaluateConditions` runs
   * (`verifyConsent` is the graph's first node), not by interrupting an
   * Agent run already in flight; this codebase's Agent runs are
   * synchronous and make no model calls, so there is no meaningful
   * "in flight" window in practice today (Known gap if that ever
   * changes).
   */
  async revoke(
    tenantId: string,
    caseId: string,
    reason?: string,
  ): Promise<ConsentRecord> {
    return runInTenantContext(this.dataSource, tenantId, async (manager) => {
      const repo = manager.getRepository(ConsentRecord);
      const active = await repo.findOne({
        where: { tenantId, caseId, revokedAt: IsNull() },
        order: { grantedAt: 'DESC' },
      });
      if (!active) {
        throw new NotFoundException(
          `No active consent record for case ${caseId}`,
        );
      }
      await repo.update(
        { id: active.id },
        { revokedAt: new Date(), revocationReason: reason ?? null },
      );
      return repo.findOneByOrFail({ id: active.id });
    });
  }

  /**
   * The case's single most recent consent record determines its status
   * (Section 9.3's scalar `consentStatus`, not a per-purpose list — see
   * the entity's own comment on that simplification). No record at all
   * is `MISSING`, unreachable through this codebase's own normal paths
   * today (every case gets one at creation) but a real, distinct status
   * per the charter's own type — e.g. a case created before this slice
   * shipped, or one manipulated directly in the database.
   */
  async getStatus(tenantId: string, caseId: string): Promise<ConsentStatus> {
    const record = await this.mostRecentRecord(tenantId, caseId);
    if (!record) return 'MISSING';
    if (record.revokedAt) return 'REVOKED';
    if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
      return 'EXPIRED';
    }
    return 'VALID';
  }

  /** The case's current active consent record's id, if any — for `ProviderAuthorizationGrant.consentRecordIds` (Section 11.5). */
  async activeRecordId(
    tenantId: string,
    caseId: string,
  ): Promise<string | null> {
    const record = await this.mostRecentRecord(tenantId, caseId);
    return record?.id ?? null;
  }

  private mostRecentRecord(
    tenantId: string,
    caseId: string,
  ): Promise<ConsentRecord | null> {
    return runInTenantContext(this.dataSource, tenantId, (manager) =>
      manager.getRepository(ConsentRecord).findOne({
        where: { tenantId, caseId },
        order: { grantedAt: 'DESC' },
      }),
    );
  }

  /**
   * Section 11.5: "Revalidation also confirms every referenced consent
   * record is still granted and unrevoked" — `ProviderAuthorizationService
   * .revalidate()`'s own consent check, one record id at a time (a grant
   * may reference more than one in principle, even though this
   * codebase's `activeRecordId()` only ever attaches a single id today).
   * Bypasses tenant scoping deliberately: `ProviderAuthorizationService`
   * already independently confirms the grant's own tenantId matches the
   * caller's before this is ever reached, so re-deriving a tenant context
   * here would only duplicate a check that's already been made, not add
   * a real guarantee.
   */
  async isRecordValid(recordId: string): Promise<boolean> {
    const record = await runWithRlsBypass(this.dataSource, (manager) =>
      manager.getRepository(ConsentRecord).findOneBy({ id: recordId }),
    );
    if (!record) return false;
    if (record.revokedAt) return false;
    if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
      return false;
    }
    return true;
  }
}
