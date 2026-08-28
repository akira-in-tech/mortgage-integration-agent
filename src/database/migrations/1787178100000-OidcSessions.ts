import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Durable, server-side OIDC sessions for the console BFF. Session handles and
 * CSRF tokens are stored only as SHA-256 hashes; the provider token bundle is
 * AES-GCM ciphertext produced by `OidcSessionService`.
 */
export class OidcSessions1787178100000 implements MigrationInterface {
  name = 'OidcSessions1787178100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "oidc_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sessionTokenHash" character(64) NOT NULL,
        "csrfTokenHash" character(64) NOT NULL,
        "userId" uuid NOT NULL,
        "encryptedTokenBundle" text NOT NULL,
        "accessExpiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "lastUsedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_oidc_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_oidc_sessions_token_hash" UNIQUE ("sessionTokenHash"),
        CONSTRAINT "FK_oidc_sessions_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_oidc_sessions_user" ON "oidc_sessions" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_oidc_sessions_expires" ON "oidc_sessions" ("expiresAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_oidc_sessions_expires"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_oidc_sessions_user"`);
    await queryRunner.query(`DROP TABLE "oidc_sessions"`);
  }
}
