import { ApiProperty } from '@nestjs/swagger';
import { EvaluationReportRecord } from '../../database/entities/evaluation-report-record.entity';
import type { EvaluationReport } from '../types';

// One row in the reports list — just the totals, not every per-case
// result. A reviewer scanning the list wants to see at a glance which
// runs passed and roughly when; the full detail is one click away.
export class EvaluationReportSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  generatedAt!: string;

  @ApiProperty({ nullable: true })
  gitCommit!: string | null;

  @ApiProperty({ nullable: true })
  gitBranch!: string | null;

  @ApiProperty()
  totalCases!: number;

  @ApiProperty()
  passed!: number;

  @ApiProperty()
  failed!: number;

  @ApiProperty({ nullable: true })
  conditionRecall!: number | null;

  @ApiProperty({ nullable: true })
  conditionPrecision!: number | null;

  static from(record: EvaluationReportRecord): EvaluationReportSummaryDto {
    return {
      id: record.id,
      generatedAt: record.generatedAt.toISOString(),
      gitCommit: record.gitCommit,
      gitBranch: record.gitBranch,
      totalCases: record.totalCases,
      passed: record.passed,
      failed: record.failed,
      conditionRecall: record.conditionRecall,
      conditionPrecision: record.conditionPrecision,
    };
  }
}

// The full saved report — every per-case result included, exactly what
// `npm run evaluate` wrote to evaluation/reports/*.json at the time.
export class EvaluationReportDetailDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  report!: EvaluationReport;

  static from(record: EvaluationReportRecord): EvaluationReportDetailDto {
    return { id: record.id, report: record.report };
  }
}
