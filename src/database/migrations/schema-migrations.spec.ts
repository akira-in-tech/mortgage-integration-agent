import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';

// Requires a reachable Postgres (same convention as test/loan.e2e-spec.ts):
// skip instead of failing when no DATABASE_URL is configured.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

// A whole disposable database — not just a dedicated schema — is required
// here: TypeORM's Postgres migration generator hardcodes an explicit
// "public". qualifier on CREATE TYPE statements for enum columns, so an
// isolated schema within the *same* database would still collide with the
// real application's already-existing enum types of the same name.
const SCRATCH_DB_NAME = 'mortgage_agent_migration_test';

function withDatabase(url: string, databaseName: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}

/**
 * Tests the full, cumulative migration sequence against a disposable
 * database rather than one file per migration: `runMigrations()` always
 * applies every pending migration, and `undoLastMigration()` only ever
 * reverts the most recently applied one, so per-migration isolation isn't
 * available through the DataSource API without much more machinery. This
 * grows by extending the "after all migrations" and "after each revert"
 * assertions below whenever a new migration is added, not by adding a new
 * spec file per migration.
 */
describeOrSkip('Schema migrations (cumulative)', () => {
  let adminDataSource: DataSource;
  let scratchDataSource: DataSource;

  beforeAll(async () => {
    adminDataSource = new DataSource({ type: 'postgres', url: DATABASE_URL });
    await adminDataSource.initialize();
    // Defensive: clean up a leftover database from a prior interrupted run
    // before (re)creating it.
    await adminDataSource.query(`DROP DATABASE IF EXISTS "${SCRATCH_DB_NAME}"`);
    await adminDataSource.query(`CREATE DATABASE "${SCRATCH_DB_NAME}"`);

    scratchDataSource = new DataSource({
      type: 'postgres',
      url: withDatabase(DATABASE_URL as string, SCRATCH_DB_NAME),
      // Entities must be declared (matching src/database/data-source.ts),
      // not just migrations: TypeORM's Postgres driver only auto-creates
      // the uuid-ossp extension (needed by @PrimaryGeneratedColumn('uuid')'s
      // uuid_generate_v4() default) when it discovers a uuid column via
      // entity metadata at connect time — a migrations-only DataSource
      // never triggers that and the migration fails with
      // "function uuid_generate_v4() does not exist".
      entities: [join(__dirname, '..', 'entities', '*.entity.{ts,js}')],
      // Leading-digit filter matches TypeORM's `<timestamp>-Name.ts` naming
      // convention and excludes *.spec.ts files in this same directory —
      // see the matching comment in src/database/data-source.ts.
      migrations: [join(__dirname, '[0-9]*.{ts,js}')],
      migrationsTableName: 'typeorm_migrations',
    });
    await scratchDataSource.initialize();
  }, 30_000);

  afterAll(async () => {
    if (scratchDataSource?.isInitialized) {
      await scratchDataSource.destroy();
    }
    if (adminDataSource?.isInitialized) {
      await adminDataSource.query(
        `DROP DATABASE IF EXISTS "${SCRATCH_DB_NAME}"`,
      );
      await adminDataSource.destroy();
    }
  }, 30_000);

  async function tableNames(): Promise<string[]> {
    const rows: Array<{ table_name: string }> = await scratchDataSource.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name != 'typeorm_migrations'
       ORDER BY table_name`,
    );
    return rows.map((r) => r.table_name);
  }

  it('applies every migration and produces the expected tables', async () => {
    await scratchDataSource.runMigrations();

    expect(await tableNames()).toEqual([
      'condition_transitions',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_source_revisions',
      'policy_sources',
      'policy_versions',
      'tenants',
    ]);

    const caseColumns: Array<{
      column_name: string;
      data_type: string;
      is_nullable: 'YES' | 'NO';
    }> = await scratchDataSource.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'loan_cases'`,
    );
    const byName = Object.fromEntries(
      caseColumns.map((c) => [c.column_name, c]),
    );

    expect(byName.tenantId).toMatchObject({
      data_type: 'uuid',
      is_nullable: 'NO',
    });
    expect(byName.idempotencyKey).toMatchObject({
      data_type: 'character varying',
      is_nullable: 'NO',
    });
    expect(byName.status).toMatchObject({
      data_type: 'USER-DEFINED',
      is_nullable: 'NO',
    });
    expect(byName.version).toMatchObject({
      data_type: 'integer',
      is_nullable: 'NO',
    });

    const foreignKeys: Array<{ constraint_name: string }> =
      await scratchDataSource.query(
        `SELECT constraint_name FROM information_schema.table_constraints
       WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY'`,
      );
    // loan_cases -> tenants, loan_conditions -> loan_cases,
    // evidence_facts -> loan_cases, condition_transitions -> loan_conditions,
    // jurisdictions -> jurisdictions (self, parentCode), policy_sources ->
    // jurisdictions, policy_source_revisions -> policy_sources,
    // policy_versions -> policy_source_revisions, policy_applicability ->
    // policy_versions, loan_cases -> jurisdictions
    expect(foreignKeys).toHaveLength(10);

    // SeedIncomeDiscrepancyPolicy's data, not schema: the charter's own
    // Section 10.7 example rule, reproducible and revertible the same way
    // every other migration is (see that migration's own class comment).
    const seededVersions: Array<{ ruleId: string; releaseStatus: string }> =
      await scratchDataSource.query(
        `SELECT "ruleId", "releaseStatus" FROM policy_versions WHERE "ruleId" = 'synthetic-income-discrepancy-review'`,
      );
    expect(seededVersions).toEqual([
      {
        ruleId: 'synthetic-income-discrepancy-review',
        releaseStatus: 'RELEASED',
      },
    ]);
  });

  it('reverts the seed-data migration without touching schema', async () => {
    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'condition_transitions',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_source_revisions',
      'policy_sources',
      'policy_versions',
      'tenants',
    ]);
    const remainingVersions = await scratchDataSource.query(
      `SELECT * FROM policy_versions WHERE "ruleId" = 'synthetic-income-discrepancy-review'`,
    );
    expect(remainingVersions).toEqual([]);
  });

  it('reverts the loan_cases income/jurisdiction migration without touching other tables', async () => {
    await scratchDataSource.undoLastMigration();

    const caseColumns: Array<{ column_name: string }> =
      await scratchDataSource.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'loan_cases'
           AND column_name IN ('statedMonthlyIncome', 'jurisdictionCode')`,
      );
    expect(caseColumns).toEqual([]);
  });

  it('reverts the policy schema migration without touching case/evidence/condition/outbox tables', async () => {
    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'condition_transitions',
      'evidence_facts',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'tenants',
    ]);
  });

  it('reverts the outbox events migration without touching case/evidence/condition tables', async () => {
    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'condition_transitions',
      'evidence_facts',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'tenants',
    ]);
  });

  it('reverts the case/evidence/condition migration without touching loan_applications', async () => {
    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual(['loan_applications']);
  });

  it('reverts the initial migration, leaving the database empty', async () => {
    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([]);

    const enumTypes: Array<{ typname: string }> = await scratchDataSource.query(
      `SELECT t.typname FROM pg_type t
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public'
         AND (t.typname LIKE 'loan_applications_%' OR t.typname LIKE 'loan_cases_%'
              OR t.typname LIKE 'loan_conditions_%' OR t.typname LIKE 'evidence_facts_%'
              OR t.typname LIKE 'condition_transitions_%' OR t.typname LIKE 'jurisdictions_%'
              OR t.typname LIKE 'policy_sources_%' OR t.typname LIKE 'policy_versions_%')`,
    );
    expect(enumTypes).toEqual([]);
  });
});
