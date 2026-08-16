import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import { PolicySource } from '../database/entities/policy-source.entity';
import { PolicySourceRevision } from '../database/entities/policy-source-revision.entity';
import { PolicyVersion } from '../database/entities/policy-version.entity';
import { PolicyApplicability } from '../database/entities/policy-applicability.entity';
import {
  JurisdictionLevel,
  JurisdictionCoverageStatus,
} from '../database/enums/jurisdiction.enum';
import { PolicySourceRetrievalMode } from '../database/enums/policy-source.enum';
import { PolicyReleaseStatus } from '../database/enums/policy-version.enum';
import { PolicyApplicabilityResolverService } from './policy-applicability-resolver.service';

// Requires a reachable Postgres (same convention as the other entity/schema
// specs): skip instead of failing when no DATABASE_URL is configured.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

const JURISDICTION_CODE = 'US-CA-RESOLVER-TEST';
const PRODUCT_CODE = 'CONVENTIONAL_MORTGAGE';
const LIFECYCLE_EVENT = 'UNDERWRITING_REVIEW';

const VALID_DSL = {
  rule: {
    id: 'resolver-test-rule',
    version: '1.0.0',
    applicability: {
      jurisdictions: [JURISDICTION_CODE],
      product: PRODUCT_CODE,
      lifecycle_events: [LIFECYCLE_EVENT],
      effective_from: '2027-01-01T00:00:00Z',
    },
    when: {
      difference_percent: {
        left: 'application.monthly_income',
        right: 'evidence.verified_monthly_income',
        greater_than: 10,
      },
    },
    outcome: { condition: 'VERIFY_INCOME_DISCREPANCY', route: 'MANUAL_REVIEW' },
  },
};

