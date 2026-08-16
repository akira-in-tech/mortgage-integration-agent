import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Jurisdiction } from './jurisdiction.entity';
import { PolicySource } from './policy-source.entity';
import { PolicySourceRevision } from './policy-source-revision.entity';
import { PolicyVersion } from './policy-version.entity';
import { PolicyApplicability } from './policy-applicability.entity';
import {
  JurisdictionLevel,
  JurisdictionCoverageStatus,
} from '../enums/jurisdiction.enum';
import { PolicySourceRetrievalMode } from '../enums/policy-source.enum';
import { PolicyReleaseStatus } from '../enums/policy-version.enum';

// Requires a reachable Postgres (same convention as the other entity/schema
// specs): skip instead of failing when no DATABASE_URL is configured.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

/**
 * Proves the M3-001 policy schema can actually hold the charter's own
 * canonical example (Section 10.7's synthetic-income-discrepancy-review
 * DSL) end-to-end — jurisdiction hierarchy, source provenance, an
 * immutable versioned rule, and its applicability scope — not just that
 * the migration applies cleanly.
 */
describeOrSkip('Policy schema (M3-001)', () => {
  let dataSource: DataSource;
  const createdIds: {
    policySourceId?: string;
    policySourceRevisionId?: string;
    policyVersionId?: string;
    policyApplicabilityId?: string;
  } = {};

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
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      // Delete in FK-dependency order; ids are collected during the test.
      if (createdIds.policyApplicabilityId) {
        await dataSource
          .getRepository(PolicyApplicability)
          .delete({ id: createdIds.policyApplicabilityId });
      }
      if (createdIds.policyVersionId) {
        await dataSource
          .getRepository(PolicyVersion)
          .delete({ id: createdIds.policyVersionId });
      }
      if (createdIds.policySourceRevisionId) {
        await dataSource
          .getRepository(PolicySourceRevision)
          .delete({ id: createdIds.policySourceRevisionId });
      }
      if (createdIds.policySourceId) {
        await dataSource
          .getRepository(PolicySource)
          .delete({ id: createdIds.policySourceId });
      }
      await dataSource
        .getRepository(Jurisdiction)
        .delete({ code: 'US-CA-M3-001-TEST' });
      await dataSource
        .getRepository(Jurisdiction)
        .delete({ code: 'US-M3-001-TEST' });
      await dataSource.destroy();
    }
  }, 30_000);

  it('persists the Section 10.7 example rule through the full provenance chain', async () => {
    const jurisdictionRepo = dataSource.getRepository(Jurisdiction);
    const federal = await jurisdictionRepo.save(
      jurisdictionRepo.create({
        code: 'US-M3-001-TEST',
        level: JurisdictionLevel.FEDERAL,
        name: 'United States (M3-001 test)',
        coverageStatus: JurisdictionCoverageStatus.COVERED,
      }),
    );
    const california = await jurisdictionRepo.save(
      jurisdictionRepo.create({
        code: 'US-CA-M3-001-TEST',
        level: JurisdictionLevel.STATE,
        parentCode: federal.code,
        name: 'California (M3-001 test)',
        coverageStatus: JurisdictionCoverageStatus.COVERED,
      }),
    );

    const sourceRepo = dataSource.getRepository(PolicySource);
    const source = await sourceRepo.save(
      sourceRepo.create({
        name: 'Synthetic launch policy pack',
        owner: 'policy-team',
        jurisdictionCode: california.code,
        retrievalMode: PolicySourceRetrievalMode.SYNTHETIC,
        freshnessObjectiveHours: 24,
      }),
    );
    createdIds.policySourceId = source.id;

    const revisionRepo = dataSource.getRepository(PolicySourceRevision);
    const revision = await revisionRepo.save(
      revisionRepo.create({
        policySourceId: source.id,
        checksum: 'sha256:synthetic-test-checksum',
        publishedAt: new Date('2026-12-01T00:00:00Z'),
        content: { note: 'synthetic launch pack, M3-001 test' },
      }),
    );
    createdIds.policySourceRevisionId = revision.id;

    // The literal Section 10.7 example, persisted as the immutable DSL blob.
    const dsl = {
      rule: {
        id: 'm3-001-schema-test-income-discrepancy-review',
        version: '1.0.0',
        applicability: {
          jurisdictions: ['US-CA'],
          product: 'CONVENTIONAL_MORTGAGE',
          lifecycle_events: ['UNDERWRITING_REVIEW'],
          effective_from: '2027-01-01T00:00:00-08:00',
          transition_rule: 'application_received_on_or_after_effective_date',
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
        ruleId: 'm3-001-schema-test-income-discrepancy-review',
        version: '1.0.0',
        sourceRevisionId: revision.id,
        dsl,
        effectiveFrom: new Date('2027-01-01T08:00:00Z'),
        releaseStatus: PolicyReleaseStatus.RELEASED,
      }),
    );
    createdIds.policyVersionId = version.id;

    const applicabilityRepo = dataSource.getRepository(PolicyApplicability);
    const applicability = await applicabilityRepo.save(
      applicabilityRepo.create({
        policyVersionId: version.id,
        jurisdictionCode: california.code,
        productCode: 'CONVENTIONAL_MORTGAGE',
        lifecycleEvent: 'UNDERWRITING_REVIEW',
        transitionRule: 'application_received_on_or_after_effective_date',
      }),
    );
    createdIds.policyApplicabilityId = applicability.id;

    // Read everything back through fresh queries — not the in-memory
    // objects just created — to prove the schema actually round-trips
    // this content, including the jsonb DSL blob and the self-referencing
    // jurisdiction hierarchy.
    const reloadedCalifornia = await jurisdictionRepo.findOneOrFail({
      where: { code: california.code },
      relations: ['parent'],
    });
    expect(reloadedCalifornia.parent?.code).toBe(federal.code);
    expect(reloadedCalifornia.level).toBe(JurisdictionLevel.STATE);

    const reloadedVersion = await versionRepo.findOneByOrFail({
      id: version.id,
    });
    expect(reloadedVersion.releaseStatus).toBe(PolicyReleaseStatus.RELEASED);
    expect(reloadedVersion.dsl).toEqual(dsl);
    expect((reloadedVersion.dsl as typeof dsl).rule.outcome.condition).toBe(
      'VERIFY_INCOME_DISCREPANCY',
    );

    const reloadedApplicability = await applicabilityRepo.findOneByOrFail({
      id: applicability.id,
    });
    expect(reloadedApplicability.jurisdictionCode).toBe(california.code);
    expect(reloadedApplicability.productCode).toBe('CONVENTIONAL_MORTGAGE');

    // Unique (ruleId, version) is enforced — a second RELEASED row for the
    // same rule/version pair would collide, matching Section 10.8:
    // "Policy identifiers and released versions are immutable."
    await expect(
      versionRepo.save(
        versionRepo.create({
          ruleId: 'm3-001-schema-test-income-discrepancy-review',
          version: '1.0.0',
          sourceRevisionId: revision.id,
          dsl,
          effectiveFrom: new Date('2027-01-01T08:00:00Z'),
          releaseStatus: PolicyReleaseStatus.DRAFT,
        }),
      ),
    ).rejects.toThrow();
  });
});
