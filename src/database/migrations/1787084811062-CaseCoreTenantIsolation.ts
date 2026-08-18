import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends M5-002's row-level security pattern from webhook_endpoints/
 * webhook_deliveries to the case-conditions core: `loan_cases`,
 * `evidence_facts`, `outbox_events`, and `condition_transitions`. Same
 * policy shape, same `app.current_tenant_id`/`app.bypass_rls` session
 * variables, set by the same `runInTenantContext`/`runWithRlsBypass`
 * helpers (`src/database/tenant-context.ts`) — nothing new at the
 * database layer, only a wider set of protected tables.
 *
 * Deliberately narrower than "every table `loan_cases` is connected to."
 * In scope here: exactly the tables written through code paths that
 * already thread `tenantId` end to end without any other structural
 * change (case-conditions.activities.ts's own manager-parameterized
 * writes, the REST API's case creation, the Agent-runtime tools that
 * mutate a case directly, and every writeOutboxEvent() call site in the
 * live request-serving path). Out of scope, explicitly deferred:
 * `loan_conditions` itself (its initial row is created by
 * create-condition.tool.ts inside the same transaction as a loan_cases
 * write, but its own tenant-scoped access pattern needs its own audit,
 * and forcing RLS on it now would also affect create-condition.tool.ts's
 * own read/update of a row this migration does not want to have to
 * reason about jointly with `loan_cases` in one slice), `agent_runs`/
 * `tool_attempts` (LangGraph runtime's own bookkeeping — separate
 * write path, not audited this slice), `case_policy_bindings`/
 * `case_policy_snapshots` (policy engine's own tables), and
 * `provider_operation_intents`/`provider_authorization_grants`
 * (provider-platform's own tables, both accessed via `@InjectRepository`
 * services that would need their own refactor to accept an external
 * `EntityManager`). Each is a real, separately-scoped follow-up, tracked
 * in docs/DEVELOPMENT_LOG.md's M5-004 entry, not silently dropped.
 *
 * `condition_transitions` has no `tenantId` column of its own (Section
 * 14.1's append-only actor-attributed history is keyed only by
 * `conditionId`) — its policy resolves tenant ownership through a join
 * to `loan_conditions`, which *does* carry `tenantId` directly (no need
 * to go all the way to `loan_cases`). This works correctly regardless of
 * whether `loan_conditions` itself has an RLS policy (it doesn't, this
 * slice) — the subquery reads `loan_conditions.tenantId` as a plain
 * column comparison, not through any policy on that table.
 */
export class CaseCoreTenantIsolation1787084811062 implements MigrationInterface {
  name = 'CaseCoreTenantIsolation1787084811062';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['loan_cases', 'evidence_facts', 'outbox_events']) {
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

    await queryRunner.query(
      `ALTER TABLE "condition_transitions" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "condition_transitions" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY "tenant_isolation" ON "condition_transitions"
         USING (
           current_setting('app.bypass_rls', true) = 'true'
           OR EXISTS (
             SELECT 1 FROM "loan_conditions" lc
             WHERE lc.id = "condition_transitions"."conditionId"
               AND lc."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
           )
         )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'condition_transitions',
      'outbox_events',
      'evidence_facts',
      'loan_cases',
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
