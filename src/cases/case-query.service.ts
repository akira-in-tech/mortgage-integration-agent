import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';
import { LoanCase, CaseStatus } from '../database/entities/loan-case.entity';
import { EvidenceFact } from '../database/entities/evidence-fact.entity';
import { LoanCondition } from '../database/entities/loan-condition.entity';
import { CasePolicyBinding } from '../database/entities/case-policy-binding.entity';
import { CasePolicySnapshot } from '../database/entities/case-policy-snapshot.entity';
import { ProviderOperationIntent } from '../database/entities/provider-operation-intent.entity';
import { AuditEvent } from '../database/entities/audit-event.entity';
import { runInTenantContext } from '../database/tenant-context';
import { CaseConnection } from './case-connection.model';
import { CaseStatusCount } from './case-status-count.model';
import { encodeCaseCursor, decodeCaseCursor } from './case-cursor';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export interface ListCasesOptions {
  status?: CaseStatus;
  borrowerId?: string;
  first?: number;
  after?: string;
}

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

  /** `cases(status?, borrowerId?, first?, after?)` (Section 15.2/15.3) — keyset-paginated over `(createdAt, id)` DESC (newest first), not `OFFSET`: stable under concurrent inserts and doesn't degrade as the offset grows. Fetches one extra row to determine `hasNextPage` without a separate `COUNT` query. */
  async listCases(
    tenantId: string,
    options: ListCasesOptions = {},
  ): Promise<CaseConnection> {
    const pageSize = Math.min(
      Math.max(options.first ?? DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE,
    );
    return runInTenantContext(this.dataSource, tenantId, async (manager) => {
      const qb = manager
        .getRepository(LoanCase)
        .createQueryBuilder('c')
        .where('c.tenantId = :tenantId', { tenantId })
        .orderBy('c.createdAt', 'DESC')
        .addOrderBy('c.id', 'DESC')
        .take(pageSize + 1);

      if (options.status) {
        qb.andWhere('c.status = :status', { status: options.status });
      }
      if (options.borrowerId) {
        qb.andWhere('c.borrowerId = :borrowerId', {
          borrowerId: options.borrowerId,
        });
      }
      if (options.after) {
        const cursor = decodeCaseCursor(options.after);
        qb.andWhere(
          '(c."createdAt" < :cursorCreatedAt OR (c."createdAt" = :cursorCreatedAt AND c.id < :cursorId))',
          { cursorCreatedAt: cursor.createdAt, cursorId: cursor.id },
        );
      }

      const rows = await qb.getMany();
      const hasNextPage = rows.length > pageSize;
      const page = hasNextPage ? rows.slice(0, pageSize) : rows;
      const edges = page.map((node) => ({
        node,
        cursor: encodeCaseCursor({ createdAt: node.createdAt, id: node.id }),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
        },
      };
    });
  }

  /** `caseStatusCounts` (Section 15.2, M6) — the tenant's real case count per status, via a `GROUP BY` rather than one `COUNT` query per status. A status with zero real cases is simply absent, not a fabricated `{status, count: 0}` row. */
  async countCasesByStatus(tenantId: string): Promise<CaseStatusCount[]> {
    return runInTenantContext(this.dataSource, tenantId, async (manager) => {
      const rows = await manager
        .getRepository(LoanCase)
        .createQueryBuilder('c')
        .select('c.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('c.tenantId = :tenantId', { tenantId })
        .groupBy('c.status')
        .getRawMany<{ status: CaseStatus; count: string }>();

      return rows.map((row) => ({
        status: row.status,
        count: Number(row.count),
      }));
    });
  }

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

  /**
   * `recentActivity` (Section 14.1/15.2, M6) — the tenant's own audit
   * events across every case, newest first, for a console activity feed
   * ("Live Stream"). Real, near-live via polling, not a fabricated
   * WebSocket push this codebase has no subsystem for: the same honest
   * "live" this console's Ops Dashboard already settled on
   * (`pollInterval`). Cheap and indexed —
   * `IDX_audit_events_tenant_created` (`tenantId`, `createdAt`) already
   * exists for exactly this shape of query, added at M5-019 before any
   * read surface consumed it.
   */
  async listRecentActivity(
    tenantId: string,
    limit?: number,
  ): Promise<AuditEvent[]> {
    const pageSize = Math.min(Math.max(limit ?? 20, 1), 100);
    return runInTenantContext(this.dataSource, tenantId, (manager) =>
      manager.getRepository(AuditEvent).find({
        where: { tenantId },
        order: { createdAt: 'DESC' },
        take: pageSize,
      }),
    );
  }
}
