import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Section 11.4's governed promotion chain (M4-007): `provider_promotion_manifests`,
 * `provider_certification_records`, `provider_approval_records`,
 * `provider_activations` — the real gate for any non-`SIMULATOR` mode,
 * completing what `ProviderAdapterStatus`'s own migration comment
 * (M4-006) named as deferred until "a second real provider mode" existed
 * (the real Plaid `AUTHORIZED_SANDBOX` adapter, this same slice).
 *
 * No RLS on any of the four tables, matching `provider_adapter_status`'s
 * own precedent exactly: `ProviderRegistryService.resolve()` has no
 * tenant dimension, so neither does promoting one of its registrations.
 */
export class ProviderPromotionChain1787177800000 implements MigrationInterface {
  name = 'ProviderPromotionChain1787177800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."provider_promotion_manifests_capability_enum" AS ENUM('INCOME', 'ASSET', 'CREDIT', 'IDENTITY', 'DOCUMENT')`,
    );
    await queryRunner.query(`
      CREATE TABLE "provider_promotion_manifests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "providerId" character varying(100) NOT NULL,
        "capability" "public"."provider_promotion_manifests_capability_enum" NOT NULL,
        "mode" character varying(30) NOT NULL,
        "version" integer NOT NULL,
        "adapterVersion" character varying(100) NOT NULL,
        "endpointAllowlist" jsonb NOT NULL,
        "dataClassifications" jsonb NOT NULL,
        "contentHash" character varying(64) NOT NULL,
        "proposedBy" character varying(200) NOT NULL,
        "proposedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "validFrom" TIMESTAMP WITH TIME ZONE NOT NULL,
        "validUntil" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_provider_promotion_manifests" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_provider_promotion_manifests_tuple" ON "provider_promotion_manifests" ("providerId", "capability", "mode")`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."provider_certification_records_decision_enum" AS ENUM('PASSED', 'FAILED', 'REVOKED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "provider_certification_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "manifestId" uuid NOT NULL,
        "environment" character varying(50) NOT NULL,
        "certifiedBy" character varying(200) NOT NULL,
        "decision" "public"."provider_certification_records_decision_enum" NOT NULL,
        "evidenceRef" character varying(2000) NOT NULL,
        "decidedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "expiresAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_provider_certification_records" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_provider_certification_records_manifest" ON "provider_certification_records" ("manifestId", "environment")`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."provider_approval_records_decision_enum" AS ENUM('APPROVED', 'REJECTED', 'REVOKED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "provider_approval_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "manifestId" uuid NOT NULL,
        "approvalRole" character varying(100) NOT NULL,
        "approvedBy" character varying(200) NOT NULL,
        "decision" "public"."provider_approval_records_decision_enum" NOT NULL,
        "decidedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "expiresAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_provider_approval_records" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_provider_approval_records_manifest" ON "provider_approval_records" ("manifestId")`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."provider_activations_capability_enum" AS ENUM('INCOME', 'ASSET', 'CREDIT', 'IDENTITY', 'DOCUMENT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."provider_activations_state_enum" AS ENUM('ACTIVE', 'DEACTIVATED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "provider_activations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "providerId" character varying(100) NOT NULL,
        "capability" "public"."provider_activations_capability_enum" NOT NULL,
        "mode" character varying(30) NOT NULL,
        "manifestId" uuid NOT NULL,
        "manifestVersion" integer NOT NULL,
        "state" "public"."provider_activations_state_enum" NOT NULL DEFAULT 'ACTIVE',
        "activatedBy" character varying(200) NOT NULL,
        "activatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_provider_activations" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "provider_activations" ADD CONSTRAINT "UQ_provider_activations_tuple" UNIQUE ("providerId", "capability", "mode")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "provider_activations"`);
    await queryRunner.query(
      `DROP TYPE "public"."provider_activations_state_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."provider_activations_capability_enum"`,
    );

    await queryRunner.query(`DROP TABLE "provider_approval_records"`);
    await queryRunner.query(
      `DROP TYPE "public"."provider_approval_records_decision_enum"`,
    );

    await queryRunner.query(`DROP TABLE "provider_certification_records"`);
    await queryRunner.query(
      `DROP TYPE "public"."provider_certification_records_decision_enum"`,
    );

    await queryRunner.query(`DROP TABLE "provider_promotion_manifests"`);
    await queryRunner.query(
      `DROP TYPE "public"."provider_promotion_manifests_capability_enum"`,
    );
  }
}
