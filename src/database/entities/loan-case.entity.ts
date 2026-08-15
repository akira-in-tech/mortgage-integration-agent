import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  VersionColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';

/** Section 6.1 — describes workflow readiness, not a formal credit decision. */
export enum CaseStatus {
  DRAFT = 'DRAFT',
  COLLECTING_EVIDENCE = 'COLLECTING_EVIDENCE',
  CONDITIONS_OPEN = 'CONDITIONS_OPEN',
  WAITING_FOR_INFORMATION = 'WAITING_FOR_INFORMATION',
  WAITING_FOR_REVIEW = 'WAITING_FOR_REVIEW',
  READY_FOR_UNDERWRITING = 'READY_FOR_UNDERWRITING',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  CLOSED = 'CLOSED',
}

export enum CaseLoanType {
  CONVENTIONAL = 'CONVENTIONAL',
  FHA = 'FHA',
  VA = 'VA',
  JUMBO = 'JUMBO',
}

/**
 * The M2 target-vocabulary case aggregate (Section 6.1, 14.1). Coexists with
 * the legacy `LoanApplication`/`evaluateLoan` one-shot demo path during the
 * M2-M4 transition rather than replacing it in place — the charter (Section
 * 3) requires the legacy vocabulary to be migrated deliberately, not dropped
 * as a side effect of adding the target schema.
 */
@Entity('loan_cases')
@Unique('UQ_loan_cases_tenant_idempotency_key', ['tenantId', 'idempotencyKey'])
@Index('IDX_loan_cases_tenant', ['tenantId'])
export class LoanCase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenantId' })
  tenant?: Tenant;

  /** Caller-supplied idempotency key for case creation (Section 15.3). */
  @Column({ type: 'varchar', length: 200 })
  idempotencyKey!: string;

  @Column({ type: 'varchar', length: 100 })
  borrowerId!: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  requestedAmount!: number;

  @Column({ type: 'enum', enum: CaseLoanType })
  loanType!: CaseLoanType;

  @Column({ type: 'enum', enum: CaseStatus, default: CaseStatus.DRAFT })
  status!: CaseStatus;

  /** Optimistic concurrency for compare-and-swap writes (Section 10.5, 17.1). */
  @VersionColumn()
  version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
