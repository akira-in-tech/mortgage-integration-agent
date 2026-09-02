import type { CaseStatus } from '../graphql/types';

type GuideTab = 'evidence' | 'conditions' | 'audit';

interface SandboxGuideProps {
  status: CaseStatus;
  openConditionCount: number;
  starting: boolean;
  onStartEvaluation: () => void;
  onOpenTab: (tab: GuideTab) => void;
}

interface GuideState {
  currentStep: number;
  title: string;
  detail: string;
  actionLabel: string;
  action: 'start' | GuideTab;
}

const STEPS = [
  'Inspect synthetic evidence',
  'Run policy evaluation',
  'Resolve a reviewer condition',
  'Review the audit trail',
];

/**
 * Converts durable workflow state into the next useful demonstration task.
 * The guide never guesses that an asynchronous workflow has completed: every
 * transition comes from the case query that CaseDetail refreshes while a
 * sandbox is open.
 */
export function getSandboxGuideState(
  status: CaseStatus,
  openConditionCount: number,
): GuideState {
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

export function SandboxGuide({
  status,
  openConditionCount,
  starting,
  onStartEvaluation,
  onOpenTab,
}: SandboxGuideProps) {
  const state = getSandboxGuideState(status, openConditionCount);
  const action = () => {
    if (state.action === 'start') onStartEvaluation();
    else onOpenTab(state.action);
  };

  return (
    <section
      aria-labelledby="sandbox-guide-heading"
      className="card-elevated"
      style={{ margin: '0 0 20px', padding: '18px 20px' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            id="sandbox-guide-heading"
            style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}
          >
            Guided synthetic case
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
            A safe 3-minute walkthrough — no borrower data, lending decision,
            funds movement, or external provider call.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={
            starting || (state.action === 'start' && status !== 'DRAFT')
          }
          onClick={action}
        >
          {starting ? 'Starting evaluation…' : state.actionLabel}
        </button>
      </div>

      <div
        aria-label="Sandbox walkthrough progress"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 10,
          marginTop: 18,
        }}
      >
        {STEPS.map((step, index) => {
          const stepNumber = index + 1;
          const current = stepNumber === state.currentStep;
          const complete = stepNumber < state.currentStep;
          return (
            <div key={step} style={{ minWidth: 0 }}>
              <div
                aria-current={current ? 'step' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  color: current
                    ? 'var(--accent)'
                    : complete
                      ? 'var(--good)'
                      : 'var(--ink-muted)',
                  fontSize: 11.5,
                  fontWeight: current ? 700 : 600,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 18,
                    height: 18,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    background: current
                      ? 'var(--accent-wash)'
                      : complete
                        ? 'var(--good-wash)'
                        : 'var(--page)',
                    border: current
                      ? '1px solid var(--accent)'
                      : '1px solid var(--border)',
                    flex: 'none',
                  }}
                >
                  {complete ? '✓' : stepNumber}
                </span>
                <span>{step}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        aria-live="polite"
        style={{
          marginTop: 15,
          paddingTop: 13,
          borderTop: '1px solid var(--gridline)',
        }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{state.title}</div>
        <div
          style={{
            marginTop: 3,
            maxWidth: 720,
            color: 'var(--ink-2)',
            fontSize: 12.5,
            lineHeight: 1.5,
          }}
        >
          {state.detail}
        </div>
      </div>
    </section>
  );
}
