import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Section 14.1's `data_disposition_tasks` (M5-015). Same shape as
 * `ConsentRecords` (M5-005): a genuinely new table, RLS applied in the
 * same migration that creates it, so there is never a window where this
 * table exists without the tenant-isolation policy already in place.
 * `AppRuntimeRole`'s (M5-003) `GRANT ... ON ALL TABLES IN SCHEMA public`
 * plus its `ALTER DEFAULT PRIVILEGES` already covers this table
 * automatically, no separate grant needed here.
 */
export class DataDispositionTasks1787162906507 implements MigrationInterface {
  name = 'DataDispositionTasks1787162906507';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."data_disposition_tasks_tasktype_enum" AS ENUM('RETENTION_REVIEW', 'DELETION', 'ANONYMIZATION', 'LEGAL_HOLD')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."data_disposition_tasks_status_enum" AS ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "data_disposition_tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "caseId" uuid NOT NULL,
        "taskType" "public"."data_disposition_tasks_tasktype_enum" NOT NULL,
        "status" "public"."data_disposition_tasks_status_enum" NOT NULL DEFAULT 'PENDING',
        "reason" character varying(2000) NOT NULL,
        "triggeringConsentRecordId" uuid,
        "affectedEvidenceFactIds" jsonb NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "resolvedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_data_disposition_tasks" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_data_disposition_tasks_tenant_case" ON "data_disposition_tasks" ("tenantId", "caseId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "data_disposition_tasks" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_disposition_tasks" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY "tenant_isolation" ON "data_disposition_tasks"
         USING (
           current_setting('app.bypass_rls', true) = 'true'
           OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
         )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY "tenant_isolation" ON "data_disposition_tasks"`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_disposition_tasks" NO FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_disposition_tasks" DISABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`DROP TABLE "data_disposition_tasks"`);
    await queryRunner.query(
      `DROP TYPE "public"."data_disposition_tasks_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."data_disposition_tasks_tasktype_enum"`,
    );
  }
}
