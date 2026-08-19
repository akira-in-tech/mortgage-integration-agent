import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends M5-002/M5-004/M5-005's row-level security pattern to
 * `loan_conditions`, `agent_runs`, and `tool_attempts` — completing RLS
 * for the entire case-conditions core (`loan_cases`, `evidence_facts`,
 * `outbox_events`, `condition_transitions`, and now these three). Same
 * policy shape, same `app.current_tenant_id`/`app.bypass_rls` session
 * variables via `src/database/tenant-context.ts`.
 *
 * A prior audit (delegated to a research agent, then independently
 * verified file by file) found `loan_conditions`' two heaviest write
 * paths — `create-condition.tool.ts`'s initial insert and
 * `case-conditions.activities.ts`'s `resolveCondition` status update —
 * were *already* running inside a `runInTenantContext` transaction from
 * M5-004's own `loan_cases` refactor (both touch `loan_cases` and
 * `loan_conditions` together in one transaction), so this migration
 * costs nothing there. The real remaining work was
 * `case-timeline.service.ts` (bare reads of all three tables) and
 * `lending-operations-agent-runtime.ts`'s `persistAgentRun` (a bare
 * `dataSource.transaction()`, trivially swapped for
 * `runInTenantContext`) — both fixed alongside this migration.
 *
 * `tool_attempts` has no `tenantId` column of its own (Section 14.1's
 * "arguments hash, result hash, side effect, and outcome" record is
 * keyed only by `agentRunId`) — its policy resolves tenant ownership
 * through a join to `agent_runs`, the same join-based pattern
 * `condition_transitions`' policy already established against
 * `loan_conditions` in M5-004.
 *
 * Deliberately still out of scope: `case_policy_bindings`/
 * `case_policy_snapshots` (`PolicyEvaluationService` has no
 * `DataSource`/`EntityManager` at all today — a real refactor, not a
 * one-line wrap) and `provider_operation_intents`/
 * `provider_authorization_grants` (several methods on
 * `ProviderOperationIntentService`/`ProviderAuthorizationService` don't
 * even have `tenantId` in scope yet). Both are real, separately-scoped
 * follow-up work, tracked in docs/DEVELOPMENT_LOG.md's dev log rather
 * than silently dropped. `evaluation/runner.ts` (the offline
 * evaluation-corpus harness) remains un-audited for RLS, consistent with
 * M5-004/M5-005's own identical, repeated deferral of that file.
 */
export class CaseConditionsAgentTenantIsolation1787129406858 implements MigrationInterface {
  name = 'CaseConditionsAgentTenantIsolation1787129406858';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['loan_conditions', 'agent_runs']) {
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
      `ALTER TABLE "tool_attempts" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "tool_attempts" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY "tenant_isolation" ON "tool_attempts"
         USING (
           current_setting('app.bypass_rls', true) = 'true'
           OR EXISTS (
             SELECT 1 FROM "agent_runs" ar
             WHERE ar.id = "tool_attempts"."agentRunId"
               AND ar."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
           )
         )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['tool_attempts', 'agent_runs', 'loan_conditions']) {
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
