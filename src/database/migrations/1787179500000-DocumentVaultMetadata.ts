import { MigrationInterface, QueryRunner } from 'typeorm';

/** Creates the object-store lineage record and its RLS policy together. */
export class DocumentVaultMetadata1787179500000 implements MigrationInterface {
  name = 'DocumentVaultMetadata1787179500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "document_records" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "tenantId" uuid NOT NULL,
      "caseId" uuid NOT NULL,
      "storageKey" character varying(300) NOT NULL,
      "contentHash" character(64) NOT NULL,
      "mediaType" character varying(255) NOT NULL,
      "byteSize" integer NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_document_records" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_document_records_byte_size" CHECK ("byteSize" > 0),
      CONSTRAINT "FK_document_records_case" FOREIGN KEY ("caseId") REFERENCES "loan_cases"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_document_records_tenant_case" ON "document_records" ("tenantId", "caseId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_document_records_storage_key" ON "document_records" ("storageKey")`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_records" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_records" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`CREATE POLICY "tenant_isolation" ON "document_records" USING (
      current_setting('app.bypass_rls', true) = 'true'
      OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY "tenant_isolation" ON "document_records"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_records" NO FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_records" DISABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`DROP TABLE "document_records"`);
  }
}
