import { MigrationInterface, QueryRunner } from 'typeorm';

export class AgentRunTimeline1786987516961 implements MigrationInterface {
  name = 'AgentRunTimeline1786987516961';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."agent_runs_route_enum" AS ENUM('PROPOSED_ACTION', 'AWAITING_INFORMATION', 'INTERRUPTED_FOR_REVIEW', 'ROUTED_TO_MANUAL_REVIEW')`,
    );
    await queryRunner.query(
      `CREATE TABLE "agent_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "caseId" uuid NOT NULL, "workflowRunId" character varying(200) NOT NULL, "route" "public"."agent_runs_route_enum" NOT NULL, "proposedActionTool" character varying(100), "proposedActionArguments" jsonb, "reviewRequested" boolean NOT NULL DEFAULT false, "reviewReason" text, "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "completedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_442f7e0ec4ae860cf17edc57825" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_agent_runs_case" ON "agent_runs" ("tenantId", "caseId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tool_attempts_outcome_enum" AS ENUM('SUCCESS', 'FAILURE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tool_attempts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "agentRunId" uuid NOT NULL, "toolName" character varying(100) NOT NULL, "outcome" "public"."tool_attempts_outcome_enum" NOT NULL, "detail" text, "attemptedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_fc2a46a11f9410d865d44dae3ae" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tool_attempts_agent_run" ON "tool_attempts" ("agentRunId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "tool_attempts" ADD CONSTRAINT "FK_a719637f191f976bec752bdf825" FOREIGN KEY ("agentRunId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tool_attempts" DROP CONSTRAINT "FK_a719637f191f976bec752bdf825"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_tool_attempts_agent_run"`,
    );
    await queryRunner.query(`DROP TABLE "tool_attempts"`);
    await queryRunner.query(`DROP TYPE "public"."tool_attempts_outcome_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_agent_runs_case"`);
    await queryRunner.query(`DROP TABLE "agent_runs"`);
    await queryRunner.query(`DROP TYPE "public"."agent_runs_route_enum"`);
  }
}
