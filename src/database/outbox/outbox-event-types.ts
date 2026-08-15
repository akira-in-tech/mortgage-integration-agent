/**
 * Subset of the Section 15.4 event catalog this codebase can actually emit
 * today. `condition.waived` was added to the charter alongside this slice —
 * the catalog previously had `condition.satisfied` but no counterpart for a
 * reviewer waiving (rather than the borrower satisfying) a condition, a gap
 * only visible once something needed to emit the event for real.
 */
export const OutboxEventType = {
  LoanCaseCreated: 'loan_case.created',
  WorkflowRunStarted: 'workflow_run.started',
  WorkflowRunWaitingForReview: 'workflow_run.waiting_for_review',
  WorkflowRunCompleted: 'workflow_run.completed',
  EvidenceUpdated: 'evidence.updated',
  ConditionOpened: 'condition.opened',
  ConditionSatisfied: 'condition.satisfied',
  ConditionWaived: 'condition.waived',
} as const;

export type OutboxEventType =
  (typeof OutboxEventType)[keyof typeof OutboxEventType];
