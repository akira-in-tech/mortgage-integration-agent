import type { CaseStatus } from '../graphql/types';
import {
  getSandboxGuideState,
  type SandboxGuideTab,
} from './sandbox-guide-state';

interface SandboxGuideProps {
  status: CaseStatus;
  openConditionCount: number;
  starting: boolean;
  onStartEvaluation: () => void;
  onOpenTab: (tab: SandboxGuideTab) => void;
}

const STEPS = [
  'Inspect synthetic evidence',
  'Run policy evaluation',
  'Resolve a reviewer condition',
  'Review the audit trail',
];

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
