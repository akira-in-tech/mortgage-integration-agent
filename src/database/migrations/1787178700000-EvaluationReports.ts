import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `evaluation_report_records` (M7-023): a durable copy of each
 * `npm run evaluate` run's report — see `EvaluationReportRecord`'s own
 * entity comment for why this table has no tenant dimension.
 */
export class EvaluationReports1787178700000 implements MigrationInterface {
  name = 'EvaluationReports1787178700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "evaluation_report_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "generatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "gitCommit" character varying(64),
        "gitBranch" character varying(200),
        "totalCases" integer NOT NULL,
        "passed" integer NOT NULL,
        "failed" integer NOT NULL,
        "conditionRecall" double precision,
        "conditionPrecision" double precision,
        "report" jsonb NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_evaluation_report_records" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_evaluation_report_records_generated_at" ON "evaluation_report_records" ("generatedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "evaluation_report_records"`);
  }
}
