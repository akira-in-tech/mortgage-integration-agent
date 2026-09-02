import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gives a logical provider effect one durable identity across workflow retries.
 * Existing rows are backfilled with their own id because they predate any
 * caller-supplied logical key and therefore cannot safely be coalesced.
 */
export class ProviderIntentReplaySafety1787179000000 implements MigrationInterface {
  name = 'ProviderIntentReplaySafety1787179000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "provider_operation_intents" ADD "logicalOperationKey" character varying(200)`,
    );
    await queryRunner.query(
      `UPDATE "provider_operation_intents" SET "logicalOperationKey" = "id"::text`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_operation_intents" ALTER COLUMN "logicalOperationKey" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_operation_intents" ADD "providerReceipt" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_operation_intents" ADD "normalizedFinding" jsonb`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_provider_operation_intents_logical_effect" ON "provider_operation_intents" ("tenantId", "providerId", "capability", "logicalOperationKey")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_provider_operation_intents_logical_effect"`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_operation_intents" DROP COLUMN "normalizedFinding"`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_operation_intents" DROP COLUMN "providerReceipt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_operation_intents" DROP COLUMN "logicalOperationKey"`,
    );
  }
}
