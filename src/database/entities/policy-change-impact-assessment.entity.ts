import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { PolicyVersion } from './policy-version.entity';
import { PolicyChangeImpactKind } from '../enums/policy-change-impact.enum';

/**
 * Section 10.6's dry-run comparison record: "applicability index finds
 * potentially affected open cases -> dry-run compares old and proposed
 * snapshots." One row per case a policy activation or withdrawal
 * potentially affects — advisory, per Section 10.6: "Impact assessment is
 * advisory until an authorized reviewer approves the transition
 * configuration" — this records what the dry run found, it does not
 * itself refresh the case's binding or snapshot. Written by
 * `PolicyChangeImpactService`, triggered by `PolicyActivationService`.
 */
@Entity('policy_change_impact_assessments')
@Index('IDX_policy_change_impact_assessments_case', ['tenantId', 'caseId'])
@Index('IDX_policy_change_impact_assessments_version', ['policyVersionId'])
export class PolicyChangeImpactAssessment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** The version whose activation or withdrawal triggered this assessment. */
  @Column({ type: 'uuid' })
  policyVersionId!: string;

  @ManyToOne(() => PolicyVersion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policyVersionId' })
  policyVersion?: PolicyVersion;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  caseId!: string;

  /** The case's active binding at assessment time, if it had one. */
  @Column({ type: 'uuid', nullable: true })
  priorPolicyBindingId!: string | null;

  @Column({ type: 'enum', enum: PolicyChangeImpactKind })
  impact!: PolicyChangeImpactKind;

  @Column({ type: 'text' })
  details!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  assessedAt!: Date;
}
