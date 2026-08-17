/**
 * Shared between the M2 deterministic workflow
 * (`case-conditions.activities.ts`) and any `AgentRuntimePort`
 * implementation that resolves policy independently (`src/agent-runtime/
 * langgraph/`), so both call `PolicyEvaluationService` for the same
 * lifecycle event rather than risking drift between two hand-copied
 * string literals.
 */
export const UNDERWRITING_REVIEW_LIFECYCLE_EVENT = 'UNDERWRITING_REVIEW';
