/** Mirrors `AgentRunRoute` (src/agent-runtime/agent-runtime.types.ts) as a persisted enum. */
export enum AgentRunRouteStatus {
  PROPOSED_ACTION = 'PROPOSED_ACTION',
  AWAITING_INFORMATION = 'AWAITING_INFORMATION',
  INTERRUPTED_FOR_REVIEW = 'INTERRUPTED_FOR_REVIEW',
  ROUTED_TO_MANUAL_REVIEW = 'ROUTED_TO_MANUAL_REVIEW',
}

/** Mirrors `ToolInvocationResult.outcome` (src/agent-runtime/agent-tool.types.ts) as a persisted enum. */
export enum ToolAttemptOutcome {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
}

/** Mirrors `MandatoryReviewCategory` (src/agent-runtime/mandatory-review-triggers.ts) as a persisted enum. */
export enum ReviewCategoryStatus {
  CONSENT_INVALID = 'CONSENT_INVALID',
  BUDGET_OR_DEADLINE_EXHAUSTED = 'BUDGET_OR_DEADLINE_EXHAUSTED',
  POLICY_AMBIGUITY = 'POLICY_AMBIGUITY',
  TOOL_EXECUTION_FAILURE = 'TOOL_EXECUTION_FAILURE',
}
