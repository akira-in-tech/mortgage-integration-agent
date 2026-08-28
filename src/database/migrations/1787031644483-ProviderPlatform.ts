import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProviderPlatform1787031644483 implements MigrationInterface {
  name = 'ProviderPlatform1787031644483';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."provider_operation_intents_capability_enum" AS ENUM('INCOME', 'ASSET', 'CREDIT', 'IDENTITY', 'DOCUMENT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."provider_operation_intents_state_enum" AS ENUM('PREPARED', 'DISPATCHED', 'SUCCEEDED', 'FAILED_FINAL', 'OUTCOME_UNKNOWN', 'RECONCILING', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "provider_operation_intents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "caseId" uuid NOT NULL, "providerId" character varying(100) NOT NULL, "capability" "public"."provider_operation_intents_capability_enum" NOT NULL, "effectClass" character varying(30) NOT NULL, "requestFingerprint" character varying(64) NOT NULL, "idempotencyKey" character varying(200) NOT NULL, "authorizationGrantId" uuid NOT NULL, "state" "public"."provider_operation_intents_state_enum" NOT NULL DEFAULT 'PREPARED', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4acb23f7f4b49590479133f03b0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_provider_operation_intents_case" ON "provider_operation_intents" ("tenantId", "caseId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."provider_authorization_grants_capability_enum" AS ENUM('INCOME', 'ASSET', 'CREDIT', 'IDENTITY', 'DOCUMENT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "provider_authorization_grants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "caseId" uuid NOT NULL, "borrowerSubjectId" character varying(200) NOT NULL, "providerId" character varying(100) NOT NULL, "capability" "public"."provider_authorization_grants_capability_enum" NOT NULL, "purposeCode" character varying(100) NOT NULL, "permittedDataClasses" jsonb NOT NULL, "permittedFields" jsonb, "consentRecordIds" jsonb NOT NULL, "permissiblePurposeDecisionId" character varying(200), "issuedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a4cfdff51c06310d9cfea01b8d8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_provider_authorization_grants_case" ON "provider_authorization_grants" ("tenantId", "caseId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_provider_authorization_grants_case"`,
    );
    await queryRunner.query(`DROP TABLE "provider_authorization_grants"`);
    await queryRunner.query(
      `DROP TYPE "public"."provider_authorization_grants_capability_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_provider_operation_intents_case"`,
    );
    await queryRunner.query(`DROP TABLE "provider_operation_intents"`);
    await queryRunner.query(
      `DROP TYPE "public"."provider_operation_intents_state_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."provider_operation_intents_capability_enum"`,
    );
  }
}
