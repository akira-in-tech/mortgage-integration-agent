import { useState } from 'react';
import { setStoredToken, setStoredActorId } from '../auth';
import { beginOidcLogin } from '../oidc';
import { createDemoSandbox } from '../demo-sandbox';

type Mode = 'bearer' | 'oidc';

export function ConnectScreen({
  onConnected,
  onSandboxConnected,
  onPlatformAdmin,
}: {
  onConnected: () => void;
  onSandboxConnected: (caseId?: string) => void;
  onPlatformAdmin: () => void;
}) {
  const [mode, setMode] = useState<Mode>('bearer');
  const [token, setToken] = useState('');
  const [actorId, setActorId] = useState('');
  const [redirecting, setRedirecting] = useState(false);
  const [startingSandbox, setStartingSandbox] = useState(false);
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [requestedAmount, setRequestedAmount] = useState('');
  const [statedMonthlyIncome, setStatedMonthlyIncome] = useState('');

  async function startSandbox() {
    setStartingSandbox(true);
    setSandboxError(null);
    try {
      // Blank fields omit that key entirely rather than sending an empty
      // string or NaN — the server's own default (the original,
      // deliberate-mismatch guided scenario) applies exactly as it did
      // before this customization existed.
      const parsedAmount = Number(requestedAmount);
      const parsedIncome = Number(statedMonthlyIncome);
      const scenario = {
        ...(requestedAmount.trim() &&
        Number.isFinite(parsedAmount) &&
        parsedAmount > 0
          ? { requestedAmount: parsedAmount }
          : {}),
        ...(statedMonthlyIncome.trim() &&
        Number.isFinite(parsedIncome) &&
        parsedIncome > 0
          ? { statedMonthlyIncome: parsedIncome }
          : {}),
      };
      const sandbox = await createDemoSandbox(scenario);
      // Audit fields expect an opaque UUID. The server generates it with the
      // isolated tenant rather than trusting a browser-chosen display name.
      setStoredActorId(sandbox.actorId ?? '');
      onSandboxConnected(sandbox.caseId);
    } catch (error) {
      setSandboxError(
        error instanceof Error
          ? error.message
          : 'Unable to create a live sandbox.',
      );
    } finally {
      setStartingSandbox(false);
    }
  }

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

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void startSandbox()}
          disabled={startingSandbox}
          style={{
            width: '100%',
            justifyContent: 'center',
            margin: '16px 0 8px',
          }}
        >
          {startingSandbox ? 'Creating your sandbox…' : 'Try live sandbox'}
        </button>
        <p
          style={{
            fontSize: 12,
            color: 'var(--ink-muted)',
            lineHeight: 1.5,
            margin: '0 0 18px',
          }}
        >
          No sign-up. Explore a private, synthetic case with agent workflows,
          policy checks, reviewer actions, and audit history. Your workspace
          expires automatically.
        </p>

        <button
          type="button"
          onClick={() => setCustomizing((value) => !value)}
          aria-expanded={customizing}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--accent)',
            marginBottom: customizing ? 12 : 18,
          }}
        >
          {customizing ? '▾ Hide scenario' : '▸ Customize the scenario'}
        </button>

        {customizing && (
          <div style={{ marginBottom: 18 }}>
            <FieldLabel htmlFor="scenario-amount">
              Requested loan amount ($)
            </FieldLabel>
            <input
              id="scenario-amount"
              type="number"
              min={1}
              inputMode="numeric"
              value={requestedAmount}
              onChange={(e) => setRequestedAmount(e.target.value)}
              placeholder="e.g. 425000"
              style={inputStyle}
            />
            <FieldLabel htmlFor="scenario-income">
              Stated monthly income ($)
            </FieldLabel>
            <input
              id="scenario-income"
              type="number"
              min={1}
              inputMode="numeric"
              value={statedMonthlyIncome}
              onChange={(e) => setStatedMonthlyIncome(e.target.value)}
              placeholder="e.g. 8500"
              style={{ ...inputStyle, marginBottom: 4 }}
            />
            <p
              style={{
                fontSize: 11,
                color: 'var(--ink-muted)',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Hypothetical numbers for this synthetic case only — never real
              borrower data. Leave blank for the default guided scenario.
            </p>
          </div>
        )}
        {sandboxError && (
          <div
            role="alert"
            style={{ fontSize: 12, color: '#b42318', marginBottom: 12 }}
          >
            {sandboxError}
          </div>
        )}

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
