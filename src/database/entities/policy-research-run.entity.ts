import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  PolicyResearchStatus,
  PolicyResearchTrigger,
} from '../enums/policy-research.enum';
import { PolicySource } from './policy-source.entity';
import { PolicySourceRevision } from './policy-source-revision.entity';

/**
 * Durable, platform-governance work item for research prompted by a source
 * or applicability concern. The query contains only policy context and
 * resolver reason codes; borrower or case evidence must never enter this
 * global queue or its model prompt.
 */
@Entity('policy_research_runs')
@Index('UQ_policy_research_runs_fingerprint', ['requestFingerprint'], {
  unique: true,
})
@Index('IDX_policy_research_runs_queue', ['status', 'requestedAt'])
export class PolicyResearchRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: PolicyResearchTrigger })
  trigger!: PolicyResearchTrigger;

  @Column({ type: 'enum', enum: PolicyResearchStatus })
  status!: PolicyResearchStatus;

  @Column({ type: 'uuid', nullable: true })
  policySourceId!: string | null;

  @ManyToOne(() => PolicySource, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'policySourceId' })
  policySource?: PolicySource | null;

  @Column({ type: 'uuid', nullable: true })
  policySourceRevisionId!: string | null;

  @ManyToOne(() => PolicySourceRevision, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'policySourceRevisionId' })
  policySourceRevision?: PolicySourceRevision | null;

  @Column({ type: 'varchar', length: 20 })
  jurisdictionCode!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  productCode!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lifecycleEvent!: string | null;

  /** Stable idempotency key, never derived from case or borrower data. */
  @Column({ type: 'varchar', length: 64 })
  requestFingerprint!: string;

  @Column({ type: 'jsonb' })
  unresolvedReasons!: string[];

  @Column({ type: 'text' })
  researchQuery!: string;

  @Column({ type: 'text', nullable: true })
  candidateSummary!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  changeSignals!: string[] | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  synthesisProvider!: string | null;

  @Column({ type: 'text', nullable: true })
  failureDetail!: string | null;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  requestedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  claimedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
}
