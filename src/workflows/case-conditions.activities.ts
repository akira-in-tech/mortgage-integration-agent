import { DataSource, EntityManager } from 'typeorm';
import { ApplicationFailure } from '@temporalio/activity';
import { PlaidIncomeData } from '../integrations/plaid/plaid.types';
import { CreditBureauData } from '../integrations/credit/credit.types';
import { DocumentVerificationResult } from '../integrations/document/document.types';
import {
  SyntheticProviderTimeoutError,
  SyntheticProviderRejectionError,
} from '../integrations/synthetic-provider-failures';
import { LoanCase, CaseStatus } from '../database/entities/loan-case.entity';
import { Tenant } from '../database/entities/tenant.entity';
import {
  EvidenceFact,
  EvidenceType,
  EvidenceSourceKind,
} from '../database/entities/evidence-fact.entity';
import {
  LoanCondition,
  ConditionStatus,
} from '../database/entities/loan-condition.entity';
import { ConditionTransition } from '../database/entities/condition-transition.entity';
import { ConditionResolutionKind } from './case-conditions.signals';
import { writeOutboxEvent } from '../database/outbox/outbox-writer';
import { OutboxEventType } from '../database/outbox/outbox-event-types';
import { PolicyEvaluationService } from '../policy/policy-evaluation.service';
import { EvaluationManifestService } from '../policy/evaluation-manifest.service';
import { createLendingOperationsAgentRuntime } from '../agent-runtime/langgraph/lending-operations-agent-runtime';
import { LendingOperationsAgentState } from '../agent-runtime/agent-state.types';
import { StaleCaseVersionError } from '../agent-runtime/tools/create-condition.tool';
import { AgentPlannerPort } from '../agent-runtime/agent-planner';
import { ProviderRegistryService } from '../provider-platform/provider-registry.service';
import { ProviderAuthorizationService } from '../provider-platform/provider-authorization.service';
import { ProviderOperationIntentService } from '../provider-platform/provider-operation-intent.service';
import { ProviderKillSwitchService } from '../provider-platform/provider-kill-switch.service';
import { ProviderPromotionService } from '../provider-platform/provider-promotion.service';
import {
  dispatchProviderRequest,
  ProviderIntentConflictError,
  ProviderIntentReplayBlockedError,
  ProviderRevalidationError,
  ProviderDisabledError,
  ProviderConsentScopeError,
  PermissiblePurposeError,
} from '../provider-platform/dispatch-provider-request';
import { ProviderCapability } from '../provider-platform/types';
import { runInTenantContext } from '../database/tenant-context';
import { ConsentService } from '../consent/consent.service';
import { PermissiblePurposeService } from '../provider-platform/permissible-purpose.service';
import { CommunicationMessageService } from '../communications/communication-message.service';
import { CommunicationDeliveryService } from '../communications/communication-delivery.service';
import { CommunicationTemplate } from '../database/entities/communication-template.entity';
import { CommunicationTemplateStatus } from '../database/enums/communication.enum';
import {
  draftInformationRequestTool,
  DraftInformationRequestResult,
} from '../agent-runtime/tools/draft-information-request.tool';
import {
  sendInformationRequestTool,
  SendInformationRequestArgs,
} from '../agent-runtime/tools/send-information-request.tool';
import {
  buildToolRegistry,
  invokeTool,
} from '../agent-runtime/agent-tool.types';
import {
  READY_FOR_UNDERWRITING_TEMPLATE_KEY,
  READY_FOR_UNDERWRITING_TEMPLATE_VERSION,
} from '../communications/well-known-templates';

export interface CaseConditionsActivitiesDeps {
  dataSource: DataSource;
  policyEvaluationService: PolicyEvaluationService;
  evaluationManifestService: EvaluationManifestService;
  providerRegistry: ProviderRegistryService;
  providerAuthorizationService: ProviderAuthorizationService;
  providerOperationIntentService: ProviderOperationIntentService;
  providerKillSwitchService: ProviderKillSwitchService;
  providerPromotionService: ProviderPromotionService;
  consentService: ConsentService;
  permissiblePurposeService?: PermissiblePurposeService;
  messageService: CommunicationMessageService;
  communicationDeliveryService: CommunicationDeliveryService;
  /** HMAC secret for outbox event signing (Section 15.3). */
  outboxSigningSecret: string;
  /** Optional local model router; omitted keeps the deterministic graph. */
  agentPlanner?: AgentPlannerPort;
}

