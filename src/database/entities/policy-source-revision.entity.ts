import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { PolicySource } from './policy-source.entity';

/**
 * Immutable retrieved-content record (Section 10.1, 14.1). Bitemporal by
 * design: `publishedAt` is the source's own valid-time publication date;
 * `recordedAt` (system time) is when this platform learned about and
 * stored it — the two are expected to differ, sometimes by a lot, for a
 * late-discovered publication.
 */
@Entity('policy_source_revisions')
@Index('IDX_policy_source_revisions_source', ['policySourceId'])
export class PolicySourceRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  policySourceId!: string;

  @ManyToOne(() => PolicySource, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'policySourceId' })
  policySource?: PolicySource;

  @Column({ type: 'text' })
  checksum!: string;

  /** The source's own valid-time publication instant. */
  @Column({ type: 'timestamptz' })
  publishedAt!: Date;

  /** System time: when this platform recorded the revision. */
  @CreateDateColumn({ type: 'timestamptz' })
  recordedAt!: Date;

  /** Retrieved content metadata — synthetic for this launch (Section 10.6). */
  @Column({ type: 'jsonb' })
  content!: Record<string, unknown>;
}
