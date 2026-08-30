import { MigrationInterface, QueryRunner } from 'typeorm';

/** Makes provider consent machine-enforceable and adds transaction-scoped consumer-report authority. */
export class PurposeBoundProviderAuthority1787179100000 implements MigrationInterface {
  name = 'PurposeBoundProviderAuthority1787179100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "consent_records" ADD "permittedPurposes" jsonb NOT NULL DEFAULT '["UNDERWRITING_EVIDENCE"]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "consent_records" ADD "permittedDataClasses" jsonb NOT NULL DEFAULT '["INCOME","CREDIT","DOCUMENT","ASSET","IDENTITY"]'::jsonb`,
    );
    await queryRunner.query(`
      CREATE TABLE "permissible_purpose_decisions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "caseId" uuid NOT NULL,
        "borrowerSubjectId" character varying(200) NOT NULL,
        "capability" "public"."provider_authorization_grants_capability_enum" NOT NULL,
        "purposeCode" character varying(100) NOT NULL,
        "permittedDataClasses" jsonb NOT NULL,
        "decision" character varying(30) NOT NULL,
        "basisCode" character varying(100) NOT NULL,
        "decidedBy" character varying(200) NOT NULL,
        "syntheticOnly" boolean NOT NULL DEFAULT false,
        "decidedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revokedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "CHK_permissible_purpose_decision" CHECK ("decision" IN ('AUTHORIZED','DENIED')),
        CONSTRAINT "PK_permissible_purpose_decisions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_permissible_purpose_decisions_case" ON "permissible_purpose_decisions" ("tenantId", "caseId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissible_purpose_decisions" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissible_purpose_decisions" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY "tenant_isolation" ON "permissible_purpose_decisions"
         USING (
           current_setting('app.bypass_rls', true) = 'true'
           OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
         )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY "tenant_isolation" ON "permissible_purpose_decisions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissible_purpose_decisions" NO FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissible_purpose_decisions" DISABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_permissible_purpose_decisions_case"`,
    );
    await queryRunner.query(`DROP TABLE "permissible_purpose_decisions"`);
    await queryRunner.query(
      `ALTER TABLE "consent_records" DROP COLUMN "permittedDataClasses"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consent_records" DROP COLUMN "permittedPurposes"`,
    );
  }
}
