import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds durable per-receiver outbound-attempt windows. */
export class WebhookEndpointOutboundRateLimit1787179400000 implements MigrationInterface {
  name = 'WebhookEndpointOutboundRateLimit1787179400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook_endpoints" ADD "outboundRateLimitPerMinute" integer NOT NULL DEFAULT 60`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "CHK_webhook_endpoint_outbound_rate" CHECK ("outboundRateLimitPerMinute" BETWEEN 1 AND 600)`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_endpoints" ADD "rateWindowStartedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_endpoints" ADD "rateWindowAttempts" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook_endpoints" DROP COLUMN "rateWindowAttempts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_endpoints" DROP COLUMN "rateWindowStartedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_endpoints" DROP CONSTRAINT "CHK_webhook_endpoint_outbound_rate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_endpoints" DROP COLUMN "outboundRateLimitPerMinute"`,
    );
  }
}
