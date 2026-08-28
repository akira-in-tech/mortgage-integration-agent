import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApiClients1787065685817 implements MigrationInterface {
  name = 'ApiClients1787065685817';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."api_clients_status_enum" AS ENUM('ACTIVE', 'REVOKED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "api_clients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "name" character varying(200) NOT NULL, "hashedSecret" character varying(200) NOT NULL, "status" "public"."api_clients_status_enum" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ef2d5ef0eb5e9a6ddc67cfa310e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_api_clients_tenant" ON "api_clients" ("tenantId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_api_clients_tenant"`);
    await queryRunner.query(`DROP TABLE "api_clients"`);
    await queryRunner.query(`DROP TYPE "public"."api_clients_status_enum"`);
  }
}
