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
import { ApiProperty } from '@nestjs/swagger';
import { Tenant } from './tenant.entity';
import { Jurisdiction } from './jurisdiction.entity';
import { LoanType } from '../enums/loan-type.enum';
import { CaseStatus } from '../enums/case-status.enum';

export { CaseStatus };

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
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenantId' })
  tenant?: Tenant;

  /** Caller-supplied idempotency key for case creation (Section 15.3). */
  @ApiProperty()
  @Column({ type: 'varchar', length: 200 })
  idempotencyKey!: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 100 })
  borrowerId!: string;

  @ApiProperty()
  @Column({ type: 'decimal', precision: 14, scale: 2 })
  requestedAmount!: number;

  @ApiProperty({ enum: LoanType })
  @Column({ type: 'enum', enum: LoanType })
  loanType!: LoanType;

  /**
   * Borrower-declared monthly income at application time (Section 10.7's
   * example rule: `application.monthly_income`, compared against Plaid's
   * verified figure to detect a discrepancy worth reviewing). Distinct
   * from any evidence fact — this is what the borrower stated, not what a
   * provider verified.
   */
  @ApiProperty()
  @Column({ type: 'decimal', precision: 14, scale: 2 })
  statedMonthlyIncome!: number;

  /**
   * Governing jurisdiction for policy applicability (Section 10.3). Real
   * mortgage applications collect this from the property/borrower state;
   * this schema has no address model yet, so it is caller-supplied
   * directly rather than derived.
   */
  @ApiProperty({ example: 'US-CA' })
  @Column({ type: 'varchar', length: 20 })
  jurisdictionCode!: string;

  @ManyToOne(() => Jurisdiction, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'jurisdictionCode' })
  jurisdiction?: Jurisdiction;

  @ApiProperty({ enum: CaseStatus })
  @Column({ type: 'enum', enum: CaseStatus, default: CaseStatus.DRAFT })
  status!: CaseStatus;

  /** Optimistic concurrency for compare-and-swap writes (Section 10.5, 17.1). */
  @ApiProperty()
  @VersionColumn()
  version!: number;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
