import { useState } from 'react';
import { NavRail } from './components/NavRail';
import { CaseList } from './components/CaseList';
import { CaseDetail } from './components/CaseDetail';
import { ConnectScreen } from './components/ConnectScreen';
import { getStoredActorId, getStoredToken, clearSession } from './auth';
import { SearchIcon } from './components/icons';

export function App() {
  const [connected, setConnected] = useState(() => Boolean(getStoredToken() && getStoredActorId()));
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  if (!connected) {
    return <ConnectScreen onConnected={() => setConnected(true)} />;
  }

  const actorId = getStoredActorId() ?? '';
  const initials = actorId
    .split(/[\s-]+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div style={{ width: '100%', height: '100vh', background: 'var(--page)', display: 'flex' }}>
      <NavRail initials={initials || '?'} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div
          style={{
            height: 56,
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 28px',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13.5, color: 'var(--ink-muted)' }}>Meridian</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" strokeWidth="2">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Cases</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <SearchIcon size={17} color="var(--ink-2)" />
            <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
            <div style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>{actorId}</div>
            <button
              className="btn"
              style={{ fontSize: 12, padding: '5px 10px' }}
              onClick={() => {
                clearSession();
                setConnected(false);
                setSelectedCaseId(null);
              }}
            >
              Disconnect
            </button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <CaseList selectedCaseId={selectedCaseId} onSelectCase={setSelectedCaseId} />
          {selectedCaseId ? (
            <CaseDetail caseId={selectedCaseId} />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Select a case to view its detail.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
