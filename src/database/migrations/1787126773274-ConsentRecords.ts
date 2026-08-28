import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Section 14.1's `consent_records` (see that entity's own comment for the
 * deliberate one-record-per-case simplification). This is a genuinely new
 * table, not a retrofit — unlike M5-002/M5-004, RLS is applied in the
 * same migration that creates it, so there is never a window where this
 * table exists without the tenant-isolation policy already in place.
 * Same `FORCE ROW LEVEL SECURITY` + `app.bypass_rls`/`app.current_tenant_id`
 * pattern as every other RLS migration in this codebase
 * (`src/database/tenant-context.ts`); `AppRuntimeRole`'s (M5-003)
 * `GRANT ... ON ALL TABLES IN SCHEMA public` plus its `ALTER DEFAULT
 * PRIVILEGES` already covers this table automatically, no separate grant
 * needed here.
 */
export class ConsentRecords1787126773274 implements MigrationInterface {
  name = 'ConsentRecords1787126773274';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "consent_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "caseId" uuid NOT NULL,
        "purpose" character varying(100) NOT NULL,
        "scope" character varying(100) NOT NULL,
        "grantedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE,
        "revokedAt" TIMESTAMP WITH TIME ZONE,
        "revocationReason" character varying(2000),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_consent_records" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_consent_records_tenant_case" ON "consent_records" ("tenantId", "caseId")
    `);

    await queryRunner.query(
      `ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "consent_records" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY "tenant_isolation" ON "consent_records"
         USING (
           current_setting('app.bypass_rls', true) = 'true'
           OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
         )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY "tenant_isolation" ON "consent_records"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consent_records" NO FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "consent_records" DISABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`DROP TABLE "consent_records"`);
  }
}
