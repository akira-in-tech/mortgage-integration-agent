import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PolicyVersion } from './policy-version.entity';

/**
 * Typed applicability scope for one policy version (Section 10.1, 10.3,
 * 10.7's example `applicability` block). Deliberately separate from
 * `PolicyVersion` rather than inline columns: the target resolver
 * (Section 10.3) matches a case's context against jurisdiction, product,
 * program, and lifecycle-event dimensions independently, and a single
 * policy version's applicability is not always a single flat row in the
 * richer target design — kept 1:1 here (one applicability row per
 * version) since nothing in this slice yet needs more than that.
 */
@Entity('policy_applicability')
@Index('IDX_policy_applicability_version', ['policyVersionId'])
@Index('IDX_policy_applicability_lookup', [
  'jurisdictionCode',
  'productCode',
  'lifecycleEvent',
])
export class PolicyApplicability {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  policyVersionId!: string;

  @ManyToOne(() => PolicyVersion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policyVersionId' })
  policyVersion?: PolicyVersion;

  @Column({ type: 'varchar', length: 20 })
  jurisdictionCode!: string;

  @Column({ type: 'varchar', length: 100 })
  productCode!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  programCode!: string | null;

  @Column({ type: 'varchar', length: 100 })
  lifecycleEvent!: string;

  /** e.g. "application_received_on_or_after_effective_date" (Section 10.7). */
  @Column({ type: 'varchar', length: 200, nullable: true })
  transitionRule!: string | null;
}
