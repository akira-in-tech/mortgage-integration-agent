// Bearer-token auth only, matching the credential shape `create-api-client.ts`
// already issues (`ApiKeyGuard`'s own format) — the same auth path this
// codebase's other real clients (client/webhook-inspector.ts,
// client/scenario-catalog.ts) already use. No OIDC login flow here: that
// needs a registered Keycloak client + redirect URI + token exchange, real
// additional scope this first console cut doesn't attempt — a human
// reviewer signing in via Keycloak is the natural next step, not built yet.
const TOKEN_KEY = 'meridian.apiToken';
const ACTOR_KEY = 'meridian.actorId';

export function getStoredToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

// `submitReview`/`escalateCase` both require a real, caller-supplied
// `actorId` distinct from the bearer credential itself — a real backend
// design choice (M6-003's own decision) so a shared REVIEWER credential's
// actions still record *which human* acted. Captured once at connect time.
export function getStoredActorId(): string | null {
  return window.localStorage.getItem(ACTOR_KEY);
}

export function setStoredActorId(actorId: string): void {
  window.localStorage.setItem(ACTOR_KEY, actorId);
}

export function clearSession(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(ACTOR_KEY);
}
