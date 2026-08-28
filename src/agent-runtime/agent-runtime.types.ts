import { LendingOperationsAgentState } from './agent-state.types';

/**
 * Section 9.2: "Temporal and PostgreSQL hold authoritative state. LangGraph
 * is an Agent runtime adapter, not the system of record." `AgentRuntimePort`
 * is that seam — whatever executes the bounded Agent run (a LangGraph.js
 * graph, or any other implementation) does so behind this interface, so
 * the workflow/activity layer that calls it never depends on which one.
 * No implementation exists yet (see docs/DEVELOPMENT_LOG.md's Known
 * gaps) — this is the contract a LangGraph.js v1 adapter will implement
 * next, informed by the real tools in src/agent-runtime/tools/ rather
 * than designed before anything concrete exercised it.
 */
export interface AgentRunBudget {
  stepBudget: number;
  durationBudgetMs: number;
  tokenBudget: number;
  providerCallBudget: number;
  costBudgetMinorUnits: number;
  currency: string;
}

export interface AgentRunInput {
  initialState: LendingOperationsAgentState;
  /** Tool names this run is allowed to select from — an unlisted tool must be unreachable (Section 20 M3 exit evidence). */
  allowedTools: string[];
  budget: AgentRunBudget;
  runDeadlineAt: string;
}

export type AgentRunRoute =
  | 'PROPOSED_ACTION'
  | 'AWAITING_INFORMATION'
  | 'INTERRUPTED_FOR_REVIEW'
  | 'ROUTED_TO_MANUAL_REVIEW';

export interface AgentRunResult {
  finalState: LendingOperationsAgentState;
  route: AgentRunRoute;
}

export interface AgentRuntimePort {
  run(input: AgentRunInput): Promise<AgentRunResult>;
}
