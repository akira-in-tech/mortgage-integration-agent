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
import { CasePolicyBinding } from '../database/entities/case-policy-binding.entity';
import { CasePolicySnapshot } from '../database/entities/case-policy-snapshot.entity';
import { ProviderOperationIntent } from '../database/entities/provider-operation-intent.entity';
import { AuditEvent } from '../database/entities/audit-event.entity';
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

  @ResolveField(() => CasePolicyBinding, {
    nullable: true,
    description:
      "The case's currently active policy binding (Section 10.4), if any.",
  })
  async policyBinding(
    @Parent() loanCase: LoanCase,
  ): Promise<CasePolicyBinding | null> {
    return this.caseQueryService.getActivePolicyBinding(
      loanCase.tenantId,
      loanCase.id,
    );
  }

  @ResolveField(() => [ProviderOperationIntent], {
    description:
      "The case's own provider-operation-intent history (Section 11.5).",
  })
  async providerOperations(
    @Parent() loanCase: LoanCase,
  ): Promise<ProviderOperationIntent[]> {
    return this.caseQueryService.listProviderOperationIntents(
      loanCase.tenantId,
      loanCase.id,
    );
  }

  @ResolveField(() => [AuditEvent], {
    description:
      "The case's own append-only audit-event history (Section 14.1, M5-019).",
  })
  async auditEvents(@Parent() loanCase: LoanCase): Promise<AuditEvent[]> {
    return this.caseQueryService.listAuditEvents(
      loanCase.tenantId,
      loanCase.id,
    );
  }
}

/**
 * `CasePolicyBinding.policySnapshot` — a lazy nested read, not an eager
 * join, matching every field resolver above's own reasoning. A separate
 * `@Resolver()` class since the parent type differs from `CasesResolver`'s
 * own `LoanCase`; `TenantAuthGuard` still applies (this is only ever
 * reached as a nested field under an already-guarded `case` query).
 */
@Resolver(() => CasePolicyBinding)
@UseGuards(TenantAuthGuard)
export class CasePolicyBindingResolver {
  constructor(private readonly caseQueryService: CaseQueryService) {}

  @ResolveField(() => CasePolicySnapshot, {
    nullable: true,
    description:
      'The immutable resolved-policy snapshot this binding points to.',
  })
  async policySnapshot(
    @Parent() binding: CasePolicyBinding,
  ): Promise<CasePolicySnapshot | null> {
    return this.caseQueryService.getPolicySnapshot(
      binding.tenantId,
      binding.policySnapshotId,
    );
  }
}
