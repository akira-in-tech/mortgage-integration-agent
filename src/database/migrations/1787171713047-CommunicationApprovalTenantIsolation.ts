import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends this series' row-level-security pattern to `communication_
 * approvals` (M5-018) — the one table M5-009's own migration named and
 * deliberately deferred ("no `tenantId` column of its own... its sole
 * writer, `CommunicationApprovalService.approve()`, has no `tenantId` in
 * its signature at all... no real caller today"), and M5-014's migration
 * confirmed was still true. Neither condition changed on its own — this
 * migration and M5-018's own service-layer change close both together:
 * `approve()` now takes `tenantId` explicitly (see that service's own
 * comment for why this was a first real design, not a retrofit around an
 * existing caller).
 *
 * Same join-based policy shape `condition_transitions`/`tool_attempts`
 * already established for a table with no `tenantId` column of its own —
 * `communication_approvals` has a real, non-nullable FK to `communication_
 * messages` (`ON DELETE CASCADE`, so an approval can never outlive its
 * message), which already carries RLS (M5-009) and a `tenantId` column.
 */
export class CommunicationApprovalTenantIsolation1787171713047 implements MigrationInterface {
  name = 'CommunicationApprovalTenantIsolation1787171713047';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "communication_approvals" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_approvals" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY "tenant_isolation" ON "communication_approvals"
         USING (
           current_setting('app.bypass_rls', true) = 'true'
           OR EXISTS (
             SELECT 1 FROM "communication_messages" cm
             WHERE cm.id = "communication_approvals"."communicationMessageId"
               AND cm."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
           )
         )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY "tenant_isolation" ON "communication_approvals"`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_approvals" NO FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_approvals" DISABLE ROW LEVEL SECURITY`,
    );
  }
}
