const API_URL = import.meta.env.VITE_API_URL ?? '';
const STORAGE_KEY = 'meridian.demoSandbox';

export interface DemoSandboxSession {
  authenticated: boolean;
  tenantId?: string;
  actorId?: string;
  csrfToken?: string;
  expiresAt?: string;
  caseId?: string;
}

let currentSession: DemoSandboxSession | null = null;

export async function createDemoSandbox(): Promise<DemoSandboxSession> {
  const response = await fetch(`${API_URL}/v1/demo-sandbox/session`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Unable to create a live sandbox.');
  return store(validate(await response.json()));
}

export async function loadDemoSandbox(): Promise<DemoSandboxSession> {
  const response = await fetch(`${API_URL}/v1/demo-sandbox/session`, {
    credentials: 'include',
  });
  if (!response.ok) return clearDemoSandbox();
  return store(validate(await response.json()));
}

export async function closeDemoSandbox(): Promise<void> {
  const csrfToken = currentSession?.csrfToken;
  await fetch(`${API_URL}/v1/demo-sandbox/session`, {
    method: 'DELETE',
    credentials: 'include',
    headers: csrfToken ? { 'x-csrf-token': csrfToken } : {},
  }).catch(() => undefined);
  clearDemoSandbox();
}

export function hasDemoSandbox(): boolean {
  return Boolean(
    currentSession?.authenticated &&
    currentSession.tenantId &&
    currentSession.csrfToken,
  );
}

export function getDemoSandboxTenantId(): string | null {
  return currentSession?.tenantId ?? null;
}

export function getDemoSandboxCsrfToken(): string | null {
  return currentSession?.csrfToken ?? null;
}

export function getDemoSandboxActorId(): string | null {
  return currentSession?.actorId ?? null;
}

export function clearDemoSandbox(): DemoSandboxSession {
  currentSession = null;
  window.localStorage.removeItem(STORAGE_KEY);
  return { authenticated: false };
}

function store(session: DemoSandboxSession): DemoSandboxSession {
  currentSession = session.authenticated ? session : null;
  if (session.authenticated) {
    // The value is only a display/resume hint. The server's HttpOnly cookie,
    // not local storage, remains the actual sandbox credential.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  return session;
}

function validate(value: unknown): DemoSandboxSession {
  if (typeof value !== 'object' || value === null) {
    throw new Error('The sandbox response was malformed.');
  }
  const record = value as Record<string, unknown>;
  if (record.authenticated === false) return { authenticated: false };
  if (
    record.authenticated !== true ||
    typeof record.tenantId !== 'string' ||
    typeof record.actorId !== 'string' ||
    typeof record.csrfToken !== 'string' ||
    typeof record.expiresAt !== 'string'
  ) {
    throw new Error('The sandbox response was malformed.');
  }
  return {
    authenticated: true,
    tenantId: record.tenantId,
    actorId: record.actorId,
    csrfToken: record.csrfToken,
    expiresAt: record.expiresAt,
    caseId: typeof record.caseId === 'string' ? record.caseId : undefined,
  };
}
