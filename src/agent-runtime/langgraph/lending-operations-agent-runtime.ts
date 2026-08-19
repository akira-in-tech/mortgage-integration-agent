import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { DataSource } from 'typeorm';
import {
  AgentRuntimePort,
  AgentRunInput,
  AgentRunResult,
  AgentRunRoute,
} from '../agent-runtime.types';
import {
  LendingOperationsAgentState,
  ToolAttemptSummary,
} from '../agent-state.types';
import {
  buildToolRegistry,
  invokeTool,
  AnyAgentTool,
} from '../agent-tool.types';
import {
  checkCaseCompletenessTool,
  CheckCaseCompletenessResult,
} from '../tools/check-case-completeness.tool';
import {
  evaluatePolicyTool,
  EvaluatePolicyResult,
} from '../tools/evaluate-policy.tool';
import {
  createConditionTool,
  CreateConditionResult,
  StaleCaseVersionError,
} from '../tools/create-condition.tool';
import {
  PolicyEvaluationService,
  RESOLVER_VERSION,
} from '../../policy/policy-evaluation.service';
import { EvaluationManifestService } from '../../policy/evaluation-manifest.service';
import { evaluatePolicyRule } from '../../policy/dsl/policy-rule-evaluator';
import { PolicyFactContext } from '../../policy/dsl/policy-rule.types';
import { loanTypeToProductCode } from '../../policy/product-code';
import { UNDERWRITING_REVIEW_LIFECYCLE_EVENT } from '../../policy/lifecycle-events';
import { LoanCase } from '../../database/entities/loan-case.entity';
import { runInTenantContext } from '../../database/tenant-context';
import {
  EvidenceFact,
  EvidenceType,
} from '../../database/entities/evidence-fact.entity';
import { AgentRun } from '../../database/entities/agent-run.entity';
import { ToolAttempt } from '../../database/entities/tool-attempt.entity';
import {
  AgentRunRouteStatus,
  ReviewCategoryStatus,
  ToolAttemptOutcome,
} from '../../database/enums/agent-run.enum';
import {
  classifyMandatoryReviewTrigger,
  MandatoryReviewCategory,
  MandatoryReviewTrigger,
} from '../mandatory-review-triggers';

export interface LendingOperationsAgentRuntimeDeps {
  dataSource: DataSource;
  policyEvaluationService: PolicyEvaluationService;
  evaluationManifestService: EvaluationManifestService;
  outboxSigningSecret: string;
}

/**
 * Section 14.1's `agent_runs`/`tool_attempts` — the Agent run's own
 * history (previously held only in memory for the duration of one
 * `run()` call, per M3-013's own finding that nothing persisted it) is
 * now durable. Written once per completed run, after the graph produces
 * a final route — not per node, so a run that throws (Section 10.5's
 * `StaleCaseVersionError`, propagated for Temporal to retry) leaves no
 * partial record, matching that this specific run never really
 * "completed" in a sense worth recording.
 */
async function persistAgentRun(
  dataSource: DataSource,
  startedAt: Date,
  result: AgentRunResult,
): Promise<void> {
  // M5-006: agent_runs/tool_attempts now carry a real RLS policy —
  // runInTenantContext, not a bare transaction, so this write can't
  // touch a row RLS would reject.
  await runInTenantContext(
    dataSource,
    result.finalState.tenantId,
    async (manager) => {
      const agentRun = await manager.getRepository(AgentRun).save(
        manager.getRepository(AgentRun).create({
          tenantId: result.finalState.tenantId,
          caseId: result.finalState.caseId,
          workflowRunId: result.finalState.workflowRunId,
          route: result.route as unknown as AgentRunRouteStatus,
          proposedActionTool: result.finalState.proposedAction?.tool ?? null,
          proposedActionArguments:
            result.finalState.proposedAction?.arguments ?? null,
          reviewRequested: result.finalState.reviewState?.requested ?? false,
          reviewReason: result.finalState.reviewState?.reason ?? null,
          reviewCategory:
            (result.finalState.reviewState
              ?.category as unknown as ReviewCategoryStatus) ?? null,
          startedAt,
        }),
      );
      if (result.finalState.attemptedTools.length > 0) {
        await manager.getRepository(ToolAttempt).save(
          result.finalState.attemptedTools.map((attempt) =>
            manager.getRepository(ToolAttempt).create({
              agentRunId: agentRun.id,
              toolName: attempt.toolName,
              outcome: attempt.outcome as unknown as ToolAttemptOutcome,
              detail: attempt.detail ?? null,
              attemptedAt: new Date(attempt.attemptedAt),
            }),
          ),
        );
      }
    },
  );
}

