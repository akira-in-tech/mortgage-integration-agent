import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Section 14.1's `users` ("OIDC-linked human identity") and
 * `tenant_memberships` ("Role assignment by tenant") — M5-024's real
 * second credential model, alongside (not replacing) `api_clients`.
 * Neither table gets RLS — see each entity's own comment for the
 * identical bootstrap reasoning `api_clients` itself already established
 * (a lookup that determines whether a request may act in a tenant at
 * all cannot itself already be scoped by that tenant's own RLS policy).
 */
export class UsersAndTenantMemberships1787177900000 implements MigrationInterface {
  name = 'UsersAndTenantMemberships1787177900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "subject" character varying(255) NOT NULL,
        "email" character varying(320) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_subject" UNIQUE ("subject")
      )
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."tenant_memberships_role_enum" AS ENUM('PARTNER', 'REVIEWER')`,
    );
    await queryRunner.query(`
      CREATE TABLE "tenant_memberships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "role" "public"."tenant_memberships_role_enum" NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenant_memberships" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "tenant_memberships" ADD CONSTRAINT "UQ_tenant_memberships_tenant_user" UNIQUE ("tenantId", "userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tenant_memberships"`);
    await queryRunner.query(
      `DROP TYPE "public"."tenant_memberships_role_enum"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
