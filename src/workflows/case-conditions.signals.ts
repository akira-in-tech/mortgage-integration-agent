import { defineSignal } from '@temporalio/workflow';

export const CASE_CONDITIONS_TASK_QUEUE = 'case-conditions';

export type ConditionResolutionKind = 'SATISFIED' | 'WAIVED';

export interface ResolveConditionSignalPayload {
  actorId: string;
  resolution: ConditionResolutionKind;
  reason?: string;
}

/**
 * Sent by a human reviewer (or, in this synthetic launch, a test/script
 * standing in for one) to resolve the case's open condition. The workflow
 * durably waits on this — the wait survives a worker restart because
 * Temporal persists workflow state server-side, not in worker memory.
 */
export const resolveConditionSignal =
  defineSignal<[ResolveConditionSignalPayload]>('resolveCondition');

export interface ResumeInterruptedEvaluationSignalPayload {
  actorId: string;
  note?: string;
}

/**
 * Section 9.5's Agent loop: "ambiguity... interrupt for review" — sent
 * once a reviewer has addressed whatever made policy applicability
 * ambiguous (uncovered jurisdiction, overlapping released versions), by
 * some means outside this workflow (no dedicated "fix the ambiguity" API
 * exists yet — see docs/DEVELOPMENT_LOG.md's Known gaps). The payload
 * carries no resolution data of its own; it only tells the workflow "try
 * evaluating again," the same way `resolveConditionSignal` tells it "the
 * condition I opened has been addressed."
 */
export const resumeInterruptedEvaluationSignal = defineSignal<
  [ResumeInterruptedEvaluationSignalPayload]
>('resumeInterruptedEvaluation');
