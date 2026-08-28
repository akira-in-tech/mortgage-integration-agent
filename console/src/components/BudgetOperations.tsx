import { useCallback, useEffect, useState } from 'react';
import {
  getAgentBudgetAggregateUsage,
  listUnknownAgentBudgetReservations,
  reconcileAgentBudgetReservation,
  type AgentBudgetAggregateUsage,
  type AgentBudgetReservationQueueItem,
} from '../agent-budget-api';
import { DataTable } from './DataTable';

export function BudgetOperations() {
  const [usage, setUsage] = useState<AgentBudgetAggregateUsage | null>(null);
  const [reservations, setReservations] = useState<
    AgentBudgetReservationQueueItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [usageResult, queueResult] = await Promise.allSettled([
      getAgentBudgetAggregateUsage(),
      listUnknownAgentBudgetReservations(),
    ]);
    if (usageResult.status === 'fulfilled') {
      setUsage(usageResult.value);
      setUsageError(null);
    } else {
      setUsageError(usageResult.reason.message);
    }
    if (queueResult.status === 'fulfilled') {
      setReservations(queueResult.value);
      setQueueError(null);
    } else {
      setQueueError(queueResult.reason.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function reconcile(outcome: 'COMMITTED' | 'RELEASED') {
    if (!selectedId || resolutionNote.trim().length < 10) return;
    const parsedCost = actualCost === '' ? undefined : Number(actualCost);
    if (
      outcome === 'COMMITTED' &&
      parsedCost !== undefined &&
      (!Number.isSafeInteger(parsedCost) || parsedCost < 0)
    ) {
      setActionMessage('Actual cost must be a nonnegative integer.');
      return;
    }
    setSubmitting(true);
    setActionMessage(null);
    try {
      await reconcileAgentBudgetReservation(selectedId, {
        outcome,
        resolutionNote: resolutionNote.trim(),
        ...(outcome === 'COMMITTED' && parsedCost !== undefined
          ? { actualCostMinorUnits: parsedCost }
          : {}),
      });
      setActionMessage(
        outcome === 'COMMITTED'
          ? 'Reservation committed with reviewer evidence.'
          : 'Reservation released with reviewer evidence.',
      );
      setSelectedId(null);
      setResolutionNote('');
      setActualCost('');
      await refresh();
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : 'Reconciliation failed.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Placeholder>Loading budget operations…</Placeholder>;

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '28px 32px',
        background: 'var(--page)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, margin: '0 0 5px' }}>
            Agent Budget Operations
          </h1>
          <div style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
            UTC-month authority and outcome-unknown reservations
          </div>
        </div>
        <button className="btn" type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      {usageError ? (
        <InlineError>
          Couldn&rsquo;t load aggregate usage: {usageError}
        </InlineError>
      ) : usage ? (
        <UsageSummary usage={usage} unknownCount={reservations.length} />
      ) : null}

      <section aria-labelledby="unknown-budget-heading">
        <h2
          id="unknown-budget-heading"
          style={{ fontSize: 15, margin: '24px 0 5px' }}
        >
          Outcome-unknown reservations
        </h2>
        <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 0 }}>
          Capacity stays reserved until a reviewer confirms whether the external
          effect occurred.
        </p>
        {queueError ? (
          <InlineError>
            Queue unavailable: {queueError}. Reviewer access is required.
          </InlineError>
        ) : (
          <DataTable
            columns={[
              'Created',
              'Reservation',
              'Provider calls',
              'Reserved cost',
              'Action',
            ]}
            emptyLabel="No outcome-unknown reservations."
            rows={reservations.map((reservation) => [
              new Date(reservation.createdAt).toLocaleString(),
              <span className="mono" key={`${reservation.id}-id`}>
                {reservation.id.slice(0, 8)}
              </span>,
              reservation.units.providerCallUnits,
              formatMinorUnits(
                reservation.units.costMinorUnits,
                usage?.currency,
              ),
              <button
                key={`${reservation.id}-action`}
                type="button"
                className="btn"
                onClick={() => {
                  setSelectedId(reservation.id);
                  setActionMessage(null);
                }}
              >
                Reconcile
              </button>,
            ])}
          />
        )}
      </section>

      {selectedId && (
        <section
          className="card"
          aria-labelledby="reconcile-heading"
          style={{ marginTop: 18, padding: 20, maxWidth: 720 }}
        >
          <h2 id="reconcile-heading" style={{ fontSize: 15, marginTop: 0 }}>
            Reconcile {selectedId.slice(0, 8)}
          </h2>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600 }}>
            Evidence note
            <textarea
              value={resolutionNote}
              onChange={(event) => setResolutionNote(event.target.value)}
              minLength={10}
              maxLength={2000}
              rows={4}
              style={{ display: 'block', width: '100%', marginTop: 6 }}
            />
          </label>
          <label
            style={{
              display: 'block',
              fontSize: 12.5,
              fontWeight: 600,
              marginTop: 14,
            }}
          >
            Actual cost in minor units (commit only)
            <input
              type="number"
              min="0"
              step="1"
              value={actualCost}
              onChange={(event) => setActualCost(event.target.value)}
              style={{ display: 'block', width: 220, marginTop: 6 }}
            />
          </label>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={submitting || resolutionNote.trim().length < 10}
              onClick={() => void reconcile('COMMITTED')}
            >
              Commit effect
            </button>
            <button
              type="button"
              className="btn"
              disabled={submitting || resolutionNote.trim().length < 10}
              onClick={() => void reconcile('RELEASED')}
            >
              Release capacity
            </button>
            <button
              type="button"
              className="btn"
              disabled={submitting}
              onClick={() => setSelectedId(null)}
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      <div aria-live="polite" style={{ marginTop: 12, fontSize: 12.5 }}>
        {actionMessage}
      </div>
    </div>
  );
}

function UsageSummary({
  usage,
  unknownCount,
}: {
  usage: AgentBudgetAggregateUsage;
  unknownCount: number;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 16,
      }}
    >
      <UsageTile
        label="Provider calls remaining"
        value={
          usage.remainingProviderCalls === null
            ? 'Disabled'
            : `${usage.remainingProviderCalls} / ${usage.providerCallLimit}`
        }
        detail={`${usage.providerCallUsed} used · ${usage.providerCallReserved} reserved`}
      />
      <UsageTile
        label="Cost remaining"
        value={
          usage.remainingCostMinorUnits === null
            ? 'Disabled'
            : formatMinorUnits(usage.remainingCostMinorUnits, usage.currency)
        }
        detail={`${formatMinorUnits(usage.costUsedMinorUnits, usage.currency)} used · ${formatMinorUnits(usage.costReservedMinorUnits, usage.currency)} reserved`}
      />
      <UsageTile
        label="Needs reconciliation"
        value={String(unknownCount)}
        detail={`Window ${usage.windowStart}`}
        warning={unknownCount > 0}
      />
    </div>
  );
}

function UsageTile({
  label,
  value,
  detail,
  warning,
}: {
  label: string;
  value: string;
  detail: string;
  warning?: boolean;
}) {
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>{label}</div>
      <div
        className="mono"
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: warning ? 'var(--warning)' : 'var(--ink)',
          margin: '7px 0 4px',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>{detail}</div>
    </div>
  );
}

function formatMinorUnits(value: number, currency: string | null | undefined) {
  if (!currency) return `${value} minor units`;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(value / 100);
}

function InlineError({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="card"
      style={{ padding: 14, color: 'var(--critical)', fontSize: 12.5 }}
    >
      {children}
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--ink-muted)',
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}
