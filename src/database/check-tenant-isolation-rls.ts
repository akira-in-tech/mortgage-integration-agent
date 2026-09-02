import { DataSource } from 'typeorm';

export interface TenantIsolationRlsGap {
  table: string;
  rowSecurityEnabled: boolean;
  rowSecurityForced: boolean;
}

/**
 * A table a real, structural check against a fully-migrated schema
 * confirmed genuinely has a `tenantId` column but no RLS — and, on
 * inspection, correctly so: each one is queried specifically to *resolve*
 * which tenant a caller belongs to, before any tenant context exists to
 * enforce RLS against in the first place (the same bootstrapping problem
 * this codebase's own `ApiKeyGuard`/`OidcGuard`/`GuestSandboxGuard` all
 * solve the same way — read the credential/session row first, then set
 * `app.current_tenant_id` for everything after). RLS-protecting the very
 * table that establishes tenant identity isn't a stricter guarantee, it's
 * a chicken-and-egg contradiction. Deliberately not derived automatically
 * — adding a table here is a real, reviewed decision, the same discipline
 * `structural-exclusions.ts`'s own denylist already follows for its list.
 */
const KNOWN_AUTH_BOOTSTRAP_TABLES: ReadonlySet<string> = new Set([
  'api_clients',
  'tenant_memberships',
  'guest_sandbox_sessions',
]);

/**
 * Section 20 M5's own exit evidence: "cross-tenant tests fail closed at
 * API, service, and database layers" — the database layer depends on
 * every tenant-scoped table actually having row-level security enabled
 * *and* forced, not just declared once in a migration. A real M7 audit
 * (M7-055) found this codebase's own long-lived local dev database
 * (built at some point via TypeORM's `synchronize` rather than the real
 * migration chain) has RLS silently disabled on the large majority of its
 * tenant-scoped tables — tenant isolation fails open there, not closed,
 * with nothing anywhere surfacing that until someone happens to run the
 * tenant-isolation spec suite directly against it.
 *
 * "Tenant-scoped" is derived structurally here — any real table with a
 * `tenantId` column — not a hardcoded list, so this stays correct as the
 * schema grows instead of silently going stale (a fixed list is exactly
 * the kind of thing a future migration could add a table without anyone
 * remembering to update).
 */
export async function findTenantIsolationRlsGaps(
  dataSource: DataSource,
): Promise<TenantIsolationRlsGap[]> {
  const rows: Array<{
    table_name: string;
    relrowsecurity: boolean;
    relforcerowsecurity: boolean;
  }> = await dataSource.query(`
    SELECT DISTINCT
      cols.table_name,
      pc.relrowsecurity,
      pc.relforcerowsecurity
    FROM information_schema.columns cols
    JOIN pg_namespace pn ON pn.nspname = cols.table_schema
    JOIN pg_class pc
      ON pc.relname = cols.table_name
     AND pc.relnamespace = pn.oid
     AND pc.relkind = 'r'
    WHERE cols.table_schema = 'public'
      AND cols.column_name = 'tenantId'
    ORDER BY cols.table_name
  `);
  return rows
    .filter(
      (row) =>
        (!row.relrowsecurity || !row.relforcerowsecurity) &&
        !KNOWN_AUTH_BOOTSTRAP_TABLES.has(row.table_name),
    )
    .map((row) => ({
      table: row.table_name,
      rowSecurityEnabled: row.relrowsecurity,
      rowSecurityForced: row.relforcerowsecurity,
    }));
}

/** One human-readable line per gap, e.g. "consent_records (RLS disabled, not forced)". */
export function describeTenantIsolationRlsGaps(
  gaps: TenantIsolationRlsGap[],
): string[] {
  return gaps.map((gap) => {
    const problems: string[] = [];
    if (!gap.rowSecurityEnabled) problems.push('RLS disabled');
    if (!gap.rowSecurityForced) problems.push('not forced');
    return `${gap.table} (${problems.join(', ')})`;
  });
}
