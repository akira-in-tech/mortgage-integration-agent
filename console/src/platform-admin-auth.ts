// Storage for the platform-admin bearer token — kept completely separate
// from the tenant session (auth.ts's meridian.apiToken / oidc.ts's
// cookie-based session). A platform admin isn't signed into any tenant at
// all, so mixing the two storage keys would risk one leaking into the
// other's request headers.
const PLATFORM_ADMIN_TOKEN_KEY = 'meridian.platformAdminToken';

export function getStoredPlatformAdminToken(): string | null {
  return window.localStorage.getItem(PLATFORM_ADMIN_TOKEN_KEY);
}

export function setStoredPlatformAdminToken(token: string): void {
  window.localStorage.setItem(PLATFORM_ADMIN_TOKEN_KEY, token);
}

export function clearStoredPlatformAdminToken(): void {
  window.localStorage.removeItem(PLATFORM_ADMIN_TOKEN_KEY);
}
