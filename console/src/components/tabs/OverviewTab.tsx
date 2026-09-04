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
  const boundPolicyVersions = parseBoundPolicyVersions(
    loanCase.policyBinding?.policySnapshot?.versions,
  );

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
          <PolicyImpactCheck
            key={loanCase.id}
            caseId={loanCase.id}
            policyVersions={boundPolicyVersions}
          />
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

interface BoundPolicyVersionOption {
  policyVersionId: string;
  ruleId: string;
  version: string;
}

/** Converts the snapshot's JSON representation into safe display options. */
function parseBoundPolicyVersions(value: unknown): BoundPolicyVersionOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.policyVersionId !== 'string' ||
      typeof candidate.ruleId !== 'string' ||
      typeof candidate.version !== 'string'
    ) {
      return [];
    }
    return [
      {
        policyVersionId: candidate.policyVersionId,
        ruleId: candidate.ruleId,
        version: candidate.version,
      },
    ];
  });
}

// Candidate ids come only from this case's immutable policy snapshot. This
// gives tenant reviewers a usable selector without exposing the platform-wide
// policy catalog, which remains a separately authorized admin surface.
function PolicyImpactCheck({
  caseId,
  policyVersions,
}: {
  caseId: string;
  policyVersions: BoundPolicyVersionOption[];
}) {
  const [open, setOpen] = useState(false);
  const [policyVersionId, setPolicyVersionId] = useState(
    policyVersions[0]?.policyVersionId ?? '',
  );
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
        Choose one of the immutable versions captured in this case's policy
        binding.
      </div>
      <form
        onSubmit={submit}
        style={{ display: 'flex', gap: 8, alignItems: 'center' }}
      >
        <select
          className="mono"
          aria-label="Policy version"
          value={policyVersionId}
          onChange={(event) => setPolicyVersionId(event.target.value)}
          style={{
            flex: 1,
            fontSize: 12,
            padding: '6px 9px',
            borderRadius: 7,
            border: '1px solid var(--border)',
          }}
        >
          {policyVersions.length === 0 && (
            <option value="">No bound policy versions</option>
          )}
          {policyVersions.map((candidate) => (
            <option
              key={candidate.policyVersionId}
              value={candidate.policyVersionId}
            >
              {candidate.ruleId} · {candidate.version}
            </option>
          ))}
        </select>
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
