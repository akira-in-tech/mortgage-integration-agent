import { MigrationInterface, QueryRunner } from 'typeorm';

export class WebhookPlatform1787042560459 implements MigrationInterface {
  name = 'WebhookPlatform1787042560459';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."webhook_endpoints_status_enum" AS ENUM('ACTIVE', 'DISABLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "webhook_endpoints" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "targetUrl" character varying(2000) NOT NULL, "secret" character varying(64) NOT NULL, "eventTypes" jsonb NOT NULL, "status" "public"."webhook_endpoints_status_enum" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_054c4cfb95223732f5939d2d546" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_webhook_endpoints_tenant" ON "webhook_endpoints" ("tenantId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."webhook_deliveries_status_enum" AS ENUM('PENDING', 'SUCCEEDED', 'FAILED_FINAL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "webhook_deliveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "webhookEndpointId" uuid NOT NULL, "outboxEventId" uuid NOT NULL, "eventType" character varying(100) NOT NULL, "status" "public"."webhook_deliveries_status_enum" NOT NULL DEFAULT 'PENDING', "attempts" jsonb NOT NULL DEFAULT '[]', "nextAttemptAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_535dd409947fb6d8fc6dfc0112a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_webhook_deliveries_dispatch_due" ON "webhook_deliveries" ("status", "nextAttemptAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_webhook_deliveries_tenant" ON "webhook_deliveries" ("tenantId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "FK_e4dca936b75c3f9d0d38ff18457" FOREIGN KEY ("webhookEndpointId") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "FK_353153416ab64f247ffbc06ca49" FOREIGN KEY ("outboxEventId") REFERENCES "outbox_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook_deliveries" DROP CONSTRAINT "FK_353153416ab64f247ffbc06ca49"`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_deliveries" DROP CONSTRAINT "FK_e4dca936b75c3f9d0d38ff18457"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_webhook_deliveries_tenant"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_webhook_deliveries_dispatch_due"`,
    );
    await queryRunner.query(`DROP TABLE "webhook_deliveries"`);
    await queryRunner.query(
      `DROP TYPE "public"."webhook_deliveries_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_webhook_endpoints_tenant"`,
    );
    await queryRunner.query(`DROP TABLE "webhook_endpoints"`);
    await queryRunner.query(
      `DROP TYPE "public"."webhook_endpoints_status_enum"`,
    );
  }
}
