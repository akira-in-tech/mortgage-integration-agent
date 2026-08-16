import { MigrationInterface, QueryRunner } from 'typeorm';

const US_JURISDICTION_CODE = 'US';
const US_CA_JURISDICTION_CODE = 'US-CA';
const POLICY_SOURCE_ID = 'f6de0bac-1cd8-4b20-bf30-f54c3766171f';
const POLICY_SOURCE_REVISION_ID = 'd4096255-18b4-4c09-8038-a3994fd8ed48';
const POLICY_VERSION_ID = '5eb544ac-9a32-44c0-ab01-414e2bbbdb2c';
const POLICY_APPLICABILITY_ID = 'e452a65d-9ee1-400b-a0c2-ff2b68cc93a7';
const RULE_ID = 'synthetic-income-discrepancy-review';
const PRODUCT_CODE = 'CONVENTIONAL_MORTGAGE';
const LIFECYCLE_EVENT = 'UNDERWRITING_REVIEW';
// Section 10.7's own example uses 2027-01-01, a future date relative to
// this project's timeline — seeded here as 2025-01-01 instead so the rule
// is actually live (and the M2 workflow's policy-driven condition check
// is actually exercisable) rather than dormant until 2027. The DSL
// content itself (operator, fact paths, 10% threshold) is otherwise
// identical to the charter's example.
const EFFECTIVE_FROM = '2025-01-01T00:00:00Z';

/**
 * Seeds the reference/policy data the M2 case-conditions workflow needs to
 * evaluate the charter's own canonical Section 10.7 example rule for real
 * (see case-conditions.activities.ts's evaluateConditions, which replaced
 * the hardcoded hasSyntheticDiscrepancy stand-in with this policy-driven
 * check). This is data, not schema — "Initial launch uses curated
 * synthetic policy sources" (Section 10.6) describes exactly this: a
 * reviewed, versioned reference dataset the application ships with, not
 * user-generated content, so a migration is the right place for it
 * (reproducible, versioned, revertible — the same properties schema
 * migrations already have).
 */
export class SeedIncomeDiscrepancyPolicy1786910931703 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "jurisdictions" ("code", "level", "parentCode", "name", "coverageStatus")
       VALUES ($1, 'FEDERAL', NULL, 'United States', 'COVERED')`,
      [US_JURISDICTION_CODE],
    );
    await queryRunner.query(
      `INSERT INTO "jurisdictions" ("code", "level", "parentCode", "name", "coverageStatus")
       VALUES ($1, 'STATE', $2, 'California', 'COVERED')`,
      [US_CA_JURISDICTION_CODE, US_JURISDICTION_CODE],
    );

    await queryRunner.query(
      `INSERT INTO "policy_sources"
         ("id", "name", "owner", "jurisdictionCode", "retrievalMode", "freshnessObjectiveHours")
       VALUES ($1, 'Synthetic launch policy pack', 'policy-team', $2, 'SYNTHETIC', 720)`,
      [POLICY_SOURCE_ID, US_CA_JURISDICTION_CODE],
    );

    await queryRunner.query(
      `INSERT INTO "policy_source_revisions"
         ("id", "policySourceId", "checksum", "publishedAt", "content")
       VALUES ($1, $2, 'sha256:synthetic-launch-pack-v1', $3, '{}'::jsonb)`,
      [POLICY_SOURCE_REVISION_ID, POLICY_SOURCE_ID, EFFECTIVE_FROM],
    );

    const dsl = {
      rule: {
        id: RULE_ID,
        version: '1.0.0',
        applicability: {
          jurisdictions: [US_CA_JURISDICTION_CODE],
          product: PRODUCT_CODE,
          lifecycle_events: [LIFECYCLE_EVENT],
          effective_from: EFFECTIVE_FROM,
          transition_rule: 'application_received_on_or_after_effective_date',
        },
        when: {
          difference_percent: {
            left: 'application.monthly_income',
            right: 'evidence.verified_monthly_income',
            greater_than: 10,
          },
        },
        outcome: {
          condition: 'VERIFY_INCOME_DISCREPANCY',
          route: 'MANUAL_REVIEW',
        },
      },
    };

    await queryRunner.query(
      `INSERT INTO "policy_versions"
         ("id", "ruleId", "version", "sourceRevisionId", "dsl", "effectiveFrom", "releaseStatus")
       VALUES ($1, $2, '1.0.0', $3, $4::jsonb, $5, 'RELEASED')`,
      [
        POLICY_VERSION_ID,
        RULE_ID,
        POLICY_SOURCE_REVISION_ID,
        JSON.stringify(dsl),
        EFFECTIVE_FROM,
      ],
    );

    await queryRunner.query(
      `INSERT INTO "policy_applicability"
         ("id", "policyVersionId", "jurisdictionCode", "productCode", "lifecycleEvent", "transitionRule")
       VALUES ($1, $2, $3, $4, $5, 'application_received_on_or_after_effective_date')`,
      [
        POLICY_APPLICABILITY_ID,
        POLICY_VERSION_ID,
        US_CA_JURISDICTION_CODE,
        PRODUCT_CODE,
        LIFECYCLE_EVENT,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "policy_applicability" WHERE "id" = $1`,
      [POLICY_APPLICABILITY_ID],
    );
    await queryRunner.query(`DELETE FROM "policy_versions" WHERE "id" = $1`, [
      POLICY_VERSION_ID,
    ]);
    await queryRunner.query(
      `DELETE FROM "policy_source_revisions" WHERE "id" = $1`,
      [POLICY_SOURCE_REVISION_ID],
    );
    await queryRunner.query(`DELETE FROM "policy_sources" WHERE "id" = $1`, [
      POLICY_SOURCE_ID,
    ]);
    await queryRunner.query(`DELETE FROM "jurisdictions" WHERE "code" = $1`, [
      US_CA_JURISDICTION_CODE,
    ]);
    await queryRunner.query(`DELETE FROM "jurisdictions" WHERE "code" = $1`, [
      US_JURISDICTION_CODE,
    ]);
  }
}
