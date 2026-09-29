import { MigrationInterface, QueryRunner } from 'typeorm';

const CA_SOURCE_ID = 'f6de0bac-1cd8-4b20-bf30-f54c3766171f';
const CA_REVISION_ID = '9d6b1f2a-4e3c-4a7b-9f0e-1a2b3c4d5e6f';
const FEDERAL_SOURCE_ID = 'e784e4d7-6311-4f99-98d0-c89f8109703d';
const FEDERAL_REVISION_ID = '2b7c8e9f-5a1d-4c6b-8e2f-3d4c5b6a7f8e';
// Matches SeedIncomeDiscrepancyPolicy1786910931703's own EFFECTIVE_FROM:
// the underlying rule content has not changed, so the re-verified
// revision keeps the same valid-time publication instant.
const CA_PUBLISHED_AT = '2025-01-01T00:00:00Z';

/**
 * Section 10.6: "source monitors update freshness and candidate revisions
 * asynchronously." The two synthetic sources seeded by
 * SeedIncomeDiscrepancyPolicy1786910931703 and
 * FederalPolicySourceCoverage1787178500000 were each recorded exactly
 * once and never re-verified, so their 720-hour freshness objective
 * (Section 10.1) eventually expires relative to real wall-clock time --
 * confirmed locally on 2026-09-17, when `npm run evaluate` correctly
 * routed the US-CA-jurisdiction fixtures (NORMAL-*, BOUNDARY-*,
 * MISSING-DATA-001) to POLICY_AMBIGUITY instead of silently evaluating
 * against a stale source.
 *
 * This is the same periodic-recheck action a real source monitor would
 * take -- appending one new immutable `policy_source_revisions` row per
 * source with a fresh `recordedAt` -- not a change to either source's
 * freshness objective and not a mutation of the original, immutable
 * seed revision. Content is unchanged (Section 10.6 revision content is
 * advisory metadata here, not itself evaluated), so this only extends
 * the freshness deadline forward from whenever this migration runs.
 *
 * Because that deadline is wall-clock-relative, this fix has the same
 * shelf life as the problem it fixes: re-run needed again after another
 * ~720 hours of this dev database going unused.
 */
export class RefreshSyntheticPolicySourceRevisions1787180200000 implements MigrationInterface {
  name = 'RefreshSyntheticPolicySourceRevisions1787180200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "policy_source_revisions"
         ("id", "policySourceId", "checksum", "publishedAt", "content")
       VALUES ($1, $2, 'sha256:synthetic-launch-pack-v1-periodic-refresh', $3, '{}'::jsonb)`,
      [CA_REVISION_ID, CA_SOURCE_ID, CA_PUBLISHED_AT],
    );
    await queryRunner.query(
      `INSERT INTO "policy_source_revisions"
         ("id", "policySourceId", "checksum", "publishedAt", "content")
       VALUES ($1, $2, 'sha256:synthetic-federal-coverage-v1-periodic-refresh', now(), '{"coverage":"reviewed-no-rules"}'::jsonb)`,
      [FEDERAL_REVISION_ID, FEDERAL_SOURCE_ID],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "policy_source_revisions" WHERE "id" = $1`,
      [FEDERAL_REVISION_ID],
    );
    await queryRunner.query(
      `DELETE FROM "policy_source_revisions" WHERE "id" = $1`,
      [CA_REVISION_ID],
    );
  }
}
