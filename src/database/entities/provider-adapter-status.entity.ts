import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import {
  ProviderCapabilityStatus,
  ProviderAdapterState,
} from '../enums/provider-platform.enum';

/**
 * Section 11.4's own explicit standalone requirement: "a kill switch can
 * suspend a provider or capability without redeploying the application."
 * Deliberately kept separate from the full `ProviderPromotionManifest`/
 * `ProviderCertificationRecord`/`ProviderApprovalRecord`/`ProviderActivation`
 * chain (M4-007, `ProviderPromotionService`) rather than merged into it:
 * this is a single-actor emergency stop with no dual control, the
 * governed chain is the opposite (default-deny, dual-control promotion).
 * `dispatchProviderRequest` checks both — a provider can be promoted
 * (`ProviderActivation.state = ACTIVE`) and still be kill-switched off;
 * for `SIMULATOR` mode (this table's own original scope) the promotion
 * chain is never consulted at all, so this table's default-ACTIVE
 * behavior is unchanged from M4-006. The kill switch itself is real and
 * useful today regardless: right now, nothing in this codebase can stop
 * `ProviderRegistryService.resolve()` from keeping returning a
 * misbehaving adapter short of a redeploy.
 *
 * NOT RLS-protected, deliberately — matches `tenants`/the policy catalog's
 * own precedent (M5-021's investigation): `ProviderRegistryService`
 * itself registers exactly one adapter per `{capability, mode}` globally,
 * shared identically across every tenant, so there is no tenant dimension
 * to scope this to.
 *
 * No row for a `{providerId, capability, mode}` tuple means ACTIVE (the
 * implicit default, matching `Tenant.agentRunStepBudgetOverride`'s own
 * null-means-default pattern) — a row only exists once an operator has
 * explicitly changed a tuple's state at least once. This table holds only
 * the *current* state, not a full history of past disable/enable cycles
 * (Known gap, same simplicity tradeoff M5-021 made for budget overrides).
 */
@Entity('provider_adapter_status')
@Unique('UQ_provider_adapter_status_tuple', [
  'providerId',
  'capability',
  'mode',
])
export class ProviderAdapterStatus {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  providerId!: string;

  @Column({ type: 'enum', enum: ProviderCapabilityStatus })
  capability!: ProviderCapabilityStatus;

  /** Plain varchar, not a persisted enum — `ProviderMode` has never been persisted as a DB enum anywhere in this codebase (only `SIMULATOR` is ever real), matching that existing precedent rather than inventing a new one here. */
  @Column({ type: 'varchar', length: 30 })
  mode!: string;

  @Column({
    type: 'enum',
    enum: ProviderAdapterState,
    default: ProviderAdapterState.ACTIVE,
  })
  state!: ProviderAdapterState;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  reason!: string | null;

  @Column({ type: 'varchar', length: 200 })
  updatedBy!: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
