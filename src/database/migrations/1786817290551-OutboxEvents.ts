import { MigrationInterface, QueryRunner } from 'typeorm';

export class OutboxEvents1786817290551 implements MigrationInterface {
  name = 'OutboxEvents1786817290551';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "outbox_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "caseId" uuid NOT NULL, "eventType" character varying(100) NOT NULL, "payload" jsonb NOT NULL, "signature" character varying(64) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "publishedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6689a16c00d09b8089f6237f1d2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_outbox_events_tenant_case" ON "outbox_events" ("tenantId", "caseId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_outbox_events_tenant_case"`,
    );
    await queryRunner.query(`DROP TABLE "outbox_events"`);
  }
}
