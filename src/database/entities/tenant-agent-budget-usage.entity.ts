import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Calendar-month UTC aggregate for cost-bearing Agent work. Reservations are
 * retained here while an external outcome is unknown, so parallel workflows
 * cannot each spend the tenant's full organizational allowance.
 */
@Entity('tenant_agent_budget_usage')
export class TenantAgentBudgetUsage {
  @PrimaryColumn({ type: 'uuid' })
  tenantId!: string;

  @PrimaryColumn({ type: 'date' })
  windowStart!: string;

  @Column({ type: 'integer', default: 0 })
  providerCallUsed!: number;

  @Column({ type: 'integer', default: 0 })
  providerCallReserved!: number;

  @Column({ type: 'integer', default: 0 })
  costUsedMinorUnits!: number;

  @Column({ type: 'integer', default: 0 })
  costReservedMinorUnits!: number;

  @Column({ type: 'char', length: 3 })
  currency!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
