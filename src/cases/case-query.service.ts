import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EvidenceFact } from '../database/entities/evidence-fact.entity';
import { LoanCondition } from '../database/entities/loan-condition.entity';
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
}
