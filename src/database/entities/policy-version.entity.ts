import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { PolicySourceRevision } from './policy-source-revision.entity';
import { PolicyReleaseStatus } from '../enums/policy-version.enum';

/**
 * An immutable, versioned policy rule (Section 10.2, 10.7, 10.8: "Policy
 * identifiers and released versions are immutable"). `dsl` stores the
 * parsed rule document (see the Section 10.7 example) — this slice
 * persists and retrieves it; parsing/validating/evaluating the DSL itself
 * is separate, not-yet-built scope (see docs/DEVELOPMENT_LOG.md).
 * `supersedesVersionId` gives a correction or supersession an explicit
 * relationship back to the record it replaces, rather than mutating that
 * record in place.
 */
@Entity('policy_versions')
@Unique('UQ_policy_versions_rule_version', ['ruleId', 'version'])
@Index('IDX_policy_versions_rule', ['ruleId'])
export class PolicyVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  ruleId!: string;

  /** Semver-style string, e.g. "1.0.0" (Section 10.7's example). */
  @Column({ type: 'varchar', length: 50 })
  version!: string;

  @Column({ type: 'uuid' })
  sourceRevisionId!: string;

  @ManyToOne(() => PolicySourceRevision, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sourceRevisionId' })
  sourceRevision?: PolicySourceRevision;

  @Column({ type: 'jsonb' })
  dsl!: Record<string, unknown>;

  @Column({ type: 'timestamptz' })
  effectiveFrom!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  effectiveTo!: Date | null;

  @Column({
    type: 'enum',
    enum: PolicyReleaseStatus,
    default: PolicyReleaseStatus.DRAFT,
  })
  releaseStatus!: PolicyReleaseStatus;

  /** System time: when this platform recorded the version. */
  @CreateDateColumn({ type: 'timestamptz' })
  recordedAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  supersedesVersionId!: string | null;
}
