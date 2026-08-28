import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStoredActorId } from './auth';
import {
  beginOidcLogin,
  beginOidcLogout,
  clearOidcSession,
  fetchOidcTenantMemberships,
  getOidcCsrfToken,
  getOidcTenantId,
  hasOidcIdentity,
  hasOidcSession,
  loadOidcSession,
  setOidcTenantId,
} from './oidc';

const TENANT_ID = '907c67ed-9930-4f71-941b-9fc8f1529f18';
const MEMBERSHIP = {
  tenantId: TENANT_ID,
  tenantName: 'Atlas',
  role: 'REVIEWER' as const,
};

function setLocation(url: string) {
  const parsed = new URL(url);
  Object.defineProperty(window, 'location', {
    value: {
      ...window.location,
      href: url,
      origin: parsed.origin,
      pathname: parsed.pathname,
      search: parsed.search,
    },
    writable: true,
    configurable: true,
  });
}

function sessionResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      authenticated: true,
      userId: 'user-1',
      email: 'reviewer@example.com',
      csrfToken: 'csrf-token',
      memberships: [MEMBERSHIP],
      ...overrides,
    }),
  };
}

describe('OIDC browser session adapter', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    setLocation('http://localhost:5173/cases?queue=review');
    clearOidcSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('starts login at the same-origin BFF without browser PKCE secrets', () => {
    beginOidcLogin();

    expect(window.location.href).toBe(
      'http://localhost:5173/v1/auth/session/login?returnTo=%2Fcases%3Fqueue%3Dreview',
    );
    expect(window.sessionStorage.getItem('meridian.oidc.pending')).toBeNull();
  });

  it('loads identity, CSRF, and memberships through the HttpOnly session endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sessionResponse());
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadOidcSession()).resolves.toMatchObject({
      authenticated: true,
      memberships: [MEMBERSHIP],
    });
    expect(fetchMock).toHaveBeenCalledWith('/v1/auth/session', {
      credentials: 'include',
    });
    expect(getStoredActorId()).toBe('reviewer@example.com');
    expect(getOidcCsrfToken()).toBe('csrf-token');
    expect(hasOidcIdentity()).toBe(true);
    expect(hasOidcSession()).toBe(false);

    setOidcTenantId(TENANT_ID);
    expect(hasOidcSession()).toBe(true);
  });

  it('rejects a tenant id not granted by the backend session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sessionResponse()));
    await loadOidcSession();

    expect(() => setOidcTenantId('not-authorized')).toThrow(/not in/);
    expect(getOidcTenantId()).toBeNull();
  });

  it('rejects malformed authority data instead of trusting it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sessionResponse({
          memberships: [
            { tenantId: TENANT_ID, tenantName: 'Atlas', role: 'ADMIN' },
          ],
        }),
      ),
    );

    await expect(loadOidcSession()).rejects.toThrow(/malformed/);
    expect(hasOidcIdentity()).toBe(false);
  });

  it('reuses the verified in-memory membership snapshot', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sessionResponse());
    vi.stubGlobal('fetch', fetchMock);
    await loadOidcSession();

    await expect(fetchOidcTenantMemberships()).resolves.toEqual([MEMBERSHIP]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('posts CSRF and follows the backend logout URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(sessionResponse())
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          logoutUrl: 'http://localhost:5173/oidc-logout-complete',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    await loadOidcSession();
    setOidcTenantId(TENANT_ID);

    await expect(beginOidcLogout()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenLastCalledWith('/v1/auth/session/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-csrf-token': 'csrf-token' },
    });
    expect(window.location.href).toBe(
      'http://localhost:5173/oidc-logout-complete',
    );
    expect(hasOidcIdentity()).toBe(false);
    expect(getOidcTenantId()).toBeNull();
  });

  it('never writes provider tokens into browser storage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sessionResponse()));
    await loadOidcSession();

    expect(
      Object.keys(window.localStorage).filter((key) =>
        /accessToken|refreshToken|idToken|expiresAt/.test(key),
      ),
    ).toEqual([]);
  });
});
