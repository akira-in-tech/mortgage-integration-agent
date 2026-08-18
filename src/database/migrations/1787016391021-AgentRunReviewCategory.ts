import { MigrationInterface, QueryRunner } from 'typeorm';

export class AgentRunReviewCategory1787016391021 implements MigrationInterface {
  name = 'AgentRunReviewCategory1787016391021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."agent_runs_reviewcategory_enum" AS ENUM('CONSENT_INVALID', 'BUDGET_OR_DEADLINE_EXHAUSTED', 'POLICY_AMBIGUITY', 'TOOL_EXECUTION_FAILURE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_runs" ADD "reviewCategory" "public"."agent_runs_reviewcategory_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_runs" DROP COLUMN "reviewCategory"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."agent_runs_reviewcategory_enum"`,
    );
  }
}
