import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import { PolicySource } from '../database/entities/policy-source.entity';
import { PolicySourceRevision } from '../database/entities/policy-source-revision.entity';
import { PolicyVersion } from '../database/entities/policy-version.entity';
import { PolicyReleaseStatus } from '../database/enums/policy-version.enum';
import { PolicySourceRetrievalMode } from '../database/enums/policy-source.enum';
import { EvaluationCaseResult } from './types';
import { buildReport } from './report';

const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

function result(
  overrides: Partial<EvaluationCaseResult>,
): EvaluationCaseResult {
  return {
    fixtureId: 'X',
    category: 'normal',
    description: '',
    expectedOutcome: 'NO_CONDITION',
    actualOutcome: 'NO_CONDITION',
    passed: true,
    detail: '',
    ...overrides,
  };
}

describeOrSkip('buildReport', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [
        Jurisdiction,
        PolicySource,
        PolicySourceRevision,
        PolicyVersion,
      ],
    });
    await dataSource.initialize();
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  }, 30_000);

  it('computes condition precision/recall and per-category pass counts, and records that no model revision exists to pin', async () => {
    const results: EvaluationCaseResult[] = [
      result({
        fixtureId: 'A',
        category: 'normal',
        expectedOutcome: 'CONDITION_OPENED',
        actualOutcome: 'CONDITION_OPENED',
        passed: true,
      }),
      result({
        fixtureId: 'B',
        category: 'normal',
        expectedOutcome: 'CONDITION_OPENED',
        actualOutcome: 'NO_CONDITION',
        passed: false,
      }),
      result({
        fixtureId: 'C',
        category: 'boundary',
        expectedOutcome: 'NO_CONDITION',
        actualOutcome: 'CONDITION_OPENED',
        passed: false,
      }),
      result({
        fixtureId: 'D',
        category: 'boundary',
        expectedOutcome: 'NO_CONDITION',
        actualOutcome: 'NO_CONDITION',
        passed: true,
      }),
    ];

    const report = await buildReport(dataSource, 'test-corpus', results);

    // Expected-CONDITION_OPENED cases: A (matched), B (missed) -> recall 1/2.
    expect(report.summary.conditionRecall).toBe(0.5);
    // Actually-CONDITION_OPENED cases: A (correct), C (spurious) -> precision 1/2.
    expect(report.summary.conditionPrecision).toBe(0.5);
    expect(report.summary.byCategory.normal).toEqual({ total: 2, passed: 1 });
    expect(report.summary.byCategory.boundary).toEqual({ total: 2, passed: 1 });
    expect(report.summary.byCategory['missing-data']).toEqual({
      total: 0,
      passed: 0,
    });
    expect(report.summary.totalCases).toBe(4);
    expect(report.summary.passed).toBe(2);
    expect(report.summary.failed).toBe(2);
    expect(report.modelAndPromptRevisions).toBeNull();
    expect(report.modelAndPromptRevisionsNote).toContain('no model calls');
    expect(report.policyDataset.resolverVersion).toBe('2.0.0');
  });

  it('reports null precision/recall when no case involves an opened condition', async () => {
    const results: EvaluationCaseResult[] = [
      result({ fixtureId: 'A', passed: true }),
    ];

    const report = await buildReport(dataSource, 'test-corpus', results);

    expect(report.summary.conditionRecall).toBeNull();
    expect(report.summary.conditionPrecision).toBeNull();
  });

  it('includes real released policy version ids from the database', async () => {
    const sourceRepo = dataSource.getRepository(PolicySource);
    const source = await sourceRepo.save(
      sourceRepo.create({
        name: 'report spec source',
        owner: 'policy-team',
        // Reuses the migration-seeded jurisdiction rather than creating a
        // new one — PolicySource.jurisdictionCode has a real FK to
        // jurisdictions.code, and this test only needs a valid one, not a
        // fresh one.
        jurisdictionCode: 'US-CA',
        retrievalMode: PolicySourceRetrievalMode.SYNTHETIC,
        freshnessObjectiveHours: 24,
      }),
    );
    const revisionRepo = dataSource.getRepository(PolicySourceRevision);
    const revision = await revisionRepo.save(
      revisionRepo.create({
        policySourceId: source.id,
        checksum: 'sha256:report-spec',
        publishedAt: new Date('2025-01-01T00:00:00Z'),
        content: {},
      }),
    );
    const versionRepo = dataSource.getRepository(PolicyVersion);
    const version = await versionRepo.save(
      versionRepo.create({
        ruleId: 'report-spec-rule',
        version: '1.0.0',
        sourceRevisionId: revision.id,
        dsl: { rule: {} },
        effectiveFrom: new Date('2025-01-01T00:00:00Z'),
        releaseStatus: PolicyReleaseStatus.RELEASED,
      }),
    );

    const report = await buildReport(dataSource, 'test-corpus', []);

    expect(report.policyDataset.releasedPolicyVersionIds).toContain(version.id);

    await versionRepo.delete({ id: version.id });
    await revisionRepo.delete({ id: revision.id });
    await sourceRepo.delete({ id: source.id });
  });
});
