import { useQuery } from '@apollo/client';
import { CASE_STATUS_COUNTS_QUERY } from '../graphql/queries';
import type { CaseStatusCount } from '../graphql/types';
import { STATUS_CONFIG, STATUS_ORDER } from './StatusPill';

const ATTENTION_STATUSES = new Set([
  'CONDITIONS_OPEN',
  'WAITING_FOR_REVIEW',
  'MANUAL_REVIEW',
]);

export function OpsDashboard() {
  const { data, loading, error } = useQuery<{
    caseStatusCounts: CaseStatusCount[];
  }>(CASE_STATUS_COUNTS_QUERY, { pollInterval: 30_000 });

  if (loading && !data) {
    return <Placeholder>Loading dashboard…</Placeholder>;
  }
  if (error) {
    return <Placeholder tone="critical">Couldn&rsquo;t load the dashboard: {error.message}</Placeholder>;
  }

  const rows = data?.caseStatusCounts ?? [];
  const byStatus = new Map(rows.map((r) => [r.status, r.count]));
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const needsAttention = rows
    .filter((r) => ATTENTION_STATUSES.has(r.status))
    .reduce((sum, r) => sum + r.count, 0);
  const ready = byStatus.get('READY_FOR_UNDERWRITING') ?? 0;
  const maxCount = Math.max(1, ...rows.map((r) => r.count));

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', background: 'var(--page)' }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 20 }}>
        Ops Dashboard
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatTile testId="stat-total" label="Total cases" value={total} />
        <StatTile testId="stat-attention" label="Needs attention" value={needsAttention} tone="warning" />
        <StatTile testId="stat-ready" label="Ready for underwriting" value={ready} tone="good" />
      </div>

      <div className="card" style={{ padding: 22 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Cases by status</div>
        <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 18 }}>
          {total === 0 ? 'No cases yet.' : `${total} case${total === 1 ? '' : 's'} total`}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {STATUS_ORDER.map((status) => {
            const count = byStatus.get(status) ?? 0;
            const pct = (count / maxCount) * 100;
            const config = STATUS_CONFIG[status];
            return (
              <div key={status} style={{ display: 'grid', gridTemplateColumns: '170px 1fr 36px', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{config.label}</span>
                <div style={{ position: 'relative', height: 10, background: 'var(--gridline)', borderRadius: 4 }}>
                  <div
                    style={{
                      position: 'absolute',
                      insetBlock: 0,
                      left: 0,
                      width: `${pct}%`,
                      minWidth: count > 0 ? 4 : 0,
                      background: config.barColor,
                      borderRadius: 4,
                      transition: 'width 200ms ease',
                    }}
                  />
                </div>
                <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, textAlign: 'right' }}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
  testId,
}: {
  label: string;
  value: number;
  tone?: 'warning' | 'good';
  testId: string;
}) {
  const color = tone === 'warning' ? 'var(--warning)' : tone === 'good' ? 'var(--good)' : 'var(--ink)';
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginBottom: 6 }}>{label}</div>
      <div className="mono" data-testid={testId} style={{ fontSize: 26, fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  );
}

function Placeholder({ children, tone }: { children: React.ReactNode; tone?: 'critical' }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, color: tone === 'critical' ? 'var(--critical)' : 'var(--ink-muted)' }}>
        {children}
      </div>
    </div>
  );
}
