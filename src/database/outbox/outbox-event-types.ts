/**
 * Subset of the Section 15.4 event catalog this codebase can actually emit
 * today. `condition.waived` was added to the charter alongside the outbox
 * slice that introduced this file — the catalog previously had
 * `condition.satisfied` but no counterpart for a reviewer waiving (rather
 * than the borrower satisfying) a condition. `WorkflowRunFailed` became
 * emittable once case-conditions.workflow.ts gained a manual-review escape
 * hatch for unrecoverable activity failures (Section 9.5's "budget or
 * runtime failure: route to manual review" pattern, applied at the
 * workflow level).
 */
export const OutboxEventType = {
  LoanCaseCreated: 'loan_case.created',
  WorkflowRunStarted: 'workflow_run.started',
  WorkflowRunWaitingForReview: 'workflow_run.waiting_for_review',
  WorkflowRunCompleted: 'workflow_run.completed',
  WorkflowRunFailed: 'workflow_run.failed',
  /** A cancellation stopped orchestration; it does not assert provider cancellation. */
  WorkflowRunCancelled: 'workflow_run.cancelled',
  /** A reviewer started a separately identifiable recovery execution. */
  WorkflowRunRecoveryStarted: 'workflow_run.recovery_started',
  EvidenceUpdated: 'evidence.updated',
  ConditionOpened: 'condition.opened',
  ConditionSatisfied: 'condition.satisfied',
  ConditionWaived: 'condition.waived',
  /**
   * Distinct from `WorkflowRunWaitingForReview` (waiting for a reviewer to
   * resolve an already-opened condition): this is the Agent run itself
   * interrupting because policy applicability was ambiguous (Section
   * 9.5's "ambiguity... interrupt for review"), before any condition
   * exists to resolve.
   */
  EvaluationInterrupted: 'evaluation.interrupted',
  /**
   * Distinct from `EvaluationInterrupted` (the runtime automatically
   * interrupting for policy-applicability ambiguity): this is the
   * `escalate_to_reviewer` tool (Section 9.4) being explicitly selected —
   * any of Section 9.6's mandatory review triggers, not only ambiguity.
   */
  CaseEscalated: 'case.escalated',
  /** `send_information_request` (Section 9.4) successfully delivered a ready-to-send communication — never includes `renderedContent` itself (see `CommunicationDeliveryService`'s own comment on why). */
  CommunicationDelivered: 'communication.delivered',
} as const;

export type OutboxEventType =
  (typeof OutboxEventType)[keyof typeof OutboxEventType];
