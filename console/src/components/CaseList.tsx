import { useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import { CASES_QUERY } from '../graphql/queries';
import type { CaseEdge, CaseStatus } from '../graphql/types';
import { StatusPill } from './StatusPill';
import { SearchIcon } from './icons';
import { formatCurrency, formatRelativeTime } from '../format';
import { createDemoSandboxCase, hasDemoSandbox } from '../demo-sandbox';

const FILTER_CHIPS: { label: string; status: CaseStatus | null }[] = [
  { label: 'All', status: null },
  { label: 'Conditions open', status: 'CONDITIONS_OPEN' },
  { label: 'Waiting for review', status: 'WAITING_FOR_REVIEW' },
  { label: 'Manual review', status: 'MANUAL_REVIEW' },
  { label: 'Ready', status: 'READY_FOR_UNDERWRITING' },
];

const PAGE_SIZE = 20;

interface CaseListProps {
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
}

export function CaseList({ selectedCaseId, onSelectCase }: CaseListProps) {
  const [statusFilter, setStatusFilter] = useState<CaseStatus | null>(null);
  const [search, setSearch] = useState('');
  const [addingCase, setAddingCase] = useState(false);
  const [newAmount, setNewAmount] = useState('');
  const [newIncome, setNewIncome] = useState('');
  const [creatingCase, setCreatingCase] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data, loading, error, fetchMore, refetch } = useQuery(CASES_QUERY, {
    variables: { status: statusFilter, first: PAGE_SIZE },
    notifyOnNetworkStatusChange: true,
  });

  // M7-074: the guided walkthrough used to seed exactly one case per visit
  // -- trying a second scenario meant abandoning the whole sandbox and
  // starting over. Every case a guest-sandbox tenant can ever see is
  // already synthetic by construction (RLS scopes this query to that one
  // tenant), so there's nothing to gate beyond "is this a sandbox at all."
  async function submitNewCase() {
    setCreatingCase(true);
    setCreateError(null);
    try {
      const parsedAmount = Number(newAmount);
      const parsedIncome = Number(newIncome);
      const scenario = {
        ...(newAmount.trim() &&
        Number.isFinite(parsedAmount) &&
        parsedAmount > 0
          ? { requestedAmount: parsedAmount }
          : {}),
        ...(newIncome.trim() &&
        Number.isFinite(parsedIncome) &&
        parsedIncome > 0
          ? { statedMonthlyIncome: parsedIncome }
          : {}),
      };
      const caseId = await createDemoSandboxCase(scenario);
      await refetch();
      onSelectCase(caseId);
      setAddingCase(false);
      setNewAmount('');
      setNewIncome('');
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Unable to create a new case.',
      );
    } finally {
      setCreatingCase(false);
    }
  }

  const filteredEdges = useMemo(() => {
    const edges = data?.cases.edges ?? [];
    if (!search.trim()) return edges;
    const needle = search.trim().toLowerCase();
    return edges.filter(
      (edge) =>
        edge.node.borrowerId.toLowerCase().includes(needle) ||
        edge.node.id.toLowerCase().includes(needle),
    );
  }, [data, search]);

  function loadMore() {
    if (!data?.cases.pageInfo.hasNextPage) return;
    fetchMore({
      variables: {
        after: data.cases.pageInfo.endCursor,
        status: statusFilter,
        first: PAGE_SIZE,
      },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult) return prev;
        return {
          cases: {
            ...fetchMoreResult.cases,
            edges: [...prev.cases.edges, ...fetchMoreResult.cases.edges],
          },
        };
      },
    });
  }

  return (
    <section
      aria-labelledby="case-list-heading"
      style={{
        width: 368,
        flex: 'none',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div style={{ padding: '18px 18px 12px', flex: 'none' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <h1
            id="case-list-heading"
            style={{
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              margin: 0,
            }}
          >
            Cases
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              className="mono"
              style={{ fontSize: 12, color: 'var(--ink-muted)' }}
            >
              {data ? `${filteredEdges.length} shown` : '…'}
            </div>
            {hasDemoSandbox() && (
              <button
                type="button"
                className="btn"
                style={{ fontSize: 12, padding: '5px 10px' }}
                onClick={() => {
                  setAddingCase((value) => !value);
                  setCreateError(null);
                }}
              >
                {addingCase ? 'Cancel' : '+ New case'}
              </button>
            )}
          </div>
        </div>
        {addingCase && (
          <div className="card" style={{ padding: 14, marginBottom: 11 }}>
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--ink-muted)',
                marginBottom: 10,
                lineHeight: 1.5,
              }}
            >
              Try another hypothetical scenario in this same sandbox — never
              real borrower data. Leave either field blank for the default
              guided scenario.
            </div>
            <label
              htmlFor="new-case-amount"
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                display: 'block',
                marginBottom: 4,
              }}
            >
              Requested loan amount ($)
            </label>
            <input
              id="new-case-amount"
              type="number"
              min={1}
              inputMode="numeric"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="e.g. 425000"
              style={{
                width: '100%',
                fontSize: 13,
                fontFamily: 'var(--font-sans)',
                padding: '7px 10px',
                borderRadius: 7,
                border: '1px solid var(--border)',
                marginBottom: 10,
                boxSizing: 'border-box',
              }}
            />
            <label
              htmlFor="new-case-income"
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                display: 'block',
                marginBottom: 4,
              }}
            >
              Stated monthly income ($)
            </label>
            <input
              id="new-case-income"
              type="number"
              min={1}
              inputMode="numeric"
              value={newIncome}
              onChange={(e) => setNewIncome(e.target.value)}
              placeholder="e.g. 8500"
              style={{
                width: '100%',
                fontSize: 13,
                fontFamily: 'var(--font-sans)',
                padding: '7px 10px',
                borderRadius: 7,
                border: '1px solid var(--border)',
                marginBottom: 10,
                boxSizing: 'border-box',
              }}
            />
            {createError && (
              <div
                role="alert"
                style={{ fontSize: 12, color: '#b42318', marginBottom: 10 }}
              >
                {createError}
              </div>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={creatingCase}
              onClick={() => void submitNewCase()}
              style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
            >
              {creatingCase ? 'Creating…' : 'Create case'}
            </button>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 11px',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--page)',
            marginBottom: 11,
          }}
        >
          <SearchIcon size={14} color="var(--ink-muted)" />
          <label className="sr-only" htmlFor="case-search">
            Search borrower or case ID
          </label>
          <input
            id="case-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search borrower, case ID…"
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              color: 'var(--ink)',
              width: '100%',
            }}
          />
        </div>
        <div
          role="group"
          aria-label="Filter cases by status"
          style={{ display: 'flex', gap: 6, overflowX: 'auto' }}
        >
          {FILTER_CHIPS.map((chip) => {
            const active = chip.status === statusFilter;
            return (
              <button
                key={chip.label}
                type="button"
                aria-pressed={active}
                onClick={() => setStatusFilter(chip.status)}
                style={{
                  flex: 'none',
                  padding: '5px 11px',
                  borderRadius: 999,
                  border: active ? 'none' : '1px solid var(--border)',
                  background: active ? 'var(--ink)' : 'var(--page)',
                  color: active ? '#fff' : 'var(--ink-2)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          borderTop: '1px solid var(--gridline)',
        }}
      >
        {loading && !data && (
          <div style={{ padding: 20, fontSize: 13, color: 'var(--ink-muted)' }}>
            Loading cases…
          </div>
        )}
        {error && (
          <div style={{ padding: 20, fontSize: 13, color: 'var(--critical)' }}>
            Couldn&rsquo;t load cases: {error.message}
          </div>
        )}
        {!loading && !error && filteredEdges.length === 0 && (
          <div style={{ padding: 20, fontSize: 13, color: 'var(--ink-muted)' }}>
            No cases match.
          </div>
        )}
        {filteredEdges.map((edge: CaseEdge) => (
          <CaseRow
            key={edge.node.id}
            edge={edge}
            selected={edge.node.id === selectedCaseId}
            onClick={() => onSelectCase(edge.node.id)}
          />
        ))}
        {data?.cases.pageInfo.hasNextPage && (
          <div
            style={{
              padding: '16px 18px',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <button
              className="btn"
              style={{ fontSize: 12, padding: '7px 14px' }}
              onClick={loadMore}
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function CaseRow({
  edge,
  selected,
  onClick,
}: {
  edge: CaseEdge;
  selected: boolean;
  onClick: () => void;
}) {
  const { node } = edge;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      style={{
        padding: selected ? '13px 18px' : '13px 18px 13px 20.5px',
        background: selected ? 'var(--accent-wash)' : undefined,
        cursor: 'pointer',
        width: '100%',
        borderTop: 'none',
        borderRight: 'none',
        borderBottom: '1px solid var(--gridline)',
        borderLeft: selected
          ? '2.5px solid var(--accent)'
          : '2.5px solid transparent',
        fontFamily: 'var(--font-sans)',
        color: 'var(--ink)',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 5,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>{node.borrowerId}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
          {formatRelativeTime(node.createdAt)}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <StatusPill status={node.status} />
        <div className="mono" style={{ fontSize: 12, color: 'var(--ink-2)' }}>
          {formatCurrency(node.requestedAmount)}
        </div>
      </div>
      <div
        className="mono"
        style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 3 }}
      >
        {node.id.slice(0, 8)}
      </div>
    </button>
  );
}
