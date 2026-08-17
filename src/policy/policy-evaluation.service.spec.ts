import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import { PolicySource } from '../database/entities/policy-source.entity';
import { PolicySourceRevision } from '../database/entities/policy-source-revision.entity';
import { PolicyVersion } from '../database/entities/policy-version.entity';
import { PolicyApplicability } from '../database/entities/policy-applicability.entity';
import { CasePolicySnapshot } from '../database/entities/case-policy-snapshot.entity';
import { CasePolicyBinding } from '../database/entities/case-policy-binding.entity';
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
    const second = await service.evaluate(TENANT_ID, caseId, baseContext);

    expect(second.outcome).toBe('REUSED');
    expect(second.snapshot.id).toBe(first.snapshot.id);
    expect(second.binding?.id).toBe(first.binding?.id);

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

  it('refreshes once revalidateAfter has passed, even with unchanged content', async () => {
    await seedReleasedVersion('pes-rule-expiry');
    const caseId = '10000000-0000-0000-0000-000000000004';

    const first = await service.evaluate(TENANT_ID, caseId, baseContext);
    // Force expiry directly rather than waiting an hour in a test.
    await dataSource
      .getRepository(CasePolicyBinding)
      .update({ id: first.binding!.id }, { revalidateAfter: new Date(0) });

    const second = await service.evaluate(TENANT_ID, caseId, baseContext);

    expect(second.outcome).toBe('REFRESHED');
    expect(second.snapshot.id).not.toBe(first.snapshot.id);
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
});
