import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  VersionColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { LoanCase } from './loan-case.entity';

export enum EvidenceType {
  INCOME = 'INCOME',
  ASSET = 'ASSET',
  CREDIT = 'CREDIT',
  IDENTITY = 'IDENTITY',
  DOCUMENT = 'DOCUMENT',
}

/** Simulator-only for the synthetic launch (Section 7); real sources are a later, separately gated capability. */
export enum EvidenceSourceKind {
  SIMULATOR = 'SIMULATOR',
  BORROWER_SUBMITTED = 'BORROWER_SUBMITTED',
}

/**
 * Typed evidence with source, confidence-bearing value, and validity
 * (Section 14.1/14.2). `value` stays a normalized JSONB payload rather than
 * per-fact-type columns until a second real fact type proves the shape
 * that's actually shared.
 */
@Entity('evidence_facts')
@Index('IDX_evidence_facts_tenant_case', ['tenantId', 'caseId'])
export class EvidenceFact {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  caseId!: string;

  @ManyToOne(() => LoanCase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'caseId' })
  case?: LoanCase;

  @Column({ type: 'enum', enum: EvidenceType })
  factType!: EvidenceType;

  @Column({ type: 'enum', enum: EvidenceSourceKind })
  sourceKind!: EvidenceSourceKind;

  /** e.g. "plaid-simulator", "credit-bureau-simulator" — not a formal provider registry yet (Section 11, M4). */
  @Column({ type: 'varchar', length: 100 })
  sourceIdentifier!: string;

  @Column({ type: 'jsonb' })
  value!: Record<string, unknown>;

  @Column({ type: 'timestamptz' })
  observedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  validThrough!: Date | null;

  @VersionColumn()
  version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
