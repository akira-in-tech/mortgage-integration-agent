import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunicationDelivery1786992668781 implements MigrationInterface {
  name = 'CommunicationDelivery1786992668781';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "communication_messages" ADD "deliveryReference" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_messages" ADD "sentAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."communication_messages_status_enum" RENAME TO "communication_messages_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."communication_messages_status_enum" AS ENUM('DRAFTED', 'AWAITING_APPROVAL', 'APPROVED', 'SENT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_messages" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_messages" ALTER COLUMN "status" TYPE "public"."communication_messages_status_enum" USING "status"::"text"::"public"."communication_messages_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_messages" ALTER COLUMN "status" SET DEFAULT 'DRAFTED'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."communication_messages_status_enum_old"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."communication_messages_status_enum_old" AS ENUM('DRAFTED', 'AWAITING_APPROVAL', 'APPROVED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_messages" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_messages" ALTER COLUMN "status" TYPE "public"."communication_messages_status_enum_old" USING "status"::"text"::"public"."communication_messages_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_messages" ALTER COLUMN "status" SET DEFAULT 'DRAFTED'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."communication_messages_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."communication_messages_status_enum_old" RENAME TO "communication_messages_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_messages" DROP COLUMN "sentAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_messages" DROP COLUMN "deliveryReference"`,
    );
  }
}
