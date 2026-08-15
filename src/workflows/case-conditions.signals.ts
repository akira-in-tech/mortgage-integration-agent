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
