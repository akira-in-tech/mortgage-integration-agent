import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlaidIncomeData } from '../../integrations/plaid/plaid.types';
import { CreditBureauData } from '../../integrations/credit/credit.types';
import { DocumentVerificationResult } from '../../integrations/document/document.types';
import { LoanType } from '../enums/loan-type.enum';
import { LoanDecisionStatus } from '../enums/loan-decision.enum';

interface RawIntegrationData {
  plaid: PlaidIncomeData;
  credit: CreditBureauData;
  documents: DocumentVerificationResult;
}

@Entity('loan_applications')
export class LoanApplication {
  /** UUIDs generated at the service layer to allow client-side idempotency keys */
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  borrowerId!: string;

  /** Loan amount stored as decimal for exact arithmetic — never use float for money */
  @Column({ type: 'decimal', precision: 14, scale: 2 })
  requestedAmount!: number;

  @Column({
    type: 'enum',
    enum: LoanType,
    default: LoanType.CONVENTIONAL,
  })
  loanType!: LoanType;

  @Column({
    type: 'enum',
    enum: LoanDecisionStatus,
    default: LoanDecisionStatus.PENDING,
  })
  decision!: LoanDecisionStatus;

  @Column({ type: 'decimal', precision: 4, scale: 3, nullable: true })
  confidence!: number | null;

  @Column({ type: 'text', nullable: true })
  reasoning!: string | null;

  @Column({ type: 'boolean', default: false })
  incomeVerified!: boolean;

  @Column({ type: 'boolean', default: false })
  documentsValid!: boolean;

  // JSON preserves commas and other punctuation inside individual conditions.
  @Column({ type: 'simple-json', nullable: true })
  conditions!: string[] | null;

  /** Full integration API payloads stored as JSONB for compliance audit trail */
  @Column({ type: 'jsonb', nullable: true })
  rawIntegrationData!: RawIntegrationData | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
