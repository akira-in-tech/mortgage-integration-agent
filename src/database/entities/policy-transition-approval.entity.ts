import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Section 16.1's "separate policy-author and policy-approver roles, with
 * independent approval for releases and transition logic" and Section
 * 10.6's diagram step "approved activation emits audit and change
 * events" — made real without a formal OIDC/RBAC system (none exists yet
 * anywhere in this codebase): `proposedBy`/`approvedBy` are plain actor-id
 * strings, the same honest scoping `CommunicationApprovalService` (M3-012)
 * already uses for human approval. The independence this enforces is
 * behavioral (a different actor id must approve than proposed), not
 * identity-verified — a real auth system would strengthen, not replace,
 * this check.
 *
 * One row per proposal; `approvedBy`/`approvedAt` start null and are set
 * exactly once by `PolicyTransitionApprovalService.approve()`. Never
 * updated again after that — a second proposal for the same version (e.g.
 * after rejection or edits) is a new row, preserving history the same way
 * `PolicyVersion` itself never mutates a released row in place.
 */
@Entity('policy_transition_approvals')
@Index('IDX_policy_transition_approvals_version', ['policyVersionId'])
export class PolicyTransitionApproval {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  policyVersionId!: string;

  @Column({ type: 'varchar', length: 200 })
  proposedBy!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  proposedAt!: Date;

  @Column({ type: 'varchar', length: 200, nullable: true })
  approvedBy!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
