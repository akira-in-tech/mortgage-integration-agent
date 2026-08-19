import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M5-017's scoped RBAC — see `ApiClientRole`'s own comment
 * (src/database/enums/api-client.enum.ts) for the two-role rationale.
 * `NOT NULL DEFAULT 'PARTNER'` so every existing credential (minted
 * before this migration) keeps working exactly as before — nothing was
 * gated by role until this same slice also adds the one `@RequireRole`
 * check (`submitReview`), so no previously-issued token silently loses
 * access it already had.
 */
export class ApiClientRole1787170970745 implements MigrationInterface {
  name = 'ApiClientRole1787170970745';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."api_clients_role_enum" AS ENUM('PARTNER', 'REVIEWER')`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_clients" ADD "role" "public"."api_clients_role_enum" NOT NULL DEFAULT 'PARTNER'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "api_clients" DROP COLUMN "role"`);
    await queryRunner.query(`DROP TYPE "public"."api_clients_role_enum"`);
  }
}
