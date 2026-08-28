import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EvaluationInputManifest } from '../database/entities/evaluation-input-manifest.entity';
import {
  runInTenantContext,
  runWithRlsBypass,
} from '../database/tenant-context';

// Requires a reachable Postgres with the EvaluationManifestTenantIsolation
// and AppRuntimeRole migrations applied: skip instead of failing when no
// DATABASE_URL is configured — same convention as every other real-DB
// spec in this codebase.
//
// M5-007's proof, same pattern as consent-tenant-isolation.spec.ts
// (M5-005): connects as the real `mortgage_app` role (M5-003), not
// DATABASE_URL's own, since a superuser connection would pass every one
// of these assertions trivially by bypassing RLS entirely.
// `evaluation_input_manifests` has its own `tenantId` column directly
// (no join-based policy needed) but, unlike `consent_records`, was
// retrofitted with RLS rather than protected from its first migration.
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

describeOrSkip('evaluation_input_manifests row-level security', () => {
  let restrictedDataSource: DataSource;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  let manifestA: EvaluationInputManifest;
  let manifestB: EvaluationInputManifest;

  beforeAll(async () => {
    restrictedDataSource = new DataSource({
      type: 'postgres',
      url: withCredentials(DATABASE_URL as string, APP_ROLE, APP_ROLE_PASSWORD),
      entities: [EvaluationInputManifest],
    });
    await restrictedDataSource.initialize();

    function makeManifest(tenantId: string) {
      const repo = restrictedDataSource.getRepository(EvaluationInputManifest);
      return repo.create({
        tenantId,
        caseId: randomUUID(),
        caseVersion: 1,
        authorizationDecisionId: null,
        consentVersionRefs: [],
        evidenceRefs: [],
        calculationRefs: [],
        policyBindingId: randomUUID(),
        observedPolicyDependencyDigest: 'a'.repeat(64),
        evaluatorVersion: '1.0.0',
        modelAndPromptManifestId: null,
        manifestHash: 'b'.repeat(64),
      });
    }

    manifestA = await runInTenantContext(
      restrictedDataSource,
      tenantA,
      (manager) =>
        manager
          .getRepository(EvaluationInputManifest)
          .save(makeManifest(tenantA)),
    );
    manifestB = await runInTenantContext(
      restrictedDataSource,
      tenantB,
      (manager) =>
        manager
          .getRepository(EvaluationInputManifest)
          .save(makeManifest(tenantB)),
    );
  });

  afterAll(async () => {
    if (restrictedDataSource?.isInitialized) {
      await runWithRlsBypass(restrictedDataSource, (manager) =>
        manager
          .getRepository(EvaluationInputManifest)
          .delete([manifestA.id, manifestB.id]),
      );
      await restrictedDataSource.destroy();
    }
  });

  it('a query with no tenant context and no bypass sees zero rows, even though real rows exist', async () => {
    const manifests = await restrictedDataSource
      .getRepository(EvaluationInputManifest)
      .find();
    expect(manifests).toHaveLength(0);
  });

  it("tenant A's context sees only tenant A's manifest", async () => {
    const manifests = await runInTenantContext(
      restrictedDataSource,
      tenantA,
      (manager) => manager.getRepository(EvaluationInputManifest).find(),
    );
    expect(manifests.map((m) => m.id)).toEqual([manifestA.id]);
  });

  it("tenant B's context sees only tenant B's manifest, never tenant A's", async () => {
    const manifests = await runInTenantContext(
      restrictedDataSource,
      tenantB,
      (manager) => manager.getRepository(EvaluationInputManifest).find(),
    );
    expect(manifests.map((m) => m.id)).toEqual([manifestB.id]);
  });

  it("a direct lookup by id for a different tenant's manifest returns nothing, even though the row exists", async () => {
    const found = await runInTenantContext(
      restrictedDataSource,
      tenantB,
      (manager) =>
        manager
          .getRepository(EvaluationInputManifest)
          .findOneBy({ id: manifestA.id }),
    );
    expect(found).toBeNull();
  });

  it('an INSERT whose row tenantId does not match the session tenant context is rejected by PostgreSQL itself', async () => {
    await expect(
      runInTenantContext(restrictedDataSource, tenantB, (manager) => {
        const repo = manager.getRepository(EvaluationInputManifest);
        return repo.save(
          repo.create({
            // Row claims tenant A while the session context says tenant B.
            tenantId: tenantA,
            caseId: randomUUID(),
            caseVersion: 1,
            authorizationDecisionId: null,
            consentVersionRefs: [],
            evidenceRefs: [],
            calculationRefs: [],
            policyBindingId: randomUUID(),
            observedPolicyDependencyDigest: 'c'.repeat(64),
            evaluatorVersion: '1.0.0',
            modelAndPromptManifestId: null,
            manifestHash: 'd'.repeat(64),
          }),
        );
      }),
    ).rejects.toThrow();
  });

  it("bypass mode sees every tenant's manifests at once — the one explicit, audited exception", async () => {
    const manifests = await runWithRlsBypass(restrictedDataSource, (manager) =>
      manager.getRepository(EvaluationInputManifest).find(),
    );
    const ids = manifests.map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining([manifestA.id, manifestB.id]));
  });
});
