import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tracks derived provider payload deletion through managed-backup expiry. */
export class EncryptedProviderLineage1787179200000 implements MigrationInterface {
  name = 'EncryptedProviderLineage1787179200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "data_disposition_tasks" ADD "affectedProviderIntentIds" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_disposition_tasks" ADD "backupExpiryDueAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_disposition_tasks" ADD "backupExpiryVerifiedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_disposition_tasks" ADD "backupVerificationReference" character varying(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "data_disposition_tasks" DROP COLUMN "backupVerificationReference"`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_disposition_tasks" DROP COLUMN "backupExpiryVerifiedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_disposition_tasks" DROP COLUMN "backupExpiryDueAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_disposition_tasks" DROP COLUMN "affectedProviderIntentIds"`,
    );
  }
}
