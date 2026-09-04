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

export interface DemoSandboxScenario {
  requestedAmount?: number;
  statedMonthlyIncome?: number;
}

let currentSession: DemoSandboxSession | null = null;

export async function createDemoSandbox(
  scenario: DemoSandboxScenario = {},
): Promise<DemoSandboxSession> {
  const response = await fetch(`${API_URL}/v1/demo-sandbox/session`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario),
  });
  if (!response.ok) throw new Error('Unable to create a live sandbox.');
  return store(validate(await response.json()));
}

/**
 * Adds another synthetic case to the caller's own existing sandbox tenant
 * (M7-074) -- unlike `createDemoSandbox()`, this never mints a new tenant
 * or session, so trying a second scenario no longer means abandoning the
 * current one. Requires the same CSRF pairing every other sandbox
 * mutation does.
 */
export async function createDemoSandboxCase(
  scenario: DemoSandboxScenario = {},
): Promise<string> {
  const csrfToken = currentSession?.csrfToken;
  const response = await fetch(`${API_URL}/v1/demo-sandbox/cases`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    },
    body: JSON.stringify(scenario),
  });
  if (!response.ok) throw new Error('Unable to create a new case.');
  const body = (await response.json()) as { caseId?: unknown };
  if (typeof body.caseId !== 'string') {
    throw new Error('The new-case response was malformed.');
  }
  return body.caseId;
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

export function getDemoSandboxCaseId(): string | null {
  return currentSession?.caseId ?? null;
}

export function clearDemoSandbox(): DemoSandboxSession {
  currentSession = null;
  window.localStorage.removeItem(STORAGE_KEY);
  return { authenticated: false };
}

function store(session: DemoSandboxSession): DemoSandboxSession {
  // The resume endpoint deliberately omits the case id: the HttpOnly cookie
  // is authoritative and the UI must not treat browser storage as access
  // control. Preserve only the matching, non-sensitive display hint so a
  // returning demo visitor lands back on the synthetic case they created.
  const storedHint = readStoredHint();
  const caseId =
    session.caseId ??
    (storedHint !== null && session.tenantId === storedHint.tenantId
      ? storedHint.caseId
      : undefined);
  const sessionWithHint = caseId ? { ...session, caseId } : session;
  currentSession = sessionWithHint.authenticated ? sessionWithHint : null;
  if (session.authenticated) {
    // The value is only a display/resume hint. The server's HttpOnly cookie,
    // not local storage, remains the actual sandbox credential.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionWithHint));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  return sessionWithHint;
}

function readStoredHint(): DemoSandboxSession | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? validate(JSON.parse(value)) : null;
  } catch {
    // A stale or manually edited hint cannot block a new cookie-backed
    // sandbox session. It is safe to ignore because it never authorizes API
    // access and is replaced by the next valid response.
    return null;
  }
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
