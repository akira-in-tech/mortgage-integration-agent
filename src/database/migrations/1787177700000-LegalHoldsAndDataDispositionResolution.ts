import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Section 14.1's `legal_holds` (M5-025), plus the two real "deletion
 * verification" columns `data_disposition_tasks` was always missing
 * (Section 14.2: "records what was deleted, anonymized, [or] retained
 * under a valid hold"). One migration for both, since they're one real
 * feature slice: `DataDispositionService.resolve()` cannot exist
 * honestly without `legal_holds` to check first. `legal_holds` gets its
 * own RLS, same new-table-with-RLS shape as `ConsentRecords`/
 * `DataDispositionTasks`/`AuditEvents`; the two new columns on the
 * already-RLS-protected `data_disposition_tasks` need no RLS change of
 * their own.
 */
export class LegalHoldsAndDataDispositionResolution1787177700000 implements MigrationInterface {
  name = 'LegalHoldsAndDataDispositionResolution1787177700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."legal_holds_status_enum" AS ENUM('ACTIVE', 'RELEASED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "legal_holds" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "caseId" uuid NOT NULL,
        "reason" character varying(2000) NOT NULL,
        "ownerId" character varying(200) NOT NULL,
        "status" "public"."legal_holds_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "placedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "releasedAt" TIMESTAMP WITH TIME ZONE,
        "releasedBy" character varying(200),
        CONSTRAINT "PK_legal_holds" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_legal_holds_tenant_case" ON "legal_holds" ("tenantId", "caseId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "legal_holds" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "legal_holds" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY "tenant_isolation" ON "legal_holds"
         USING (
           current_setting('app.bypass_rls', true) = 'true'
           OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
         )`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."data_disposition_tasks_resolutionoutcome_enum" AS ENUM('DELETED', 'ANONYMIZED', 'RETAINED_UNDER_HOLD')`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_disposition_tasks" ADD "resolutionOutcome" "public"."data_disposition_tasks_resolutionoutcome_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_disposition_tasks" ADD "resolvedBy" character varying(200)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "data_disposition_tasks" DROP COLUMN "resolvedBy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_disposition_tasks" DROP COLUMN "resolutionOutcome"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."data_disposition_tasks_resolutionoutcome_enum"`,
    );

    await queryRunner.query(`DROP POLICY "tenant_isolation" ON "legal_holds"`);
    await queryRunner.query(
      `ALTER TABLE "legal_holds" NO FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "legal_holds" DISABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`DROP TABLE "legal_holds"`);
    await queryRunner.query(`DROP TYPE "public"."legal_holds_status_enum"`);
  }
}
