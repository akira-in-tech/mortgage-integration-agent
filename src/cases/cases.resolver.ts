import { UseGuards } from '@nestjs/common';
import {
  Resolver,
  Query,
  ResolveField,
  Parent,
  Args,
  ID,
} from '@nestjs/graphql';
import { LoanCase } from '../database/entities/loan-case.entity';
import { EvidenceFact } from '../database/entities/evidence-fact.entity';
import { LoanCondition } from '../database/entities/loan-condition.entity';
import { CasesService } from './cases.service';
import { CaseQueryService } from './case-query.service';
import { TimelineEntry } from './case-timeline.service';
import { TenantAuthGuard } from '../auth/tenant-auth.guard';
import { AuthTenantId } from '../auth/auth-tenant-id.decorator';

/**
 * Section 15.2's "GraphQL serves... flexible case, evidence, and timeline
 * querying for the console" (M6) — this codebase's first real resolver for
 * the M2+ target case aggregate; `LoanResolver` (`src/loan/`) is the
 * older, pre-Agent-runtime `evaluateLoan` one-shot path and stays
 * untouched. `TenantAuthGuard` (M5-024) gates this resolver exactly like
 * `CasesController` gates the equivalent REST routes — a human's real
 * OIDC session or a machine's `api_client` credential, either one, same
 * tenant-scoping guarantee: `AuthTenantId()` always resolves the tenant
 * from the caller's own credential, never from a client-suppliable
 * argument, so there is no `tenantId` field on this query to get right or
 * wrong. Evidence/conditions/timeline are `@ResolveField()`s rather than
 * eagerly joined onto the top-level query — a GraphQL client that only
 * asks for `{ id status }` triggers none of those extra reads.
 */
@Resolver(() => LoanCase)
@UseGuards(TenantAuthGuard)
export class CasesResolver {
  constructor(
    private readonly casesService: CasesService,
    private readonly caseQueryService: CaseQueryService,
  ) {}

  @Query(() => LoanCase, {
    name: 'case',
    description: 'Get a loan case by id (Section 15.2).',
  })
  async case(
    @AuthTenantId() tenantId: string,
    @Args('caseId', { type: () => ID }) caseId: string,
  ): Promise<LoanCase> {
    return this.casesService.getCase(tenantId, caseId);
  }

  @ResolveField(() => [EvidenceFact], {
    description: "The case's own evidence facts (Section 14.1).",
  })
  async evidenceFacts(@Parent() loanCase: LoanCase): Promise<EvidenceFact[]> {
    return this.caseQueryService.listEvidenceFacts(
      loanCase.tenantId,
      loanCase.id,
    );
  }

  @ResolveField(() => [LoanCondition], {
    description: "The case's own operational conditions (Section 14.1).",
  })
  async conditions(@Parent() loanCase: LoanCase): Promise<LoanCondition[]> {
    return this.caseQueryService.listConditions(loanCase.tenantId, loanCase.id);
  }

  @ResolveField(() => [TimelineEntry], {
    description:
      "The case's own chronological domain-event/Agent-run timeline (Section 7.1).",
  })
  async timeline(@Parent() loanCase: LoanCase): Promise<TimelineEntry[]> {
    return this.casesService.getTimeline(loanCase.tenantId, loanCase.id);
  }
}
