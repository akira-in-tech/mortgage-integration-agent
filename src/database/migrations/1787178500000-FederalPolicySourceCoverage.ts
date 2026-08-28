import { MigrationInterface, QueryRunner } from 'typeorm';

const FEDERAL_SOURCE_ID = 'e784e4d7-6311-4f99-98d0-c89f8109703d';
const FEDERAL_REVISION_ID = '5cb642be-21b6-4138-b55f-e09db56c60d2';

/**
 * A COVERED jurisdiction must have a concrete, freshness-bounded source even
 * when the reviewed source currently contributes no applicable rules. This
 * federal sentinel closes the otherwise ambiguous US ancestry node seeded by
 * the original synthetic policy pack without inventing federal policy content.
 */
export class FederalPolicySourceCoverage1787178500000 implements MigrationInterface {
  name = 'FederalPolicySourceCoverage1787178500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "policy_sources"
         ("id", "name", "owner", "jurisdictionCode", "retrievalMode", "freshnessObjectiveHours")
       VALUES ($1, 'Synthetic federal coverage review', 'policy-team', 'US', 'SYNTHETIC', 720)`,
      [FEDERAL_SOURCE_ID],
    );
    await queryRunner.query(
      `INSERT INTO "policy_source_revisions"
         ("id", "policySourceId", "checksum", "publishedAt", "content")
       VALUES ($1, $2, 'sha256:synthetic-federal-coverage-v1', now(), '{"coverage":"reviewed-no-rules"}'::jsonb)`,
      [FEDERAL_REVISION_ID, FEDERAL_SOURCE_ID],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "policy_source_revisions" WHERE "id" = $1`,
      [FEDERAL_REVISION_ID],
    );
    await queryRunner.query(`DELETE FROM "policy_sources" WHERE "id" = $1`, [
      FEDERAL_SOURCE_ID,
    ]);
  }
}
