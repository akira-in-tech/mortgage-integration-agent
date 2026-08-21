import type { LoanCase } from '../../graphql/types';
import { useCaseMutations } from '../../useCaseMutations';
import { formatDateTime } from '../../format';

const STATUS_COLOR: Record<string, string> = {
  OPEN: 'var(--warning)',
  SATISFIED: 'var(--good)',
  WAIVED: 'var(--ink-muted)',
  ESCALATED: 'var(--critical)',
  IN_PROGRESS: 'var(--blue-500)',
  WAITING_FOR_EVIDENCE: 'var(--blue-500)',
};

export function ConditionsTab({ loanCase }: { loanCase: LoanCase }) {
  const conditions = loanCase.conditions ?? [];
  const { resolveCondition, resolvingCondition, error } = useCaseMutations(loanCase.id);

  if (conditions.length === 0) {
    return (
      <div className="card" style={{ padding: 24, fontSize: 13, color: 'var(--ink-muted)' }}>
        No conditions on this case.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error && <div style={{ fontSize: 12, color: 'var(--critical)' }}>{error.message}</div>}
      {conditions.map((condition) => (
        <div key={condition.id} className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{condition.code}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5, maxWidth: 560 }}>
                {condition.description}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 8 }}>
                Opened {formatDateTime(condition.createdAt)}
              </div>
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: STATUS_COLOR[condition.status] ?? 'var(--ink-2)',
                flex: 'none',
                marginLeft: 12,
              }}
            >
              {condition.status}
            </span>
          </div>
          {condition.status === 'OPEN' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                className="btn btn-primary"
                style={{ fontSize: 12, padding: '6px 12px' }}
                disabled={resolvingCondition}
                onClick={() => resolveCondition('SATISFIED')}
              >
                Mark satisfied
              </button>
              <button
                className="btn"
                style={{ fontSize: 12, padding: '6px 12px' }}
                disabled={resolvingCondition}
                onClick={() => resolveCondition('WAIVED')}
              >
                Waive
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
