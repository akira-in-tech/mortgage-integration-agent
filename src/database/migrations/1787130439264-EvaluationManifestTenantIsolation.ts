import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends M5-002/M5-004/M5-005/M5-006's row-level security pattern to
 * `evaluation_input_manifests` — Section 10.5's durable, evidence-backed
 * record of exactly what every completed DSL evaluation read. Same
 * policy shape, same `app.current_tenant_id`/`app.bypass_rls` session
 * variables via `src/database/tenant-context.ts`.
 *
 * The smallest table in this family to protect: `EvaluationManifestService`
 * has exactly one write path (`assemble()`, an insert-only `save()`) and
 * no reads at all — a fresh, independent audit (this codebase's own
 * entity/service grep, not delegated) confirmed no other production code
 * queries `evaluation_input_manifests` directly. Both real call sites
 * (`lending-operations-agent-runtime.ts`'s `resolveOutcomeNode`, one per
 * branch) already run outside any surrounding `runInTenantContext`
 * block, so wrapping `assemble()` in its own has no nesting concerns.
 *
 * Found along the way, not previously named in M5-004/M5-006's own
 * deferred-scope lists: this table has a real `tenantId` column and was
 * simply missed by those slices' own scoping, not a table anyone
 * deliberately excluded. Other still-unprotected tenant-scoped tables
 * found by the same fresh audit — `case_policy_bindings`/
 * `case_policy_snapshots` (M5-004/M5-006's own named deferral),
 * `policy_change_impact_assessments`, `communication_messages`,
 * `communication_templates`, `provider_operation_intents`/
 * `provider_authorization_grants` — remain separately scoped, real
 * follow-up work, not silently dropped (see docs/DEVELOPMENT_LOG.md).
 */
export class EvaluationManifestTenantIsolation1787130439264 implements MigrationInterface {
  name = 'EvaluationManifestTenantIsolation1787130439264';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "evaluation_input_manifests" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluation_input_manifests" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY "tenant_isolation" ON "evaluation_input_manifests"
         USING (
           current_setting('app.bypass_rls', true) = 'true'
           OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
         )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY "tenant_isolation" ON "evaluation_input_manifests"`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluation_input_manifests" NO FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluation_input_manifests" DISABLE ROW LEVEL SECURITY`,
    );
  }
}
