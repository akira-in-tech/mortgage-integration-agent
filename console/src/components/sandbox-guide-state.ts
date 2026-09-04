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
 *
 * `hasAuditEvents` matters because reaching a handoff status doesn't always
 * mean a reviewer did anything. The seeded income-discrepancy rule only
 * opens a condition when the case's stated monthly income differs from the
 * simulator's own verified figure by more than 10% -- guaranteed for the
 * default walkthrough (which deliberately states $1/month), but a custom
 * scenario's own numbers (Section 15's "+ New case") may or may not cross
 * that line. When they don't, the workflow reaches READY_FOR_UNDERWRITING
 * or MANUAL_REVIEW without a single reviewer action, so the case's audit
 * trail is genuinely empty -- pointing the guide at "Open audit trail" in
 * that case would send a visitor to a real but misleadingly-framed dead
 * end, not a bug in what the audit trail shows.
 */
export function getSandboxGuideState(
  status: CaseStatus,
  openConditionCount: number,
  hasAuditEvents: boolean,
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
    if (hasAuditEvents) {
      return {
        currentStep: 4,
        title: 'The simulated workflow has reached a handoff state',
        detail:
          'Inspect the policy binding, evidence, and human actions captured for this case.',
        actionLabel: 'Open audit trail',
        action: 'audit',
      };
    }
    return {
      currentStep: 4,
      title: 'The simulated workflow completed without a reviewer condition',
      detail:
        "This scenario's stated income was close enough to the simulator's own verified figure that no condition ever opened, so there's genuinely no reviewer action in the audit trail yet. Try a bigger mismatch between requested amount and stated income in a new case to see one.",
      actionLabel: 'View synthetic evidence',
      action: 'evidence',
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
