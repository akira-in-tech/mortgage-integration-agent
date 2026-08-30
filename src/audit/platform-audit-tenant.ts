/**
 * `audit_events` (Section 14.1) is tenant-scoped: `tenantId uuid NOT
 * NULL`, RLS-checked against `app.current_tenant_id`. Almost everything
 * this codebase audits genuinely belongs to one tenant, but two real
 * mutation surfaces don't: provider promotion (`ProviderPromotionService`
 * — one shared provider catalog every tenant dispatches through, see
 * `ProviderActivation`'s own "NOT tenant-scoped" note) and policy catalog
 * activation (`PolicyActivationService` — one shared policy catalog, not
 * a per-tenant one). Recording those under a real tenant's id would
 * misattribute a platform-wide action to whichever tenant happened to be
 * looking; recording them nowhere (the actual gap found by the M5/M3
 * audits) loses the provenance entirely.
 *
 * This is the nil UUID, not a real `Tenant` row — `audit_events` has no
 * foreign key to `tenants`, only the RLS check above, so writing under a
 * fixed, well-known, never-reused id is safe and makes every
 * platform-wide audit event easy to find with one query
 * (`WHERE "tenantId" = '00000000-0000-0000-0000-000000000000'`).
 */
export const PLATFORM_AUDIT_TENANT_ID = '00000000-0000-0000-0000-000000000000';
