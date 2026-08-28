import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Section 11.4's kill switch (M4-006) — see `ProviderAdapterStatus`'s own
 * entity comment for the full scoping rationale (a real, standalone
 * emergency-disable mechanism, deliberately not the full manifest/
 * certification/approval/activation chain, which needs a second real
 * provider mode to have genuine content). Genuinely new table, no RLS
 * applied — this table has no tenant dimension at all (see that same
 * entity comment), matching `tenants`/the policy catalog's own precedent
 * of a real, deliberately-unprotected shared table.
 */
export class ProviderAdapterStatus1787177600000 implements MigrationInterface {
  name = 'ProviderAdapterStatus1787177600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."provider_adapter_status_capability_enum" AS ENUM('INCOME', 'ASSET', 'CREDIT', 'IDENTITY', 'DOCUMENT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."provider_adapter_status_state_enum" AS ENUM('ACTIVE', 'DISABLED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "provider_adapter_status" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "providerId" character varying(100) NOT NULL,
        "capability" "public"."provider_adapter_status_capability_enum" NOT NULL,
        "mode" character varying(30) NOT NULL,
        "state" "public"."provider_adapter_status_state_enum" NOT NULL DEFAULT 'ACTIVE',
        "reason" character varying(2000),
        "updatedBy" character varying(200) NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_provider_adapter_status" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "provider_adapter_status" ADD CONSTRAINT "UQ_provider_adapter_status_tuple" UNIQUE ("providerId", "capability", "mode")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "provider_adapter_status"`);
    await queryRunner.query(
      `DROP TYPE "public"."provider_adapter_status_state_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."provider_adapter_status_capability_enum"`,
    );
  }
}