describeOrSkip('PolicyApplicabilityResolverService', () => {
  let dataSource: DataSource;
  let resolver: PolicyApplicabilityResolverService;
  const cleanupIds = {
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
      ],
    });
    await dataSource.initialize();
    resolver = new PolicyApplicabilityResolverService(
      dataSource.getRepository(Jurisdiction),
      dataSource.getRepository(PolicyApplicability),
      dataSource.getRepository(PolicyVersion),
    );

    await dataSource.getRepository(Jurisdiction).save(
      dataSource.getRepository(Jurisdiction).create({
        code: JURISDICTION_CODE,
        level: JurisdictionLevel.STATE,
        name: 'California (resolver test)',
        coverageStatus: JurisdictionCoverageStatus.COVERED,
      }),
    );
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (cleanupIds.applicabilityIds.length) {
        await dataSource
          .getRepository(PolicyApplicability)
          .delete(cleanupIds.applicabilityIds);
      }
      if (cleanupIds.versionIds.length) {
        await dataSource
          .getRepository(PolicyVersion)
          .delete(cleanupIds.versionIds);
      }
      if (cleanupIds.revisionIds.length) {
        await dataSource
          .getRepository(PolicySourceRevision)
          .delete(cleanupIds.revisionIds);
      }
      if (cleanupIds.sourceIds.length) {
        await dataSource
          .getRepository(PolicySource)
          .delete(cleanupIds.sourceIds);
      }
      await dataSource
        .getRepository(Jurisdiction)
        .delete({ code: JURISDICTION_CODE });
      await dataSource.destroy();
    }
  }, 30_000);

  async function makeReleasedVersion(overrides: {
    ruleId: string;
    version: string;
    effectiveFrom: Date;
    effectiveTo?: Date | null;
    releaseStatus?: PolicyReleaseStatus;
    dsl?: Record<string, unknown>;
  }): Promise<PolicyVersion> {
    const sourceRepo = dataSource.getRepository(PolicySource);
    const source = await sourceRepo.save(
      sourceRepo.create({
        name: 'Resolver test source',
        owner: 'policy-team',
        jurisdictionCode: JURISDICTION_CODE,
        retrievalMode: PolicySourceRetrievalMode.SYNTHETIC,
        freshnessObjectiveHours: 24,
      }),
    );
    cleanupIds.sourceIds.push(source.id);

    const revisionRepo = dataSource.getRepository(PolicySourceRevision);
    const revision = await revisionRepo.save(
      revisionRepo.create({
        policySourceId: source.id,
        checksum: `sha256:${overrides.ruleId}-${overrides.version}`,
        publishedAt: new Date('2026-12-01T00:00:00Z'),
        content: {},
      }),
    );
    cleanupIds.revisionIds.push(revision.id);

    const versionRepo = dataSource.getRepository(PolicyVersion);
    const version = await versionRepo.save(
      versionRepo.create({
        ruleId: overrides.ruleId,
        version: overrides.version,
        sourceRevisionId: revision.id,
        dsl: overrides.dsl ?? {
          ...VALID_DSL,
          rule: {
            ...VALID_DSL.rule,
            id: overrides.ruleId,
            version: overrides.version,
          },
        },
        effectiveFrom: overrides.effectiveFrom,
        effectiveTo: overrides.effectiveTo ?? null,
        releaseStatus: overrides.releaseStatus ?? PolicyReleaseStatus.RELEASED,
      }),
    );
    cleanupIds.versionIds.push(version.id);

    const applicabilityRepo = dataSource.getRepository(PolicyApplicability);
    const applicability = await applicabilityRepo.save(
      applicabilityRepo.create({
        policyVersionId: version.id,
        jurisdictionCode: JURISDICTION_CODE,
        productCode: PRODUCT_CODE,
        lifecycleEvent: LIFECYCLE_EVENT,
      }),
    );
    cleanupIds.applicabilityIds.push(applicability.id);

    return version;
  }

  it('resolves a single currently-effective released version', async () => {
    await makeReleasedVersion({
      ruleId: 'single-match-rule',
      version: '1.0.0',
      effectiveFrom: new Date('2027-01-01T00:00:00Z'),
    });

    const result = await resolver.resolve({
      jurisdictionCode: JURISDICTION_CODE,
      productCode: PRODUCT_CODE,
      lifecycleEvent: LIFECYCLE_EVENT,
      asOf: new Date('2027-06-01T00:00:00Z'),
    });

    expect(result.status).toBe('RESOLVED');
    expect(result.versions).toHaveLength(1);
    expect(result.versions[0].ruleId).toBe('single-match-rule');
    expect(result.versions[0].rule.outcome.condition).toBe(
      'VERIFY_INCOME_DISCREPANCY',
    );
  });

  it('resolves to no applicable versions for an unrelated lifecycle event, not REVIEW_REQUIRED', async () => {
    const result = await resolver.resolve({
      jurisdictionCode: JURISDICTION_CODE,
      productCode: PRODUCT_CODE,
      lifecycleEvent: 'SOME_OTHER_LIFECYCLE_EVENT',
      asOf: new Date('2027-06-01T00:00:00Z'),
    });

    expect(result.status).toBe('RESOLVED');
    expect(result.versions).toHaveLength(0);
  });

  it('excludes a version whose effectiveFrom is still in the future', async () => {
    await makeReleasedVersion({
      ruleId: 'future-rule',
      version: '1.0.0',
      effectiveFrom: new Date('2099-01-01T00:00:00Z'),
    });

    const result = await resolver.resolve({
      jurisdictionCode: JURISDICTION_CODE,
      productCode: PRODUCT_CODE,
      lifecycleEvent: LIFECYCLE_EVENT,
      asOf: new Date('2027-06-01T00:00:00Z'),
    });

    expect(result.versions.some((v) => v.ruleId === 'future-rule')).toBe(false);
  });

  it('excludes a version whose effectiveTo has already passed', async () => {
    await makeReleasedVersion({
      ruleId: 'expired-rule',
      version: '1.0.0',
      effectiveFrom: new Date('2020-01-01T00:00:00Z'),
      effectiveTo: new Date('2021-01-01T00:00:00Z'),
    });

    const result = await resolver.resolve({
      jurisdictionCode: JURISDICTION_CODE,
      productCode: PRODUCT_CODE,
      lifecycleEvent: LIFECYCLE_EVENT,
      asOf: new Date('2027-06-01T00:00:00Z'),
    });

    expect(result.versions.some((v) => v.ruleId === 'expired-rule')).toBe(
      false,
    );
  });

  it('excludes a DRAFT (not yet released) version', async () => {
    await makeReleasedVersion({
      ruleId: 'draft-rule',
      version: '1.0.0',
      effectiveFrom: new Date('2027-01-01T00:00:00Z'),
      releaseStatus: PolicyReleaseStatus.DRAFT,
    });

    const result = await resolver.resolve({
      jurisdictionCode: JURISDICTION_CODE,
      productCode: PRODUCT_CODE,
      lifecycleEvent: LIFECYCLE_EVENT,
      asOf: new Date('2027-06-01T00:00:00Z'),
    });

    expect(result.versions.some((v) => v.ruleId === 'draft-rule')).toBe(false);
  });

  it('fails closed to REVIEW_REQUIRED when two released versions of the same rule overlap', async () => {
    await makeReleasedVersion({
      ruleId: 'overlapping-rule',
      version: '1.0.0',
      effectiveFrom: new Date('2027-01-01T00:00:00Z'),
    });
    await makeReleasedVersion({
      ruleId: 'overlapping-rule',
      version: '2.0.0',
      effectiveFrom: new Date('2027-02-01T00:00:00Z'),
    });

    const result = await resolver.resolve({
      jurisdictionCode: JURISDICTION_CODE,
      productCode: PRODUCT_CODE,
      lifecycleEvent: LIFECYCLE_EVENT,
      asOf: new Date('2027-06-01T00:00:00Z'),
    });

    expect(result.status).toBe('REVIEW_REQUIRED');
    expect(result.versions).toHaveLength(0);
    expect(result.unresolvedReasons[0]).toContain('overlapping-rule');
  });

  it('fails closed to REVIEW_REQUIRED for a jurisdiction with no covered policy source', async () => {
    const result = await resolver.resolve({
      jurisdictionCode: 'US-ZZ-NEVER-SEEDED',
      productCode: PRODUCT_CODE,
      lifecycleEvent: LIFECYCLE_EVENT,
      asOf: new Date('2027-06-01T00:00:00Z'),
    });

    expect(result.status).toBe('REVIEW_REQUIRED');
    expect(result.unresolvedReasons[0]).toContain('US-ZZ-NEVER-SEEDED');
  });

  it('fails closed to REVIEW_REQUIRED for a jurisdiction with PARTIAL coverage', async () => {
    const partialCode = 'US-PARTIAL-TEST';
    await dataSource.getRepository(Jurisdiction).save(
      dataSource.getRepository(Jurisdiction).create({
        code: partialCode,
        level: JurisdictionLevel.STATE,
        name: 'Partially covered (resolver test)',
        coverageStatus: JurisdictionCoverageStatus.PARTIAL,
      }),
    );

    const result = await resolver.resolve({
      jurisdictionCode: partialCode,
      productCode: PRODUCT_CODE,
      lifecycleEvent: LIFECYCLE_EVENT,
      asOf: new Date('2027-06-01T00:00:00Z'),
    });

    expect(result.status).toBe('REVIEW_REQUIRED');

    await dataSource.getRepository(Jurisdiction).delete({ code: partialCode });
  });
});
