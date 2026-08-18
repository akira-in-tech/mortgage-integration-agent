import 'reflect-metadata';
import { DataSource, IsNull } from 'typeorm';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import { PolicySource } from '../database/entities/policy-source.entity';
import { PolicySourceRevision } from '../database/entities/policy-source-revision.entity';
import { PolicyVersion } from '../database/entities/policy-version.entity';
import { PolicyApplicability } from '../database/entities/policy-applicability.entity';
import { CasePolicySnapshot } from '../database/entities/case-policy-snapshot.entity';
import { CasePolicyBinding } from '../database/entities/case-policy-binding.entity';
import { PolicyCatalogGeneration } from '../database/entities/policy-catalog-generation.entity';
import {
  JurisdictionLevel,
  JurisdictionCoverageStatus,
} from '../database/enums/jurisdiction.enum';
import { PolicySourceRetrievalMode } from '../database/enums/policy-source.enum';
import { PolicyReleaseStatus } from '../database/enums/policy-version.enum';
import { PolicyResolutionStatus } from '../database/enums/policy-resolution-status.enum';
import { PolicyApplicabilityResolverService } from './policy-applicability-resolver.service';
import { PolicyEvaluationService } from './policy-evaluation.service';

// Requires a reachable Postgres (same convention as the other policy
// specs): skip instead of failing when no DATABASE_URL is configured.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

// Distinct from the SeedIncomeDiscrepancyPolicy migration's permanent
// US-CA data — this suite seeds and cleans up its own jurisdiction/case
// context so it can freely create/invalidate bindings without touching
// real seeded rows other suites also read.
const JURISDICTION_CODE = 'US-PES-TEST';
const NOT_COVERED_JURISDICTION_CODE = 'US-PES-NC';
const PRODUCT_CODE = 'CONVENTIONAL_MORTGAGE';
const LIFECYCLE_EVENT = 'UNDERWRITING_REVIEW';
const TENANT_ID = '33333333-3333-3333-3333-333333333333';

