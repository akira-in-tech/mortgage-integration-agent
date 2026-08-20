import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ProviderCapabilityStatus } from '../enums/provider-platform.enum';

/**
 * Section 11.4's `ProviderPromotionManifest`, trimmed to the fields this
 * codebase can honestly back — skips charter fields that reference
 * governance subsystems that don't exist here (`consentAndPurposePolicyId`,
 * `timeoutPolicyId`, `retryPolicyId`, `rateAndCostBudgetId`), the same
 * scoping precedent `ProviderAdapterStatus`'s own comment (M4-006) already
 * set for this exact chain.
 *
 * NOT tenant-scoped, NOT RLS-protected — matches `ProviderAdapterStatus`'s
 * own precedent exactly: `ProviderRegistryService.resolve()` registers one
 * adapter per `{capability, mode}` globally, shared identically across
 * every tenant, so there is no tenant dimension for a promotion of that
 * same global registration to be scoped to either.
 *
 * Immutable — one row per proposal. `version` increments per
 * `{providerId, capability, mode}` tuple so a re-proposal (new adapter
 * code, corrected allowlist, etc.) is a new row, never an update to an
 * existing one — the same "never mutate a released row" discipline
 * `PolicyVersion` and `PolicyTransitionApproval` already follow.
 */
@Entity('provider_promotion_manifests')
@Index('IDX_provider_promotion_manifests_tuple', [
  'providerId',
  'capability',
  'mode',
])
export class ProviderPromotionManifest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  providerId!: string;

  @Column({ type: 'enum', enum: ProviderCapabilityStatus })
  capability!: ProviderCapabilityStatus;

  /** Plain varchar, not a persisted enum — matches `ProviderAdapterStatus.mode`'s own precedent: `ProviderMode` has never been persisted as a DB enum anywhere in this codebase. */
  @Column({ type: 'varchar', length: 30 })
  mode!: string;

  @Column({ type: 'int' })
  version!: number;

  @Column({ type: 'varchar', length: 100 })
  adapterVersion!: string;

  @Column({ type: 'jsonb' })
  endpointAllowlist!: string[];

  @Column({ type: 'jsonb' })
  dataClassifications!: string[];

  /** `computeDigest()` over `{providerId, capability, mode, adapterVersion, endpointAllowlist, dataClassifications}` — a plain content fingerprint (see policy-digest.ts's own comment), not an authenticated signature. */
  @Column({ type: 'varchar', length: 64 })
  contentHash!: string;

  @Column({ type: 'varchar', length: 200 })
  proposedBy!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  proposedAt!: Date;

  @Column({ type: 'timestamptz' })
  validFrom!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  validUntil!: Date | null;
}
