import { useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import { CASES_QUERY } from '../graphql/queries';
import type { CaseEdge, CaseStatus } from '../graphql/types';
import { StatusPill } from './StatusPill';
import { SearchIcon } from './icons';
import { formatCurrency, formatRelativeTime } from '../format';

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

  const { data, loading, error, fetchMore } = useQuery(CASES_QUERY, {
    variables: { status: statusFilter, first: PAGE_SIZE },
    notifyOnNetworkStatusChange: true,
  });

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
          <div
            className="mono"
            style={{ fontSize: 12, color: 'var(--ink-muted)' }}
          >
            {data ? `${filteredEdges.length} shown` : '…'}
          </div>
        </div>
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
