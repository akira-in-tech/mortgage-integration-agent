import { MigrationInterface, QueryRunner } from 'typeorm';

export class LoanCaseIncomeAndJurisdiction1786910916794 implements MigrationInterface {
  name = 'LoanCaseIncomeAndJurisdiction1786910916794';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loan_cases" ADD "statedMonthlyIncome" numeric(14,2) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan_cases" ADD "jurisdictionCode" character varying(20) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan_cases" ADD CONSTRAINT "FK_8bfe0dccefb5c70c47db64fe6ad" FOREIGN KEY ("jurisdictionCode") REFERENCES "jurisdictions"("code") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loan_cases" DROP CONSTRAINT "FK_8bfe0dccefb5c70c47db64fe6ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan_cases" DROP COLUMN "jurisdictionCode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loan_cases" DROP COLUMN "statedMonthlyIncome"`,
    );
  }
}
