// One small helper for talking to the backend's REST routes (not
// GraphQL). Used by any screen that calls a REST endpoint directly —
// right now that's Agent Budget Operations and the admin queues
// (provider reconciliation, data disposition).
//
// It sends the same credentials Apollo sends for GraphQL, so a signed-in
// person or machine only has to log in once:
//   - signed in with SSO: the browser's own session cookie (sent
//     automatically) plus a tenant id and CSRF token in headers
//   - signed in with a bearer token: an Authorization header
import { getStoredToken } from './auth';
import { getOidcCsrfToken, getOidcTenantId, hasOidcSession } from './oidc';

const API_URL = import.meta.env.VITE_API_URL ?? '';

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (hasOidcSession()) {
    const tenantId = getOidcTenantId();
    const csrfToken = getOidcCsrfToken();
    if (tenantId) headers.set('x-tenant-id', tenantId);
    if (csrfToken) headers.set('x-csrf-token', csrfToken);
  } else {
    const token = getStoredToken();
    if (token) headers.set('authorization', `Bearer ${token}`);
  }
  if (init.body) headers.set('content-type', 'application/json');

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: unknown;
    } | null;
    const message =
      typeof body?.message === 'string'
        ? body.message
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return (await response.json()) as T;
}
