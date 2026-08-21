import type { LoanCase } from '../../graphql/types';
import { useCaseMutations } from '../../useCaseMutations';
import { AlertTriangleIcon, PolicyIcon } from '../icons';
import { formatDateTime, formatRelativeTime, summarizeEvidenceValue } from '../../format';

export function OverviewTab({ loanCase }: { loanCase: LoanCase }) {
  const openCondition = (loanCase.conditions ?? []).find((c) => c.status === 'OPEN');
  const { resolveCondition, resolvingCondition, error } = useCaseMutations(loanCase.id);

  const recentActivity = [...(loanCase.timeline ?? [])]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 3);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20 }}>
      {openCondition && (
        <div className="card-elevated" style={{ padding: 19 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'var(--warning-wash)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
              }}
            >
              <AlertTriangleIcon size={15} color="var(--warning)" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Open condition</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{openCondition.code}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 14 }}>
            {openCondition.description}
          </div>
          {error && (
            <div style={{ fontSize: 12, color: 'var(--critical)', marginBottom: 8 }}>{error.message}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
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
        </div>
      )}

      {loanCase.policyBinding && (
        <div className="card" style={{ padding: 19 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <PolicyIcon color="var(--ink-2)" />
            <div style={{ fontSize: 14, fontWeight: 700 }}>Policy binding</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 12.5 }}>
            <Row label="Context" value={loanCase.policyBinding.contextKey} mono />
            <Row label="Bound" value={formatRelativeTime(loanCase.policyBinding.boundAt)} />
            <Row label="Revalidate after" value={formatDateTime(loanCase.policyBinding.revalidateAfter)} />
            {loanCase.policyBinding.policySnapshot && (
              <Row
                label="Resolution"
                value={loanCase.policyBinding.policySnapshot.resolutionStatus}
              />
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 19 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Evidence summary</div>
        {(loanCase.evidenceFacts ?? []).length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>No evidence collected yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(loanCase.evidenceFacts ?? []).map((fact) => (
              <div key={fact.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{fact.factType}</span>
                <span className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {summarizeEvidenceValue(fact.factType, fact.value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 19 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Recent activity</div>
        {recentActivity.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>No activity yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recentActivity.map((entry, i) => (
              <div key={i} style={{ display: 'flex', gap: 10 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--ink-muted)',
                    marginTop: 5,
                    flex: 'none',
                  }}
                />
                <div>
                  <div style={{ fontSize: 12.5 }}>{entry.summary}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>{formatRelativeTime(entry.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--ink-muted)' }}>{label}</span>
      <span className={mono ? 'mono' : undefined}>{value}</span>
    </div>
  );
}
