import { useState } from 'react';
import { setStoredToken, setStoredActorId } from '../auth';

export function ConnectScreen({ onConnected }: { onConnected: () => void }) {
  const [token, setToken] = useState('');
  const [actorId, setActorId] = useState('');

  function connect(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim() || !actorId.trim()) return;
    setStoredToken(token.trim());
    setStoredActorId(actorId.trim());
    onConnected();
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--page)',
      }}
    >
      <form onSubmit={connect} className="card-elevated" style={{ padding: 32, width: 380 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Connect to Meridian</div>
        <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 22, lineHeight: 1.5 }}>
          Paste an API client bearer token (from <code>npm run create-api-client</code>) and your
          name — actions you take are recorded under it, distinct from the credential itself.
        </div>
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Bearer token</label>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="00000000-0000-0000-0000-000000000000.…"
          className="mono"
          style={{
            width: '100%',
            fontSize: 13,
            padding: '9px 11px',
            borderRadius: 7,
            border: '1px solid var(--border)',
            marginBottom: 16,
          }}
        />
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Your name</label>
        <input
          value={actorId}
          onChange={(e) => setActorId(e.target.value)}
          placeholder="reviewer-1"
          style={{
            width: '100%',
            fontSize: 13,
            fontFamily: 'var(--font-sans)',
            padding: '9px 11px',
            borderRadius: 7,
            border: '1px solid var(--border)',
            marginBottom: 22,
          }}
        />
        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
          Connect
        </button>
      </form>
    </div>
  );
}
