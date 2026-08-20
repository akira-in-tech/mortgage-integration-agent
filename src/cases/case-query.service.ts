import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';
import { EvidenceFact } from '../database/entities/evidence-fact.entity';
import { LoanCondition } from '../database/entities/loan-condition.entity';
import { CasePolicyBinding } from '../database/entities/case-policy-binding.entity';
import { CasePolicySnapshot } from '../database/entities/case-policy-snapshot.entity';
import { ProviderOperationIntent } from '../database/entities/provider-operation-intent.entity';
import { AuditEvent } from '../database/entities/audit-event.entity';
import { runInTenantContext } from '../database/tenant-context';

/**
 * Section 15.2/20 M6's GraphQL operations-query surface: real evidence and
 * condition listing for a case, neither of which any REST route exposes
 * either — this is the first real query surface of any kind for both
 * tables. Kept separate from `CasesService` (REST-facing orchestration,
 * per that class's own comment) the same way `CaseTimelineService` already
 * is: a small, focused read service `CasesResolver`'s field resolvers call,
 * not a place case-creation/workflow-orchestration logic lives.
 */
@Injectable()
export class CaseQueryService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async listEvidenceFacts(
    tenantId: string,
    caseId: string,
  ): Promise<EvidenceFact[]> {
    return runInTenantContext(this.dataSource, tenantId, (manager) =>
      manager.getRepository(EvidenceFact).find({
        where: { tenantId, caseId },
        order: { observedAt: 'ASC' },
      }),
    );
  }

  async listConditions(
    tenantId: string,
    caseId: string,
  ): Promise<LoanCondition[]> {
    return runInTenantContext(this.dataSource, tenantId, (manager) =>
      manager.getRepository(LoanCondition).find({
        where: { tenantId, caseId },
        order: { createdAt: 'ASC' },
      }),
    );
  }

  /** The case's currently active policy binding (Section 10.4), if any — a plain read, no re-evaluation triggered (unlike `PolicyEvaluationService.evaluate()`). */
  async getActivePolicyBinding(
    tenantId: string,
    caseId: string,
  ): Promise<CasePolicyBinding | null> {
    return runInTenantContext(this.dataSource, tenantId, (manager) =>
      manager.getRepository(CasePolicyBinding).findOne({
        where: { tenantId, caseId, invalidatedAt: IsNull() },
      }),
    );
  }

  /** Backs `CasePolicyBinding.policySnapshot`'s own `@ResolveField()` — a lazy, nested read, not an eager join. */
  async getPolicySnapshot(
    tenantId: string,
    snapshotId: string,
  ): Promise<CasePolicySnapshot | null> {
    return runInTenantContext(this.dataSource, tenantId, (manager) =>
      manager
        .getRepository(CasePolicySnapshot)
        .findOneBy({ tenantId, id: snapshotId }),
    );
  }

  async listProviderOperationIntents(
    tenantId: string,
    caseId: string,
  ): Promise<ProviderOperationIntent[]> {
    return runInTenantContext(this.dataSource, tenantId, (manager) =>
      manager.getRepository(ProviderOperationIntent).find({
        where: { tenantId, caseId },
        order: { createdAt: 'ASC' },
      }),
    );
  }

  /** `AuditEvent.resourceId` isn't always a caseId (an RBAC_REJECTED event's own resourceId is a route name) — this only ever returns events actually recorded against this exact case (Section 14.1's own append-only history, real per M5-019). */
  async listAuditEvents(
    tenantId: string,
    caseId: string,
  ): Promise<AuditEvent[]> {
    return runInTenantContext(this.dataSource, tenantId, (manager) =>
      manager.getRepository(AuditEvent).find({
        where: { tenantId, resourceId: caseId },
        order: { createdAt: 'ASC' },
      }),
    );
  }
}
