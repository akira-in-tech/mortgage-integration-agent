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
import { ProviderRegistryService } from '../provider-platform/provider-registry.service';
import { ProviderAuthorizationService } from '../provider-platform/provider-authorization.service';
import { ProviderOperationIntentService } from '../provider-platform/provider-operation-intent.service';
import {
  dispatchProviderRequest,
  ProviderRevalidationError,
} from '../provider-platform/dispatch-provider-request';
import { ProviderCapability } from '../provider-platform/types';
import { runInTenantContext } from '../database/tenant-context';
import { ConsentService } from '../consent/consent.service';

export interface CaseConditionsActivitiesDeps {
  dataSource: DataSource;
  policyEvaluationService: PolicyEvaluationService;
  evaluationManifestService: EvaluationManifestService;
  providerRegistry: ProviderRegistryService;
  providerAuthorizationService: ProviderAuthorizationService;
  providerOperationIntentService: ProviderOperationIntentService;
  consentService: ConsentService;
  /** HMAC secret for outbox event signing (Section 15.3). */
  outboxSigningSecret: string;
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
const AGENT_RUN_STEP_BUDGET = 10;
const AGENT_RUN_DURATION_BUDGET_MS = 20_000;
const AGENT_ALLOWED_TOOLS = [
  'check_case_completeness',
  'evaluate_policy',
  'create_condition',
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
    if (error instanceof ProviderRevalidationError) {
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
    consentService,
    outboxSigningSecret,
  } = deps;
  const providerDispatchDeps = {
    registry: providerRegistry,
    authorizationService: providerAuthorizationService,
    intentService: providerOperationIntentService,
    consentService,
  };

  const agentRuntime = createLendingOperationsAgentRuntime({
    dataSource,
    policyEvaluationService,
    evaluationManifestService,
    outboxSigningSecret,
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

      const now = new Date();
      const runDeadlineAt = new Date(
        now.getTime() + AGENT_RUN_DURATION_BUDGET_MS,
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
        remainingStepBudget: AGENT_RUN_STEP_BUDGET,
        remainingDurationBudgetMs: AGENT_RUN_DURATION_BUDGET_MS,
        remainingTokenBudget: 0, // this graph makes no model calls
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
          stepBudget: AGENT_RUN_STEP_BUDGET,
          durationBudgetMs: AGENT_RUN_DURATION_BUDGET_MS,
          tokenBudget: 0,
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
