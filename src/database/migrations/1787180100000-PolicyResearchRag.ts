import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the durable, citation-bound policy research queue. These tables are
 * global governance data, not tenant data: requests contain only jurisdiction
 * and product/lifecycle context, never borrower facts or case identifiers.
 */
export class PolicyResearchRag1787180100000 implements MigrationInterface {
  name = 'PolicyResearchRag1787180100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."policy_research_runs_trigger_enum" AS ENUM('NEW_SOURCE_REVISION', 'SOURCE_FRESHNESS_EXPIRED', 'COVERAGE_GAP', 'APPLICABILITY_CONFLICT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."policy_research_runs_status_enum" AS ENUM('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "policy_research_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "trigger" "public"."policy_research_runs_trigger_enum" NOT NULL,
        "status" "public"."policy_research_runs_status_enum" NOT NULL,
        "policySourceId" uuid,
        "policySourceRevisionId" uuid,
        "jurisdictionCode" character varying(20) NOT NULL,
        "productCode" character varying(100),
        "lifecycleEvent" character varying(100),
        "requestFingerprint" character varying(64) NOT NULL,
        "unresolvedReasons" jsonb NOT NULL,
        "researchQuery" text NOT NULL,
        "candidateSummary" text,
        "changeSignals" jsonb,
        "synthesisProvider" character varying(50),
        "failureDetail" text,
        "attempts" integer NOT NULL DEFAULT 0,
        "requestedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "claimedAt" TIMESTAMP WITH TIME ZONE,
        "completedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_policy_research_runs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_policy_research_runs_fingerprint" UNIQUE ("requestFingerprint"),
        CONSTRAINT "FK_policy_research_runs_source" FOREIGN KEY ("policySourceId") REFERENCES "policy_sources"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_policy_research_runs_revision" FOREIGN KEY ("policySourceRevisionId") REFERENCES "policy_source_revisions"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_policy_research_runs_queue" ON "policy_research_runs" ("status", "requestedAt")`,
    );
    await queryRunner.query(`
      CREATE TABLE "policy_research_citations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "policyResearchRunId" uuid NOT NULL,
        "policySourceRevisionId" uuid NOT NULL,
        "sourceChecksum" character varying(200) NOT NULL,
        "location" character varying(500) NOT NULL,
        "excerpt" text NOT NULL,
        "excerptDigest" character varying(64) NOT NULL,
        "rank" integer NOT NULL,
        "relevanceScore" numeric(7,6) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_policy_research_citations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_policy_research_citations_run_rank" UNIQUE ("policyResearchRunId", "rank"),
        CONSTRAINT "FK_policy_research_citations_run" FOREIGN KEY ("policyResearchRunId") REFERENCES "policy_research_runs"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_policy_research_citations_revision" FOREIGN KEY ("policySourceRevisionId") REFERENCES "policy_source_revisions"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_policy_research_citations_run_rank" ON "policy_research_citations" ("policyResearchRunId", "rank")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_policy_research_citations_run_rank"`,
    );
    await queryRunner.query(`DROP TABLE "policy_research_citations"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_policy_research_runs_queue"`,
    );
    await queryRunner.query(`DROP TABLE "policy_research_runs"`);
    await queryRunner.query(
      `DROP TYPE "public"."policy_research_runs_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."policy_research_runs_trigger_enum"`,
    );
  }
}
