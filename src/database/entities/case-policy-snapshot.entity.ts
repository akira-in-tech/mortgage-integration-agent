import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { PolicyResolutionStatus } from '../enums/policy-resolution-status.enum';

/**
 * Immutable resolved-policy record for one case (Section 10.3, 14.1:
 * "Immutable resolved versions, source revisions, context hash, and
 * resolution reasons"). Written once per distinct resolution outcome by
 * `PolicyEvaluationService` — never updated in place. `versions` is a
 * denormalized snapshot of what `PolicyApplicabilityResolverService`
 * returned at `resolvedAt`, not a live reference — the whole point of a
 * snapshot is that it stays exactly what it was even if the underlying
 * policy catalog changes later.
 */
@Entity('case_policy_snapshots')
@Index('IDX_case_policy_snapshots_case', ['tenantId', 'caseId'])
export class CasePolicySnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  caseId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  resolvedAt!: Date;

  /** Digest of the resolution context + outcome (see policy-digest.ts). */
  @Column({ type: 'varchar', length: 64 })
  contextHash!: string;

  /** Version tag for the resolver algorithm that produced this snapshot. */
  @Column({ type: 'varchar', length: 20 })
  resolverVersion!: string;

  @Column({ type: 'enum', enum: PolicyResolutionStatus })
  resolutionStatus!: PolicyResolutionStatus;

  @Column({ type: 'jsonb' })
  versions!: Array<{
    policyVersionId: string;
    ruleId: string;
    version: string;
    effectiveFrom: string;
    effectiveTo: string | null;
  }>;

  @Column({ type: 'jsonb' })
  unresolvedReasons!: string[];
}
