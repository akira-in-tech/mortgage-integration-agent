import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends M5-002/M5-004/M5-005/M5-006/M5-007's row-level security pattern
 * to `policy_change_impact_assessments` — Section 10.6's dry-run
 * comparison record, one row per case a policy activation or withdrawal
 * potentially affects. Same policy shape, same
 * `app.current_tenant_id`/`app.bypass_rls` session variables via
 * `src/database/tenant-context.ts`. Direct `tenantId` column, no join
 * needed.
 *
 * `PolicyChangeImpactService` (its sole writer) already had a
 * `DataSource` injected, but its private `assessOneCase()` shared bare
 * `CasePolicyBinding`/`CasePolicySnapshot`/`PolicyChangeImpactAssessment`
 * repository reads/writes across two callers needing different tenant
 * contexts: `assessImpact()`'s catalog-wide cross-tenant candidate scan
 * (genuinely needs `runWithRlsBypass` for its own `LoanCase` lookup, same
 * as `WebhookDispatchService`'s due-delivery scan) vs.
 * `assessImpactForCase()`'s single-tenant lookup. Fixed the same way
 * `WebhookDispatchService` already does: bypass only for the cross-tenant
 * discovery scan, then `runInTenantContext` with that specific case's own
 * `tenantId` for the per-case read/write work `assessOneCase` does —
 * `assessOneCase` itself now takes an `EntityManager` parameter instead
 * of owning its own repositories, mirroring
 * `case-conditions.activities.ts`'s `finalizeReadyForUnderwriting`.
 *
 * `case_policy_bindings`/`case_policy_snapshots` themselves still have no
 * RLS policy of their own (deliberately deferred, see
 * docs/DEVELOPMENT_LOG.md) — wrapping their reads in `runInTenantContext`
 * here is harmless today (`src/database/tenant-context.ts`'s own comment:
 * "the SET has no observable effect there — not incorrect") and becomes
 * protective automatically once/if that table group gets its own RLS
 * migration, without requiring another change to this file.
 */
export class PolicyChangeImpactAssessmentTenantIsolation1787132677787 implements MigrationInterface {
  name = 'PolicyChangeImpactAssessmentTenantIsolation1787132677787';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "policy_change_impact_assessments" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_change_impact_assessments" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY "tenant_isolation" ON "policy_change_impact_assessments"
         USING (
           current_setting('app.bypass_rls', true) = 'true'
           OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
         )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY "tenant_isolation" ON "policy_change_impact_assessments"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_change_impact_assessments" NO FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_change_impact_assessments" DISABLE ROW LEVEL SECURITY`,
    );
  }
}
