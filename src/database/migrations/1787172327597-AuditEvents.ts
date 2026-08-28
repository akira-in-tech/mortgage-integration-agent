import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Section 14.1's `audit_events` (M5-019). Genuinely new table, RLS
 * applied in the same migration that creates it — same shape as
 * `ConsentRecords`/`DataDispositionTasks`. `AppRuntimeRole`'s (M5-003)
 * `GRANT ... ON ALL TABLES IN SCHEMA public` plus its `ALTER DEFAULT
 * PRIVILEGES` already covers this table automatically, no separate
 * grant needed here.
 *
 * The append-only trigger is the one piece with no precedent elsewhere
 * in this series: "Append-only actor, action, resource, and security
 * history" is a real, load-bearing property for an audit trail
 * specifically — a table application code merely *chooses* not to
 * update or delete is not the same guarantee as one the database itself
 * refuses to. Unconditional (not even `app.bypass_rls` can UPDATE/
 * DELETE a written row) — a real future retention-driven purge would
 * need its own explicit mechanism (e.g. a dedicated migration that
 * temporarily drops this trigger), not a silent carve-out through the
 * same flag every other RLS policy in this codebase already treats as a
 * routine, frequently-used escape hatch.
 */
export class AuditEvents1787172327597 implements MigrationInterface {
  name = 'AuditEvents1787172327597';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "actorId" character varying(200) NOT NULL,
        "action" character varying(100) NOT NULL,
        "resourceType" character varying(100) NOT NULL,
        "resourceId" character varying(200),
        "correlationId" uuid,
        "reason" character varying(2000),
        "metadata" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_events" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_events_tenant_created" ON "audit_events" ("tenantId", "createdAt")`,
    );

    await queryRunner.query(
      `ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY "tenant_isolation" ON "audit_events"
         USING (
           current_setting('app.bypass_rls', true) = 'true'
           OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
         )`,
    );

    await queryRunner.query(`
      CREATE FUNCTION "reject_audit_event_mutation"() RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'audit_events is append-only: % is not permitted', TG_OP;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "audit_events_append_only"
        BEFORE UPDATE OR DELETE ON "audit_events"
        FOR EACH ROW EXECUTE FUNCTION "reject_audit_event_mutation"()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER "audit_events_append_only" ON "audit_events"`,
    );
    await queryRunner.query(`DROP FUNCTION "reject_audit_event_mutation"()`);
    await queryRunner.query(`DROP POLICY "tenant_isolation" ON "audit_events"`);
    await queryRunner.query(
      `ALTER TABLE "audit_events" NO FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" DISABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`DROP TABLE "audit_events"`);
  }
}
