// Real Authorization Code + PKCE flow against this repo's own Keycloak
// realm (`keycloak/realm-export.json`) and the backend's own `OidcGuard`
// (`src/auth/oidc.guard.ts`) — the "human" half of `TenantAuthGuard`,
// alongside the bearer-token/`ApiKeyGuard` path `auth.ts` already covers.
// A public client (no client secret a browser could ever keep safe), so
// PKCE's `code_verifier`/`code_challenge` pair is what proves this
// browser — not just anyone with the authorization code — is the one
// that started the flow.
//
// `OidcGuard` needs an explicit `X-Tenant-Id` on every request (a real
// human can hold `tenant_memberships` in more than one tenant); there is
// no self-service "list my tenants" query anywhere in this codebase
// (Known gap, honestly disclosed), so the tenant id is entered once at
// sign-in time, the same real limitation the bearer-token connect
// screen's `actorId` field already has.
import { setStoredActorId } from './auth';

const ISSUER_URL =
  import.meta.env.VITE_OIDC_ISSUER_URL ??
  'http://localhost:8080/realms/mortgage-agent';
const CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID ?? 'mortgage-agent-app';

const ACCESS_TOKEN_KEY = 'meridian.oidc.accessToken';
const REFRESH_TOKEN_KEY = 'meridian.oidc.refreshToken';
const EXPIRES_AT_KEY = 'meridian.oidc.expiresAt';
const TENANT_ID_KEY = 'meridian.oidc.tenantId';
const PENDING_KEY = 'meridian.oidc.pending';

// Refresh this long before real expiry so an in-flight request never
// races a token that expires mid-request.
const REFRESH_SKEW_MS = 30_000;

interface PendingLogin {
  verifier: string;
  state: string;
  tenantId: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sha256(input: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input),
  );
  return new Uint8Array(digest);
}

function randomString(length = 48): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/** The RP's own freshly-received id_token, parsed for display claims only — not a signature-verified trust decision (the backend's own OidcGuard independently re-verifies every access_token against the issuer's real JWKS on every request; the console never makes an authorization decision based on this). */
function decodeIdTokenClaims(idToken: string): {
  email?: string;
  preferred_username?: string;
} {
  const payload = idToken.split('.')[1];
  const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(json);
}

export async function beginOidcLogin(tenantId: string): Promise<void> {
  const verifier = randomString();
  const challenge = base64UrlEncode(await sha256(verifier));
  const state = randomString(24);

  const pending: PendingLogin = { verifier, state, tenantId };
  window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));

  const redirectUri = window.location.origin + window.location.pathname;
  const url = new URL(`${ISSUER_URL}/protocol/openid-connect/auth`);
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);

  window.location.href = url.toString();
}

/** Call once on app mount. Returns true if this load was an OIDC redirect callback (handled, and the URL's own ?code/&state stripped) — the caller should treat that as "now connected." Returns false for a normal load. */
export async function tryHandleOidcCallback(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return false;

  const raw = window.sessionStorage.getItem(PENDING_KEY);
  window.sessionStorage.removeItem(PENDING_KEY);
  window.history.replaceState(null, '', window.location.pathname);
  if (!raw) return false;

  const pending: PendingLogin = JSON.parse(raw);
  if (pending.state !== state) {
    // Not this browser's own flow (or a replayed/forged callback) — fail
    // closed rather than accept an authorization code with no matching
    // PKCE verifier.
    return false;
  }

  const redirectUri = window.location.origin + window.location.pathname;
  const tokens = await exchangeToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: pending.verifier,
  });
  if (!tokens) return false;

  storeTokens(tokens, pending.tenantId);
  return true;
}

async function exchangeToken(
  params: Record<string, string>,
): Promise<TokenResponse | null> {
  const response = await fetch(`${ISSUER_URL}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...params }),
  });
  if (!response.ok) return null;
  return (await response.json()) as TokenResponse;
}

function storeTokens(tokens: TokenResponse, tenantId: string): void {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  window.localStorage.setItem(
    EXPIRES_AT_KEY,
    String(Date.now() + tokens.expires_in * 1000),
  );
  window.localStorage.setItem(TENANT_ID_KEY, tenantId);
  if (tokens.refresh_token) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  }
  if (tokens.id_token) {
    const claims = decodeIdTokenClaims(tokens.id_token);
    setStoredActorId(claims.email ?? claims.preferred_username ?? 'oidc-user');
  }
}

export function getOidcTenantId(): string | null {
  return window.localStorage.getItem(TENANT_ID_KEY);
}

export function hasOidcSession(): boolean {
  return Boolean(
    window.localStorage.getItem(ACCESS_TOKEN_KEY) && getOidcTenantId(),
  );
}

export function clearOidcSession(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(EXPIRES_AT_KEY);
  window.localStorage.removeItem(TENANT_ID_KEY);
}

/** Returns a real, currently-valid access token — refreshing first if within REFRESH_SKEW_MS of real expiry. null if there's no session or refresh failed (the caller should treat that as logged out). */
export async function getValidOidcAccessToken(): Promise<string | null> {
  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  const expiresAt = Number(window.localStorage.getItem(EXPIRES_AT_KEY) ?? 0);
  if (!token) return null;

  if (Date.now() < expiresAt - REFRESH_SKEW_MS) {
    return token;
  }

  const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    clearOidcSession();
    return null;
  }

  const tokens = await exchangeToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  if (!tokens) {
    clearOidcSession();
    return null;
  }

  const tenantId = getOidcTenantId();
  storeTokens(tokens, tenantId ?? '');
  return tokens.access_token;
}