const RuntimeAnnotation = Annotation.Root({
  agentState: Annotation<LendingOperationsAgentState>(),
  route: Annotation<AgentRunRoute | undefined>(),
  policyEvaluation: Annotation<EvaluatePolicyResult | undefined>(),
});
type RuntimeState = typeof RuntimeAnnotation.State;

function recordAttempt(
  agentState: LendingOperationsAgentState,
  toolName: string,
  outcome: 'SUCCESS' | 'FAILURE',
  detail?: string,
): LendingOperationsAgentState {
  const attempt: ToolAttemptSummary = {
    toolName,
    attemptedAt: new Date().toISOString(),
    outcome,
    detail,
  };
  return {
    ...agentState,
    attemptedTools: [...agentState.attemptedTools, attempt],
  };
}

/**
 * Section 9.3: budget fields are server-issued observations the runtime
 * enforces, never model authority. This checks only the two budget
 * dimensions this adapter actually tracks (steps, trusted deadline) —
 * token, provider-call, and cost-ledger enforcement remain a known gap
 * (docs/DEVELOPMENT_LOG.md), so exhausting those is not yet detected here.
 */
function budgetExceeded(
  agentState: LendingOperationsAgentState,
  runDeadlineAt: string,
): MandatoryReviewTrigger | undefined {
  if (agentState.remainingStepBudget <= 0) {
    return classifyMandatoryReviewTrigger(
      MandatoryReviewCategory.BUDGET_OR_DEADLINE_EXHAUSTED,
      'remainingStepBudget exhausted',
    );
  }
  if (Date.now() >= Date.parse(runDeadlineAt)) {
    return classifyMandatoryReviewTrigger(
      MandatoryReviewCategory.BUDGET_OR_DEADLINE_EXHAUSTED,
      `runDeadlineAt (${runDeadlineAt}) exceeded`,
    );
  }
  return undefined;
}

function consumeStep(
  agentState: LendingOperationsAgentState,
): LendingOperationsAgentState {
  return {
    ...agentState,
    remainingStepBudget: agentState.remainingStepBudget - 1,
  };
}

/**
 * Section 9.5's Agent loop names this the run's second step — "VERIFY
 * TENANT, CONSENT, TRUSTED DEADLINE, AND AUTHORITATIVE BUDGET LEDGER" —
 * before evidence is even inspected, and Section 6.3's authority order
 * puts it first of all: "Consent, authorization, and security controls
 * may stop processing." `consentStatus` is the only piece of that this
 * codebase can check today — no authorization-grant or budget-ledger
 * model exists yet (see `budgetExceeded` above and
 * docs/DEVELOPMENT_LOG.md's Known gaps for what else Section 9.6 lists
 * that has no real backing signal yet: contradictory evidence, evidence
 * confidence thresholds, communication classification, provider-contract
 * conformance, and prompt-injection signals, since this graph makes no
 * model calls at all today).
 */
function consentInvalid(
  agentState: LendingOperationsAgentState,
): MandatoryReviewTrigger | undefined {
  if (agentState.consentStatus !== 'VALID') {
    return classifyMandatoryReviewTrigger(
      MandatoryReviewCategory.CONSENT_INVALID,
      `consentStatus is "${agentState.consentStatus}", not VALID`,
    );
  }
  return undefined;
}