describeOrSkip('PolicyEvaluationService', () => {
  let dataSource: DataSource;
  let resolver: PolicyApplicabilityResolverService;
  let service: PolicyEvaluationService;
  const cleanup = {
    applicabilityIds: [] as string[],
    versionIds: [] as string[],
    revisionIds: [] as string[],
    sourceIds: [] as string[],
  };

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [
        Jurisdiction,
        PolicySource,
        PolicySourceRevision,
        PolicyVersion,
        PolicyApplicability,
        CasePolicySnapshot,
        CasePolicyBinding,
        PolicyCatalogGeneration,
      ],
    });
    await dataSource.initialize();

    resolver = new PolicyApplicabilityResolverService(
      dataSource.getRepository(Jurisdiction),
      dataSource.getRepository(PolicyApplicability),
      dataSource.getRepository(PolicyVersion),
    );
    service = new PolicyEvaluationService(
      resolver,
      dataSource.getRepository(CasePolicySnapshot),
      dataSource.getRepository(CasePolicyBinding),
      dataSource.getRepository(PolicyCatalogGeneration),
    );

    await dataSource.getRepository(Jurisdiction).save([
      dataSource.getRepository(Jurisdiction).create({
        code: JURISDICTION_CODE,
        level: JurisdictionLevel.STATE,
        name: 'PolicyEvaluationService test (covered)',
        coverageStatus: JurisdictionCoverageStatus.COVERED,
      }),
      dataSource.getRepository(Jurisdiction).create({
        code: NOT_COVERED_JURISDICTION_CODE,
        level: JurisdictionLevel.STATE,
        name: 'PolicyEvaluationService test (not covered)',
        coverageStatus: JurisdictionCoverageStatus.NOT_COVERED,
      }),
    ]);
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource
        .getRepository(CasePolicyBinding)
        .delete({ tenantId: TENANT_ID });
      await dataSource
        .getRepository(CasePolicySnapshot)
        .delete({ tenantId: TENANT_ID });
      if (cleanup.applicabilityIds.length) {
        await dataSource
          .getRepository(PolicyApplicability)
          .delete(cleanup.applicabilityIds);
      }
      if (cleanup.versionIds.length) {
        await dataSource
          .getRepository(PolicyVersion)
          .delete(cleanup.versionIds);
      }
      if (cleanup.revisionIds.length) {
        await dataSource
          .getRepository(PolicySourceRevision)
          .delete(cleanup.revisionIds);
      }
      if (cleanup.sourceIds.length) {
        await dataSource.getRepository(PolicySource).delete(cleanup.sourceIds);
      }
      await dataSource
        .getRepository(Jurisdiction)
        .delete({ code: JURISDICTION_CODE });
      await dataSource
        .getRepository(Jurisdiction)
        .delete({ code: NOT_COVERED_JURISDICTION_CODE });
      await dataSource.destroy();
    }
  }, 30_000);

  async function seedReleasedVersion(ruleId: string): Promise<string> {
    const sourceRepo = dataSource.getRepository(PolicySource);
    const source = await sourceRepo.save(
      sourceRepo.create({
        name: 'PolicyEvaluationService test source',
        owner: 'policy-team',
        jurisdictionCode: JURISDICTION_CODE,
        retrievalMode: PolicySourceRetrievalMode.SYNTHETIC,
        freshnessObjectiveHours: 24,
      }),
    );
    cleanup.sourceIds.push(source.id);

    const revisionRepo = dataSource.getRepository(PolicySourceRevision);
    const revision = await revisionRepo.save(
      revisionRepo.create({
        policySourceId: source.id,
        checksum: `sha256:${ruleId}`,
        publishedAt: new Date('2025-01-01T00:00:00Z'),
        content: {},
      }),
    );
    cleanup.revisionIds.push(revision.id);

    const dsl = {
      rule: {
        id: ruleId,
        version: '1.0.0',
        applicability: {
          jurisdictions: [JURISDICTION_CODE],
          product: PRODUCT_CODE,
          lifecycle_events: [LIFECYCLE_EVENT],
          effective_from: '2025-01-01T00:00:00Z',
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

    const versionRepo = dataSource.getRepository(PolicyVersion);
    const version = await versionRepo.save(
      versionRepo.create({
        ruleId,
        version: '1.0.0',
        sourceRevisionId: revision.id,
        dsl,
        effectiveFrom: new Date('2025-01-01T00:00:00Z'),
        releaseStatus: PolicyReleaseStatus.RELEASED,
      }),
    );
    cleanup.versionIds.push(version.id);

    const applicabilityRepo = dataSource.getRepository(PolicyApplicability);
    const applicability = await applicabilityRepo.save(
      applicabilityRepo.create({
        policyVersionId: version.id,
        jurisdictionCode: JURISDICTION_CODE,
        productCode: PRODUCT_CODE,
        lifecycleEvent: LIFECYCLE_EVENT,
      }),
    );
    cleanup.applicabilityIds.push(applicability.id);

    // A real caller only ever gets a new released version visible through
    // PolicyActivationService.activate(), which bumps the catalog
    // generation as part of the same transaction (M3-011) — this helper
    // bypasses that service (it seeds RELEASED directly, for fixture
    // simplicity), so it bumps the generation itself to keep the fixture
    // internally consistent with what PolicyEvaluationService's fast path
    // now assumes: a new release always means "something changed."
    await dataSource.query(
      `UPDATE policy_catalog_generation SET generation = generation + 1 WHERE id = 1`,
    );

    return version.id;
  }

  const baseContext = {
    jurisdictionCode: JURISDICTION_CODE,
    productCode: PRODUCT_CODE,
    lifecycleEvent: LIFECYCLE_EVENT,
    asOf: new Date('2026-01-01T00:00:00Z'),
  };

  it('creates a snapshot and a binding on first evaluation (REFRESHED)', async () => {
    await seedReleasedVersion('pes-rule-first');
    const caseId = '10000000-0000-0000-0000-000000000001';

    const result = await service.evaluate(TENANT_ID, caseId, baseContext);

    expect(result.outcome).toBe('REFRESHED');
    expect(result.snapshot.resolutionStatus).toBe(
      PolicyResolutionStatus.RESOLVED,
    );
    expect(result.binding).toBeDefined();
    expect(result.binding?.policySnapshotId).toBe(result.snapshot.id);
    expect(result.binding?.invalidatedAt).toBeNull();
  });

  it('reuses the existing binding and snapshot when nothing has changed (REUSED)', async () => {
    await seedReleasedVersion('pes-rule-reuse');
    const caseId = '10000000-0000-0000-0000-000000000002';

    const first = await service.evaluate(TENANT_ID, caseId, baseContext);
    // M3-011's actual fast path: the catalog generation hasn't moved
    // since `first` bound this case, so `second` must not call the
    // resolver at all — proving this is a real skip, not just an
    // incidentally-identical re-resolution.
    const resolveSpy = jest.spyOn(resolver, 'resolve');
    const second = await service.evaluate(TENANT_ID, caseId, baseContext);

    expect(second.outcome).toBe('REUSED');
    expect(second.snapshot.id).toBe(first.snapshot.id);
    expect(second.binding?.id).toBe(first.binding?.id);
    expect(resolveSpy).not.toHaveBeenCalled();
    resolveSpy.mockRestore();

    // Reuse must not create a second snapshot/binding row for the case.
    const snapshots = await dataSource
      .getRepository(CasePolicySnapshot)
      .find({ where: { tenantId: TENANT_ID, caseId } });
    expect(snapshots).toHaveLength(1);
    const bindings = await dataSource
      .getRepository(CasePolicyBinding)
      .find({ where: { tenantId: TENANT_ID, caseId } });
    expect(bindings).toHaveLength(1);
  });

  it('takes the slow path but reuses the snapshot when the catalog generation moved but this case is unaffected', async () => {
    await seedReleasedVersion('pes-rule-unaffected-by-bump');
    const caseId = '10000000-0000-0000-0000-000000000007';

    const first = await service.evaluate(TENANT_ID, caseId, baseContext);
    expect(first.binding?.observedCatalogGeneration).toBeDefined();
    const generationAfterFirst = first.binding!.observedCatalogGeneration;

    // Simulate an unrelated policy activation elsewhere in the catalog —
    // bumps the global generation without changing anything this case's
    // own applicability resolves to.
    await dataSource.query(
      `UPDATE policy_catalog_generation SET generation = generation + 1 WHERE id = 1`,
    );
    const resolveSpy = jest.spyOn(resolver, 'resolve');
    const second = await service.evaluate(TENANT_ID, caseId, baseContext);

    // Slow path did run (generation had moved) — asserted before
    // mockRestore(), which itself clears recorded call history.
    expect(resolveSpy).toHaveBeenCalled();
    resolveSpy.mockRestore();
    // ...but since content was unchanged, the SAME snapshot/binding row
    // is reused (in-place generation refresh), not a new one.
    expect(second.outcome).toBe('REUSED');
    expect(second.snapshot.id).toBe(first.snapshot.id);
    expect(second.binding?.id).toBe(first.binding?.id);
    expect(second.binding?.observedCatalogGeneration).toBeGreaterThan(
      generationAfterFirst,
    );
    const bindings = await dataSource
      .getRepository(CasePolicyBinding)
      .find({ where: { tenantId: TENANT_ID, caseId } });
    expect(bindings).toHaveLength(1);
  });

  it('refreshes and invalidates the prior binding when the applicable policy actually changes', async () => {
    const caseId = '10000000-0000-0000-0000-000000000003';
    await seedReleasedVersion('pes-rule-change-a');
    const first = await service.evaluate(TENANT_ID, caseId, baseContext);
    expect(first.outcome).toBe('REFRESHED');

    // A second, independent rule becomes applicable to the same
    // jurisdiction/product/lifecycle-event — the resolver's output for
    // this case genuinely changes, so the digest must change too.
    await seedReleasedVersion('pes-rule-change-b');
    const second = await service.evaluate(TENANT_ID, caseId, baseContext);

    expect(second.outcome).toBe('REFRESHED');
    expect(second.snapshot.id).not.toBe(first.snapshot.id);
    expect(second.binding?.id).not.toBe(first.binding?.id);

    const priorBinding = await dataSource
      .getRepository(CasePolicyBinding)
      .findOneByOrFail({ id: first.binding!.id });
    expect(priorBinding.invalidatedAt).not.toBeNull();
  });

  it('re-validates once revalidateAfter has passed, reusing the same snapshot in place since content is still unchanged', async () => {
    await seedReleasedVersion('pes-rule-expiry');
    const caseId = '10000000-0000-0000-0000-000000000004';

    const first = await service.evaluate(TENANT_ID, caseId, baseContext);
    // Force expiry directly rather than waiting an hour in a test.
    await dataSource
      .getRepository(CasePolicyBinding)
      .update({ id: first.binding!.id }, { revalidateAfter: new Date(0) });

    const resolveSpy = jest.spyOn(resolver, 'resolve');
    const second = await service.evaluate(TENANT_ID, caseId, baseContext);
    // The expired revalidateAfter forces the slow path (this is the
    // periodic re-check Section 10.4's "configured maximum validation
    // interval" exists for) even though the generation never moved.
    expect(resolveSpy).toHaveBeenCalled();
    resolveSpy.mockRestore();

    // Content is genuinely unchanged, so the same snapshot/binding row is
    // reused rather than minting a redundant duplicate — only
    // revalidateAfter (and the observed generation) are refreshed.
    expect(second.outcome).toBe('REUSED');
    expect(second.snapshot.id).toBe(first.snapshot.id);
    expect(second.binding?.id).toBe(first.binding?.id);
    expect(second.binding?.revalidateAfter.getTime()).toBeGreaterThan(
      new Date(0).getTime(),
    );
  });

  it('does not create a binding for REVIEW_REQUIRED, and persists a snapshot recording why', async () => {
    const caseId = '10000000-0000-0000-0000-000000000005';

    const result = await service.evaluate(TENANT_ID, caseId, {
      ...baseContext,
      jurisdictionCode: NOT_COVERED_JURISDICTION_CODE,
    });

    expect(result.outcome).toBe('REVIEW_REQUIRED');
    expect(result.binding).toBeUndefined();
    expect(result.snapshot.resolutionStatus).toBe(
      PolicyResolutionStatus.REVIEW_REQUIRED,
    );
    expect(result.snapshot.unresolvedReasons[0]).toContain(
      NOT_COVERED_JURISDICTION_CODE,
    );

    const bindings = await dataSource
      .getRepository(CasePolicyBinding)
      .find({ where: { tenantId: TENANT_ID, caseId } });
    expect(bindings).toHaveLength(0);
  });

  it('invalidates an existing valid binding if a later evaluation becomes REVIEW_REQUIRED', async () => {
    const caseId = '10000000-0000-0000-0000-000000000006';
    await seedReleasedVersion('pes-rule-then-review-required');
    const first = await service.evaluate(TENANT_ID, caseId, baseContext);
    expect(first.outcome).toBe('REFRESHED');

    // Same case, but now resolved against an uncovered jurisdiction —
    // simulates the case's own context changing in a way that makes the
    // previously-valid binding no longer trustworthy.
    const second = await service.evaluate(TENANT_ID, caseId, {
      ...baseContext,
      jurisdictionCode: NOT_COVERED_JURISDICTION_CODE,
    });
    expect(second.outcome).toBe('REVIEW_REQUIRED');

    const priorBinding = await dataSource
      .getRepository(CasePolicyBinding)
      .findOneByOrFail({ id: first.binding!.id });
    expect(priorBinding.invalidatedAt).not.toBeNull();
  });

  // Section 20's exit evidence H: "a catalog activation racing with
  // evaluation produces one internally consistent, auditable result."
  // `CasePolicyBinding`'s own comment always claimed "one row per case at
  // a time," but nothing enforced it before the partial unique index
  // added alongside this test — these two tests are what actually prove
  // the invariant holds under real concurrent execution, not just
  // sequential calls that happen to never overlap.
  describe('concurrency (exit evidence H)', () => {
    it('two concurrent evaluate() calls for the same brand-new case converge on exactly one active binding', async () => {
      await seedReleasedVersion('pes-rule-concurrent-self');
      const caseId = '10000000-0000-0000-0000-000000000090';

      // Real wall-clock timing between two Promise.all-started calls is
      // not guaranteed to actually overlap on a fast local database — to
      // reliably exercise the race (not just hope for lucky timing),
      // deliberately slow down whichever of the two calls reaches
      // resolver.resolve() second, giving the other one time to fully
      // commit its INSERT first. This guarantees the second call's own
      // INSERT collides with the unique index and must take the
      // catch-and-recover path this test exists to prove — verified by
      // first confirming this same test fails without that recovery path
      // (see this slice's dev-log entry for that verification).
      let resolveCallCount = 0;
      const resolveSpy = jest
        .spyOn(resolver, 'resolve')
        .mockImplementation(async (ctx) => {
          const isSecondCaller = ++resolveCallCount === 2;
          if (isSecondCaller) {
            await new Promise((r) => setTimeout(r, 100));
          }
          return PolicyApplicabilityResolverService.prototype.resolve.call(
            resolver,
            ctx,
          );
        });

      const [resultA, resultB] = await Promise.all([
        service.evaluate(TENANT_ID, caseId, baseContext),
        service.evaluate(TENANT_ID, caseId, baseContext),
      ]);
      resolveSpy.mockRestore();

      // Neither call crashed, and both agree on exactly one winning
      // binding/snapshot — one of them was the real INSERT (REFRESHED),
      // the other recovered from the unique-constraint race (REUSED).
      expect(resultA.binding?.id).toBeDefined();
      expect(resultA.binding?.id).toBe(resultB.binding?.id);
      expect(resultA.snapshot.id).toBe(resultB.snapshot.id);
      expect([resultA.outcome, resultB.outcome].sort()).toEqual([
        'REFRESHED',
        'REUSED',
      ]);

      const activeBindings = await dataSource
        .getRepository(CasePolicyBinding)
        .find({
          where: { tenantId: TENANT_ID, caseId, invalidatedAt: IsNull() },
        });
      expect(activeBindings).toHaveLength(1);
      expect(activeBindings[0].id).toBe(resultA.binding!.id);
    });

    it('a concurrent catalog generation bump (the atomic core of a real policy activation) racing with an in-flight evaluation still leaves exactly one consistent, auditable binding', async () => {
      await seedReleasedVersion('pes-rule-concurrent-activation');
      const caseId = '10000000-0000-0000-0000-000000000091';

      // Establish an initial binding first, so the race below exercises
      // the slow-path "unchanged digest" branch rather than the
      // brand-new-case path the test above already covers.
      const first = await service.evaluate(TENANT_ID, caseId, baseContext);
      expect(first.outcome).toBe('REFRESHED');
      // Force the next call past the fast path immediately, the same way
      // the "takes the slow path" test above does.
      await dataSource
        .getRepository(CasePolicyBinding)
        .update({ id: first.binding!.id }, { revalidateAfter: new Date(0) });

      // Race a real generation bump — the exact atomic operation
      // PolicyActivationService.activate() performs as part of a real
      // activation (its own business-status transition is already
      // covered by policy-activation.service.spec.ts) — against a second
      // evaluate() call for the same case.
      const [, second] = await Promise.all([
        dataSource.query(
          `UPDATE policy_catalog_generation SET generation = generation + 1 WHERE id = 1`,
        ),
        service.evaluate(TENANT_ID, caseId, baseContext),
      ]);

      expect(['REUSED', 'REFRESHED']).toContain(second.outcome);
      const activeBindings = await dataSource
        .getRepository(CasePolicyBinding)
        .find({
          where: { tenantId: TENANT_ID, caseId, invalidatedAt: IsNull() },
        });
      expect(activeBindings).toHaveLength(1);

      // A follow-up evaluation, now that both concurrent operations have
      // settled, must observe the current generation and find nothing
      // actually changed — reusing the one active binding rather than
      // ever producing a second one or looping into an inconsistent
      // state.
      const followUp = await service.evaluate(TENANT_ID, caseId, baseContext);
      expect(followUp.binding?.id).toBe(activeBindings[0].id);
      const stillOneBinding = await dataSource
        .getRepository(CasePolicyBinding)
        .find({
          where: { tenantId: TENANT_ID, caseId, invalidatedAt: IsNull() },
        });
      expect(stillOneBinding).toHaveLength(1);
    });
  });
});
