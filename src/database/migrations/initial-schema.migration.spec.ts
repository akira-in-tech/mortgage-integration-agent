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

describeOrSkip('InitialSchema migration', () => {
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
      migrations: [join(__dirname, '*.{ts,js}')],
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

  it('creates loan_applications with the columns and types the entity declares', async () => {
    await scratchDataSource.runMigrations();

    const columns: Array<{
      column_name: string;
      data_type: string;
      is_nullable: 'YES' | 'NO';
    }> = await scratchDataSource.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'loan_applications'`,
    );
    const byName = Object.fromEntries(columns.map((c) => [c.column_name, c]));

    expect(byName.id).toMatchObject({ data_type: 'uuid', is_nullable: 'NO' });
    expect(byName.borrowerId).toMatchObject({
      data_type: 'character varying',
      is_nullable: 'NO',
    });
    expect(byName.requestedAmount).toMatchObject({
      data_type: 'numeric',
      is_nullable: 'NO',
    });
    expect(byName.loanType).toMatchObject({
      data_type: 'USER-DEFINED',
      is_nullable: 'NO',
    });
    expect(byName.decision).toMatchObject({
      data_type: 'USER-DEFINED',
      is_nullable: 'NO',
    });
    expect(byName.confidence).toMatchObject({ is_nullable: 'YES' });
    expect(byName.rawIntegrationData).toMatchObject({
      data_type: 'jsonb',
      is_nullable: 'YES',
    });
    expect(byName.createdAt).toMatchObject({
      data_type: 'timestamp with time zone',
      is_nullable: 'NO',
    });

    const primaryKey: Array<{ column_name: string }> =
      await scratchDataSource.query(
        `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = 'public'
         AND tc.table_name = 'loan_applications'
         AND tc.constraint_type = 'PRIMARY KEY'`,
      );
    expect(primaryKey).toEqual([{ column_name: 'id' }]);
  });

  it('drops the table and both enum types on revert, leaving the database empty', async () => {
    await scratchDataSource.undoLastMigration();

    const tables: Array<{ table_name: string }> = await scratchDataSource.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name != 'typeorm_migrations'`,
    );
    expect(tables).toEqual([]);

    const enumTypes: Array<{ typname: string }> = await scratchDataSource.query(
      `SELECT t.typname FROM pg_type t
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public' AND t.typname LIKE 'loan_applications_%'`,
    );
    expect(enumTypes).toEqual([]);
  });
});
