import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { EvaluationReportRecord } from '../database/entities/evaluation-report-record.entity';
import { EvaluationReportRecordService } from './evaluation-report-record.service';
import type { EvaluationReport } from './types';

// Requires a reachable Postgres (same convention as the other real-DB
// specs): skip instead of failing when no DATABASE_URL is configured.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

function makeReport(
  overrides: Partial<EvaluationReport> = {},
): EvaluationReport {
  return {
    generatedAt: new Date().toISOString(),
    codeRevision: { gitCommit: randomUUID().slice(0, 8), gitBranch: 'test' },
    policyDataset: { resolverVersion: '1', releasedPolicyVersionIds: [] },
    modelAndPromptRevisions: null,
    modelAndPromptRevisionsNote: 'No model calls made.',
    corpus: { totalCases: 2, source: '/fake/cases' },
    results: [
      {
        fixtureId: 'fixture-1',
        category: 'normal',
        description: 'a normal case',
        expectedOutcome: 'NO_CONDITION',
        actualOutcome: 'NO_CONDITION',
        passed: true,
        detail: 'matched',
      },
      {
        fixtureId: 'fixture-2',
        category: 'boundary',
        description: 'a boundary case',
        expectedOutcome: 'CONDITION_OPENED',
        actualOutcome: 'NO_CONDITION',
        passed: false,
        detail: 'did not match',
      },
    ],
    summary: {
      totalCases: 2,
      passed: 1,
      failed: 1,
      byCategory: {
        normal: { total: 1, passed: 1 },
        boundary: { total: 1, passed: 0 },
        'missing-data': { total: 0, passed: 0 },
        'policy-coverage': { total: 0, passed: 0 },
        'provider-failure': { total: 0, passed: 0 },
      },
      conditionRecall: 0,
      conditionPrecision: null,
    },
    ...overrides,
  };
}

describeOrSkip('EvaluationReportRecordService', () => {
  let dataSource: DataSource;
  let service: EvaluationReportRecordService;
  const recordIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [EvaluationReportRecord],
    });
    await dataSource.initialize();
    service = new EvaluationReportRecordService(
      dataSource.getRepository(EvaluationReportRecord),
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (recordIds.length > 0) {
        await dataSource
          .getRepository(EvaluationReportRecord)
          .delete(recordIds);
      }
      await dataSource.destroy();
    }
  });

  it('record() saves the real report, including every per-case result, not just the summary', async () => {
    const report = makeReport();
    const saved = await service.record(report);
    recordIds.push(saved.id);

    expect(saved.totalCases).toBe(2);
    expect(saved.passed).toBe(1);
    expect(saved.failed).toBe(1);
    expect(saved.gitCommit).toBe(report.codeRevision.gitCommit);

    const fetched = await service.get(saved.id);
    expect(fetched.report).toEqual(report);
  });

  it('list() returns summaries newest-generatedAt-first', async () => {
    const older = await service.record(
      makeReport({
        generatedAt: new Date('2026-01-01T00:00:00Z').toISOString(),
      }),
    );
    const newer = await service.record(
      makeReport({
        generatedAt: new Date('2026-06-01T00:00:00Z').toISOString(),
      }),
    );
    recordIds.push(older.id, newer.id);

    const listed = await service.list(100);
    const ids = listed.map((r) => r.id);
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
  });

  it('get() throws for an unknown id, rather than returning something fabricated', async () => {
    await expect(service.get(randomUUID())).rejects.toThrow();
  });
});
