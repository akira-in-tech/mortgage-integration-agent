import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { ConsentRecord } from '../database/entities/consent-record.entity';
import {
  runInTenantContext,
  runWithRlsBypass,
} from '../database/tenant-context';

// Requires a reachable Postgres with the ConsentRecords and AppRuntimeRole
// migrations applied: skip instead of failing when no DATABASE_URL is
// configured — same convention as every other real-DB spec in this
// codebase.
//
// M5-005's proof, same pattern as webhook-tenant-isolation.spec.ts
// (M5-002) and case-core-tenant-isolation.spec.ts (M5-004): connects as
// the real `mortgage_app` role (M5-003), not DATABASE_URL's own, since a
// superuser connection would pass every one of these assertions
// trivially by bypassing RLS entirely. Simpler than the other two proof
// specs — `consent_records` has its own `tenantId` column directly (no
// join-based policy needed, unlike `condition_transitions`), and RLS was
// applied in the same migration that created the table, not retrofitted.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

const APP_ROLE = 'mortgage_app';
const APP_ROLE_PASSWORD =
  process.env.APP_DATABASE_ROLE_PASSWORD ?? 'mortgage_app_demo';

function withCredentials(url: string, user: string, password: string): string {
  const parsed = new URL(url);
  parsed.username = user;
  parsed.password = password;
  return parsed.toString();
}

describeOrSkip('consent_records row-level security', () => {
  let restrictedDataSource: DataSource;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  let recordA: ConsentRecord;
  let recordB: ConsentRecord;

  beforeAll(async () => {
    restrictedDataSource = new DataSource({
      type: 'postgres',
      url: withCredentials(DATABASE_URL as string, APP_ROLE, APP_ROLE_PASSWORD),
      entities: [ConsentRecord],
    });
    await restrictedDataSource.initialize();

    function makeRecord(tenantId: string) {
      const repo = restrictedDataSource.getRepository(ConsentRecord);
      return repo.create({
        tenantId,
        caseId: randomUUID(),
        purpose: 'CASE_PROCESSING',
        scope: 'CASE_PROCESSING',
        // These fields are the provider-dispatch authorization boundary,
        // so RLS fixtures must satisfy the same non-null schema contract as
        // production consent rows rather than relying on an obsolete shape.
        permittedPurposes: ['CASE_PROCESSING'],
        permittedDataClasses: ['BORROWER_PROFILE'],
        grantedAt: new Date(),
        expiresAt: null,
        revokedAt: null,
        revocationReason: null,
      });
    }

    recordA = await runInTenantContext(
      restrictedDataSource,
      tenantA,
      (manager) =>
        manager.getRepository(ConsentRecord).save(makeRecord(tenantA)),
    );
    recordB = await runInTenantContext(
      restrictedDataSource,
      tenantB,
      (manager) =>
        manager.getRepository(ConsentRecord).save(makeRecord(tenantB)),
    );
  });

  afterAll(async () => {
    if (restrictedDataSource?.isInitialized) {
      await runWithRlsBypass(restrictedDataSource, (manager) =>
        manager.getRepository(ConsentRecord).delete([recordA.id, recordB.id]),
      );
      await restrictedDataSource.destroy();
    }
  });

  it('a query with no tenant context and no bypass sees zero rows, even though real rows exist', async () => {
    const records = await restrictedDataSource
      .getRepository(ConsentRecord)
      .find();
    expect(records).toHaveLength(0);
  });

  it("tenant A's context sees only tenant A's record", async () => {
    const records = await runInTenantContext(
      restrictedDataSource,
      tenantA,
      (manager) => manager.getRepository(ConsentRecord).find(),
    );
    expect(records.map((r) => r.id)).toEqual([recordA.id]);
  });

  it("tenant B's context sees only tenant B's record, never tenant A's", async () => {
    const records = await runInTenantContext(
      restrictedDataSource,
      tenantB,
      (manager) => manager.getRepository(ConsentRecord).find(),
    );
    expect(records.map((r) => r.id)).toEqual([recordB.id]);
  });

  it("a direct lookup by id for a different tenant's record returns nothing, even though the row exists", async () => {
    const found = await runInTenantContext(
      restrictedDataSource,
      tenantB,
      (manager) =>
        manager.getRepository(ConsentRecord).findOneBy({ id: recordA.id }),
    );
    expect(found).toBeNull();
  });

  it("an UPDATE against a different tenant's record affects zero rows rather than erroring or succeeding silently", async () => {
    const result = await runInTenantContext(
      restrictedDataSource,
      tenantB,
      (manager) =>
        manager
          .getRepository(ConsentRecord)
          .update({ id: recordA.id }, { revokedAt: new Date() }),
    );
    expect(result.affected).toBe(0);

    const stillIntact = await runInTenantContext(
      restrictedDataSource,
      tenantA,
      (manager) =>
        manager
          .getRepository(ConsentRecord)
          .findOneByOrFail({ id: recordA.id }),
    );
    expect(stillIntact.revokedAt).toBeNull();
  });

  it('an INSERT whose row tenantId does not match the session tenant context is rejected by PostgreSQL itself', async () => {
    await expect(
      runInTenantContext(restrictedDataSource, tenantB, (manager) => {
        const repo = manager.getRepository(ConsentRecord);
        return repo.save(
          repo.create({
            // Row claims tenant A while the session context says tenant B.
            tenantId: tenantA,
            caseId: randomUUID(),
            purpose: 'CASE_PROCESSING',
            scope: 'CASE_PROCESSING',
            permittedPurposes: ['CASE_PROCESSING'],
            permittedDataClasses: ['BORROWER_PROFILE'],
            grantedAt: new Date(),
            expiresAt: null,
            revokedAt: null,
            revocationReason: null,
          }),
        );
      }),
    ).rejects.toThrow();
  });

  it("bypass mode sees every tenant's records at once — the one explicit, audited exception", async () => {
    const records = await runWithRlsBypass(restrictedDataSource, (manager) =>
      manager.getRepository(ConsentRecord).find(),
    );
    const ids = records.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining([recordA.id, recordB.id]));
  });
});
