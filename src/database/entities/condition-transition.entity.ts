import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { LoanCondition, ConditionStatus } from './loan-condition.entity';

/**
 * Actor-attributed condition state history (Section 14.1). Append-only —
 * never updated, only inserted — so it can serve as the audit trail for
 * every condition transition without a separate audit table duplicating it.
 */
@Entity('condition_transitions')
@Index('IDX_condition_transitions_condition', ['conditionId'])
export class ConditionTransition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  conditionId!: string;

  @ManyToOne(() => LoanCondition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conditionId' })
  condition?: LoanCondition;

  @Column({ type: 'enum', enum: ConditionStatus })
  fromStatus!: ConditionStatus;

  @Column({ type: 'enum', enum: ConditionStatus })
  toStatus!: ConditionStatus;

  /** Null for a deterministic system transition; set for a human reviewer action. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  actorId!: string | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  occurredAt!: Date;
}
