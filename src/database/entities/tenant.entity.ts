import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Organization boundary (Section 14.1). RBAC (M5-017) and RLS across
 * every tenant-scoped table (M5-002 through M5-018) are done; this row
 * itself is never RLS-protected — it *is* the tenant boundary other
 * tables' policies reference, not data scoped to one.
 *
 * `agentRunStepBudgetOverride`/`agentRunDurationBudgetMsOverride`
 * (M5-021) are Section 20 M5's own "tenant-owned... budget
 * configuration" — the one concrete, currently-hardcoded-global value
 * among that scope line's five named configuration domains
 * (provider/policy/webhook/communication-template/budget) that had a
 * real value to override: `case-conditions.activities.ts`'s own
 * `AGENT_RUN_STEP_BUDGET`/`AGENT_RUN_DURATION_BUDGET_MS` constants,
 * identical for every tenant today. The other four were checked, not
 * assumed: `communication_templates`/`webhook_endpoints` are already
 * genuinely tenant-owned (their own `tenantId` column); the policy
 * catalog (`policy_versions`/`policy_sources`) is deliberately shared
 * infrastructure with no `tenantId` at all (Section 10's own
 * jurisdiction-scoped model, not a gap); the provider registry has
 * nothing to differentiate per tenant since every capability only ever
 * has a `SIMULATOR` adapter today. Null means "use the platform
 * default" — the same honest-null pattern this codebase already uses
 * for every other not-yet-driven optional field.
 */
@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'integer', nullable: true })
  agentRunStepBudgetOverride!: number | null;

  @Column({ type: 'integer', nullable: true })
  agentRunDurationBudgetMsOverride!: number | null;

  /** Null means cost-bearing Agent work is not authorized for this tenant. */
  @Column({ type: 'integer', nullable: true })
  agentMonthlyProviderCallLimit!: number | null;

  /** Calendar-month UTC ceiling in the configured currency's minor units. */
  @Column({ type: 'integer', nullable: true })
  agentMonthlyCostLimitMinorUnits!: number | null;

  @Column({ type: 'char', length: 3, nullable: true })
  agentBudgetCurrency!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