/**
 * Section 9.2's `AgentRuntimePort` implemented against a real LangGraph.js
 * v1 `StateGraph`, orchestrating the three tools that exist today
 * (src/agent-runtime/tools/) in the same order Section 9.5's Agent loop
 * describes: verify consent, check completeness, request a guarded
 * policy evaluation, then propose (and, since `create_condition`'s
 * approval boundary is a structural guard rather than a human gate,
 * execute) a condition transition. `allowedTools` is enforced by only
 * registering the subset
 * of tools it names — an unlisted tool is simply not in the registry
 * `invokeTool` looks up, so it fails the same tested way an unregistered
 * name always does (agent-tool.types.spec.ts), rather than through a
 * separate allow-check that could drift from that behavior.
 *
 * Wired into the M2 Temporal workflow since M3-008: `case-conditions
 * .activities.ts`'s `evaluateConditions` calls this runtime instead of
 * `PolicyEvaluationService`/`createConditionTool` directly, so its
 * decision is genuinely produced by a bounded Agent run, per Section
 * 9.2's runtime-separation diagram ("Temporal workflow... bounded Agent
 * run... deterministic policy engine" as three separate layers).
 */
export function createLendingOperationsAgentRuntime(
  deps: LendingOperationsAgentRuntimeDeps,
): AgentRuntimePort {
  const allTools: AnyAgentTool[] = [
    checkCaseCompletenessTool({ dataSource: deps.dataSource }),
    evaluatePolicyTool({
      policyEvaluationService: deps.policyEvaluationService,
    }),
    createConditionTool({
      dataSource: deps.dataSource,
      outboxSigningSecret: deps.outboxSigningSecret,
    }),
  ];

  return {
    async run(input: AgentRunInput): Promise<AgentRunResult> {
      const startedAt = new Date();
      const registry = buildToolRegistry(
        allTools.filter((tool) => input.allowedTools.includes(tool.name)),
      );
      const toolContext = {
        tenantId: input.initialState.tenantId,
        caseId: input.initialState.caseId,
      };

      /**
       * The single place Section 9.5's two-tier "ambiguity/protected
       * action: interrupt for review" vs. "budget or runtime failure:
       * route to manual review" distinction is applied — every mandatory-
       * review trigger this graph detects flows through here, dispatching
       * on `MandatoryReviewTrigger.route` (`mandatory-review-triggers.ts`)
       * rather than each call site independently deciding which of the
       * two routes it means (Section 20's exit evidence B; M3-021). The
       * persisted `reviewCategory` this produces is what makes a run's
       * audit trail queryable by *which* Section 9.6 concern triggered
       * it, not just a free-text reason string.
       */
      function routeMandatoryReview(
        agentState: LendingOperationsAgentState,
        trigger: MandatoryReviewTrigger,
      ): Partial<RuntimeState> {
        return {
          agentState: {
            ...agentState,
            reviewState: {
              requested: true,
              reason: trigger.reason,
              category: trigger.category,
            },
          },
          route:
            trigger.route === 'INTERRUPT_FOR_REVIEW'
              ? 'INTERRUPTED_FOR_REVIEW'
              : 'ROUTED_TO_MANUAL_REVIEW',
        };
      }

      async function verifyConsentNode(
        state: RuntimeState,
      ): Promise<Partial<RuntimeState>> {
        const trigger = consentInvalid(state.agentState);
        if (trigger) return routeMandatoryReview(state.agentState, trigger);
        return {};
      }

      async function checkCompletenessNode(
        state: RuntimeState,
      ): Promise<Partial<RuntimeState>> {
        const exceeded = budgetExceeded(state.agentState, input.runDeadlineAt);
        if (exceeded) return routeMandatoryReview(state.agentState, exceeded);

        const invocation = await invokeTool(
          registry,
          'check_case_completeness',
          toolContext,
          {},
        );
        const nextState = recordAttempt(
          consumeStep(state.agentState),
          'check_case_completeness',
          invocation.outcome,
          invocation.error,
        );
        if (invocation.outcome === 'FAILURE') {
          return routeMandatoryReview(
            nextState,
            classifyMandatoryReviewTrigger(
              MandatoryReviewCategory.TOOL_EXECUTION_FAILURE,
              `check_case_completeness unavailable: ${invocation.error}`,
            ),
          );
        }
        const result = invocation.result as CheckCaseCompletenessResult;
        if (!result.complete) {
          return { agentState: nextState, route: 'AWAITING_INFORMATION' };
        }
        return { agentState: nextState };
      }

      async function evaluatePolicyNode(
        state: RuntimeState,
      ): Promise<Partial<RuntimeState>> {
        const exceeded = budgetExceeded(state.agentState, input.runDeadlineAt);
        if (exceeded) return routeMandatoryReview(state.agentState, exceeded);

        const loanCase = await runInTenantContext(
          deps.dataSource,
          toolContext.tenantId,
          (manager) =>
            manager.getRepository(LoanCase).findOneByOrFail({
              id: toolContext.caseId,
              tenantId: toolContext.tenantId,
            }),
        );

        const invocation = await invokeTool(
          registry,
          'evaluate_policy',
          toolContext,
          {
            jurisdictionCode: loanCase.jurisdictionCode,
            productCode: loanTypeToProductCode(loanCase.loanType),
            lifecycleEvent: UNDERWRITING_REVIEW_LIFECYCLE_EVENT,
          },
        );
        const nextState = recordAttempt(
          consumeStep(state.agentState),
          'evaluate_policy',
          invocation.outcome,
          invocation.error,
        );
        if (invocation.outcome === 'FAILURE') {
          return routeMandatoryReview(
            nextState,
            classifyMandatoryReviewTrigger(
              MandatoryReviewCategory.TOOL_EXECUTION_FAILURE,
              `evaluate_policy unavailable: ${invocation.error}`,
            ),
          );
        }
        const result = invocation.result as EvaluatePolicyResult;
        if (result.status === 'REVIEW_REQUIRED') {
          // No `EvaluationInputManifest` here (M3-022's own scope
          // boundary, see that entity's comment): REVIEW_REQUIRED means
          // no binding was created for this ambiguous resolution — a
          // manifest without a real `policyBindingId` to reference would
          // have nothing genuine to read from.
          return routeMandatoryReview(
            nextState,
            classifyMandatoryReviewTrigger(
              MandatoryReviewCategory.POLICY_AMBIGUITY,
              result.unresolvedReasons.join('; ') || 'policy review required',
            ),
          );
        }
        return {
          agentState: { ...nextState, policyBindingId: result.policyBindingId },
          policyEvaluation: result,
        };
      }

      async function resolveOutcomeNode(
        state: RuntimeState,
      ): Promise<Partial<RuntimeState>> {
        const exceeded = budgetExceeded(state.agentState, input.runDeadlineAt);
        if (exceeded) return routeMandatoryReview(state.agentState, exceeded);

        const stepped = consumeStep(state.agentState);
        const evaluation = state.policyEvaluation!;

        // Section 20's exit evidence F / Section 18.3 ("evaluations
        // without a valid immutable input manifest accepted: 0"): every
        // completed DSL evaluation gets a manifest now, not only ones
        // that go on to open a condition (M3-022) — this branch has no
        // applicable rule to check evidence against, so the manifest
        // simply references no evidence, but the evaluation itself (and
        // the real policyBindingId/digest it read) is still real and
        // worth an audit-backed record.
        if (evaluation.matchedVersions.length === 0) {
          await deps.evaluationManifestService.assemble({
            tenantId: toolContext.tenantId,
            caseId: toolContext.caseId,
            caseVersion: state.agentState.caseVersion,
            policyBindingId: state.agentState.policyBindingId!,
            observedPolicyDependencyDigest:
              evaluation.observedPolicyDependencyDigest!,
            evaluatorVersion: RESOLVER_VERSION,
            evidence: [],
          });
          return { agentState: stepped, route: 'PROPOSED_ACTION' };
        }

        // Sequential, not Promise.all: both queries share the same
        // transaction's single underlying connection, and node-postgres
        // itself warns that overlapping queries on one client (rather
        // than awaited one at a time) is deprecated — real risk of
        // result-set confusion between the two queries, not just a style
        // preference.
        const { loanCase, latestIncomeFact } = await runInTenantContext(
          deps.dataSource,
          toolContext.tenantId,
          async (manager) => {
            const loanCase = await manager
              .getRepository(LoanCase)
              .findOneByOrFail({
                id: toolContext.caseId,
                tenantId: toolContext.tenantId,
              });
            const latestIncomeFact = await manager
              .getRepository(EvidenceFact)
              .findOne({
                where: {
                  tenantId: toolContext.tenantId,
                  caseId: toolContext.caseId,
                  factType: EvidenceType.INCOME,
                },
                order: { observedAt: 'DESC' },
              });
            return { loanCase, latestIncomeFact };
          },
        );
        const factContext: PolicyFactContext = {
          application: { monthly_income: Number(loanCase.statedMonthlyIncome) },
          evidence: {
            verified_monthly_income: (
              latestIncomeFact?.value as { monthlyIncome?: number } | undefined
            )?.monthlyIncome,
          },
        };

        const match = evaluation.matchedVersions
          .map((version) => ({
            version,
            result: evaluatePolicyRule(version.rule, factContext),
          }))
          .find(({ result }) => result.matched);

        // Section 10.5: assembled right after the DSL evaluation
        // completes, referencing exactly the evidence this evaluation
        // actually read (`latestIncomeFact`), not every fact on the
        // case — whether or not a rule ended up matching, since a
        // "checked and nothing applied" outcome is still a real,
        // completed evaluation Section 18.3's gate covers.
        const manifest = await deps.evaluationManifestService.assemble({
          tenantId: toolContext.tenantId,
          caseId: toolContext.caseId,
          caseVersion: state.agentState.caseVersion,
          policyBindingId: state.agentState.policyBindingId!,
          observedPolicyDependencyDigest:
            evaluation.observedPolicyDependencyDigest!,
          evaluatorVersion: RESOLVER_VERSION,
          evidence: latestIncomeFact ? [latestIncomeFact] : [],
        });

        if (!match) {
          return { agentState: stepped, route: 'PROPOSED_ACTION' };
        }

        const invocation = await invokeTool(
          registry,
          'create_condition',
          toolContext,
          {
            code: match.version.rule.outcome.condition,
            description: match.result.reason,
            policyVersionId: match.version.policyVersionId,
            ruleId: match.version.ruleId,
            policySnapshotId: evaluation.policySnapshotId,
            expectedCaseVersion: state.agentState.caseVersion,
            evaluationManifestId: manifest.id,
          },
        );
        const nextState = recordAttempt(
          stepped,
          'create_condition',
          invocation.outcome,
          invocation.error,
        );
        if (invocation.outcome === 'FAILURE') {
          return routeMandatoryReview(
            nextState,
            classifyMandatoryReviewTrigger(
              MandatoryReviewCategory.TOOL_EXECUTION_FAILURE,
              `create_condition failed: ${invocation.error}`,
            ),
          );
        }
        const created = invocation.result as CreateConditionResult;
        if (created.outcome === 'STALE_CASE_VERSION') {
          // Not a tool failure — the tool ran correctly and found the
          // case has moved on since this run's initial state was
          // captured (Section 10.5). Propagating out of the graph (not
          // routing to manual review) lets Temporal's own activity retry
          // re-run evaluateConditions against the case's current state,
          // which is what a stale evaluation actually needs.
          throw new StaleCaseVersionError(
            toolContext.caseId,
            state.agentState.caseVersion,
          );
        }
        return {
          agentState: {
            ...nextState,
            proposedAction: {
              tool: 'create_condition',
              arguments: {
                conditionId: created.conditionId,
                code: match.version.rule.outcome.condition,
              },
            },
          },
          route: 'PROPOSED_ACTION',
        };
      }

      const graph = new StateGraph(RuntimeAnnotation)
        .addNode('verifyConsent', verifyConsentNode)
        .addNode('checkCompleteness', checkCompletenessNode)
        .addNode('evaluatePolicy', evaluatePolicyNode)
        .addNode('resolveOutcome', resolveOutcomeNode)
        .addEdge(START, 'verifyConsent')
        .addConditionalEdges('verifyConsent', (state) =>
          state.route ? END : 'checkCompleteness',
        )
        .addConditionalEdges('checkCompleteness', (state) =>
          state.route ? END : 'evaluatePolicy',
        )
        .addConditionalEdges('evaluatePolicy', (state) =>
          state.route ? END : 'resolveOutcome',
        )
        .addEdge('resolveOutcome', END)
        .compile();

      const finalState = await graph.invoke({
        agentState: input.initialState,
        route: undefined,
        policyEvaluation: undefined,
      });

      const result: AgentRunResult = {
        finalState: finalState.agentState,
        // A route is always set by whichever terminal node ran; this
        // fail-closed fallback only guards against a future graph-wiring
        // bug leaving it unset, never an expected path today.
        route: finalState.route ?? 'ROUTED_TO_MANUAL_REVIEW',
      };
      await persistAgentRun(deps.dataSource, startedAt, result);
      return result;
    },
  };
}
