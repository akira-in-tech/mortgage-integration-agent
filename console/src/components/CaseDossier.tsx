import { useQuery } from '@apollo/client';
import { CASE_QUERY } from '../graphql/queries';
import type { LoanCase } from '../graphql/types';
import { StatusPill } from './StatusPill';
import {
  formatCurrency,
  formatDateTime,
  formatLoanType,
  summarizeEvidenceValue,
} from '../format';

// A dossier is deliberately NOT the tabbed Triage Queue layout: one
// continuous, read-oriented document covering every section of a case at
// once — the thing a reviewer would actually print or export for a file,
// unlike the click-through-one-tab-at-a-time operational view.
export function CaseDossier({
  caseId,
  onClose,
}: {
  caseId: string;
  onClose: () => void;
}) {
  const { data, loading, error } = useQuery(CASE_QUERY, {
    variables: { caseId },
  });

  return (
    <div
      className="dossier-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--page)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        className="dossier-toolbar"
        style={{
          flex: 'none',
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>Case Dossier</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn"
            style={{ fontSize: 12, padding: '6px 12px' }}
            onClick={() => window.print()}
          >
            Print
          </button>
          <button
            className="btn"
            style={{ fontSize: 12, padding: '6px 12px' }}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          justifyContent: 'center',
          padding: '32px 24px',
        }}
      >
        <div className="dossier-page" style={{ width: '100%', maxWidth: 760 }}>
          {loading && !data && (
            <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
              Loading dossier…
            </div>
          )}
          {error && (
            <div style={{ fontSize: 13, color: 'var(--critical)' }}>
              Couldn&rsquo;t load this case: {error.message}
            </div>
          )}
          {data?.case && <DossierContent loanCase={data.case} />}
        </div>
      </div>
    </div>
  );
}

