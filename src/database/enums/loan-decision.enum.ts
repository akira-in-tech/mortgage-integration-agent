/**
 * Shared across the GraphQL layer (src/loan/loan.model.ts) and persistence
 * layer (loan-application.entity.ts) so the same decision vocabulary can't
 * drift between the API and the database. `PENDING` is a valid persisted
 * state (before an agent has evaluated the case) but is deliberately
 * excluded from `UnderwritingDecision` (src/agent/agent.types.ts), which
 * types only what the agent itself can produce.
 */
export enum LoanDecisionStatus {
  APPROVED = 'APPROVED',
  CONDITIONAL = 'CONDITIONAL',
  DENIED = 'DENIED',
  PENDING = 'PENDING',
}
