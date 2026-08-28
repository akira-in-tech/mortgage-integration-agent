import { MigrationInterface, QueryRunner } from 'typeorm';

export class PolicyTransitionApproval1786992218898 implements MigrationInterface {
  name = 'PolicyTransitionApproval1786992218898';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "policy_transition_approvals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "policyVersionId" uuid NOT NULL, "proposedBy" character varying(200) NOT NULL, "proposedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "approvedBy" character varying(200), "approvedAt" TIMESTAMP WITH TIME ZONE, "notes" text, CONSTRAINT "PK_02b91825d2228cda031049c8202" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_policy_transition_approvals_version" ON "policy_transition_approvals" ("policyVersionId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_policy_transition_approvals_version"`,
    );
    await queryRunner.query(`DROP TABLE "policy_transition_approvals"`);
  }
}
