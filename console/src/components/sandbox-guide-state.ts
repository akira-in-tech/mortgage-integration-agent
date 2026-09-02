import type { CaseStatus } from '../graphql/types';

export type SandboxGuideTab = 'evidence' | 'conditions' | 'audit';

export interface SandboxGuideState {
  currentStep: number;
  title: string;
  detail: string;
  actionLabel: string;
  action: 'start' | SandboxGuideTab;
}

/**
 * Converts durable workflow state into the next useful demonstration task.
 * The guide never guesses that an asynchronous workflow has completed: every
 * transition comes from the case query that CaseDetail refreshes while a
 * sandbox is open.
 */
export function getSandboxGuideState(
  status: CaseStatus,
  openConditionCount: number,
): SandboxGuideState {
  if (openConditionCount > 0 || status === 'CONDITIONS_OPEN') {
    return {
      currentStep: 3,
      title: 'A reviewer condition needs attention',
      detail:
        'Open the condition, then satisfy or waive it. The workflow records the reviewer action before it advances.',
      actionLabel: 'Review open condition',
      action: 'conditions',
    };
  }

  if (
    status === 'READY_FOR_UNDERWRITING' ||
    status === 'CLOSED' ||
    status === 'MANUAL_REVIEW'
  ) {
    return {
      currentStep: 4,
      title: 'The simulated workflow has reached a handoff state',
      detail:
        'Inspect the policy binding, evidence, and human actions captured for this case.',
      actionLabel: 'Open audit trail',
      action: 'audit',
    };
  }

  if (status === 'DRAFT') {
    return {
      currentStep: 2,
      title: 'Run the simulated evaluation',
      detail:
        'This starts the real Temporal workflow wired to this sandbox. It uses only synthetic data and deterministic provider adapters.',
      actionLabel: 'Run simulated evaluation',
      action: 'start',
    };
  }

  return {
    currentStep: 2,
    title: 'The evaluation is in progress',
    detail:
      'The page refreshes the case while the workflow collects evidence and applies the current policy binding.',
    actionLabel: 'View synthetic evidence',
    action: 'evidence',
  };
}
