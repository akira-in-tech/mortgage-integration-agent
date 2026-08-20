import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ProviderApprovalDecision } from '../enums/provider-promotion.enum';

/**
 * Section 11.4's `ProviderApprovalRecord`: the human dual-control decision
 * over one manifest, append-only like `ProviderCertificationRecord` for
 * the same reason (a revocation is a new row, not a mutation).
 * `ProviderPromotionService.activate()` requires the latest row for a
 * manifest to be `APPROVED`, unexpired, and `approvedBy !== proposedBy` —
 * the exact self-approval rejection `PolicyTransitionApprovalService`
 * already enforces for policy releases (Section 16.1).
 */
@Entity('provider_approval_records')
@Index('IDX_provider_approval_records_manifest', ['manifestId'])
export class ProviderApprovalRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  manifestId!: string;

  /** e.g. "compliance", "engineering-lead" — free-text, the same honest actor-role scoping `PolicyTransitionApproval` uses instead of a real RBAC role check. */
  @Column({ type: 'varchar', length: 100 })
  approvalRole!: string;

  @Column({ type: 'varchar', length: 200 })
  approvedBy!: string;

  @Column({ type: 'enum', enum: ProviderApprovalDecision })
  decision!: ProviderApprovalDecision;

  @CreateDateColumn({ type: 'timestamptz' })
  decidedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;
}
