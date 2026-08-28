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
    jurisdictionCodes: [] as string[],
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
      dataSource.getRepository(PolicySource),
      dataSource.getRepository(PolicySourceRevision),
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
      if (cleanupIds.jurisdictionCodes.length) {
        await dataSource
          .getRepository(Jurisdiction)
          .delete(cleanupIds.jurisdictionCodes);
      }
      await dataSource
        .getRepository(Jurisdiction)
        .delete({ code: JURISDICTION_CODE });
      await dataSource.destroy();
    }
  }, 30_000);

  async function makeFreshSource(
    jurisdictionCode: string,
    freshnessObjectiveHours = 24,
  ): Promise<{ source: PolicySource; revision: PolicySourceRevision }> {
    const sourceRepo = dataSource.getRepository(PolicySource);
    const source = await sourceRepo.save(
      sourceRepo.create({
        name: `Resolver test source (${jurisdictionCode})`,
        owner: 'policy-team',
        jurisdictionCode,
        retrievalMode: PolicySourceRetrievalMode.SYNTHETIC,
        freshnessObjectiveHours,
      }),
    );
    cleanupIds.sourceIds.push(source.id);

    const revisionRepo = dataSource.getRepository(PolicySourceRevision);
    const revision = await revisionRepo.save(
      revisionRepo.create({
        policySourceId: source.id,
        checksum: `sha256:${source.id}`,
        publishedAt: new Date('2026-12-01T00:00:00Z'),
        content: {},
      }),
    );
    cleanupIds.revisionIds.push(revision.id);
    return { source, revision };
  }

  async function makeReleasedVersion(overrides: {
    ruleId: string;
    version: string;
    effectiveFrom: Date;
    effectiveTo?: Date | null;
    releaseStatus?: PolicyReleaseStatus;
    dsl?: Record<string, unknown>;
    jurisdictionCode?: string;
    transitionRule?: string | null;
  }): Promise<PolicyVersion> {
    const jurisdictionCode = overrides.jurisdictionCode ?? JURISDICTION_CODE;
    const { revision } = await makeFreshSource(jurisdictionCode);

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
        jurisdictionCode,
        productCode: PRODUCT_CODE,
        lifecycleEvent: LIFECYCLE_EVENT,
        transitionRule: overrides.transitionRule ?? null,
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

  it('resolves policies declared on every covered jurisdiction ancestor', async () => {
    const parentCode = 'US-ANCESTRY-PARENT';
    const childCode = 'US-ANCESTRY-CHILD';
    await dataSource.getRepository(Jurisdiction).save([
      dataSource.getRepository(Jurisdiction).create({
        code: parentCode,
        level: JurisdictionLevel.FEDERAL,
        name: 'Resolver ancestry parent',
        coverageStatus: JurisdictionCoverageStatus.COVERED,
      }),
      dataSource.getRepository(Jurisdiction).create({
        code: childCode,
        level: JurisdictionLevel.STATE,
        parentCode,
        name: 'Resolver ancestry child',
        coverageStatus: JurisdictionCoverageStatus.COVERED,
      }),
    ]);
    cleanupIds.jurisdictionCodes.push(childCode, parentCode);
    await makeFreshSource(childCode);
    await makeReleasedVersion({
      ruleId: 'ancestor-rule',
      version: '1.0.0',
      jurisdictionCode: parentCode,
      effectiveFrom: new Date('2025-01-01T00:00:00Z'),
    });

    const result = await resolver.resolve({
      jurisdictionCode: childCode,
      productCode: PRODUCT_CODE,
      lifecycleEvent: LIFECYCLE_EVENT,
      asOf: new Date('2027-06-01T00:00:00Z'),
    });

    expect(result.status).toBe('RESOLVED');
    expect(result.versions.map((version) => version.ruleId)).toContain(
      'ancestor-rule',
    );
  });

  it('fails closed when any declared source in the ancestry is stale', async () => {
    const staleCode = 'US-STALE-SOURCE';
    await dataSource.getRepository(Jurisdiction).save(
      dataSource.getRepository(Jurisdiction).create({
        code: staleCode,
        level: JurisdictionLevel.STATE,
        name: 'Resolver stale-source jurisdiction',
        coverageStatus: JurisdictionCoverageStatus.COVERED,
      }),
    );
    cleanupIds.jurisdictionCodes.push(staleCode);
    const { revision } = await makeFreshSource(staleCode, 1);
    await dataSource
      .getRepository(PolicySourceRevision)
      .update(
        { id: revision.id },
        { recordedAt: new Date('2020-01-01T00:00:00Z') },
      );

    const result = await resolver.resolve({
      jurisdictionCode: staleCode,
      productCode: PRODUCT_CODE,
      lifecycleEvent: LIFECYCLE_EVENT,
      asOf: new Date(),
    });

    expect(result.status).toBe('REVIEW_REQUIRED');
    expect(result.unresolvedReasons.join(' ')).toContain(
      'exceeded its freshness objective',
    );
  });

  it('grandfathers an application against the policy window at receipt time', async () => {
    const transitionCode = 'US-GRANDFATHER';
    await dataSource.getRepository(Jurisdiction).save(
      dataSource.getRepository(Jurisdiction).create({
        code: transitionCode,
        level: JurisdictionLevel.STATE,
        name: 'Resolver grandfathering jurisdiction',
        coverageStatus: JurisdictionCoverageStatus.COVERED,
      }),
    );
    cleanupIds.jurisdictionCodes.push(transitionCode);
    await makeReleasedVersion({
      ruleId: 'grandfathered-rule',
      version: '1.0.0',
      jurisdictionCode: transitionCode,
      effectiveFrom: new Date('2025-01-01T00:00:00Z'),
      effectiveTo: new Date('2027-01-01T00:00:00Z'),
      transitionRule: 'application_received_on_or_after_effective_date',
    });
    await makeReleasedVersion({
      ruleId: 'grandfathered-rule',
      version: '2.0.0',
      jurisdictionCode: transitionCode,
      effectiveFrom: new Date('2027-01-01T00:00:00Z'),
      transitionRule: 'application_received_on_or_after_effective_date',
    });

    const result = await resolver.resolve({
      jurisdictionCode: transitionCode,
      productCode: PRODUCT_CODE,
      lifecycleEvent: LIFECYCLE_EVENT,
      applicationReceivedAt: new Date('2026-12-15T00:00:00Z'),
      asOf: new Date('2027-06-01T00:00:00Z'),
    });

    expect(result.status).toBe('RESOLVED');
    expect(
      result.versions.find((version) => version.ruleId === 'grandfathered-rule')
        ?.version,
    ).toBe('1.0.0');
  });

  it('fails closed for an unsupported transition rule', async () => {
    const unsupportedCode = 'US-UNSUPPORTED-TR';
    await dataSource.getRepository(Jurisdiction).save(
      dataSource.getRepository(Jurisdiction).create({
        code: unsupportedCode,
        level: JurisdictionLevel.STATE,
        name: 'Resolver unsupported-transition jurisdiction',
        coverageStatus: JurisdictionCoverageStatus.COVERED,
      }),
    );
    cleanupIds.jurisdictionCodes.push(unsupportedCode);
    await makeReleasedVersion({
      ruleId: 'unsupported-transition-rule',
      version: '1.0.0',
      jurisdictionCode: unsupportedCode,
      effectiveFrom: new Date('2025-01-01T00:00:00Z'),
      transitionRule: 'guess_based_on_latest_version',
    });

    const result = await resolver.resolve({
      jurisdictionCode: unsupportedCode,
      productCode: PRODUCT_CODE,
      lifecycleEvent: LIFECYCLE_EVENT,
      applicationReceivedAt: new Date('2026-01-01T00:00:00Z'),
      asOf: new Date('2027-06-01T00:00:00Z'),
    });

    expect(result.status).toBe('REVIEW_REQUIRED');
    expect(result.unresolvedReasons.join(' ')).toContain(
      'unsupported transition rule',
    );
  });
});
