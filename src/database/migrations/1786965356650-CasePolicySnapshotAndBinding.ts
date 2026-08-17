import { MigrationInterface, QueryRunner } from 'typeorm';

export class CasePolicySnapshotAndBinding1786965356650 implements MigrationInterface {
  name = 'CasePolicySnapshotAndBinding1786965356650';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."case_policy_snapshots_resolutionstatus_enum" AS ENUM('RESOLVED', 'REVIEW_REQUIRED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "case_policy_snapshots" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "caseId" uuid NOT NULL, "resolvedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contextHash" character varying(64) NOT NULL, "resolverVersion" character varying(20) NOT NULL, "resolutionStatus" "public"."case_policy_snapshots_resolutionstatus_enum" NOT NULL, "versions" jsonb NOT NULL, "unresolvedReasons" jsonb NOT NULL, CONSTRAINT "PK_75bea35dc40c71ba37612988034" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_case_policy_snapshots_case" ON "case_policy_snapshots" ("tenantId", "caseId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "case_policy_bindings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "caseId" uuid NOT NULL, "dependencyDigest" character varying(64) NOT NULL, "policySnapshotId" uuid NOT NULL, "boundAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "revalidateAfter" TIMESTAMP WITH TIME ZONE NOT NULL, "invalidatedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_ab553f35ac1ba76061bb71103ad" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_case_policy_bindings_case_active" ON "case_policy_bindings" ("tenantId", "caseId", "invalidatedAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "case_policy_bindings" ADD CONSTRAINT "FK_9a81593acfe33cf83e2ff0d5d4d" FOREIGN KEY ("policySnapshotId") REFERENCES "case_policy_snapshots"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "case_policy_bindings" DROP CONSTRAINT "FK_9a81593acfe33cf83e2ff0d5d4d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_case_policy_bindings_case_active"`,
    );
    await queryRunner.query(`DROP TABLE "case_policy_bindings"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_case_policy_snapshots_case"`,
    );
    await queryRunner.query(`DROP TABLE "case_policy_snapshots"`);
    await queryRunner.query(
      `DROP TYPE "public"."case_policy_snapshots_resolutionstatus_enum"`,
    );
  }
}
