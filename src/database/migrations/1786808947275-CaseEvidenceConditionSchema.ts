import { MigrationInterface, QueryRunner } from 'typeorm';

export class CaseEvidenceConditionSchema1786808947275 implements MigrationInterface {
  name = 'CaseEvidenceConditionSchema1786808947275';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "tenants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(200) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."loan_cases_loantype_enum" AS ENUM('CONVENTIONAL', 'FHA', 'VA', 'JUMBO')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."loan_cases_status_enum" AS ENUM('DRAFT', 'COLLECTING_EVIDENCE', 'CONDITIONS_OPEN', 'WAITING_FOR_INFORMATION', 'WAITING_FOR_REVIEW', 'READY_FOR_UNDERWRITING', 'MANUAL_REVIEW', 'CLOSED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "loan_cases" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "idempotencyKey" character varying(200) NOT NULL, "borrowerId" character varying(100) NOT NULL, "requestedAmount" numeric(14,2) NOT NULL, "loanType" "public"."loan_cases_loantype_enum" NOT NULL, "status" "public"."loan_cases_status_enum" NOT NULL DEFAULT 'DRAFT', "version" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_loan_cases_tenant_idempotency_key" UNIQUE ("tenantId", "idempotencyKey"), CONSTRAINT "PK_cebb57edb1e1207841ca80aa7c9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_loan_cases_tenant" ON "loan_cases" ("tenantId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."evidence_facts_facttype_enum" AS ENUM('INCOME', 'ASSET', 'CREDIT', 'IDENTITY', 'DOCUMENT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."evidence_facts_sourcekind_enum" AS ENUM('SIMULATOR', 'BORROWER_SUBMITTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "evidence_facts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "caseId" uuid NOT NULL, "factType" "public"."evidence_facts_facttype_enum" NOT NULL, "sourceKind" "public"."evidence_facts_sourcekind_enum" NOT NULL, "sourceIdentifier" character varying(100) NOT NULL, "value" jsonb NOT NULL, "observedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "validThrough" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_77ee994251136ed9a71c8213fdd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_evidence_facts_tenant_case" ON "evidence_facts" ("tenantId", "caseId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."loan_conditions_status_enum" AS ENUM('OPEN', 'IN_PROGRESS', 'WAITING_FOR_EVIDENCE', 'SATISFIED', 'WAIVED', 'ESCALATED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "loan_conditions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "caseId" uuid NOT NULL, "code" character varying(100) NOT NULL, "description" text NOT NULL, "status" "public"."loan_conditions_status_enum" NOT NULL DEFAULT 'OPEN', "policySnapshotId" uuid, "version" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7f6e7ac231b01513290074f588a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_loan_conditions_tenant_case" ON "loan_conditions" ("tenantId", "caseId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."condition_transitions_fromstatus_enum" AS ENUM('OPEN', 'IN_PROGRESS', 'WAITING_FOR_EVIDENCE', 'SATISFIED', 'WAIVED', 'ESCALATED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."condition_transitions_tostatus_enum" AS ENUM('OPEN', 'IN_PROGRESS', 'WAITING_FOR_EVIDENCE', 'SATISFIED', 'WAIVED', 'ESCALATED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "condition_transitions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conditionId" uuid NOT NULL, "fromStatus" "public"."condition_transitions_fromstatus_enum" NOT NULL, "toStatus" "public"."condition_transitions_tostatus_enum" NOT NULL, "actorId" character varying(100), "reason" text, "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b46dabebd2644f595d4010b19f6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_condition_transitions_condition" ON "condition_transitions" ("conditionId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "loan_cases" ADD CONSTRAINT "FK_d6c46cfe1f225adcf486c7f95a3" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "evidence_facts" ADD CONSTRAINT "FK_5f67123188f7a508f7b2cbe7d15" FOREIGN KEY ("caseId") REFERENCES "loan_cases"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan_conditions" ADD CONSTRAINT "FK_702bd8c99c72b59c5f104629b41" FOREIGN KEY ("caseId") REFERENCES "loan_cases"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "condition_transitions" ADD CONSTRAINT "FK_47d7bfa527a59aa89487825114d" FOREIGN KEY ("conditionId") REFERENCES "loan_conditions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "condition_transitions" DROP CONSTRAINT "FK_47d7bfa527a59aa89487825114d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan_conditions" DROP CONSTRAINT "FK_702bd8c99c72b59c5f104629b41"`,
    );
    await queryRunner.query(
      `ALTER TABLE "evidence_facts" DROP CONSTRAINT "FK_5f67123188f7a508f7b2cbe7d15"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan_cases" DROP CONSTRAINT "FK_d6c46cfe1f225adcf486c7f95a3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_condition_transitions_condition"`,
    );
    await queryRunner.query(`DROP TABLE "condition_transitions"`);
    await queryRunner.query(
      `DROP TYPE "public"."condition_transitions_tostatus_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."condition_transitions_fromstatus_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_loan_conditions_tenant_case"`,
    );
    await queryRunner.query(`DROP TABLE "loan_conditions"`);
    await queryRunner.query(`DROP TYPE "public"."loan_conditions_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_evidence_facts_tenant_case"`,
    );
    await queryRunner.query(`DROP TABLE "evidence_facts"`);
    await queryRunner.query(
      `DROP TYPE "public"."evidence_facts_sourcekind_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."evidence_facts_facttype_enum"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_loan_cases_tenant"`);
    await queryRunner.query(`DROP TABLE "loan_cases"`);
    await queryRunner.query(`DROP TYPE "public"."loan_cases_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."loan_cases_loantype_enum"`);
    await queryRunner.query(`DROP TABLE "tenants"`);
  }
}
