import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLoanApplications1710000000000 implements MigrationInterface {
  name = 'CreateLoanApplications1710000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "loan_applications_loan_type_enum" AS ENUM ('CONVENTIONAL', 'FHA', 'VA', 'JUMBO')`,
    );
    await queryRunner.query(
      `CREATE TYPE "loan_applications_decision_enum" AS ENUM ('APPROVED', 'CONDITIONAL', 'DENIED', 'PENDING')`,
    );
    await queryRunner.query(`
      CREATE TABLE "loan_applications" (
        "id" uuid NOT NULL,
        "borrowerId" character varying(100) NOT NULL,
        "requestedAmount" numeric(14,2) NOT NULL,
        "loanType" "loan_applications_loan_type_enum" NOT NULL DEFAULT 'CONVENTIONAL',
        "decision" "loan_applications_decision_enum" NOT NULL DEFAULT 'PENDING',
        "confidence" numeric(4,3),
        "reasoning" text,
        "incomeVerified" boolean NOT NULL DEFAULT false,
        "documentsValid" boolean NOT NULL DEFAULT false,
        "conditions" text,
        "rawIntegrationData" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loan_applications" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_loan_applications_borrower_created" ON "loan_applications" ("borrowerId", "createdAt")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_loan_applications_borrower_created"`,
    );
    await queryRunner.query(`DROP TABLE "loan_applications"`);
    await queryRunner.query(`DROP TYPE "loan_applications_decision_enum"`);
    await queryRunner.query(`DROP TYPE "loan_applications_loan_type_enum"`);
  }
}
