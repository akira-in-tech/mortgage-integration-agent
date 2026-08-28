import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends M5-002/M5-004/M5-006/M5-007/M5-008/M5-009/M5-010's row-level
 * security pattern to `provider_authorization_grants` and
 * `provider_operation_intents` (M5-014) — Section 11.5's real, live
 * dispatch-path tables (`dispatchProviderRequest`'s own grant/intent
 * bookkeeping, exercised on every income/credit/document/asset/identity
 * fetch). Same policy shape, same `app.current_tenant_id`/`app.bypass_rls`
 * session variables via `src/database/tenant-context.ts`. Both have direct
 * `tenantId` columns, no join needed.
 *
 * Unlike most of this series, this pair was a genuinely *live* gap, not a
 * dormant one: `ProviderAuthorizationService`/`ProviderOperationIntentService`
 * used plain `@InjectRepository` with zero tenant scoping, and
 * `ProviderOperationIntentService`'s four `mark*()` methods and
 * `ProviderAuthorizationService.revoke()` had no `tenantId` parameter at
 * all — an `UPDATE ... WHERE id = $1` with no tenant predicate whatsoever,
 * relying on nothing but the caller happening to pass the right id.
 * Converting both services to `@InjectDataSource()` plus
 * `runInTenantContext()` per call (mirroring `ConsentService`'s own
 * established shape, not a new pattern) closes that for real, not just at
 * the database layer: `revoke()`/`mark*()` now genuinely cannot affect a
 * different tenant's row even if a future caller passed the wrong id,
 * where before this migration they always could have.
 *
 * `communication_approvals` — named in the same "什麼沒做" sweep — is
 * deliberately still out of scope, for the exact reason M5-009's own
 * migration already recorded: no `tenantId` column of its own, and its
 * sole writer (`CommunicationApprovalService.approve()`) still has no real
 * caller anywhere in this codebase to define what a threaded-through
 * signature should look like. Revisit together once `send_information_
 * request`'s approval-gated path is actually built.
 */
export class ProviderPlatformTenantIsolation1787161668146 implements MigrationInterface {
  name = 'ProviderPlatformTenantIsolation1787161668146';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'provider_authorization_grants',
      'provider_operation_intents',
    ]) {
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
    for (const table of [
      'provider_operation_intents',
      'provider_authorization_grants',
    ]) {
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
