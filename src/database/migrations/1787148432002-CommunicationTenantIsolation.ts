import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends M5-002/M5-004/M5-006/M5-007/M5-008's row-level security
 * pattern to `communication_messages` and `communication_templates` —
 * Section 9.4's `draft_information_request`/`send_information_request`
 * backing tables. Same policy shape, same
 * `app.current_tenant_id`/`app.bypass_rls` session variables via
 * `src/database/tenant-context.ts`. Both have direct `tenantId` columns,
 * no join needed.
 *
 * A fresh, direct audit (M5-007's own methodology: grep every entity for
 * a `tenantId!` column, not trust a prior slice's Known-gaps list at
 * face value) found these two named in M5-007's own "Next safe step" as
 * needing a service-shape audit first — done here.
 * `CommunicationMessageService.draft()` (writes both tables) already had
 * `tenantId` as an explicit parameter, a mechanical conversion.
 * `CommunicationDeliveryService.deliver()` had a bare, unwrapped initial
 * read of `communication_messages` with no `tenantId` parameter at all —
 * fixed by threading `tenantId` through from `send_information_request`'s
 * own real `ToolContext` (which already carried it, just discarded) down
 * to `deliver()`'s new signature, closing a latent gap the same shape as
 * `case-timeline.service.ts`'s pre-M5-006 one.
 *
 * Deliberately still out of scope: `communication_approvals` (no
 * `tenantId` column of its own — would need a join through
 * `communication_messages`, the same shape as `condition_transitions`/
 * `tool_attempts`). Its sole writer, `CommunicationApprovalService
 * .approve()`, has no `tenantId` in its signature at all — the exact
 * same "several methods don't have tenantId in scope" gap already used
 * to defer `provider_operation_intents`/`provider_authorization_grants`.
 * Unlike `deliver()`, `approve()` has no real caller today (`send_
 * information_request`/`draft_information_request` are both registered
 * tools but neither `check_policy_change_impact` nor `approve()`'s own
 * eventual entry point exists yet — see docs/DEVELOPMENT_LOG.md) to
 * define what a threaded-through signature should look like, so one
 * isn't invented here. Once `communication_messages` gets this
 * migration's RLS policy, `approve()`'s own bare read will correctly
 * fail closed (return zero rows) under the restricted role rather than
 * silently succeed with no tenant check — the same fail-closed direction
 * every other unwrapped read of an RLS-protected table already takes,
 * not a regression this migration introduces.
 */
export class CommunicationTenantIsolation1787148432002 implements MigrationInterface {
  name = 'CommunicationTenantIsolation1787148432002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['communication_messages', 'communication_templates']) {
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
    for (const table of ['communication_templates', 'communication_messages']) {
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
