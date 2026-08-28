import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Authoritative per-workflow Agent budget. Graph state contains only a
 * snapshot of this row; every tool boundary must reserve capacity here before
 * work begins, so stale or model-supplied state cannot expand a limit.
 */
@Entity('agent_budget_ledgers')
@Index('UQ_agent_budget_ledgers_workflow', ['tenantId', 'workflowRunId'], {
  unique: true,
})
@Index('UQ_agent_budget_ledgers_id_tenant', ['id', 'tenantId'], {
  unique: true,
})
@Index('IDX_agent_budget_ledgers_case', ['tenantId', 'caseId'])
export class AgentBudgetLedger {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  caseId!: string;

  @Column({ type: 'varchar', length: 200 })
  workflowRunId!: string;

  @Column({ type: 'integer' })
  stepLimit!: number;

  @Column({ type: 'integer', default: 0 })
  stepUsed!: number;

  @Column({ type: 'integer', default: 0 })
  stepReserved!: number;

  @Column({ type: 'integer' })
  tokenLimit!: number;

  @Column({ type: 'integer', default: 0 })
  tokenUsed!: number;

  @Column({ type: 'integer', default: 0 })
  tokenReserved!: number;

  @Column({ type: 'integer' })
  providerCallLimit!: number;

  @Column({ type: 'integer', default: 0 })
  providerCallUsed!: number;

  @Column({ type: 'integer', default: 0 })
  providerCallReserved!: number;

  @Column({ type: 'integer' })
  costLimitMinorUnits!: number;

  @Column({ type: 'integer', default: 0 })
  costUsedMinorUnits!: number;

  @Column({ type: 'integer', default: 0 })
  costReservedMinorUnits!: number;

  @Column({ type: 'char', length: 3 })
  currency!: string;

  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ type: 'timestamptz' })
  deadlineAt!: Date;

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
