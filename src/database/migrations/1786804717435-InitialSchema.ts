import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1786804717435 implements MigrationInterface {
  name = 'InitialSchema1786804717435';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."loan_applications_loantype_enum" AS ENUM('CONVENTIONAL', 'FHA', 'VA', 'JUMBO')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."loan_applications_decision_enum" AS ENUM('APPROVED', 'CONDITIONAL', 'DENIED', 'PENDING')`,
    );
    await queryRunner.query(
      `CREATE TABLE "loan_applications" ("id" uuid NOT NULL, "borrowerId" character varying(100) NOT NULL, "requestedAmount" numeric(14,2) NOT NULL, "loanType" "public"."loan_applications_loantype_enum" NOT NULL DEFAULT 'CONVENTIONAL', "decision" "public"."loan_applications_decision_enum" NOT NULL DEFAULT 'PENDING', "confidence" numeric(4,3), "reasoning" text, "incomeVerified" boolean NOT NULL DEFAULT false, "documentsValid" boolean NOT NULL DEFAULT false, "conditions" text, "rawIntegrationData" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a40270ea2f2b1fbc185b0f5684a" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "loan_applications"`);
    await queryRunner.query(
      `DROP TYPE "public"."loan_applications_decision_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."loan_applications_loantype_enum"`,
    );
  }
}
