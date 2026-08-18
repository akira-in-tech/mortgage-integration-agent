import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Section 20 M5's own exit evidence: "cross-tenant tests fail closed at
 * API, service, and database layers." M5-001 closed the first two; this
 * is the database layer, for `webhook_endpoints`/`webhook_deliveries`
 * only — real PostgreSQL row-level security, not a naming convention.
 *
 * `FORCE ROW LEVEL SECURITY` matters as much as `ENABLE`: without it, the
 * table owner (this codebase's own application role, since it's the role
 * that ran every migration) bypasses RLS by PostgreSQL's own default,
 * which would make the policy silently inert for every real query this
 * codebase ever issues. `src/database/tenant-context.ts`'s
 * `runInTenantContext`/`runWithRlsBypass` are the only application code
 * that ever sets the two session variables this policy reads —
 * `app.current_tenant_id` (real per-request tenant scoping) and
 * `app.bypass_rls` (an explicit, auditable opt-out for the one place that
 * legitimately needs it: `WebhookDispatchService`'s own cross-tenant
 * due-delivery scan). Neither set — the default for any connection,
 * including a future bug that forgets to call either helper — means the
 * policy evaluates to false for every row: zero rows visible, not an
 * error and not a leak.
 *
 * Deliberately does NOT cover `loan_cases` or its dependent tables
 * (`evidence_facts`, `loan_conditions`, `condition_transitions`,
 * `agent_runs`, `tool_attempts`, `outbox_events`, `case_policy_bindings`,
 * `case_policy_snapshots`): those are written by both the REST API layer
 * (through these same helpers, straightforwardly) *and* the Temporal
 * worker (`case-conditions.activities.ts`), which runs completely outside
 * any HTTP request context and today sets neither session variable
 * anywhere. Forcing RLS on those tables without first threading the same
 * tenant-context/bypass discipline through every activity in that file
 * would break the M2/M3 case-conditions workflow outright — this
 * codebase's most extensively built and verified business logic. That is
 * real, separately-scoped follow-up work, not something to bundle into
 * this migration; tracked as a known gap in docs/DEVELOPMENT_LOG.md's
 * M5-002 entry rather than silently left unmentioned.
 */
export class WebhookTenantIsolation1787069708184 implements MigrationInterface {
  name = 'WebhookTenantIsolation1787069708184';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['webhook_endpoints', 'webhook_deliveries']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`,
      );
      // NULLIF(..., '') guards a real, non-superuser-specific failure
      // mode: once any transaction on a pooled connection has SET LOCAL
      // this custom GUC, PostgreSQL's placeholder for it reverts to ''
      // (not NULL) once that transaction ends, for the rest of the
      // session/connection's lifetime — not just the first, never-set
      // case. Casting '' straight to uuid throws `invalid input syntax
      // for type uuid`, which is what a pooled connection (every
      // connection here, via TypeORM's pool) will do on any later query
      // that doesn't call runInTenantContext/runWithRlsBypass again.
      // NULLIF turns that '' into NULL first, and NULL::uuid is always
      // NULL (never an error) — so a missing/expired context correctly
      // fails closed (zero rows) instead of throwing.
      await queryRunner.query(
        `CREATE POLICY "tenant_isolation" ON "${table}"
           USING (
             current_setting('app.bypass_rls', true) = 'true'
             OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
           )`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['webhook_deliveries', 'webhook_endpoints']) {
      await queryRunner.query(`DROP POLICY "tenant_isolation" ON "${table}"`);
      await queryRunner.query(
        `ALTER TABLE "${table}" NO FORCE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`,
      );
    }
  }
}
