/**
 * Attached to the request by `PlatformAdminGuard`. Deliberately not
 * `AuthContext` reused with a fake `tenantId` — a platform admin acts
 * across every tenant, not within one, so giving this its own shape (no
 * `tenantId` field at all) makes that impossible to get wrong by accident.
 */
export interface PlatformAdminContext {
  adminId: string;
  adminName: string;
  correlationId: string;
}
