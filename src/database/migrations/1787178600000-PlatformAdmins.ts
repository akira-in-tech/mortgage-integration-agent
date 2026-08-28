import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `platform_admins` (M7-020): a bearer credential with no tenant
 * dimension, existing only to drive the Section 11.4 provider promotion
 * chain — see `PlatformAdmin`'s own entity comment for why this can't
 * just be another `api_clients` row.
 *
 * No RLS, same as `provider_promotion_manifests` and friends — nothing
 * here is tenant data.
 */
export class PlatformAdmins1787178600000 implements MigrationInterface {
  name = 'PlatformAdmins1787178600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."platform_admins_status_enum" AS ENUM('ACTIVE', 'REVOKED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "platform_admins" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(200) NOT NULL,
        "hashedSecret" character varying(200) NOT NULL,
        "status" "public"."platform_admins_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_admins" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "platform_admins"`);
    await queryRunner.query(`DROP TYPE "public"."platform_admins_status_enum"`);
  }
}
