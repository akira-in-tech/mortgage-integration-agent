import { setStoredActorId } from './auth';

const API_URL = import.meta.env.VITE_API_URL ?? '';
const TENANT_ID_KEY = 'meridian.oidc.tenantId';

export interface OidcTenantMembership {
  tenantId: string;
  tenantName: string;
  role: 'PARTNER' | 'REVIEWER';
}

export interface OidcBrowserSession {
  authenticated: boolean;
  userId?: string;
  email?: string;
  csrfToken?: string;
  memberships: OidcTenantMembership[];
}

// Authentication state is memory-only. Provider tokens live behind the
// backend's HttpOnly session cookie and are never available to this module.
let currentSession: OidcBrowserSession | null = null;

export async function loadOidcSession(): Promise<OidcBrowserSession> {
  const response = await fetch(`${API_URL}/v1/auth/session`, {
    credentials: 'include',
  });
  if (!response.ok) return unauthenticatedSession();
  const session = validateSession(await response.json());
  currentSession = session.authenticated ? session : null;
  if (session.authenticated) {
    setStoredActorId(session.email ?? session.userId ?? 'oidc-user');
  } else {
    clearOidcTenantId();
  }
  return session;
}

export function beginOidcLogin(): void {
  const returnTo = `${window.location.pathname}${window.location.search}`;
  const url = new URL(`${API_URL}/v1/auth/session/login`, window.location.href);
  url.searchParams.set('returnTo', returnTo);
  window.location.href = url.toString();
}

export async function beginOidcLogout(): Promise<boolean> {
  const csrfToken = currentSession?.csrfToken;
  try {
    const response = await fetch(`${API_URL}/v1/auth/session/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: csrfToken ? { 'x-csrf-token': csrfToken } : {},
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { logoutUrl?: unknown };
    currentSession = null;
    clearOidcTenantId();
    if (typeof body.logoutUrl === 'string') {
      window.location.href = body.logoutUrl;
      return true;
    }
    return false;
  } catch {
    currentSession = null;
    clearOidcTenantId();
    return false;
  }
}

export function getOidcTenantId(): string | null {
  return window.localStorage.getItem(TENANT_ID_KEY);
}

export function setOidcTenantId(tenantId: string): void {
  if (!currentSession?.memberships.some((item) => item.tenantId === tenantId)) {
    throw new Error('The selected tenant is not in the current session');
  }
  window.localStorage.setItem(TENANT_ID_KEY, tenantId);
}

export function clearOidcTenantId(): void {
  window.localStorage.removeItem(TENANT_ID_KEY);
}

export function hasOidcIdentity(): boolean {
  return Boolean(currentSession?.authenticated);
}

export function hasOidcSession(): boolean {
  const tenantId = getOidcTenantId();
  return Boolean(
    currentSession?.authenticated &&
    tenantId &&
    currentSession.memberships.some((item) => item.tenantId === tenantId),
  );
}

export function getOidcCsrfToken(): string | null {
  return currentSession?.csrfToken ?? null;
}

export function clearOidcSession(): void {
  currentSession = null;
  clearOidcTenantId();
}

export async function fetchOidcTenantMemberships(): Promise<
  OidcTenantMembership[]
> {
  const session = currentSession ?? (await loadOidcSession());
  if (!session.authenticated) {
    throw new Error('Your sign-in session is no longer valid.');
  }
  return session.memberships;
}

function unauthenticatedSession(): OidcBrowserSession {
  currentSession = null;
  return { authenticated: false, memberships: [] };
}

function validateSession(value: unknown): OidcBrowserSession {
  if (typeof value !== 'object' || value === null) {
    throw new Error('The session response was malformed.');
  }
  const record = value as Record<string, unknown>;
  if (record.authenticated === false) return unauthenticatedSession();
  if (
    record.authenticated !== true ||
    typeof record.csrfToken !== 'string' ||
    !Array.isArray(record.memberships)
  ) {
    throw new Error('The session response was malformed.');
  }
  const memberships = record.memberships.map(validateMembership);
  return {
    authenticated: true,
    userId: typeof record.userId === 'string' ? record.userId : undefined,
    email: typeof record.email === 'string' ? record.email : undefined,
    csrfToken: record.csrfToken,
    memberships,
  };
}

function validateMembership(value: unknown): OidcTenantMembership {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as Record<string, unknown>).tenantId !== 'string' ||
    typeof (value as Record<string, unknown>).tenantName !== 'string' ||
    !['PARTNER', 'REVIEWER'].includes(
      String((value as Record<string, unknown>).role),
    )
  ) {
    throw new Error('The session response was malformed.');
  }
  return value as OidcTenantMembership;
}
