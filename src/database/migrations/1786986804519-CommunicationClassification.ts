import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunicationClassification1786986804519 implements MigrationInterface {
  name = 'CommunicationClassification1786986804519';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."communication_templates_status_enum" AS ENUM('DRAFT', 'APPROVED', 'RETIRED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "communication_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "templateKey" character varying(100) NOT NULL, "version" character varying(50) NOT NULL, "channel" character varying(50) NOT NULL, "locale" character varying(10) NOT NULL, "recipientRelationship" character varying(50) NOT NULL, "bodyTemplate" text NOT NULL, "allowedVariables" jsonb NOT NULL, "attachmentsAllowed" boolean NOT NULL DEFAULT false, "status" "public"."communication_templates_status_enum" NOT NULL DEFAULT 'DRAFT', "approvedBy" character varying(200), "approvedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_communication_templates_tenant_key_version" UNIQUE ("tenantId", "templateKey", "version"), CONSTRAINT "PK_ca5cd6c5ee3127e345e9d30a719" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."communication_messages_classification_enum" AS ENUM('PROTECTED', 'ROUTINE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."communication_messages_status_enum" AS ENUM('DRAFTED', 'AWAITING_APPROVAL', 'APPROVED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "communication_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "caseId" uuid NOT NULL, "classification" "public"."communication_messages_classification_enum" NOT NULL, "classificationReasons" jsonb NOT NULL, "templateId" uuid, "recipientRelationship" character varying(50) NOT NULL, "channel" character varying(50) NOT NULL, "locale" character varying(10) NOT NULL, "variables" jsonb NOT NULL, "renderedContent" text NOT NULL, "renderedContentHash" character varying(64) NOT NULL, "status" "public"."communication_messages_status_enum" NOT NULL DEFAULT 'DRAFTED', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9aad48c5013416feccdfb1f4352" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_communication_messages_case" ON "communication_messages" ("tenantId", "caseId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "communication_approvals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "communicationMessageId" uuid NOT NULL, "actorId" character varying(200) NOT NULL, "approvedRenderedContentHash" character varying(64) NOT NULL, "reason" text, "approvedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ec2b992584b0d5a6c005a2815c1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_communication_approvals_message" ON "communication_approvals" ("communicationMessageId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "case_policy_bindings" ALTER COLUMN "observedCatalogGeneration" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "case_policy_bindings" ALTER COLUMN "contextKey" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_messages" ADD CONSTRAINT "FK_f07e0f283fe4267365c909aa0ea" FOREIGN KEY ("templateId") REFERENCES "communication_templates"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_approvals" ADD CONSTRAINT "FK_c4c6e6a4129c5f5b2bd90a337c3" FOREIGN KEY ("communicationMessageId") REFERENCES "communication_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "communication_approvals" DROP CONSTRAINT "FK_c4c6e6a4129c5f5b2bd90a337c3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "communication_messages" DROP CONSTRAINT "FK_f07e0f283fe4267365c909aa0ea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "case_policy_bindings" ALTER COLUMN "contextKey" SET DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "case_policy_bindings" ALTER COLUMN "observedCatalogGeneration" SET DEFAULT '0'`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_communication_approvals_message"`,
    );
    await queryRunner.query(`DROP TABLE "communication_approvals"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_communication_messages_case"`,
    );
    await queryRunner.query(`DROP TABLE "communication_messages"`);
    await queryRunner.query(
      `DROP TYPE "public"."communication_messages_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."communication_messages_classification_enum"`,
    );
    await queryRunner.query(`DROP TABLE "communication_templates"`);
    await queryRunner.query(
      `DROP TYPE "public"."communication_templates_status_enum"`,
    );
  }
}
