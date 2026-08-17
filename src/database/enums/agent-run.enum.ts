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
