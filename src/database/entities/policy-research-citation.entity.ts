import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PolicyResearchRun } from './policy-research-run.entity';
import { PolicySourceRevision } from './policy-source-revision.entity';

/**
 * A bounded, immutable excerpt used to ground one research run. Persisting
 * the revision checksum and excerpt digest lets a reviewer detect drift
 * before relying on an LLM-generated candidate summary.
 */
@Entity('policy_research_citations')
@Index('IDX_policy_research_citations_run_rank', [
  'policyResearchRunId',
  'rank',
])
@Index(
  'UQ_policy_research_citations_run_rank',
  ['policyResearchRunId', 'rank'],
  {
    unique: true,
  },
)
export class PolicyResearchCitation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  policyResearchRunId!: string;

  @ManyToOne(() => PolicyResearchRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policyResearchRunId' })
  policyResearchRun?: PolicyResearchRun;

  @Column({ type: 'uuid' })
  policySourceRevisionId!: string;

  @ManyToOne(() => PolicySourceRevision, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'policySourceRevisionId' })
  policySourceRevision?: PolicySourceRevision;

  @Column({ type: 'varchar', length: 200 })
  sourceChecksum!: string;

  @Column({ type: 'varchar', length: 500 })
  location!: string;

  @Column({ type: 'text' })
  excerpt!: string;

  @Column({ type: 'varchar', length: 64 })
  excerptDigest!: string;

  @Column({ type: 'int' })
  rank!: number;

  @Column({ type: 'numeric', precision: 7, scale: 6 })
  relevanceScore!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
