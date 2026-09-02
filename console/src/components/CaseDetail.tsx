import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { CASE_QUERY } from '../graphql/queries';
import { START_WORKFLOW_RUN_MUTATION } from '../graphql/mutations';
import { StatusPill } from './StatusPill';
import { DocIcon } from './icons';
import { useCaseMutations } from '../useCaseMutations';
import { formatCurrency, formatRelativeTime } from '../format';
import { OverviewTab } from './tabs/OverviewTab';
import { EvidenceTab } from './tabs/EvidenceTab';
import { ConditionsTab } from './tabs/ConditionsTab';
import { TimelineTab } from './tabs/TimelineTab';
import { CommunicationsTab } from './tabs/CommunicationsTab';
import { AuditTab } from './tabs/AuditTab';
import { SandboxGuide } from './SandboxGuide';

type TabId =
  | 'overview'
  | 'evidence'
  | 'conditions'
  | 'timeline'
  | 'communications'
  | 'audit';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'conditions', label: 'Conditions' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'communications', label: 'Communications' },
  { id: 'audit', label: 'Audit' },
];

const TERMINAL_STATUSES = new Set(['CLOSED', 'READY_FOR_UNDERWRITING']);

export function CaseDetail({
  caseId,
  isSandbox = false,
  onOpenDossier,
}: {
  caseId: string;
  isSandbox?: boolean;
  onOpenDossier: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [escalating, setEscalating] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');

  const { data, loading, error } = useQuery(CASE_QUERY, {
    variables: { caseId },
    // A sandbox contains exactly one isolated synthetic case. Polling this
    // narrow query makes Temporal's asynchronous transitions visible without
    // turning the normal authenticated operations console into a polling UI.
    pollInterval: isSandbox ? 2_500 : 0,
  });
  const [startWorkflow, startWorkflowState] = useMutation(
    START_WORKFLOW_RUN_MUTATION,
    {
      refetchQueries: [{ query: CASE_QUERY, variables: { caseId } }],
      awaitRefetchQueries: true,
    },
  );
  const {
    escalate,
    escalating: escalateInFlight,
    error: mutationError,
  } = useCaseMutations(caseId);

  if (loading && !data) {
    return <Placeholder>Loading case…</Placeholder>;
  }
  if (error) {
    return (
      <Placeholder tone="critical">
        Couldn&rsquo;t load this case: {error.message}
      </Placeholder>
    );
  }
  if (!data) {
    return <Placeholder>No case data.</Placeholder>;
  }

  const loanCase = data.case;
  const openConditionCount = (loanCase.conditions ?? []).filter(
    (c) => c.status === 'OPEN',
  ).length;
  const canEscalate =
    !TERMINAL_STATUSES.has(loanCase.status) &&
    loanCase.status !== 'WAITING_FOR_REVIEW';

  async function submitEscalation() {
    if (!escalateReason.trim()) return;
    await escalate(escalateReason.trim());
    setEscalating(false);
    setEscalateReason('');
  }

  function startSandboxEvaluation() {
    // The server keeps the start idempotent per case. Retrying after a brief
    // network interruption therefore resumes the same workflow rather than
    // creating a second evaluation for the synthetic record.
    void startWorkflow({ variables: { caseId } });
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        background: 'var(--page)',
      }}
    >
      <div
        style={{
          flex: 'none',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '22px 32px 0',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}
              >
                {loanCase.borrowerId}
              </div>
              <StatusPill status={loanCase.status} />
            </div>
            <div
              className="mono"
              style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 3 }}
            >
              {loanCase.id} &middot; opened{' '}
              {formatRelativeTime(loanCase.createdAt)} &middot; version{' '}
              {loanCase.version}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn"
              style={{ fontSize: 12.5 }}
              onClick={onOpenDossier}
            >
              <DocIcon size={13} />
              View dossier
            </button>
            {canEscalate &&
              (!escalating ? (
                <button className="btn" onClick={() => setEscalating(true)}>
                  Escalate
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    autoFocus
                    value={escalateReason}
                    onChange={(e) => setEscalateReason(e.target.value)}
                    placeholder="Reason for escalation…"
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 13,
                      padding: '7px 10px',
                      borderRadius: 7,
                      border: '1px solid var(--border)',
                      width: 220,
                    }}
                  />
                  <button
                    className="btn btn-primary"
                    disabled={escalateInFlight || !escalateReason.trim()}
                    onClick={submitEscalation}
                  >
                    Confirm
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      setEscalating(false);
                      setEscalateReason('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ))}
          </div>
        </div>

        {mutationError && (
          <div
            style={{ fontSize: 12, color: 'var(--critical)', marginTop: 10 }}
          >
            {mutationError.message}
          </div>
        )}
        {startWorkflowState.error && (
          <div
            role="alert"
            style={{ fontSize: 12, color: 'var(--critical)', marginTop: 10 }}
          >
            {startWorkflowState.error.message}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 28,
            margin: '18px 0 0',
            paddingBottom: 18,
            flexWrap: 'wrap',
          }}
        >
          <Stat label="Loan type" value={loanCase.loanType} />
          <Stat
            label="Requested amount"
            value={formatCurrency(loanCase.requestedAmount)}
            mono
          />
          <Stat
            label="Stated income / mo"
            value={formatCurrency(loanCase.statedMonthlyIncome)}
            mono
          />
          <Stat label="Jurisdiction" value={loanCase.jurisdictionCode} />
          <Stat label="Borrower ID" value={loanCase.borrowerId} mono />
        </div>

        <div style={{ display: 'flex', gap: 24 }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                fontFamily: 'var(--font-sans)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? 'var(--ink)' : 'var(--ink-2)',
                paddingBottom: 10,
                borderBottom:
                  activeTab === tab.id
                    ? '2px solid var(--accent)'
                    : '2px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {tab.label}
              {tab.id === 'conditions' && openConditionCount > 0 && (
                <span
                  style={{
                    background: 'var(--warning)',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 999,
                  }}
                >
                  {openConditionCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '24px 32px',
        }}
      >
        {isSandbox && (
          <SandboxGuide
            status={loanCase.status}
            openConditionCount={openConditionCount}
            starting={startWorkflowState.loading}
            onStartEvaluation={startSandboxEvaluation}
            onOpenTab={setActiveTab}
          />
        )}
        {activeTab === 'overview' && <OverviewTab loanCase={loanCase} />}
        {activeTab === 'evidence' && <EvidenceTab loanCase={loanCase} />}
        {activeTab === 'conditions' && <ConditionsTab loanCase={loanCase} />}
        {activeTab === 'timeline' && <TimelineTab loanCase={loanCase} />}
        {activeTab === 'communications' && (
          <CommunicationsTab loanCase={loanCase} />
        )}
        {activeTab === 'audit' && <AuditTab loanCase={loanCase} />}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginBottom: 2 }}>
        {label}
      </div>
      <div
        className={mono ? 'mono' : undefined}
        style={{ fontSize: 13, fontWeight: 600 }}
      >
        {value}
      </div>
    </div>
  );
}

function Placeholder({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: 'critical';
}) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: tone === 'critical' ? 'var(--critical)' : 'var(--ink-muted)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
