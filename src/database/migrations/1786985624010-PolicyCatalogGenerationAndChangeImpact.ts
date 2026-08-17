import { MigrationInterface, QueryRunner } from 'typeorm';

export class PolicyCatalogGenerationAndChangeImpact1786985624010 implements MigrationInterface {
  name = 'PolicyCatalogGenerationAndChangeImpact1786985624010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."policy_change_impact_assessments_impact_enum" AS ENUM('NO_IMPACT', 'REQUIRES_REEVALUATION', 'AMBIGUOUS')`,
    );
    await queryRunner.query(
      `CREATE TABLE "policy_change_impact_assessments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "policyVersionId" uuid NOT NULL, "tenantId" uuid NOT NULL, "caseId" uuid NOT NULL, "priorPolicyBindingId" uuid, "impact" "public"."policy_change_impact_assessments_impact_enum" NOT NULL, "details" text NOT NULL, "assessedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a8f3820728ee3e5f28368fd30e9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_policy_change_impact_assessments_version" ON "policy_change_impact_assessments" ("policyVersionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_policy_change_impact_assessments_case" ON "policy_change_impact_assessments" ("tenantId", "caseId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "policy_catalog_generation" ("id" integer NOT NULL DEFAULT '1', "generation" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_190baad2af114539de3b504b481" PRIMARY KEY ("id"))`,
    );
    // The single row PolicyEvaluationService's fast path always reads —
    // required for the table to be usable at all, not optional sample
    // data, so it's seeded in the same migration as the schema rather
    // than a separate data migration.
    await queryRunner.query(
      `INSERT INTO "policy_catalog_generation" ("id", "generation") VALUES (1, 0)`,
    );
    // DEFAULT 0 (not just NOT NULL): any case_policy_bindings row that
    // already existed before this migration gets the safe "no
    // generation ever observed" value, which can only force an extra
    // slow-path re-resolution on its next evaluate() call, never an
    // incorrect fast-path reuse.
    await queryRunner.query(
      `ALTER TABLE "case_policy_bindings" ADD "observedCatalogGeneration" integer NOT NULL DEFAULT '0'`,
    );
    // DEFAULT '' (not a real context key format — real ones are always
    // "jurisdiction|product|lifecycle") for the same reason as above: any
    // pre-existing binding row can never derive its original request
    // context from the row alone, and '' can never equal a real
    // currentContextKey, so it safely always forces the slow path rather
    // than fast-pathing on an unknown assumption.
    await queryRunner.query(
      `ALTER TABLE "case_policy_bindings" ADD "contextKey" character varying(300) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_change_impact_assessments" ADD CONSTRAINT "FK_6009702acb40e3aa0e2a75a1ec5" FOREIGN KEY ("policyVersionId") REFERENCES "policy_versions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "policy_change_impact_assessments" DROP CONSTRAINT "FK_6009702acb40e3aa0e2a75a1ec5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "case_policy_bindings" DROP COLUMN "contextKey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "case_policy_bindings" DROP COLUMN "observedCatalogGeneration"`,
    );
    await queryRunner.query(`DROP TABLE "policy_catalog_generation"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_policy_change_impact_assessments_case"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_policy_change_impact_assessments_version"`,
    );
    await queryRunner.query(`DROP TABLE "policy_change_impact_assessments"`);
    await queryRunner.query(
      `DROP TYPE "public"."policy_change_impact_assessments_impact_enum"`,
    );
  }
}