interface CaseRef {
  tenantId: string;
  caseId: string;
}

interface EvaluateConditionsInput extends CaseRef {
  /** Sourced from `workflowInfo().runId` in the workflow — correlates this Agent run to its Temporal workflow run (Section 9.3). Threaded in explicitly rather than read via `activityInfo()` here, so this activity behaves identically whether invoked through a real Temporal worker or called directly, as case-conditions.activities.spec.ts does. */
  workflowRunId: string;
}

interface EvaluateConditionsResult {
  /**
   * `INTERRUPTED` (Section 9.5: "ambiguity... interrupt for review") is
   * distinct from `REVIEW_REQUIRED`: the latter never happens from a
   * real Agent run today (see `evaluateConditions` below), the former is
   * this activity's actual mapping of `AgentRunRoute`'s
   * `INTERRUPTED_FOR_REVIEW` — a reviewer can address the ambiguity and
   * signal the workflow to resume, rather than the case being routed
   * straight to `MANUAL_REVIEW`.
   */
  outcome: 'READY' | 'CONDITION_OPENED' | 'REVIEW_REQUIRED' | 'INTERRUPTED';
  conditionId?: string;
  reviewReason?: string;
}

// Comfortably inside case-conditions.workflow.ts's 30s activity
// startToCloseTimeout, so the Agent run's own trusted deadline can never
// legitimately outlive Temporal's activity timeout — the two budgets
// don't compete, the inner one is strictly the tighter constraint.
// Platform defaults — a tenant's own Tenant.agentRunStepBudgetOverride/
// agentRunDurationBudgetMsOverride (M5-021) take precedence when set;
// see resolveAgentRunBudget() below.
const DEFAULT_AGENT_RUN_STEP_BUDGET = 10;
const DEFAULT_AGENT_RUN_DURATION_BUDGET_MS = 20_000;

/** M5-021: Section 20 M5's "tenant-owned... budget configuration" — see `Tenant`'s own class comment for the full scope reasoning. A tenant with no override (the common case) behaves identically to every tenant before this migration. */
function resolveAgentRunBudget(tenant: Tenant): {
  stepBudget: number;
  durationBudgetMs: number;
} {
  return {
    stepBudget:
      tenant.agentRunStepBudgetOverride ?? DEFAULT_AGENT_RUN_STEP_BUDGET,
    durationBudgetMs:
      tenant.agentRunDurationBudgetMsOverride ??
      DEFAULT_AGENT_RUN_DURATION_BUDGET_MS,
  };
}
const AGENT_ALLOWED_TOOLS = [
  'check_case_completeness',
  'evaluate_policy',
  'create_condition',
  'draft_information_request',
];

interface ResolveConditionInput extends CaseRef {
  conditionId: string;
  actorId: string;
  resolution: ConditionResolutionKind;
  reason?: string;
}

/**
 * Retry-classification boundary (M2 scope: "retry classification"): calls
 * a provider simulator and reinterprets whatever it throws as an
 * ApplicationFailure with an explicit retry decision. `ApplicationFailure
 * .nonRetryable()` forces Temporal to stop after this attempt regardless
 * of the workflow's retry policy, so a terminal synthetic failure never
 * wastes the configured 3 attempts the way a transient one legitimately
 * does. No real provider integration exists yet to observe genuine
 * failure modes from (see synthetic-provider-failures.ts) — an
 * unrecognized error is left untouched rather than guessed at.
 */
