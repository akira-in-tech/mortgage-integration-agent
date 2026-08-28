import { NotFoundException } from '@nestjs/common';
import { EvaluationReportRecordService } from './evaluation-report-record.service';
import { EvaluationReportController } from './evaluation-report.controller';
import type { EvaluationReport } from './types';

const REPORT_ID = '11111111-1111-1111-1111-111111111111';

const REPORT: EvaluationReport = {
  generatedAt: '2026-01-01T00:00:00.000Z',
  codeRevision: { gitCommit: 'abc123', gitBranch: 'main' },
  policyDataset: { resolverVersion: '1', releasedPolicyVersionIds: [] },
  modelAndPromptRevisions: null,
  modelAndPromptRevisionsNote: 'No model calls made.',
  corpus: { totalCases: 1, source: '/fake/cases' },
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
  ],
  summary: {
    totalCases: 1,
    passed: 1,
    failed: 0,
    byCategory: {
      normal: { total: 1, passed: 1 },
      boundary: { total: 0, passed: 0 },
      'missing-data': { total: 0, passed: 0 },
      'policy-coverage': { total: 0, passed: 0 },
      'provider-failure': { total: 0, passed: 0 },
    },
    conditionRecall: null,
    conditionPrecision: null,
  },
};

const RECORD = {
  id: REPORT_ID,
  generatedAt: new Date('2026-01-01T00:00:00Z'),
  gitCommit: 'abc123',
  gitBranch: 'main',
  totalCases: 1,
  passed: 1,
  failed: 0,
  conditionRecall: null,
  conditionPrecision: null,
  report: REPORT,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

describe('EvaluationReportController', () => {
  let reportService: { list: jest.Mock; get: jest.Mock };
  let controller: EvaluationReportController;

  beforeEach(() => {
    reportService = {
      list: jest.fn().mockResolvedValue([RECORD]),
      get: jest.fn().mockResolvedValue(RECORD),
    };
    controller = new EvaluationReportController(
      reportService as unknown as EvaluationReportRecordService,
    );
  });

  it('lists real summaries, not the full per-case results', async () => {
    const result = await controller.list(50);
    expect(reportService.list).toHaveBeenCalledWith(50);
    expect(result).toEqual([
      {
        id: REPORT_ID,
        generatedAt: '2026-01-01T00:00:00.000Z',
        gitCommit: 'abc123',
        gitBranch: 'main',
        totalCases: 1,
        passed: 1,
        failed: 0,
        conditionRecall: null,
        conditionPrecision: null,
      },
    ]);
  });

  it('get() returns the full saved report, every per-case result included', async () => {
    const result = await controller.get(REPORT_ID);
    expect(result).toEqual({ id: REPORT_ID, report: REPORT });
  });

  it('get() turns an unknown id into a 404, not an unhandled error', async () => {
    reportService.get.mockRejectedValue(new Error('not found'));
    await expect(controller.get(REPORT_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('download() sets a real Content-Disposition header naming this exact report', async () => {
    const response = { set: jest.fn() };
    const result = await controller.download(
      REPORT_ID,
      response as unknown as Parameters<typeof controller.download>[1],
    );
    expect(response.set).toHaveBeenCalledWith(
      'Content-Disposition',
      `attachment; filename="evaluation-report-${REPORT_ID}.json"`,
    );
    expect(result).toEqual(REPORT);
  });
});
