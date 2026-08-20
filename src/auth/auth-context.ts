import { ApiClientRole } from '../database/enums/api-client.enum';

/**
 * Attached to the request object by `TenantAuthGuard` (M5-024) — either
 * `ApiKeyGuard` (machine `api_clients`) or `OidcGuard` (OIDC-linked human
 * `users`/`tenant_memberships`) actually populates it, but every
 * downstream consumer (`AuthTenantId()`/`CurrentAuth()`/`RoleGuard`,
 * every controller's own audit-event calls) reads the identical shape
 * either way. `actorId` is deliberately generic, not `apiClientId` — it
 * is an `ApiClient.id` for a machine credential and a `User.id` for an
 * OIDC one; audit trails already called this field `actorId`, this
 * interface now matches that name honestly instead of overclaiming a
 * single credential type. `correlationId` (M5-019) is a fresh id per
 * authenticated request — the trace unit `audit_events` rows reference;
 * there is no distributed tracing system to integrate with instead.
 */
export interface AuthContext {
  tenantId: string;
  actorId: string;
  role: ApiClientRole;
  correlationId: string;
}
