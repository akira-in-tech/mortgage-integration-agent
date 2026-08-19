import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { CasePolicySnapshot } from '../database/entities/case-policy-snapshot.entity';
import { CasePolicyBinding } from '../database/entities/case-policy-binding.entity';
import { PolicyResolutionStatus } from '../database/enums/policy-resolution-status.enum';
import {
  runInTenantContext,
  runWithRlsBypass,
} from '../database/tenant-context';

// Requires a reachable Postgres with the CasePolicyTenantIsolation and
// AppRuntimeRole migrations applied: skip instead of failing when no
// DATABASE_URL is configured — same convention as every other real-DB
// spec in this codebase.
//
// M5-010's proof, same pattern as evaluation-manifest-tenant-isolation
// .spec.ts (M5-007): connects as the real `mortgage_app` role (M5-003),
// not DATABASE_URL's own, since a superuser connection would pass every
// one of these assertions trivially by bypassing RLS entirely. Both
// tables have their own direct `tenantId` column — no join needed for
// tenant isolation itself, though `CasePolicyBinding.policySnapshotId`
// does carry a real FK to `CasePolicySnapshot`, so a snapshot must exist
// before a binding referencing it can be inserted.
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

describeOrSkip(
  'case_policy_snapshots/case_policy_bindings row-level security',
  () => {
    let restrictedDataSource: DataSource;
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    let snapshotA: CasePolicySnapshot;
    let snapshotB: CasePolicySnapshot;
    let bindingA: CasePolicyBinding;
    let bindingB: CasePolicyBinding;

    beforeAll(async () => {
      restrictedDataSource = new DataSource({
        type: 'postgres',
        url: withCredentials(
          DATABASE_URL as string,
          APP_ROLE,
          APP_ROLE_PASSWORD,
        ),
        entities: [CasePolicySnapshot, CasePolicyBinding],
      });
      await restrictedDataSource.initialize();

      function makeSnapshot(tenantId: string, caseId: string) {
        const repo = restrictedDataSource.getRepository(CasePolicySnapshot);
        return repo.create({
          tenantId,
          caseId,
          contextHash: 'a'.repeat(64),
          resolverVersion: '1.0.0',
          resolutionStatus: PolicyResolutionStatus.RESOLVED,
          versions: [],
          unresolvedReasons: [],
        });
      }
      function makeBinding(
        tenantId: string,
        caseId: string,
        policySnapshotId: string,
      ) {
        const repo = restrictedDataSource.getRepository(CasePolicyBinding);
        return repo.create({
          tenantId,
          caseId,
          dependencyDigest: 'b'.repeat(64),
          observedCatalogGeneration: 0,
          contextKey: 'US-CA|CONVENTIONAL_MORTGAGE|UNDERWRITING_REVIEW',
          policySnapshotId,
          revalidateAfter: new Date(Date.now() + 60 * 60 * 1000),
          invalidatedAt: null,
        });
      }

      const caseIdA = randomUUID();
      const caseIdB = randomUUID();

      snapshotA = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) =>
          manager
            .getRepository(CasePolicySnapshot)
            .save(makeSnapshot(tenantA, caseIdA)),
      );
      snapshotB = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager
            .getRepository(CasePolicySnapshot)
            .save(makeSnapshot(tenantB, caseIdB)),
      );
      bindingA = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) =>
          manager
            .getRepository(CasePolicyBinding)
            .save(makeBinding(tenantA, caseIdA, snapshotA.id)),
      );
      bindingB = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager
            .getRepository(CasePolicyBinding)
            .save(makeBinding(tenantB, caseIdB, snapshotB.id)),
      );
    });

    afterAll(async () => {
      if (restrictedDataSource?.isInitialized) {
        await runWithRlsBypass(restrictedDataSource, async (manager) => {
          await manager
            .getRepository(CasePolicyBinding)
            .delete([bindingA.id, bindingB.id]);
          await manager
            .getRepository(CasePolicySnapshot)
            .delete([snapshotA.id, snapshotB.id]);
        });
        await restrictedDataSource.destroy();
      }
    });

    it('a query with no tenant context and no bypass sees zero rows on both tables, even though real rows exist', async () => {
      const snapshots = await restrictedDataSource
        .getRepository(CasePolicySnapshot)
        .find();
      const bindings = await restrictedDataSource
        .getRepository(CasePolicyBinding)
        .find();
      expect(snapshots).toHaveLength(0);
      expect(bindings).toHaveLength(0);
    });

    it("tenant A's context sees only tenant A's rows on both tables", async () => {
      const result = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        async (manager) => ({
          snapshots: await manager.getRepository(CasePolicySnapshot).find(),
          bindings: await manager.getRepository(CasePolicyBinding).find(),
        }),
      );
      expect(result.snapshots.map((s) => s.id)).toEqual([snapshotA.id]);
      expect(result.bindings.map((b) => b.id)).toEqual([bindingA.id]);
    });

    it("tenant B's context sees only tenant B's rows, never tenant A's", async () => {
      const result = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        async (manager) => ({
          snapshots: await manager.getRepository(CasePolicySnapshot).find(),
          bindings: await manager.getRepository(CasePolicyBinding).find(),
        }),
      );
      expect(result.snapshots.map((s) => s.id)).toEqual([snapshotB.id]);
      expect(result.bindings.map((b) => b.id)).toEqual([bindingB.id]);
    });

    it("a direct lookup by id for a different tenant's snapshot or binding returns nothing, even though the row exists", async () => {
      const foundSnapshot = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager
            .getRepository(CasePolicySnapshot)
            .findOneBy({ id: snapshotA.id }),
      );
      const foundBinding = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager
            .getRepository(CasePolicyBinding)
            .findOneBy({ id: bindingA.id }),
      );
      expect(foundSnapshot).toBeNull();
      expect(foundBinding).toBeNull();
    });

    it('an INSERT whose row tenantId does not match the session tenant context is rejected by PostgreSQL itself', async () => {
      await expect(
        runInTenantContext(restrictedDataSource, tenantB, (manager) => {
          const repo = manager.getRepository(CasePolicySnapshot);
          return repo.save(
            repo.create({
              // Row claims tenant A while the session context says tenant B.
              tenantId: tenantA,
              caseId: randomUUID(),
              contextHash: 'c'.repeat(64),
              resolverVersion: '1.0.0',
              resolutionStatus: PolicyResolutionStatus.RESOLVED,
              versions: [],
              unresolvedReasons: [],
            }),
          );
        }),
      ).rejects.toThrow();
    });

    it("bypass mode sees every tenant's rows on both tables at once — the one explicit, audited exception", async () => {
      const result = await runWithRlsBypass(
        restrictedDataSource,
        async (manager) => ({
          snapshots: await manager.getRepository(CasePolicySnapshot).find(),
          bindings: await manager.getRepository(CasePolicyBinding).find(),
        }),
      );
      expect(result.snapshots.map((s) => s.id)).toEqual(
        expect.arrayContaining([snapshotA.id, snapshotB.id]),
      );
      expect(result.bindings.map((b) => b.id)).toEqual(
        expect.arrayContaining([bindingA.id, bindingB.id]),
      );
    });
  },
);
