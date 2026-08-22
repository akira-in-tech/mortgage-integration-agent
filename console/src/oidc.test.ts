import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  beginOidcLogin,
  tryHandleOidcCallback,
  getOidcTenantId,
  setOidcTenantId,
  hasOidcTokens,
  hasOidcSession,
  clearOidcSession,
  getValidOidcAccessToken,
  fetchOidcTenantMemberships,
  beginOidcLogout,
} from './oidc';
import { getStoredActorId } from './auth';

const ISSUER_URL = 'http://localhost:8080/realms/mortgage-agent';
const TENANT_ID = '907c67ed-9930-4f71-941b-9fc8f1529f18';

// A real base64url-encoded JWT-shaped id_token — only the payload
// segment matters here, decodeIdTokenClaims() only ever reads that.
function fakeIdToken(claims: Record<string, unknown>): string {
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${encode({ alg: 'RS256' })}.${encode(claims)}.signature`;
}

function setLocation(url: string) {
  const u = new URL(url);
  Object.defineProperty(window, 'location', {
    value: {
      ...window.location,
      href: url,
      origin: u.origin,
      pathname: u.pathname,
      search: u.search,
    },
    writable: true,
    configurable: true,
  });
}

describe('oidc', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    setLocation('http://localhost:5173/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  describe('beginOidcLogin', () => {
    it('redirects to the real issuer authorize endpoint with a real PKCE S256 challenge and stashes the verifier for the callback', async () => {
      await beginOidcLogin();

      expect(window.location.href).toContain(
        `${ISSUER_URL}/protocol/openid-connect/auth`,
      );
      const url = new URL(window.location.href);
      expect(url.searchParams.get('client_id')).toBe('mortgage-agent-app');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('code_challenge')).toBeTruthy();
      expect(url.searchParams.get('state')).toBeTruthy();

      const pending = JSON.parse(
        window.sessionStorage.getItem('meridian.oidc.pending')!,
      );
      expect(pending).not.toHaveProperty('tenantId');
      expect(pending.state).toBe(url.searchParams.get('state'));
      expect(pending.verifier).toBeTruthy();
    });
  });

  describe('tryHandleOidcCallback', () => {
    it('returns false and touches nothing on a normal (non-callback) page load', async () => {
      const handled = await tryHandleOidcCallback();
      expect(handled).toBe(false);
      expect(hasOidcSession()).toBe(false);
    });

    it('exchanges a real matching code+state for tokens, stores them, and derives actorId from the id_token', async () => {
      await beginOidcLogin();
      const authorizeUrl = new URL(window.location.href);
      const state = authorizeUrl.searchParams.get('state')!;

      setLocation(`http://localhost:5173/?code=real-auth-code&state=${state}`);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'real-access-token',
          refresh_token: 'real-refresh-token',
          expires_in: 300,
          id_token: fakeIdToken({ email: 'reviewer@example.com' }),
        }),
      });
      vi.stubGlobal('fetch', fetchMock);
      const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

      const handled = await tryHandleOidcCallback();

      expect(handled).toBe(true);
      expect(hasOidcTokens()).toBe(true);
      expect(hasOidcSession()).toBe(false);
      expect(getOidcTenantId()).toBeNull();
      expect(getStoredActorId()).toBe('reviewer@example.com');

      setOidcTenantId(TENANT_ID);
      expect(hasOidcSession()).toBe(true);

      const [, requestInit] = fetchMock.mock.calls[0];
      const body = requestInit.body as URLSearchParams;
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(body.get('code')).toBe('real-auth-code');
      expect(body.get('code_verifier')).toBeTruthy();

      // The URL's own ?code/&state must be stripped so a refresh doesn't
      // replay the exchange.
      expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/');
    });

    it('fails closed on a state mismatch instead of exchanging a code with no matching PKCE verifier', async () => {
      await beginOidcLogin();
      setLocation(
        'http://localhost:5173/?code=real-auth-code&state=forged-state',
      );

      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const handled = await tryHandleOidcCallback();

      expect(handled).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(hasOidcSession()).toBe(false);
    });
  });

  describe('getValidOidcAccessToken', () => {
    it('returns the stored token unchanged when it is not near expiry', async () => {
      window.localStorage.setItem('meridian.oidc.accessToken', 'still-good');
      window.localStorage.setItem(
        'meridian.oidc.expiresAt',
        String(Date.now() + 60_000),
      );
      window.localStorage.setItem('meridian.oidc.tenantId', TENANT_ID);

      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const token = await getValidOidcAccessToken();

      expect(token).toBe('still-good');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refreshes via the real refresh_token grant when within the skew window of expiry', async () => {
      window.localStorage.setItem(
        'meridian.oidc.accessToken',
        'about-to-expire',
      );
      window.localStorage.setItem(
        'meridian.oidc.refreshToken',
        'real-refresh-token',
      );
      window.localStorage.setItem(
        'meridian.oidc.expiresAt',
        String(Date.now() + 5_000),
      );
      window.localStorage.setItem('meridian.oidc.tenantId', TENANT_ID);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'refreshed-token',
          expires_in: 300,
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const token = await getValidOidcAccessToken();

      expect(token).toBe('refreshed-token');
      const [, requestInit] = fetchMock.mock.calls[0];
      const body = requestInit.body as URLSearchParams;
      expect(body.get('grant_type')).toBe('refresh_token');
      expect(body.get('refresh_token')).toBe('real-refresh-token');
      expect(window.localStorage.getItem('meridian.oidc.accessToken')).toBe(
        'refreshed-token',
      );
    });

    it('clears the session and returns null when the refresh itself fails', async () => {
      window.localStorage.setItem(
        'meridian.oidc.accessToken',
        'about-to-expire',
      );
      window.localStorage.setItem(
        'meridian.oidc.refreshToken',
        'stale-refresh-token',
      );
      window.localStorage.setItem(
        'meridian.oidc.expiresAt',
        String(Date.now() - 1_000),
      );
      window.localStorage.setItem('meridian.oidc.tenantId', TENANT_ID);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

      const token = await getValidOidcAccessToken();

      expect(token).toBeNull();
      expect(hasOidcSession()).toBe(false);
    });
  });

  describe('clearOidcSession', () => {
    it('removes every stored OIDC key', () => {
      window.localStorage.setItem('meridian.oidc.accessToken', 'x');
      window.localStorage.setItem('meridian.oidc.refreshToken', 'x');
      window.localStorage.setItem('meridian.oidc.expiresAt', '123');
      window.localStorage.setItem('meridian.oidc.tenantId', TENANT_ID);
      window.localStorage.setItem('meridian.oidc.idToken', 'id-token');

      clearOidcSession();

      expect(hasOidcSession()).toBe(false);
      expect(getOidcTenantId()).toBeNull();
      expect(window.localStorage.getItem('meridian.oidc.idToken')).toBeNull();
    });
  });

  describe('fetchOidcTenantMemberships', () => {
    it('loads the verified identity memberships without a tenant header', async () => {
      window.localStorage.setItem('meridian.oidc.accessToken', 'access-token');
      window.localStorage.setItem(
        'meridian.oidc.expiresAt',
        String(Date.now() + 60_000),
      );
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { tenantId: TENANT_ID, tenantName: 'Atlas', role: 'REVIEWER' },
        ],
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(fetchOidcTenantMemberships()).resolves.toEqual([
        { tenantId: TENANT_ID, tenantName: 'Atlas', role: 'REVIEWER' },
      ]);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/v1/auth/me/tenants',
        { headers: { Authorization: 'Bearer access-token' } },
      );
      expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty(
        'X-Tenant-Id',
      );
    });

    it('rejects malformed membership responses instead of trusting browser authority data', async () => {
      window.localStorage.setItem('meridian.oidc.accessToken', 'access-token');
      window.localStorage.setItem(
        'meridian.oidc.expiresAt',
        String(Date.now() + 60_000),
      );
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => [{ tenantId: TENANT_ID, role: 'ADMIN' }],
        }),
      );

      await expect(fetchOidcTenantMemberships()).rejects.toThrow('malformed');
    });
  });

  describe('beginOidcLogout', () => {
    it('clears local credentials and redirects through the discovered upstream logout endpoint', async () => {
      window.localStorage.setItem('meridian.oidc.accessToken', 'access-token');
      window.localStorage.setItem('meridian.oidc.idToken', 'id-token');
      window.localStorage.setItem('meridian.oidc.tenantId', TENANT_ID);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            end_session_endpoint:
              'http://localhost:8080/realms/mortgage-agent/logout',
          }),
        }),
      );

      await expect(beginOidcLogout()).resolves.toBe(true);

      const logoutUrl = new URL(window.location.href);
      expect(logoutUrl.pathname).toContain('/logout');
      expect(logoutUrl.searchParams.get('client_id')).toBe(
        'mortgage-agent-app',
      );
      expect(logoutUrl.searchParams.get('id_token_hint')).toBe('id-token');
      expect(hasOidcTokens()).toBe(false);
    });

    it('still clears local credentials when discovery is unavailable', async () => {
      window.localStorage.setItem('meridian.oidc.accessToken', 'access-token');
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

      await expect(beginOidcLogout()).resolves.toBe(false);
      expect(hasOidcTokens()).toBe(false);
    });
  });
});
