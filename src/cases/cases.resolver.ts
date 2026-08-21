import { UseGuards } from '@nestjs/common';
import {
  Resolver,
  Query,
  Mutation,
  ResolveField,
  Parent,
  Args,
  ID,
  Int,
} from '@nestjs/graphql';
import { LoanCase, CaseStatus } from '../database/entities/loan-case.entity';
import { EvidenceFact } from '../database/entities/evidence-fact.entity';
import { LoanCondition } from '../database/entities/loan-condition.entity';
import { CasePolicyBinding } from '../database/entities/case-policy-binding.entity';
import { CasePolicySnapshot } from '../database/entities/case-policy-snapshot.entity';
import { ProviderOperationIntent } from '../database/entities/provider-operation-intent.entity';
import { AuditEvent } from '../database/entities/audit-event.entity';
import { ConsentRecord } from '../database/entities/consent-record.entity';
import { CaseConnection } from './case-connection.model';
import { PolicyChangeImpactResult } from './policy-change-impact-result.model';
import { CasesService, StartWorkflowRunResult } from './cases.service';
import { CaseQueryService } from './case-query.service';
import { TimelineEntry } from './case-timeline.service';
import { ReviewDto } from './dto/review.dto';
import { ConsentActionDto } from './dto/consent-action.dto';
import { EscalateDto } from './dto/escalate.dto';
import { CheckPolicyChangeImpactDto } from './dto/check-policy-change-impact.dto';
import { TenantAuthGuard } from '../auth/tenant-auth.guard';
import { AuthTenantId } from '../auth/auth-tenant-id.decorator';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { AuthContext } from '../auth/auth-context';
import { RoleGuard } from '../auth/role.guard';
import { RequireRole } from '../auth/require-role.decorator';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { AuditEventService } from '../audit/audit-event.service';

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
    private readonly auditEventService: AuditEventService,
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

  @Query(() => CaseConnection, {
    name: 'cases',
    description:
      "The tenant's own cases, cursor-paginated newest first, with optional status/borrowerId filtering (Section 15.2/15.3).",
  })
  async cases(
    @AuthTenantId() tenantId: string,
    @Args('status', { type: () => CaseStatus, nullable: true })
    status?: CaseStatus,
    @Args('borrowerId', { nullable: true }) borrowerId?: string,
    @Args('first', { type: () => Int, nullable: true }) first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<CaseConnection> {
    return this.caseQueryService.listCases(tenantId, {
      status,
      borrowerId,
      first,
      after,
    });
  }

  /**
   * Mirrors `CasesController.startWorkflow()` exactly — same service
   * call, idempotent per case (a case with a workflow already running
   * returns that same run rather than starting a second one). No extra
   * audit event: REST's own route doesn't record one for this action
   * either.
   */
  @Mutation(() => StartWorkflowRunResult, {
    name: 'startWorkflowRun',
    description:
      'Start the case-conditions workflow for a case, idempotent per case (Section 15.1).',
  })
  async startWorkflowRun(
    @AuthTenantId() tenantId: string,
    @Args('caseId', { type: () => ID }) caseId: string,
  ): Promise<StartWorkflowRunResult> {
    return this.casesService.startWorkflow(tenantId, caseId);
  }

  /**
   * Mirrors `CasesController.submitReview()` exactly — same service call,
   * same audit-event shape, same `RoleGuard`/`RequireRole(REVIEWER)` gate
   * (Section 6.3, M5-017) on top of the class-level `TenantAuthGuard`.
   * Returns `Boolean` rather than the case: the underlying action is a
   * Temporal signal the workflow applies asynchronously (same as REST's
   * own 202-and-poll), so returning `LoanCase` here would misleadingly
   * imply the review is already reflected in it.
   */
  @Mutation(() => Boolean, {
    name: 'submitReview',
    description:
      'Submit a reviewer decision (condition resolution or evaluation resume). Delivers a signal the workflow applies asynchronously (Section 15.1/9.5).',
  })
  @UseGuards(RoleGuard)
  @RequireRole(ApiClientRole.REVIEWER)
  async submitReview(
    @CurrentAuth() auth: AuthContext,
    @Args('caseId', { type: () => ID }) caseId: string,
    @Args('input', { type: () => ReviewDto }) input: ReviewDto,
  ): Promise<boolean> {
    await this.casesService.submitReview(auth.tenantId, caseId, input);
    await this.auditEventService.record({
      tenantId: auth.tenantId,
      actorId: input.actorId,
      action: `REVIEW_${input.reviewType}`,
      resourceType: 'loan_case',
      resourceId: caseId,
      correlationId: auth.correlationId,
      reason: input.reason ?? null,
      metadata: {
        authenticatedActorId: auth.actorId,
        resolution: input.resolution,
      },
    });
    return true;
  }

  /** Mirrors `CasesController.submitConsentAction()` exactly — same service call, same audit-event shape, synchronous like its REST counterpart. */
  @Mutation(() => ConsentRecord, {
    name: 'submitConsentAction',
    description: 'Grant or revoke consent for a case (Section 15.1/14.2).',
  })
  async submitConsentAction(
    @CurrentAuth() auth: AuthContext,
    @Args('caseId', { type: () => ID }) caseId: string,
    @Args('input', { type: () => ConsentActionDto }) input: ConsentActionDto,
  ): Promise<ConsentRecord> {
    const record = await this.casesService.submitConsentAction(
      auth.tenantId,
      caseId,
      input,
    );
    await this.auditEventService.record({
      tenantId: auth.tenantId,
      actorId: auth.actorId,
      action: `CONSENT_${input.action}`,
      resourceType: 'loan_case',
      resourceId: caseId,
      correlationId: auth.correlationId,
      reason: input.reason ?? null,
      metadata: { consentRecordId: record.id },
    });
    return record;
  }

  /**
   * Mirrors `CasesController.escalate()` — same service call, same
   * audit-event shape. Unlike `submitReview`, escalation is a real
   * synchronous compare-and-swap on the case itself (the REST route's
   * own 200, not 202), so returning the freshly re-read `LoanCase` here
   * is accurate, not a promise of an async outcome — and saves the
   * caller an immediate follow-up `case(caseId)` round trip.
   */
  @Mutation(() => LoanCase, {
    name: 'escalateCase',
    description:
      'Pause a case for human review (escalate_to_reviewer, Section 9.4).',
  })
  async escalateCase(
    @CurrentAuth() auth: AuthContext,
    @Args('caseId', { type: () => ID }) caseId: string,
    @Args('input', { type: () => EscalateDto }) input: EscalateDto,
  ): Promise<LoanCase> {
    await this.casesService.escalate(auth.tenantId, caseId, input);
    await this.auditEventService.record({
      tenantId: auth.tenantId,
      actorId: input.actorId,
      action: 'CASE_ESCALATED',
      resourceType: 'loan_case',
      resourceId: caseId,
      correlationId: auth.correlationId,
      reason: input.reason,
      metadata: { authenticatedActorId: auth.actorId },
    });
    return this.casesService.getCase(auth.tenantId, caseId);
  }

  /**
   * Mirrors `CasesController.checkPolicyChangeImpact()` exactly — same
   * service call. Advisory only (`check_policy_change_impact`'s own
   * approval boundary: "cannot change case applicability"), so no RBAC
   * restriction, matching REST. Still a `Mutation`, not a `Query`: a real
   * `PolicyChangeImpactAssessment` row is persisted as a side effect,
   * the same reason the REST route is a `POST`, not a `GET`.
   */
  @Mutation(() => PolicyChangeImpactResult, {
    name: 'checkPolicyChangeImpact',
    description:
      "Check whether a policy version affects this case's own live binding (Section 9.4/10.6).",
  })
  async checkPolicyChangeImpact(
    @AuthTenantId() tenantId: string,
    @Args('caseId', { type: () => ID }) caseId: string,
    @Args('input', { type: () => CheckPolicyChangeImpactDto })
    input: CheckPolicyChangeImpactDto,
  ): Promise<PolicyChangeImpactResult> {
    return this.casesService.checkPolicyChangeImpact(tenantId, caseId, input);
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