function DossierContent({ loanCase }: { loanCase: LoanCase }) {
  const conditions = loanCase.conditions ?? [];
  const evidenceFacts = loanCase.evidenceFacts ?? [];
  const timeline = [...(loanCase.timeline ?? [])].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const communications = loanCase.communicationMessages ?? [];
  const auditEvents = [...(loanCase.auditEvents ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="card" style={{ padding: 36 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <div>
          <div
            style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}
          >
            {loanCase.borrowerId}
          </div>
          <div
            className="mono"
            style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginTop: 3 }}
          >
            {loanCase.id} &middot; version {loanCase.version}
          </div>
        </div>
        <StatusPill status={loanCase.status} />
      </div>

      <DossierSection title="Loan summary">
        <FieldGrid
          fields={[
            ['Loan type', formatLoanType(loanCase.loanType)],
            ['Requested amount', formatCurrency(loanCase.requestedAmount)],
            [
              'Stated monthly income',
              formatCurrency(loanCase.statedMonthlyIncome),
            ],
            ['Jurisdiction', loanCase.jurisdictionCode],
            ['Opened', formatDateTime(loanCase.createdAt)],
            ['Last updated', formatDateTime(loanCase.updatedAt)],
          ]}
        />
      </DossierSection>

      {loanCase.policyBinding && (
        <DossierSection title="Policy binding">
          <FieldGrid
            fields={[
              ['Context', loanCase.policyBinding.contextKey],
              ['Bound', formatDateTime(loanCase.policyBinding.boundAt)],
              [
                'Revalidate after',
                formatDateTime(loanCase.policyBinding.revalidateAfter),
              ],
              ...(loanCase.policyBinding.policySnapshot
                ? ([
                    [
                      'Resolution',
                      loanCase.policyBinding.policySnapshot.resolutionStatus,
                    ],
                  ] as [string, string][])
                : []),
            ]}
          />
        </DossierSection>
      )}

      <DossierSection title={`Conditions (${conditions.length})`}>
        {conditions.length === 0 ? (
          <EmptyNote>No conditions on this case.</EmptyNote>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12.5,
            }}
          >
            <tbody>
              {conditions.map((c) => (
                <tr
                  key={c.id}
                  style={{ borderTop: '1px solid var(--gridline)' }}
                >
                  <td
                    style={{ padding: '8px 0', fontWeight: 600, width: '30%' }}
                  >
                    {c.code}
                  </td>
                  <td style={{ padding: '8px 0', color: 'var(--ink-2)' }}>
                    {c.description}
                  </td>
                  <td
                    style={{ padding: '8px 0', width: 110, textAlign: 'right' }}
                  >
                    {c.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DossierSection>

      <DossierSection title={`Evidence (${evidenceFacts.length})`}>
        {evidenceFacts.length === 0 ? (
          <EmptyNote>No evidence collected yet.</EmptyNote>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12.5,
            }}
          >
            <tbody>
              {evidenceFacts.map((fact) => (
                <tr
                  key={fact.id}
                  style={{ borderTop: '1px solid var(--gridline)' }}
                >
                  <td
                    style={{ padding: '8px 0', fontWeight: 600, width: '25%' }}
                  >
                    {fact.factType}
                  </td>
                  <td style={{ padding: '8px 0', color: 'var(--ink-2)' }}>
                    {summarizeEvidenceValue(fact.factType, fact.value)}
                  </td>
                  <td
                    style={{
                      padding: '8px 0',
                      width: 160,
                      textAlign: 'right',
                      color: 'var(--ink-muted)',
                    }}
                  >
                    {formatDateTime(fact.observedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DossierSection>

      <DossierSection title="Timeline">
        {timeline.length === 0 ? (
          <EmptyNote>No activity yet.</EmptyNote>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {timeline.map((entry, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, fontSize: 12.5 }}>
                <div
                  className="mono"
                  style={{
                    color: 'var(--ink-muted)',
                    width: 150,
                    flex: 'none',
                  }}
                >
                  {formatDateTime(entry.timestamp)}
                </div>
                <div>{entry.summary}</div>
              </div>
            ))}
          </div>
        )}
      </DossierSection>

      {communications.length > 0 && (
        <DossierSection title={`Communications (${communications.length})`}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12.5,
            }}
          >
            <tbody>
              {communications.map((message) => (
                <tr
                  key={message.id}
                  style={{ borderTop: '1px solid var(--gridline)' }}
                >
                  <td
                    style={{ padding: '8px 0', fontWeight: 600, width: '25%' }}
                  >
                    {message.classification} &middot; {message.channel}
                  </td>
                  <td style={{ padding: '8px 0', color: 'var(--ink-2)' }}>
                    {message.status}
                  </td>
                  <td
                    style={{
                      padding: '8px 0',
                      width: 160,
                      textAlign: 'right',
                      color: 'var(--ink-muted)',
                    }}
                  >
                    {formatDateTime(message.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DossierSection>
      )}

      <DossierSection title={`Audit trail (${auditEvents.length})`}>
        {auditEvents.length === 0 ? (
          <EmptyNote>No audit events recorded.</EmptyNote>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12.5,
            }}
          >
            <tbody>
              {auditEvents.map((event) => (
                <tr
                  key={event.id}
                  style={{ borderTop: '1px solid var(--gridline)' }}
                >
                  <td
                    className="mono"
                    style={{
                      padding: '8px 0',
                      width: 150,
                      color: 'var(--ink-muted)',
                    }}
                  >
                    {formatDateTime(event.createdAt)}
                  </td>
                  <td
                    style={{ padding: '8px 0', fontWeight: 600, width: '30%' }}
                  >
                    {event.action}
                  </td>
                  <td style={{ padding: '8px 0', color: 'var(--ink-2)' }}>
                    {event.actorId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DossierSection>
    </div>
  );
}

function DossierSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 26 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--ink-muted)',
          borderBottom: '1px solid var(--gridline)',
          paddingBottom: 8,
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function FieldGrid({ fields }: { fields: [string, string][] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '10px 24px',
      }}
    >
      {fields.map(([label, value]) => (
        <div
          key={label}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12.5,
          }}
        >
          <span style={{ color: 'var(--ink-muted)' }}>{label}</span>
          <span style={{ fontWeight: 600 }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>{children}</div>
  );
}
