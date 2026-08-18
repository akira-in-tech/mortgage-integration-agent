import { DataSource, EntityManager } from 'typeorm';

/**
 * Section 20 M5's own exit evidence: "cross-tenant tests fail closed at
 * API, service, and database layers" — this is the database layer.
 * `webhook_endpoints`/`webhook_deliveries` carry a real PostgreSQL RLS
 * policy (`WebhookTenantIsolation` migration) that checks
 * `current_setting('app.current_tenant_id', true)`; these two helpers
 * are the *only* place application code ever sets that value, always
 * transaction-scoped (`set_config(..., true)` is `SET LOCAL` semantics
 * reached through a real bind parameter, not string-interpolated SQL) so
 * it can never leak across a pooled connection into an unrelated later
 * request or transaction.
 *
 * Scope: only `webhook_endpoints`/`webhook_deliveries` have an RLS policy
 * today — see that migration's own comment for why `loan_cases` and its
 * dependent tables (written by both the REST API and the Temporal worker,
 * a separate trust boundary) are a deliberately separate, not-yet-started
 * follow-up. Calling `runInTenantContext`/`runWithRlsBypass` around a
 * query against a table with no RLS policy is harmless — the `SET` has no
 * observable effect there — not incorrect.
 */
export async function runInTenantContext<T>(
  dataSource: DataSource,
  tenantId: string,
  work: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  return dataSource.transaction(async (manager) => {
    await manager.query(
      `SELECT set_config('app.current_tenant_id', $1, true)`,
      [tenantId],
    );
    return work(manager);
  });
}

/**
 * For trusted, system-level code that must legitimately operate across
 * every tenant at once in one query (currently: `WebhookDispatchService`'s
 * own due-delivery scan — everything else it does already knows a
 * specific event/delivery's own tenant and uses `runInTenantContext`
 * instead). An explicit, auditable opt-out, never a default: code that
 * calls neither helper sees zero rows on an RLS-protected table, which is
 * the fail-closed direction Section 20 M5 asks for even against this
 * codebase's own bugs, not only a hostile caller's.
 */
export async function runWithRlsBypass<T>(
  dataSource: DataSource,
  work: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  return dataSource.transaction(async (manager) => {
    await manager.query(`SELECT set_config('app.bypass_rls', 'true', true)`);
    return work(manager);
  });
}
