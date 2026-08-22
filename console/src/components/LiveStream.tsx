import { useEffect, useRef } from 'react';
import { useQuery } from '@apollo/client';
import { RECENT_ACTIVITY_QUERY } from '../graphql/queries';
import { formatDateTime, formatRelativeTime } from '../format';

const POLL_MS = 8_000;

// "Live" here means real, near-live polling — the same honest definition
// Ops Dashboard already settled on — not a fabricated WebSocket push this
// codebase has no subsystem for. recentActivity (M6-010) is a real,
// tenant-wide, cross-case audit-event feed, newest first.
export function LiveStream() {
  const { data, loading, error, startPolling, stopPolling } = useQuery(
    RECENT_ACTIVITY_QUERY,
    {
      variables: { limit: 50 },
    },
  );

  useEffect(() => {
    startPolling(POLL_MS);
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const events = data?.recentActivity ?? [];

  // "New since the previous poll" — compared against the ids this
  // component last rendered with real data, not the very first load
  // (which would otherwise highlight every row on page open). Tracked
  // with an explicit boolean, not just "is the ids ref non-null":
  // Apollo's own loading→loaded transition is itself a second render
  // with real `data`, and an empty-but-non-null Set is still truthy, so
  // that first real-data render must be recognized by a flag, not by
  // the ref's own emptiness.
  const previousIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedOnceRef = useRef(false);
  const newIds = hasLoadedOnceRef.current
    ? new Set(
        events
          .filter((e) => !previousIdsRef.current.has(e.id))
          .map((e) => e.id),
      )
    : new Set<string>();
  useEffect(() => {
    if (!data) return;
    previousIdsRef.current = new Set(events.map((e) => e.id));
    hasLoadedOnceRef.current = true;
  });

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
          alignItems: 'center',
          gap: 10,
          marginBottom: 20,
        }}
      >
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            margin: 0,
          }}
        >
          Live Stream
        </h1>
        <LivePulse />
      </div>

      {loading && !data && (
        <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
          Loading activity…
        </div>
      )}
      {error && (
        <div style={{ fontSize: 13, color: 'var(--critical)' }}>
          Couldn&rsquo;t load activity: {error.message}
        </div>
      )}

      {data && events.length === 0 && (
        <div
          className="card"
          style={{ padding: 24, fontSize: 13, color: 'var(--ink-muted)' }}
        >
          No activity recorded yet.
        </div>
      )}

      {events.length > 0 && (
        <div className="card">
          {events.map((event, i) => {
            const isNew = newIds.has(event.id);
            return (
              <div
                key={event.id}
                style={{
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                  padding: '13px 20px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--gridline)',
                  background: isNew ? 'var(--accent-wash)' : 'transparent',
                  transition: 'background 800ms ease',
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--ink-muted)',
                    width: 70,
                    flex: 'none',
                    marginTop: 2,
                  }}
                  title={formatDateTime(event.createdAt)}
                >
                  {formatRelativeTime(event.createdAt)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {event.action}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--ink-2)',
                      marginTop: 1,
                    }}
                  >
                    {event.actorId} &middot; {event.resourceType}
                    {event.resourceId
                      ? ` · ${event.resourceId.slice(0, 8)}`
                      : ''}
                    {event.reason ? ` — ${event.reason}` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LivePulse() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--good)',
        background: 'var(--good-wash)',
        padding: '3px 9px',
        borderRadius: 999,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--good)',
          animation: 'meridian-pulse 1.6s ease-in-out infinite',
        }}
      />
      Live
      <style>{`
        @keyframes meridian-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </span>
  );
}
