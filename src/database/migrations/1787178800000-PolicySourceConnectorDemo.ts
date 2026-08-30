import { MigrationInterface, QueryRunner } from 'typeorm';

const DEMO_SOURCE_ID = '3f1a2c6e-8b4d-4a1e-9c3f-6d2e8a7b5c14';

/**
 * Section 29 item 4's mechanism demonstration (M7-027): a `CONNECTOR`-
 * mode policy source that `PolicySourceMonitorService`
 * (`policy-source-monitor.service.ts`) actually polls, proving the
 * ingestion mechanism works end to end. `US-DEMO` is deliberately not a
 * real jurisdiction - `NOT_COVERED`, named to say exactly what it is, and
 * never intended to be evaluated against for real. No revision is seeded
 * here; the monitor creates the first one for real the first time it
 * runs, which is itself part of the real evidence for this feature.
 */
export class PolicySourceConnectorDemo1787178800000 implements MigrationInterface {
  name = 'PolicySourceConnectorDemo1787178800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "jurisdictions" ("code", "level", "parentCode", "name", "coverageStatus")
       VALUES ('US-DEMO', 'STATE', 'US', 'Connector mechanism demonstration only - not a real jurisdiction', 'NOT_COVERED')`,
    );
    await queryRunner.query(
      `INSERT INTO "policy_sources"
         ("id", "name", "owner", "jurisdictionCode", "retrievalMode", "freshnessObjectiveHours")
       VALUES ($1, 'Demo connector source (Section 29 item 4 mechanism demonstration only)', 'policy-team', 'US-DEMO', 'CONNECTOR', 24)`,
      [DEMO_SOURCE_ID],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "policy_source_revisions" WHERE "policySourceId" = $1`,
      [DEMO_SOURCE_ID],
    );
    await queryRunner.query(`DELETE FROM "policy_sources" WHERE "id" = $1`, [
      DEMO_SOURCE_ID,
    ]);
    await queryRunner.query(
      `DELETE FROM "jurisdictions" WHERE "code" = 'US-DEMO'`,
    );
  }
}
