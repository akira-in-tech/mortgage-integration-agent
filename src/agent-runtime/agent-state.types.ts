/**
 * Section 9.3's `LendingOperationsAgentState`, as closely as this
 * codebase's actual data supports. Distinct from `src/agent/` (the
 * legacy one-shot `evaluateLoan` decisioning path — `AgentService`,
 * `RulesUnderwriterService`, `OllamaUnderwriterService`): that system
 * predates the M3 Agent charter and is a different concept that happens
 * to share the word "Agent." This module is Section 9's *stateful,
 * bounded, tool-using* Agent that runs inside the M2 case-conditions
 * workflow — a real naming collision worth calling out, not resolved by
 * renaming the legacy module (out of scope here) or silently reusing its
 * directory (would conflate two different systems).
 */

export interface EvidenceSummary {
  factType: string;
  sourceIdentifier: string;
  observedAt: string;
}

export interface ConditionSummary {
  conditionId: string;
  code: string;
  status: string;
}

export interface ProviderHealthSummary {
  providerName: string;
  healthy: boolean;
}

export interface ToolAttemptSummary {
  toolName: string;
  attemptedAt: string;
  outcome: 'SUCCESS' | 'FAILURE';
  /** Free-text summary, never raw provider payloads or borrower PII. */
  detail?: string;
}

export interface AgentAction {
  tool: string;
  arguments: Record<string, unknown>;
}

export interface HumanReviewState {
  requested: boolean;
  reason?: string;
}

export type ConsentStatus = 'VALID' | 'MISSING' | 'EXPIRED' | 'REVOKED';

/**
 * Section 9.3. Budget fields are server-issued observations here too —
 * nothing in `src/agent-runtime/` lets a caller supply or increase them;
 * see `AgentRunBudget` in `agent-runtime.types.ts` for how a run's
 * starting budget is established.
 */
export interface LendingOperationsAgentState {
  tenantId: string;
  caseId: string;
  caseVersion: number;
  workflowRunId: string;
  workflowStatus: string;
  consentStatus: ConsentStatus;
  evidenceSummary: EvidenceSummary[];
  openConditions: ConditionSummary[];
  providerHealth: ProviderHealthSummary[];
  attemptedTools: ToolAttemptSummary[];
  policyBindingId?: string;
  modelVersion?: string;
  promptVersion?: string;
  remainingStepBudget: number;
  remainingDurationBudgetMs: number;
  remainingTokenBudget: number;
  remainingProviderCallBudget: number;
  budgetCurrency: string;
  remainingCostBudgetMinorUnits: number;
  budgetLedgerVersion: number;
  runStartedAt: string;
  runDeadlineAt: string;
  proposedAction?: AgentAction;
  reviewState?: HumanReviewState;
}
