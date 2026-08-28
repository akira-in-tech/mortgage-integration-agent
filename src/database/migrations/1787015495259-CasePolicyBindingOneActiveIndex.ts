import { MigrationInterface, QueryRunner } from 'typeorm';

export class CasePolicyBindingOneActiveIndex1787015495259 implements MigrationInterface {
  name = 'CasePolicyBindingOneActiveIndex1787015495259';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_case_policy_bindings_one_active" ON "case_policy_bindings" ("tenantId", "caseId") WHERE "invalidatedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_case_policy_bindings_one_active"`,
    );
  }
}
