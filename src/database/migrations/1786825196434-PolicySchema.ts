import { MigrationInterface, QueryRunner } from 'typeorm';

export class PolicySchema1786825196434 implements MigrationInterface {
  name = 'PolicySchema1786825196434';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."jurisdictions_level_enum" AS ENUM('FEDERAL', 'STATE', 'LOCAL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."jurisdictions_coveragestatus_enum" AS ENUM('COVERED', 'PARTIAL', 'NOT_COVERED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "jurisdictions" ("code" character varying(20) NOT NULL, "level" "public"."jurisdictions_level_enum" NOT NULL, "parentCode" character varying(20), "name" character varying(200) NOT NULL, "coverageStatus" "public"."jurisdictions_coveragestatus_enum" NOT NULL DEFAULT 'NOT_COVERED', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e33b5f6afb84e58de0c2399edb0" PRIMARY KEY ("code"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."policy_sources_retrievalmode_enum" AS ENUM('SYNTHETIC', 'MANUAL', 'CONNECTOR')`,
    );
    await queryRunner.query(
      `CREATE TABLE "policy_sources" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(200) NOT NULL, "owner" character varying(200) NOT NULL, "jurisdictionCode" character varying(20) NOT NULL, "retrievalMode" "public"."policy_sources_retrievalmode_enum" NOT NULL, "freshnessObjectiveHours" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b65a12ae5c450a66a5df9c54470" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "policy_source_revisions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "policySourceId" uuid NOT NULL, "checksum" text NOT NULL, "publishedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "recordedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "content" jsonb NOT NULL, CONSTRAINT "PK_28383bcaefe084e1b1ac1722d9a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_policy_source_revisions_source" ON "policy_source_revisions" ("policySourceId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."policy_versions_releasestatus_enum" AS ENUM('DRAFT', 'PROPOSED', 'RELEASED', 'SUPERSEDED', 'WITHDRAWN', 'CORRECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "policy_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ruleId" character varying(200) NOT NULL, "version" character varying(50) NOT NULL, "sourceRevisionId" uuid NOT NULL, "dsl" jsonb NOT NULL, "effectiveFrom" TIMESTAMP WITH TIME ZONE NOT NULL, "effectiveTo" TIMESTAMP WITH TIME ZONE, "releaseStatus" "public"."policy_versions_releasestatus_enum" NOT NULL DEFAULT 'DRAFT', "recordedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "supersedesVersionId" uuid, CONSTRAINT "UQ_policy_versions_rule_version" UNIQUE ("ruleId", "version"), CONSTRAINT "PK_125d2970fc66a316f84af16812e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_policy_versions_rule" ON "policy_versions" ("ruleId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "policy_applicability" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "policyVersionId" uuid NOT NULL, "jurisdictionCode" character varying(20) NOT NULL, "productCode" character varying(100) NOT NULL, "programCode" character varying(100), "lifecycleEvent" character varying(100) NOT NULL, "transitionRule" character varying(200), CONSTRAINT "PK_e2ea9e85e22d308c33397f2b09b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_policy_applicability_lookup" ON "policy_applicability" ("jurisdictionCode", "productCode", "lifecycleEvent") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_policy_applicability_version" ON "policy_applicability" ("policyVersionId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "jurisdictions" ADD CONSTRAINT "FK_59d97426cb22b4eb5cbea9c5638" FOREIGN KEY ("parentCode") REFERENCES "jurisdictions"("code") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_sources" ADD CONSTRAINT "FK_598f9feef2fc2bd62b037d26084" FOREIGN KEY ("jurisdictionCode") REFERENCES "jurisdictions"("code") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_source_revisions" ADD CONSTRAINT "FK_50983d742a0139d13faf7a94b9e" FOREIGN KEY ("policySourceId") REFERENCES "policy_sources"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_versions" ADD CONSTRAINT "FK_46e77c5687817084265685ace65" FOREIGN KEY ("sourceRevisionId") REFERENCES "policy_source_revisions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_applicability" ADD CONSTRAINT "FK_ac1e4a9ccb52e3e01542bf2ad7a" FOREIGN KEY ("policyVersionId") REFERENCES "policy_versions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "policy_applicability" DROP CONSTRAINT "FK_ac1e4a9ccb52e3e01542bf2ad7a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_versions" DROP CONSTRAINT "FK_46e77c5687817084265685ace65"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_source_revisions" DROP CONSTRAINT "FK_50983d742a0139d13faf7a94b9e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policy_sources" DROP CONSTRAINT "FK_598f9feef2fc2bd62b037d26084"`,
    );
    await queryRunner.query(
      `ALTER TABLE "jurisdictions" DROP CONSTRAINT "FK_59d97426cb22b4eb5cbea9c5638"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_policy_applicability_version"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_policy_applicability_lookup"`,
    );
    await queryRunner.query(`DROP TABLE "policy_applicability"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_policy_versions_rule"`);
    await queryRunner.query(`DROP TABLE "policy_versions"`);
    await queryRunner.query(
      `DROP TYPE "public"."policy_versions_releasestatus_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_policy_source_revisions_source"`,
    );
    await queryRunner.query(`DROP TABLE "policy_source_revisions"`);
    await queryRunner.query(`DROP TABLE "policy_sources"`);
    await queryRunner.query(
      `DROP TYPE "public"."policy_sources_retrievalmode_enum"`,
    );
    await queryRunner.query(`DROP TABLE "jurisdictions"`);
    await queryRunner.query(
      `DROP TYPE "public"."jurisdictions_coveragestatus_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."jurisdictions_level_enum"`);
  }
}
