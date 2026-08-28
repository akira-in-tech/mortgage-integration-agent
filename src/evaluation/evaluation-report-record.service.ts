import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EvaluationReportRecord } from '../database/entities/evaluation-report-record.entity';
import type { EvaluationReport } from './types';

/**
 * Saves and reads back `npm run evaluate` runs. `record()` is called
 * once per real run, right after the same report is written to
 * `evaluation/reports/*.json` — this is the durable, REST-reachable
 * copy of that exact object, not a second computation of it.
 */
@Injectable()
export class EvaluationReportRecordService {
  constructor(
    @InjectRepository(EvaluationReportRecord)
    private readonly repository: Repository<EvaluationReportRecord>,
  ) {}

  async record(report: EvaluationReport): Promise<EvaluationReportRecord> {
    return this.repository.save(
      this.repository.create({
        generatedAt: new Date(report.generatedAt),
        gitCommit: report.codeRevision.gitCommit,
        gitBranch: report.codeRevision.gitBranch,
        totalCases: report.summary.totalCases,
        passed: report.summary.passed,
        failed: report.summary.failed,
        conditionRecall: report.summary.conditionRecall,
        conditionPrecision: report.summary.conditionPrecision,
        report,
      }),
    );
  }

  /** Summaries only, newest first — a list screen doesn't need every per-case result just to show totals. */
  async list(limit = 50): Promise<EvaluationReportRecord[]> {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    return this.repository.find({
      order: { generatedAt: 'DESC' },
      take: boundedLimit,
    });
  }

  /** The full row, including its complete per-case report — what a download actually needs. */
  async get(id: string): Promise<EvaluationReportRecord> {
    return this.repository.findOneByOrFail({ id });
  }
}
