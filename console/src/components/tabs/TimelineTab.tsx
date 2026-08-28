import type { LoanCase } from '../../graphql/types';
import { formatDateTime } from '../../format';

export function TimelineTab({ loanCase }: { loanCase: LoanCase }) {
  const entries = [...(loanCase.timeline ?? [])].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  if (entries.length === 0) {
    return (
      <div
        className="card"
        style={{ padding: 24, fontSize: 13, color: 'var(--ink-muted)' }}
      >
        No timeline entries yet.
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '4px 0' }}>
      {entries.map((entry, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            padding: '12px 20px',
            borderBottom:
              i === entries.length - 1 ? 'none' : '1px solid var(--gridline)',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{entry.summary}</div>
            <div
              className="mono"
              style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 2 }}
            >
              {entry.kind}
            </div>
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--ink-muted)',
              flex: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {formatDateTime(entry.timestamp)}
          </div>
        </div>
      ))}
    </div>
  );
}
