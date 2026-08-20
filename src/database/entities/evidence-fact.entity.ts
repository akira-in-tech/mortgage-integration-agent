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
import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
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

registerEnumType(EvidenceType, { name: 'EvidenceType' });
registerEnumType(EvidenceSourceKind, { name: 'EvidenceSourceKind' });

/**
 * Typed evidence with source, confidence-bearing value, and validity
 * (Section 14.1/14.2). `value` stays a normalized JSONB payload rather than
 * per-fact-type columns until a second real fact type proves the shape
 * that's actually shared. `@ObjectType()`/`@Field()` (M6) reuse this same
 * entity for GraphQL rather than a parallel DTO — this is also this
 * table's first real query surface of any kind (no REST route lists
 * evidence facts either).
 */
@Entity('evidence_facts')
@ObjectType()
@Index('IDX_evidence_facts_tenant_case', ['tenantId', 'caseId'])
export class EvidenceFact {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Field(() => ID)
  @Column({ type: 'uuid' })
  caseId!: string;

  @ManyToOne(() => LoanCase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'caseId' })
  case?: LoanCase;

  @Field(() => EvidenceType)
  @Column({ type: 'enum', enum: EvidenceType })
  factType!: EvidenceType;

  @Field(() => EvidenceSourceKind)
  @Column({ type: 'enum', enum: EvidenceSourceKind })
  sourceKind!: EvidenceSourceKind;

  /** e.g. "plaid-simulator", "credit-bureau-simulator" — not a formal provider registry yet (Section 11, M4). */
  @Field()
  @Column({ type: 'varchar', length: 100 })
  sourceIdentifier!: string;

  @Field(() => GraphQLJSON)
  @Column({ type: 'jsonb' })
  value!: Record<string, unknown>;

  @Field()
  @Column({ type: 'timestamptz' })
  observedAt!: Date;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  validThrough!: Date | null;

  @Field(() => Int)
  @VersionColumn()
  version!: number;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
