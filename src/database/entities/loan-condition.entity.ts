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
import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
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

registerEnumType(ConditionStatus, { name: 'ConditionStatus' });

/**
 * A resolvable operational condition (Section 14.1). `policySnapshotId` is
 * nullable here because the M3 policy engine that produces it doesn't exist
 * yet; M3 will make it required for any SATISFIED/WAIVED/ESCALATED
 * transition (Section 6.2: "every satisfied, waived, or escalated condition
 * includes ... the immutable case policy snapshot that governed it").
 * `@ObjectType()`/`@Field()` (M6) reuse this same entity for GraphQL —
 * this table's first real query surface of any kind.
 */
@Entity('loan_conditions')
@ObjectType()
@Index('IDX_loan_conditions_tenant_case', ['tenantId', 'caseId'])
export class LoanCondition {
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

  /** e.g. "VERIFY_INCOME_DISCREPANCY" — stable machine-readable condition type. */
  @Field()
  @Column({ type: 'varchar', length: 100 })
  code!: string;

  @Field()
  @Column({ type: 'text' })
  description!: string;

  @Field(() => ConditionStatus)
  @Column({
    type: 'enum',
    enum: ConditionStatus,
    default: ConditionStatus.OPEN,
  })
  status!: ConditionStatus;

  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  policySnapshotId!: string | null;

  /** The immutable `EvaluationInputManifest` (Section 10.5) whose inputs justified this condition — nullable because not every condition-creation path builds one (M3-014). */
  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  evaluationManifestId!: string | null;

  @Field(() => Int)
  @VersionColumn()
  version!: number;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
