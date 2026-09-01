import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Public demo sessions are deliberately separate from OIDC sessions: they
 * authorize one disposable synthetic tenant, never a human identity or an
 * existing customer workspace.
 */
export class GuestSandboxSessions1787180000000 implements MigrationInterface {
  name = 'GuestSandboxSessions1787180000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "guest_sandbox_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sessionTokenHash" character(64) NOT NULL,
        "csrfTokenHash" character(64) NOT NULL,
        "tenantId" uuid NOT NULL,
        "actorId" uuid NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "lastUsedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guest_sandbox_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_guest_sandbox_sessions_token_hash" UNIQUE ("sessionTokenHash"),
        CONSTRAINT "FK_guest_sandbox_sessions_tenant" FOREIGN KEY ("tenantId")
          REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_guest_sandbox_sessions_expires" ON "guest_sandbox_sessions" ("expiresAt")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_guest_sandbox_sessions_expires"`,
    );
    await queryRunner.query(`DROP TABLE "guest_sandbox_sessions"`);
  }
}