async function callProviderWithRetryClassification<T>(
  fn: () => Promise<T>,
  providerName: string,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof SyntheticProviderRejectionError) {
      throw ApplicationFailure.nonRetryable(
        error.message,
        'TerminalProviderFailure',
        providerName,
      );
    }
    if (error instanceof SyntheticProviderTimeoutError) {
      throw ApplicationFailure.retryable(
        error.message,
        'TransientProviderFailure',
        providerName,
      );
    }
    if (
      error instanceof ProviderRevalidationError ||
      error instanceof ProviderConsentScopeError ||
      error instanceof PermissiblePurposeError
    ) {
      // A mismatched, expired, revoked, or (M5-005) consent-invalidated
      // grant — retrying the identical request can never fix any of
      // these, so this is unconditionally non-retryable, the same
      // reasoning as a terminal synthetic provider rejection above.
      throw ApplicationFailure.nonRetryable(
        error.message,
        'ProviderAuthorizationRevalidationFailed',
        providerName,
      );
    }
    if (
      error instanceof ProviderIntentConflictError ||
      error instanceof ProviderIntentReplayBlockedError
    ) {
      throw ApplicationFailure.nonRetryable(
        error.message,
        error.name,
        providerName,
      );
    }
    if (error instanceof ProviderDisabledError) {
      // Section 11.4's kill switch (M4-006) — an operator's own
      // deliberate action, unlikely to flip back within this activity's
      // few-second retry window. Same "retrying can never fix this
      // attempt" reasoning as ProviderRevalidationError above, so this
      // routes straight to manual review rather than burning Temporal's
      // configured retry budget against a provider an operator
      // intentionally turned off.
      throw ApplicationFailure.nonRetryable(
        error.message,
        'ProviderDisabled',
        providerName,
      );
    }
    throw error;
  }
}

/**
 * Activities run outside the deterministic workflow sandbox — this is
 * where all I/O (database writes, simulator calls) actually happens. All
 * three evidence-fetch activities (income, credit, document — M4-002)
 * dispatch through the real provider-platform registry
 * (`dispatch-provider-request.ts`) rather than calling a simulator
 * service directly: each capability's `ProviderAdapter` (in
 * `src/integrations/`) wraps the same simulator logic the older
 * `evaluateLoan` path (`src/agent/agent.service.ts`) still calls
 * directly, unchanged.
 *
 * Every domain write below runs inside `runInTenantContext()` (M5-004) —
 * a `dataSource.transaction()` that also sets this activity's own
 * tenantId as the session's RLS context, alongside the outbox event(s)
 * it produces, so a committed state change and its event can never
 * diverge (Section 9.5: "COMMIT STATE AND OUTBOX EVENT"; M2 scope:
 * "transactional outbox and signed status event foundation") and can
 * never touch a row RLS on `loan_cases`/`evidence_facts`/
 * `outbox_events`/`condition_transitions` would reject.
 */
