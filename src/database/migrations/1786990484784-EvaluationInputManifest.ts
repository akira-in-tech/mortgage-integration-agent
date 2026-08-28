import { MigrationInterface, QueryRunner } from 'typeorm';

export class EvaluationInputManifest1786990484784 implements MigrationInterface {
  name = 'EvaluationInputManifest1786990484784';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "evaluation_input_manifests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "caseId" uuid NOT NULL, "caseVersion" integer NOT NULL, "authorizationDecisionId" character varying(200), "consentVersionRefs" jsonb NOT NULL, "evidenceRefs" jsonb NOT NULL, "calculationRefs" jsonb NOT NULL, "policyBindingId" uuid NOT NULL, "observedPolicyDependencyDigest" character varying(64) NOT NULL, "evaluatorVersion" character varying(20) NOT NULL, "modelAndPromptManifestId" character varying(200), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "manifestHash" character varying(64) NOT NULL, CONSTRAINT "PK_8d2e956aa35e9528d0a030d84d3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_evaluation_input_manifests_case" ON "evaluation_input_manifests" ("tenantId", "caseId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "loan_conditions" ADD "evaluationManifestId" uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loan_conditions" DROP COLUMN "evaluationManifestId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_evaluation_input_manifests_case"`,
    );
    await queryRunner.query(`DROP TABLE "evaluation_input_manifests"`);
  }
}
