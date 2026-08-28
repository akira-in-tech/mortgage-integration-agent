import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import type { EvaluationReport } from '../../evaluation/types';

/**
 * A durable copy of one `npm run evaluate` run's report — the same
 * object `src/evaluation-report.ts` already writes to
 * `evaluation/reports/*.json` on local disk, now also saved as a real
 * row so it can be listed and downloaded over REST instead of requiring
 * shell/filesystem access to the machine that ran it.
 *
 * NOT tenant-scoped, no RLS — an evaluation run isn't owned by any one
 * tenant (it uses a disposable synthetic tenant of its own, deleted
 * afterward), so this is release/QA evidence, not tenant data. Same
 * "no tenant dimension" precedent `provider_promotion_manifests` and
 * `platform_admins` already set, and reachable through the same
 * `PlatformAdminGuard` rather than any tenant credential for the same
 * reason: no tenant's own reviewer should be the audience for the
 * whole platform's release evidence.
 *
 * `report` holds the complete `EvaluationReport` object (every per-case
 * result included) so nothing is lost; the other columns duplicate its
 * summary fields only so listing reports doesn't need to parse that
 * JSON just to show totals.
 */
@Entity('evaluation_report_records')
export class EvaluationReportRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'timestamptz' })
  generatedAt!: Date;

  @Column({ type: 'varchar', length: 64, nullable: true })
  gitCommit!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  gitBranch!: string | null;

  @Column({ type: 'int' })
  totalCases!: number;

  @Column({ type: 'int' })
  passed!: number;

  @Column({ type: 'int' })
  failed!: number;

  @Column({ type: 'float', nullable: true })
  conditionRecall!: number | null;

  @Column({ type: 'float', nullable: true })
  conditionPrecision!: number | null;

  /** The full report this row summarizes — every per-case result, not just the totals above. */
  @Column({ type: 'jsonb' })
  report!: EvaluationReport;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