export function createCaseConditionsActivities(
  deps: CaseConditionsActivitiesDeps,
) {
  const {
    dataSource,
    policyEvaluationService,
    evaluationManifestService,
    providerRegistry,
    providerAuthorizationService,
    providerOperationIntentService,
    providerKillSwitchService,
    providerPromotionService,
    consentService,
    permissiblePurposeService,
    messageService,
    communicationDeliveryService,
    outboxSigningSecret,
    agentPlanner,
  } = deps;
  const providerDispatchDeps = {
    registry: providerRegistry,
    authorizationService: providerAuthorizationService,
    intentService: providerOperationIntentService,
    killSwitchService: providerKillSwitchService,
    promotionService: providerPromotionService,
    consentService,
    permissiblePurposeService:
      permissiblePurposeService ?? new PermissiblePurposeService(dataSource),
  };

  // M3-024: the real, registered-tool-invoking (not a bypass) path
  // `finalizeReadyForUnderwriting` below uses to draft-then-send a
  // ROUTINE "your case reached underwriting review" notice — opt-in per
  // tenant (see sendReadyForUnderwritingNotification's own up-front
  // template check) and never blocks the case's own real
  // READY_FOR_UNDERWRITING transition even when something here fails.
  const readyNotificationTools = buildToolRegistry([
    draftInformationRequestTool({ messageService }),
    sendInformationRequestTool({ communicationDeliveryService }),
  ]);

  async function sendReadyForUnderwritingNotification(
    tenantId: string,
    caseId: string,
  ): Promise<void> {
    try {
      // Checked up front, not just left to classifyCommunication's own
      // fail-closed default: a tenant that never ran `npm run
      // seed-communication-template` shouldn't get a permanent, empty,
      // never-approvable CommunicationMessage row for every single case
      // that reaches READY — this mechanism is opt-in per tenant, and an
      // unseeded tenant should see zero trace of it, not silent noise.
      const hasApprovedTemplate = await runInTenantContext(
        dataSource,
        tenantId,
        (manager) =>
          manager.getRepository(CommunicationTemplate).findOneBy({
            tenantId,
            templateKey: READY_FOR_UNDERWRITING_TEMPLATE_KEY,
            version: READY_FOR_UNDERWRITING_TEMPLATE_VERSION,
            status: CommunicationTemplateStatus.APPROVED,
          }),
      );
      if (!hasApprovedTemplate) {
        return;
      }

      const draftInvocation = await invokeTool(
        readyNotificationTools,
        'draft_information_request',
        { tenantId, caseId },
        {
          recipientRelationship: 'BORROWER',
          channel: 'EMAIL',
          locale: 'en-US',
          templateKey: READY_FOR_UNDERWRITING_TEMPLATE_KEY,
          templateVersion: READY_FOR_UNDERWRITING_TEMPLATE_VERSION,
          variables: { caseId },
          hasAttachments: false,
        },
      );
      if (draftInvocation.outcome === 'FAILURE') {
        console.error(
          `readyForUnderwriting notification draft failed [caseId=${caseId}]: ${draftInvocation.error}`,
        );
        return;
      }
      const drafted = draftInvocation.result as DraftInformationRequestResult;
      const sendInvocation = await invokeTool(
        readyNotificationTools,
        'send_information_request',
        { tenantId, caseId },
        {
          communicationMessageId: drafted.communicationMessageId,
        } satisfies SendInformationRequestArgs,
      );
      if (sendInvocation.outcome === 'FAILURE') {
        console.error(
          `readyForUnderwriting notification send failed [caseId=${caseId}]: ${sendInvocation.error}`,
        );
      }
      // NOT_READY here (rather than a FAILURE) would mean
      // classifyCommunication found some other real reason to stay
      // PROTECTED despite the approved template existing (e.g. Section
      // 6.4's negative-implication guard) — not logged as an error,
      // since that's the classifier correctly doing its job, not a bug.
    } catch (error) {
      // A routine notification's own failure must never block the case's
      // real, already-committed READY_FOR_UNDERWRITING transition — the
      // same "audit logging can't break the action it describes"
      // reasoning AuditEventService.record() already uses.
      console.error(
        `readyForUnderwriting notification threw [caseId=${caseId}]: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const agentRuntime = createLendingOperationsAgentRuntime({
    dataSource,
    policyEvaluationService,
    evaluationManifestService,
    messageService,
    outboxSigningSecret,
    agentPlanner,
  });

  async function finalizeReadyForUnderwriting(
    manager: EntityManager,
    {
      tenantId,
      caseId,
      expectedCaseVersion,
    }: CaseRef & { expectedCaseVersion?: number },
  ): Promise<void> {
    const criteria: Record<string, unknown> = { id: caseId, tenantId };
    if (expectedCaseVersion !== undefined) {
      criteria.version = expectedCaseVersion;
    }
    const updateResult = await manager
      .getRepository(LoanCase)
      .update(criteria, { status: CaseStatus.READY_FOR_UNDERWRITING });
    if (expectedCaseVersion !== undefined && updateResult.affected === 0) {
      // Section 10.5: the case changed since the evaluation that decided
      // it was ready began. Throwing (not silently marking it ready
      // anyway) lets Temporal's activity retry re-run evaluateConditions
      // against the case's current state instead.
      throw new StaleCaseVersionError(caseId, expectedCaseVersion);
    }
    await writeOutboxEvent(manager, outboxSigningSecret, {
      tenantId,
      caseId,
      eventType: OutboxEventType.WorkflowRunCompleted,
      payload: { caseId, finalStatus: CaseStatus.READY_FOR_UNDERWRITING },
    });
  }

  async function recordEvidence(
    manager: EntityManager,
    params: CaseRef & {
      factType: EvidenceType;
      sourceIdentifier: string;
      value: Record<string, unknown>;
    },
  ): Promise<void> {
    const evidenceRepo = manager.getRepository(EvidenceFact);
    await evidenceRepo.save(
      evidenceRepo.create({
        tenantId: params.tenantId,
        caseId: params.caseId,
        factType: params.factType,
        sourceKind: EvidenceSourceKind.SIMULATOR,
        sourceIdentifier: params.sourceIdentifier,
        value: params.value,
        observedAt: new Date(),
      }),
    );
    await writeOutboxEvent(manager, outboxSigningSecret, {
      tenantId: params.tenantId,
      caseId: params.caseId,
      eventType: OutboxEventType.EvidenceUpdated,
      payload: {
        caseId: params.caseId,
        evidenceType: params.factType,
        sourceIdentifier: params.sourceIdentifier,
      },
    });
  }

  return {
    async markCollectingEvidence({ tenantId, caseId }: CaseRef): Promise<void> {
      await runInTenantContext(dataSource, tenantId, async (manager) => {
        await manager
          .getRepository(LoanCase)
          .update(
            { id: caseId, tenantId },
            { status: CaseStatus.COLLECTING_EVIDENCE },
          );
        await writeOutboxEvent(manager, outboxSigningSecret, {
          tenantId,
          caseId,
          eventType: OutboxEventType.WorkflowRunStarted,
          payload: { caseId },
        });
      });
    },

    async fetchIncomeEvidence({
      tenantId,
      caseId,
      borrowerId,
    }: CaseRef & { borrowerId: string }): Promise<PlaidIncomeData> {
      const income = await callProviderWithRetryClassification(
        () =>
          dispatchProviderRequest<PlaidIncomeData>(providerDispatchDeps, {
            tenantId,
            caseId,
            borrowerSubjectId: borrowerId,
            capability: ProviderCapability.INCOME,
            request: { borrowerId },
            purposeCode: 'UNDERWRITING_EVIDENCE',
            permittedDataClasses: ['INCOME'],
          }),
        'plaid-simulator',
      );
      await runInTenantContext(dataSource, tenantId, (manager) =>
        recordEvidence(manager, {
          tenantId,
          caseId,
          factType: EvidenceType.INCOME,
          sourceIdentifier: 'plaid-simulator',
          value: income as unknown as Record<string, unknown>,
        }),
      );
      return income;
    },

    async fetchCreditEvidence({
      tenantId,
      caseId,
      borrowerId,
    }: CaseRef & { borrowerId: string }): Promise<CreditBureauData> {
      const credit = await callProviderWithRetryClassification(
        () =>
          dispatchProviderRequest<CreditBureauData>(providerDispatchDeps, {
            tenantId,
            caseId,
            borrowerSubjectId: borrowerId,
            capability: ProviderCapability.CREDIT,
            request: { borrowerId },
            purposeCode: 'UNDERWRITING_EVIDENCE',
            permittedDataClasses: ['CREDIT'],
          }),
        'credit-bureau-simulator',
      );
      await runInTenantContext(dataSource, tenantId, (manager) =>
        recordEvidence(manager, {
          tenantId,
          caseId,
          factType: EvidenceType.CREDIT,
          sourceIdentifier: 'credit-bureau-simulator',
          value: credit as unknown as Record<string, unknown>,
        }),
      );
      return credit;
    },

    async fetchDocumentEvidence({
      tenantId,
      caseId,
      borrowerId,
    }: CaseRef & { borrowerId: string }): Promise<DocumentVerificationResult> {
      const documents = await callProviderWithRetryClassification(
        () =>
          dispatchProviderRequest<DocumentVerificationResult>(
            providerDispatchDeps,
            {
              tenantId,
              caseId,
              borrowerSubjectId: borrowerId,
              capability: ProviderCapability.DOCUMENT,
              request: { borrowerId },
              purposeCode: 'UNDERWRITING_EVIDENCE',
              permittedDataClasses: ['DOCUMENT'],
            },
          ),
        'document-verification-simulator',
      );
      await runInTenantContext(dataSource, tenantId, (manager) =>
        recordEvidence(manager, {
          tenantId,
          caseId,
          factType: EvidenceType.DOCUMENT,
          sourceIdentifier: 'document-verification-simulator',
          value: documents as unknown as Record<string, unknown>,
        }),
      );
      return documents;
    },

    /**
     * Runs a bounded Agent run (Section 9.2/9.5) through the LangGraph.js
     * runtime (`src/agent-runtime/langgraph/`) instead of calling the
     * policy engine and condition tool directly — the runtime's own three
     * nodes do exactly what this activity used to do inline (check
     * completeness, request a guarded policy evaluation, evaluate the
     * matched rule against real evidence and open a condition on a
     * match), now exercised through the same tool-registry contract a
     * future non-deterministic Agent run will use too. An unresolved
     * policy binding (Section 10.3: `REVIEW_REQUIRED` — missing coverage,
     * overlapping versions) routes to manual review rather than silently
     * treating the case as clean.
     */
    async evaluateConditions({
      tenantId,
      caseId,
      workflowRunId,
    }: EvaluateConditionsInput): Promise<EvaluateConditionsResult> {
      const loanCase = await runInTenantContext(
        dataSource,
        tenantId,
        (manager) =>
          manager
            .getRepository(LoanCase)
            .findOneByOrFail({ id: caseId, tenantId }),
      );
      // M5-005: real consent status, no longer a hardcoded 'VALID' —
      // this is what finally makes the LangGraph runtime's verifyConsent
      // node (built in M3-009, wired as the graph's first step) able to
      // genuinely route a revoked/expired/missing-consent case to manual
      // review instead of always seeing a placeholder that could never
      // fail.
      const consentStatus = await consentService.getStatus(tenantId, caseId);

      // M5-021: tenants isn't RLS-protected (it's the tenant boundary
      // other tables' policies reference, not data scoped to one) — a
      // plain read, no runInTenantContext needed, matching every other
      // reference to this table in this codebase.
      const tenant = await dataSource
        .getRepository(Tenant)
        .findOneByOrFail({ id: tenantId });
      const { stepBudget, durationBudgetMs } = resolveAgentRunBudget(tenant);

      const now = new Date();
      const runDeadlineAt = new Date(
        now.getTime() + durationBudgetMs,
      ).toISOString();
      const initialState: LendingOperationsAgentState = {
        tenantId,
        caseId,
        caseVersion: loanCase.version,
        workflowRunId,
        workflowStatus: loanCase.status,
        consentStatus,
        evidenceSummary: [],
        openConditions: [],
        providerHealth: [],
        attemptedTools: [],
        remainingStepBudget: stepBudget,
        remainingDurationBudgetMs: durationBudgetMs,
        remainingTokenBudget: agentPlanner?.tokenBudgetUnits ?? 0,
        remainingProviderCallBudget: 0, // its tools make no outbound provider calls; evidence was already fetched by earlier workflow activities
        budgetCurrency: 'USD',
        remainingCostBudgetMinorUnits: 0, // all providers are synthetic; no real cost is ever incurred
        budgetLedgerVersion: 1,
        runStartedAt: now.toISOString(),
        runDeadlineAt,
      };

      const result = await agentRuntime.run({
        initialState,
        allowedTools: AGENT_ALLOWED_TOOLS,
        budget: {
          stepBudget,
          durationBudgetMs,
          tokenBudget: agentPlanner?.tokenBudgetUnits ?? 0,
          providerCallBudget: 0,
          costBudgetMinorUnits: 0,
          currency: 'USD',
        },
        runDeadlineAt,
      });

      switch (result.route) {
        case 'PROPOSED_ACTION': {
          const conditionId = result.finalState.proposedAction?.arguments
            .conditionId as string | undefined;
          if (conditionId) {
            return { outcome: 'CONDITION_OPENED', conditionId };
          }
          await runInTenantContext(dataSource, tenantId, (manager) =>
            finalizeReadyForUnderwriting(manager, {
              tenantId,
              caseId,
              expectedCaseVersion: initialState.caseVersion,
            }),
          );
          await sendReadyForUnderwritingNotification(tenantId, caseId);
          return { outcome: 'READY' };
        }
        case 'ROUTED_TO_MANUAL_REVIEW':
          return {
            outcome: 'REVIEW_REQUIRED',
            reviewReason:
              result.finalState.reviewState?.reason ??
              'agent run routed to manual review',
          };
        case 'INTERRUPTED_FOR_REVIEW':
          return {
            outcome: 'INTERRUPTED',
            reviewReason:
              result.finalState.reviewState?.reason ??
              'ambiguity requires review',
          };
        case 'AWAITING_INFORMATION':
          // Not reachable here today: the workflow always fetches all
          // three evidence types before calling this activity. Fail
          // closed rather than silently treat an unexpected route as
          // readiness.
          return {
            outcome: 'REVIEW_REQUIRED',
            reviewReason: `unexpected Agent run route "${result.route}"`,
          };
      }
    },

    async resolveCondition({
      tenantId,
      caseId,
      conditionId,
      actorId,
      resolution,
      reason,
    }: ResolveConditionInput): Promise<void> {
      const toStatus =
        resolution === 'SATISFIED'
          ? ConditionStatus.SATISFIED
          : ConditionStatus.WAIVED;

      await runInTenantContext(dataSource, tenantId, async (manager) => {
        const conditionRepo = manager.getRepository(LoanCondition);
        const condition = await conditionRepo.findOneByOrFail({
          id: conditionId,
        });
        await conditionRepo.update({ id: conditionId }, { status: toStatus });
        await manager.getRepository(ConditionTransition).save(
          manager.getRepository(ConditionTransition).create({
            conditionId,
            fromStatus: condition.status,
            toStatus,
            actorId,
            reason: reason ?? null,
          }),
        );
        await writeOutboxEvent(manager, outboxSigningSecret, {
          tenantId,
          caseId,
          eventType:
            resolution === 'SATISFIED'
              ? OutboxEventType.ConditionSatisfied
              : OutboxEventType.ConditionWaived,
          payload: {
            caseId,
            conditionId,
            actorId,
            resolution,
            reason: reason ?? null,
          },
        });
      });
    },

    async markReadyForUnderwriting({
      tenantId,
      caseId,
    }: CaseRef): Promise<void> {
      await runInTenantContext(dataSource, tenantId, (manager) =>
        finalizeReadyForUnderwriting(manager, { tenantId, caseId }),
      );
      await sendReadyForUnderwritingNotification(tenantId, caseId);
    },

    /**
     * Section 9.5: "ambiguity... interrupt for review" — the case genuinely
     * pauses here (`WAITING_FOR_REVIEW`, distinct from `MANUAL_REVIEW`'s
     * "cannot proceed safely within the configured automation boundary")
     * until a reviewer signals `resumeInterruptedEvaluationSignal`, at
     * which point the workflow re-runs `evaluateConditions` from scratch.
     */
    async markWaitingForReview({
      tenantId,
      caseId,
      reason,
    }: CaseRef & { reason: string }): Promise<void> {
      await runInTenantContext(dataSource, tenantId, async (manager) => {
        await manager
          .getRepository(LoanCase)
          .update(
            { id: caseId, tenantId },
            { status: CaseStatus.WAITING_FOR_REVIEW },
          );
        await writeOutboxEvent(manager, outboxSigningSecret, {
          tenantId,
          caseId,
          eventType: OutboxEventType.EvaluationInterrupted,
          payload: { caseId, reason },
        });
      });
    },

    /**
     * Escape hatch for an unrecoverable activity failure (evidence
     * fetching exhausted its retries, or hit a terminal provider error) —
     * mirrors Section 9.5's "budget or runtime failure: route to manual
     * review" Agent-loop pattern at the workflow level. `reason` is the
     * classified failure's message, safe to log verbatim since it never
     * contains borrower data (see synthetic-provider-failures.ts).
     */
    async markManualReview({
      tenantId,
      caseId,
      reason,
    }: CaseRef & { reason: string }): Promise<void> {
      await runInTenantContext(dataSource, tenantId, async (manager) => {
        await manager
          .getRepository(LoanCase)
          .update(
            { id: caseId, tenantId },
            { status: CaseStatus.MANUAL_REVIEW },
          );
        await writeOutboxEvent(manager, outboxSigningSecret, {
          tenantId,
          caseId,
          eventType: OutboxEventType.WorkflowRunFailed,
          payload: { caseId, reason },
        });
      });
    },
  };
}

export type CaseConditionsActivities = ReturnType<
  typeof createCaseConditionsActivities
>;
