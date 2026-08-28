import { useState } from 'react';
import { setStoredToken, setStoredActorId } from '../auth';
import { beginOidcLogin } from '../oidc';

type Mode = 'bearer' | 'oidc';

export function ConnectScreen({
  onConnected,
  onPlatformAdmin,
}: {
  onConnected: () => void;
  onPlatformAdmin: () => void;
}) {
  const [mode, setMode] = useState<Mode>('bearer');
  const [token, setToken] = useState('');
  const [actorId, setActorId] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  function connectWithBearer(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim() || !actorId.trim()) return;
    setStoredToken(token.trim());
    setStoredActorId(actorId.trim());
    onConnected();
  }

  function connectWithOidc(e: React.FormEvent) {
    e.preventDefault();
    setRedirecting(true);
    // The backend owns PKCE state, code exchange, refresh, and provider
    // tokens. The browser follows only the same-origin login endpoint.
    beginOidcLogin();
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--page)',
      }}
    >
      <section
        className="card-elevated"
        aria-labelledby="connect-heading"
        style={{ padding: 32, width: 380 }}
      >
        <h1
          id="connect-heading"
          style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}
        >
          Connect to Meridian
        </h1>

        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          <ModeTab active={mode === 'bearer'} onClick={() => setMode('bearer')}>
            Bearer token
          </ModeTab>
          <ModeTab active={mode === 'oidc'} onClick={() => setMode('oidc')}>
            Sign in with SSO
          </ModeTab>
        </div>

        {mode === 'bearer' ? (
          <form onSubmit={connectWithBearer}>
            <div
              style={{
                fontSize: 13,
                color: 'var(--ink-muted)',
                marginBottom: 18,
                lineHeight: 1.5,
              }}
            >
              Paste an API client bearer token (from{' '}
              <code>npm run create-api-client</code>) and your name — actions
              you take are recorded under it, distinct from the credential
              itself.
            </div>
            <FieldLabel htmlFor="bearer-token">Bearer token</FieldLabel>
            <input
              id="bearer-token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000.…"
              className="mono"
              style={inputStyle}
            />
            <FieldLabel htmlFor="actor-name">Your name</FieldLabel>
            <input
              id="actor-name"
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
              placeholder="reviewer-1"
              style={{ ...inputStyle, marginBottom: 22 }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Connect
            </button>
          </form>
        ) : (
          <form onSubmit={connectWithOidc}>
            <div
              style={{
                fontSize: 13,
                color: 'var(--ink-muted)',
                marginBottom: 18,
                lineHeight: 1.5,
              }}
            >
              Sign in with your OIDC account. After authentication, the console
              loads only the tenant memberships provisioned for that identity.
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={redirecting}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {redirecting ? 'Redirecting…' : 'Sign in'}
            </button>
          </form>
        )}

        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: '1px solid var(--gridline)',
            textAlign: 'center',
          }}
        >
          <button
            type="button"
            className="btn"
            style={{ fontSize: 12 }}
            onClick={onPlatformAdmin}
          >
            Platform admin sign-in
          </button>
          <div
            style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 6 }}
          >
            Not a tenant — drives provider promotion across every tenant.
          </div>
        </div>
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 13,
  fontFamily: 'var(--font-sans)',
  padding: '9px 11px',
  borderRadius: 7,
  border: '1px solid var(--border)',
  marginBottom: 16,
  boxSizing: 'border-box',
};

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        fontSize: 12,
        fontWeight: 600,
        display: 'block',
        marginBottom: 6,
      }}
    >
      {children}
    </label>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        flex: 1,
        fontSize: 12.5,
        fontWeight: 600,
        padding: '7px 0',
        borderRadius: 7,
        border: 'none',
        cursor: 'pointer',
        background: active ? 'var(--accent-wash)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--ink-muted)',
      }}
    >
      {children}
    </button>
  );
}
