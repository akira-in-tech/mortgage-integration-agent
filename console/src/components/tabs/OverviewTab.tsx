import { useState } from 'react';
import { useMutation } from '@apollo/client';
import type { LoanCase } from '../../graphql/types';
import { useCaseMutations } from '../../useCaseMutations';
import { CHECK_POLICY_CHANGE_IMPACT_MUTATION } from '../../graphql/mutations';
import { AlertTriangleIcon, PolicyIcon } from '../icons';
import {
  formatDateTime,
  formatRelativeTime,
  summarizeEvidenceValue,
} from '../../format';

export function OverviewTab({ loanCase }: { loanCase: LoanCase }) {
  const openCondition = (loanCase.conditions ?? []).find(
    (c) => c.status === 'OPEN',
  );
  const { resolveCondition, resolvingCondition, error } = useCaseMutations(
    loanCase.id,
  );

  const recentActivity = [...(loanCase.timeline ?? [])]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, 3);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 20,
      }}
    >
      {openCondition && (
        <div className="card-elevated" style={{ padding: 19 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}
          >
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
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            {openCondition.code}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--ink-2)',
              lineHeight: 1.55,
              marginBottom: 14,
            }}
          >
            {openCondition.description}
          </div>
          {error && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--critical)',
                marginBottom: 8,
              }}
            >
              {error.message}
            </div>
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <PolicyIcon color="var(--ink-2)" />
            <div style={{ fontSize: 14, fontWeight: 700 }}>Policy binding</div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
              fontSize: 12.5,
            }}
          >
            <Row
              label="Context"
              value={loanCase.policyBinding.contextKey}
              mono
            />
            <Row
              label="Bound"
              value={formatRelativeTime(loanCase.policyBinding.boundAt)}
            />
            <Row
              label="Revalidate after"
              value={formatDateTime(loanCase.policyBinding.revalidateAfter)}
            />
            {loanCase.policyBinding.policySnapshot && (
              <Row
                label="Resolution"
                value={loanCase.policyBinding.policySnapshot.resolutionStatus}
              />
            )}
          </div>
          {/* key={loanCase.id}: forces a fresh form when the reviewer
              switches cases, so a result from a different case can never
              stay on screen looking like it belongs to this one. */}
          <PolicyImpactCheck key={loanCase.id} caseId={loanCase.id} />
        </div>
      )}

      <div className="card" style={{ padding: 19 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
          Evidence summary
        </div>
        {(loanCase.evidenceFacts ?? []).length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
            No evidence collected yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(loanCase.evidenceFacts ?? []).map((fact) => (
              <div
                key={fact.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                  {fact.factType}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 12.5, fontWeight: 600 }}
                >
                  {summarizeEvidenceValue(fact.factType, fact.value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 19 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
          Recent activity
        </div>
        {recentActivity.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
            No activity yet.
          </div>
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
                  <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                    {formatRelativeTime(entry.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Lets a reviewer check whether a specific policy version (usually one
// that was just published) would change how this case resolves, without
// actually re-running or changing anything on the case. There's no
// screen anywhere yet to browse existing policy versions and pick one —
// the reviewer has to already have the id from whoever published it.
function PolicyImpactCheck({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false);
  const [policyVersionId, setPolicyVersionId] = useState('');
  const [checkImpact, { data, loading, error }] = useMutation(
    CHECK_POLICY_CHANGE_IMPACT_MUTATION,
  );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!policyVersionId.trim()) return;
    void checkImpact({
      variables: { caseId, input: { policyVersionId: policyVersionId.trim() } },
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn"
        style={{ fontSize: 11.5, padding: '4px 10px', marginTop: 12 }}
        onClick={() => setOpen(true)}
      >
        Check impact of a policy version
      </button>
    );
  }

  const result = data?.checkPolicyChangeImpact;

  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 14,
        borderTop: '1px solid var(--gridline)',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 8 }}>
        Check whether a policy version would require re-evaluating this case.
        There's no list to pick from yet — paste the id you were given.
      </div>
      <form
        onSubmit={submit}
        style={{ display: 'flex', gap: 8, alignItems: 'center' }}
      >
        <input
          className="mono"
          value={policyVersionId}
          onChange={(event) => setPolicyVersionId(event.target.value)}
          placeholder="policy version id"
          style={{
            flex: 1,
            fontSize: 12,
            padding: '6px 9px',
            borderRadius: 7,
            border: '1px solid var(--border)',
          }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          style={{ fontSize: 12, padding: '6px 12px' }}
          disabled={loading || !policyVersionId.trim()}
        >
          Check
        </button>
      </form>

      {error && (
        <div style={{ fontSize: 12, color: 'var(--critical)', marginTop: 8 }}>
          {error.message}
        </div>
      )}

      {result && (
        <div style={{ fontSize: 12.5, marginTop: 10 }}>
          {result.assessed ? (
            <>
              <ImpactBadge impact={result.impact} />
              {result.details && (
                <div style={{ color: 'var(--ink-2)', marginTop: 6 }}>
                  {result.details}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: 'var(--ink-muted)' }}>
              Not assessed{result.reason ? `: ${result.reason}` : '.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ImpactBadge({ impact }: { impact: string | null | undefined }) {
  const tone =
    impact === 'NO_IMPACT'
      ? 'good'
      : impact === 'REQUIRES_REEVALUATION'
        ? 'warning'
        : 'critical'; // AMBIGUOUS, or anything unexpected — treat as the most cautious case
  const label =
    impact === 'NO_IMPACT'
      ? 'No impact'
      : impact === 'REQUIRES_REEVALUATION'
        ? 'Requires re-evaluation'
        : 'Ambiguous';
  return (
    <span
      className="pill"
      style={{ background: `var(--${tone}-wash)`, color: `var(--${tone})` }}
    >
      {label}
    </span>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--ink-muted)' }}>{label}</span>
      <span className={mono ? 'mono' : undefined}>{value}</span>
    </div>
  );
}
