import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds content-free model-call evidence and persisted model provenance. */
export class GovernedAgentPlanner1787179300000 implements MigrationInterface {
  name = 'GovernedAgentPlanner1787179300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."agent_runs_reviewcategory_enum" ADD VALUE IF NOT EXISTS 'MODEL_OUTPUT_INVALID'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."agent_runs_reviewcategory_enum" ADD VALUE IF NOT EXISTS 'MODEL_UNCERTAINTY'`,
    );
    await queryRunner.query(`
      CREATE TABLE "agent_model_invocations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "caseId" uuid NOT NULL,
        "caseVersion" integer NOT NULL,
        "workflowRunId" character varying(200) NOT NULL,
        "modelVersion" character varying(200) NOT NULL,
        "promptVersion" character varying(100) NOT NULL,
        "nextAction" character varying(30) NOT NULL,
        "reasonCode" character varying(40) NOT NULL,
        "confidenceBasisPoints" integer NOT NULL,
        "accountedTokenUnits" integer NOT NULL,
        "requestDigest" character varying(64) NOT NULL,
        "responseDigest" character varying(64) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_agent_model_invocation_action" CHECK ("nextAction" IN ('EVALUATE_POLICY','REQUEST_HUMAN_REVIEW')),
        CONSTRAINT "CHK_agent_model_invocation_reason" CHECK ("reasonCode" IN ('POLICY_EVALUATION_REQUIRED','HUMAN_REVIEW_REQUIRED')),
        CONSTRAINT "CHK_agent_model_invocation_route_reason" CHECK (("nextAction" = 'EVALUATE_POLICY' AND "reasonCode" = 'POLICY_EVALUATION_REQUIRED') OR ("nextAction" = 'REQUEST_HUMAN_REVIEW' AND "reasonCode" = 'HUMAN_REVIEW_REQUIRED')),
        CONSTRAINT "CHK_agent_model_invocation_confidence" CHECK ("confidenceBasisPoints" BETWEEN 0 AND 10000),
        CONSTRAINT "CHK_agent_model_invocation_tokens" CHECK ("accountedTokenUnits" > 0),
        CONSTRAINT "PK_agent_model_invocations" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_agent_model_invocations_replay" ON "agent_model_invocations" ("tenantId", "workflowRunId", "caseVersion", "modelVersion", "promptVersion")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_agent_model_invocations_case" ON "agent_model_invocations" ("tenantId", "caseId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_model_invocations" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_model_invocations" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY "tenant_isolation" ON "agent_model_invocations"
         USING (
           current_setting('app.bypass_rls', true) = 'true'
           OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
         )`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_runs" ADD "modelInvocationId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_runs" ADD "modelVersion" character varying(200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_runs" ADD "promptVersion" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_runs" ADD CONSTRAINT "FK_agent_runs_model_invocation" FOREIGN KEY ("modelInvocationId") REFERENCES "agent_model_invocations"("id") ON DELETE RESTRICT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_runs" DROP CONSTRAINT "FK_agent_runs_model_invocation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_runs" DROP COLUMN "promptVersion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_runs" DROP COLUMN "modelVersion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_runs" DROP COLUMN "modelInvocationId"`,
    );
    await queryRunner.query(
      `DROP POLICY "tenant_isolation" ON "agent_model_invocations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_model_invocations" NO FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_model_invocations" DISABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_agent_model_invocations_case"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_agent_model_invocations_replay"`,
    );
    await queryRunner.query(`DROP TABLE "agent_model_invocations"`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM "agent_runs"
          WHERE "reviewCategory"::text IN ('MODEL_OUTPUT_INVALID','MODEL_UNCERTAINTY')
        ) THEN
          RAISE EXCEPTION 'cannot revert governed Agent planner while model review rows exist';
        END IF;
      END $$
    `);
    await queryRunner.query(
      `ALTER TYPE "public"."agent_runs_reviewcategory_enum" RENAME TO "agent_runs_reviewcategory_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."agent_runs_reviewcategory_enum" AS ENUM('CONSENT_INVALID','BUDGET_OR_DEADLINE_EXHAUSTED','POLICY_AMBIGUITY','TOOL_EXECUTION_FAILURE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_runs" ALTER COLUMN "reviewCategory" TYPE "public"."agent_runs_reviewcategory_enum" USING "reviewCategory"::text::"public"."agent_runs_reviewcategory_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."agent_runs_reviewcategory_enum_old"`,
    );
  }
}
