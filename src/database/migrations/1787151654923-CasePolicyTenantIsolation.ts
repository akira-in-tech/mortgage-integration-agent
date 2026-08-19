import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends M5-002/M5-004/M5-006/M5-007/M5-008/M5-009's row-level security
 * pattern to `case_policy_snapshots` and `case_policy_bindings` — the
 * last piece of the case-conditions-core policy audit trail
 * (`PolicyEvaluationService`'s own tables). Same policy shape, same
 * `app.current_tenant_id`/`app.bypass_rls` session variables via
 * `src/database/tenant-context.ts`. Both have direct `tenantId` columns,
 * no join needed. `policy_catalog_generation` — the third table
 * `PolicyEvaluationService` reads — is deliberately not touched here: it
 * is a single global row with no `tenantId` column at all (Section 10.4's
 * fast-path key), not tenant-scoped data.
 *
 * `PolicyEvaluationService.evaluate()` is mechanical to convert (per
 * M5-007's corrected understanding — it already had `CasePolicySnapshot`/
 * `CasePolicyBinding` repositories injected, just never wrapped in tenant
 * context) but requires unusual care in HOW it's wrapped: `evaluate()`'s
 * own concurrency-recovery path (Section 20's exit evidence H) issues a
 * `CasePolicyBinding` insert that can legitimately fail a real unique
 * constraint (`IDX_case_policy_bindings_one_active`) under a genuine
 * race, then reads back the winning row in its `catch` block. If that
 * whole method ran inside one shared transaction, the failed INSERT
 * would abort the transaction and every subsequent statement in the same
 * transaction — including the catch block's own recovery reads — would
 * fail with "current transaction is aborted," the identical class of bug
 * M5-002/M5-003 already found and fixed for `DROP ROLE`'s own
 * dependent-objects error (a JS `try/catch` cannot rescue a Postgres
 * transaction's abort state; only ending that transaction can). Fixed by
 * keeping each logical step in `evaluate()` in its own separate
 * `runInTenantContext` call — the same transactional granularity the
 * original bare-repository-call code already had — rather than
 * collapsing the whole method into one transaction the way most other
 * services in this series safely could.
 */
export class CasePolicyTenantIsolation1787151654923 implements MigrationInterface {
  name = 'CasePolicyTenantIsolation1787151654923';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['case_policy_snapshots', 'case_policy_bindings']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`,
      );
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
    for (const table of ['case_policy_bindings', 'case_policy_snapshots']) {
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
