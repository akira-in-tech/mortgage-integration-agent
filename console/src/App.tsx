import { useEffect, useState } from 'react';
import { NavRail, type ConsoleView } from './components/NavRail';
import { CaseList } from './components/CaseList';
import { CaseDetail } from './components/CaseDetail';
import { CaseDossier } from './components/CaseDossier';
import { OpsDashboard } from './components/OpsDashboard';
import { LiveStream } from './components/LiveStream';
import { BudgetOperations } from './components/BudgetOperations';
import { AdminQueues } from './components/AdminQueues';
import { PlatformAdminConsole } from './components/PlatformAdminConsole';
import { ConnectScreen } from './components/ConnectScreen';
import { TenantSelectionScreen } from './components/TenantSelectionScreen';
import {
  getStoredActorId,
  getStoredToken,
  clearSession,
  setStoredActorId,
} from './auth';
import {
  loadOidcSession,
  hasOidcSession,
  hasOidcIdentity,
  clearOidcSession,
  beginOidcLogout,
} from './oidc';
import { SearchIcon } from './components/icons';
import {
  clearDemoSandbox,
  closeDemoSandbox,
  getDemoSandboxActorId,
  hasDemoSandbox,
  loadDemoSandbox,
} from './demo-sandbox';
import { clearGraphqlSessionCache } from './apollo-client';

export function App() {
  const [checkingOidcCallback, setCheckingOidcCallback] = useState(true);
  const [connected, setConnected] = useState(() =>
    Boolean(getStoredToken() && getStoredActorId()),
  );
  const [platformAdminMode, setPlatformAdminMode] = useState(false);
  const [selectingTenant, setSelectingTenant] = useState(false);
  const [memberships, setMemberships] = useState<
    import('./oidc').OidcTenantMembership[]
  >([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [dossierCaseId, setDossierCaseId] = useState<string | null>(null);
  const [view, setView] = useState<ConsoleView>('queue');

  useEffect(() => {
    loadOidcSession()
      .then((session) => {
        if (session.authenticated) {
          setMemberships(session.memberships);
          setConnected(hasOidcSession());
          setSelectingTenant(!hasOidcSession());
          return;
        }
        return loadDemoSandbox().then((sandbox) => {
          if (sandbox.authenticated) {
            setStoredActorId(sandbox.actorId ?? '');
            setSelectedCaseId(sandbox.caseId ?? null);
            setConnected(true);
          }
        });
      })
      // An unavailable identity endpoint must not strand machine-token users
      // on the startup screen; operational queries still report their own
      // transport failure after an explicit connection attempt.
      .catch(() => clearOidcSession())
      .finally(() => setCheckingOidcCallback(false));
  }, []);

  function disconnect() {
    const upstreamOidcSession = hasOidcIdentity();
    clearSession();
    setConnected(false);
    setSelectingTenant(false);
    setSelectedCaseId(null);
    // A browser can adopt another tenant without reloading the JavaScript
    // process. Clear tenant-shaped results at the same moment credentials are
    // discarded so the next session never renders the previous one from cache.
    void clearGraphqlSessionCache();
    if (upstreamOidcSession) {
      void beginOidcLogout();
    } else {
      clearOidcSession();
      if (hasDemoSandbox()) void closeDemoSandbox();
      else clearDemoSandbox();
    }
  }

  // Platform admin is a completely separate credential world from the
  // tenant session above — checked first, before the OIDC-callback wait,
  // since it never touches OIDC at all.
  if (platformAdminMode) {
    return <PlatformAdminConsole onExit={() => setPlatformAdminMode(false)} />;
  }

  if (checkingOidcCallback) {
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
        <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
          Signing in…
        </div>
      </div>
    );
  }

  if (!connected) {
    if (selectingTenant) {
      return (
        <TenantSelectionScreen
          memberships={memberships}
          onSelected={() => {
            setSelectingTenant(false);
            setConnected(true);
          }}
          onCancel={disconnect}
        />
      );
    }
    return (
      <ConnectScreen
        onConnected={() => setConnected(true)}
        onSandboxConnected={async (caseId) => {
          await clearGraphqlSessionCache();
          setSelectedCaseId(caseId ?? null);
          setView('queue');
          setConnected(true);
        }}
        onPlatformAdmin={() => setPlatformAdminMode(true)}
      />
    );
  }

  if (dossierCaseId) {
    return (
      <CaseDossier
        caseId={dossierCaseId}
        onClose={() => setDossierCaseId(null)}
      />
    );
  }

  const actorId = getDemoSandboxActorId() ?? getStoredActorId() ?? '';
  const initials = actorId
    .split(/[\s-]+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        background: 'var(--page)',
        display: 'flex',
      }}
    >
      <NavRail
        initials={initials || '?'}
        activeView={view}
        onNavigate={setView}
      />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <header
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
            <span style={{ fontSize: 13.5, color: 'var(--ink-muted)' }}>
              Meridian
            </span>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--ink-muted)"
              strokeWidth="2"
            >
              <path
                d="M9 18l6-6-6-6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>
              {view === 'dashboard'
                ? 'Ops Dashboard'
                : view === 'stream'
                  ? 'Live Stream'
                  : view === 'budgets'
                    ? 'Agent Budget Operations'
                    : view === 'admin'
                      ? 'Admin Queues'
                      : 'Cases'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {view === 'queue' && <SearchIcon size={17} color="var(--ink-2)" />}
            <div
              style={{ width: 1, height: 18, background: 'var(--border)' }}
            />
            <div style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
              {actorId}
            </div>
            <button
              className="btn"
              style={{ fontSize: 12, padding: '5px 10px' }}
              onClick={disconnect}
            >
              Disconnect
            </button>
          </div>
        </header>

        <main style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {view === 'dashboard' ? (
            <OpsDashboard />
          ) : view === 'stream' ? (
            <LiveStream />
          ) : view === 'budgets' ? (
            <BudgetOperations />
          ) : view === 'admin' ? (
            <AdminQueues />
          ) : (
            <>
              <CaseList
                selectedCaseId={selectedCaseId}
                onSelectCase={setSelectedCaseId}
              />
              {selectedCaseId ? (
                <CaseDetail
                  caseId={selectedCaseId}
                  // M7-074: a guest-sandbox tenant can now hold more than
                  // one case (see CaseList's "+ New case"); every case it
                  // can ever see is already synthetic by construction
                  // (RLS scopes this whole tenant to the sandbox), not
                  // only the one case the walkthrough originally seeded.
                  isSandbox={hasDemoSandbox()}
                  onOpenDossier={() => setDossierCaseId(selectedCaseId)}
                />
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
                    Select a case to view its detail.
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
