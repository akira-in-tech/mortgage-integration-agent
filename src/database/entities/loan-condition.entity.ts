import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  VersionColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { LoanCase } from './loan-case.entity';

/** Section 6.2. */
export enum ConditionStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_FOR_EVIDENCE = 'WAITING_FOR_EVIDENCE',
  SATISFIED = 'SATISFIED',
  WAIVED = 'WAIVED',
  ESCALATED = 'ESCALATED',
}

/**
 * A resolvable operational condition (Section 14.1). `policySnapshotId` is
 * nullable here because the M3 policy engine that produces it doesn't exist
 * yet; M3 will make it required for any SATISFIED/WAIVED/ESCALATED
 * transition (Section 6.2: "every satisfied, waived, or escalated condition
 * includes ... the immutable case policy snapshot that governed it").
 */
@Entity('loan_conditions')
@Index('IDX_loan_conditions_tenant_case', ['tenantId', 'caseId'])
export class LoanCondition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  caseId!: string;

  @ManyToOne(() => LoanCase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'caseId' })
  case?: LoanCase;

  /** e.g. "VERIFY_INCOME_DISCREPANCY" — stable machine-readable condition type. */
  @Column({ type: 'varchar', length: 100 })
  code!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({
    type: 'enum',
    enum: ConditionStatus,
    default: ConditionStatus.OPEN,
  })
  status!: ConditionStatus;

  @Column({ type: 'uuid', nullable: true })
  policySnapshotId!: string | null;

  @VersionColumn()
  version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
