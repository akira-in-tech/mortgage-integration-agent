import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AgentBudgetReservationStatus {
  Reserved = 'RESERVED',
  Committed = 'COMMITTED',
  Released = 'RELEASED',
  Unknown = 'UNKNOWN',
}

/**
 * Idempotent capacity claim made before an Agent tool effect. UNKNOWN keeps
 * its capacity reserved until reconciliation proves the external outcome,
 * preventing retries from spending the same provider/cost budget twice.
 */
@Entity('agent_budget_reservations')
@Index('UQ_agent_budget_reservations_key', ['ledgerId', 'idempotencyKey'], {
  unique: true,
})
@Index('IDX_agent_budget_reservations_tenant', ['tenantId', 'ledgerId'])
export class AgentBudgetReservation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  ledgerId!: string;

  @Column({ type: 'varchar', length: 200 })
  idempotencyKey!: string;

  @Column({ type: 'integer', default: 0 })
  stepUnits!: number;

  @Column({ type: 'integer', default: 0 })
  tokenUnits!: number;

  @Column({ type: 'integer', default: 0 })
  providerCallUnits!: number;

  @Column({ type: 'integer', default: 0 })
  costMinorUnits!: number;

  @Column({ type: 'integer', nullable: true })
  actualCostMinorUnits!: number | null;

  @Column({ type: 'enum', enum: AgentBudgetReservationStatus })
  status!: AgentBudgetReservationStatus;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
