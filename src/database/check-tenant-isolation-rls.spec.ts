import 'reflect-metadata';
import { DataSource } from 'typeorm';
import {
  describeTenantIsolationRlsGaps,
  findTenantIsolationRlsGaps,
} from './check-tenant-isolation-rls';

// Requires a reachable Postgres (same convention as this codebase's other
// real-DB specs): skip instead of failing when no DATABASE_URL is
// configured.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

describeOrSkip('findTenantIsolationRlsGaps (M7-055)', () => {
  let dataSource: DataSource;
  const scratchTable = 'rls_check_spec_scratch';

  beforeAll(async () => {
    dataSource = new DataSource({ type: 'postgres', url: DATABASE_URL });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query(`DROP TABLE IF EXISTS "${scratchTable}"`);
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await dataSource.query(`DROP TABLE IF EXISTS "${scratchTable}"`);
    await dataSource.query(
      `CREATE TABLE "${scratchTable}" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL)`,
    );
  });

  it('reports a real, freshly-created tenantId-bearing table with no RLS as a gap', async () => {
    const gaps = await findTenantIsolationRlsGaps(dataSource);
    const found = gaps.find((gap) => gap.table === scratchTable);
    expect(found).toMatchObject({
      table: scratchTable,
      rowSecurityEnabled: false,
      rowSecurityForced: false,
    });
    expect(describeTenantIsolationRlsGaps([found!])).toEqual([
      `${scratchTable} (RLS disabled, not forced)`,
    ]);
  });

  it('reports a real, half-fixed table (enabled but not forced) as a narrower gap', async () => {
    await dataSource.query(
      `ALTER TABLE "${scratchTable}" ENABLE ROW LEVEL SECURITY`,
    );
    const gaps = await findTenantIsolationRlsGaps(dataSource);
    const found = gaps.find((gap) => gap.table === scratchTable);
    expect(found).toMatchObject({
      rowSecurityEnabled: true,
      rowSecurityForced: false,
    });
    expect(describeTenantIsolationRlsGaps([found!])).toEqual([
      `${scratchTable} (not forced)`,
    ]);
  });

  it('no longer reports a table once RLS is really enabled and forced', async () => {
    await dataSource.query(
      `ALTER TABLE "${scratchTable}" ENABLE ROW LEVEL SECURITY`,
    );
    await dataSource.query(
      `ALTER TABLE "${scratchTable}" FORCE ROW LEVEL SECURITY`,
    );
    const gaps = await findTenantIsolationRlsGaps(dataSource);
    expect(gaps.find((gap) => gap.table === scratchTable)).toBeUndefined();
  });

  it('never reports the known auth-bootstrap tables, even though they really do lack RLS by design', async () => {
    // Real check against this database's own actual schema, not the
    // scratch table above — proves the exclusion list is doing real work
    // against real tables, not just a name that happens not to collide.
    const gaps = await findTenantIsolationRlsGaps(dataSource);
    const gapTables = new Set(gaps.map((gap) => gap.table));
    expect(gapTables.has('api_clients')).toBe(false);
    expect(gapTables.has('tenant_memberships')).toBe(false);
    expect(gapTables.has('guest_sandbox_sessions')).toBe(false);
  });

  it('never reports a table with no tenantId column at all', async () => {
    await dataSource.query(`DROP TABLE IF EXISTS "${scratchTable}"`);
    await dataSource.query(
      `CREATE TABLE "${scratchTable}" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4())`,
    );
    const gaps = await findTenantIsolationRlsGaps(dataSource);
    expect(gaps.find((gap) => gap.table === scratchTable)).toBeUndefined();
  });
});
