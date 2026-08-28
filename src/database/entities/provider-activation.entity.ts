import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { ProviderActivationState } from '../enums/provider-promotion.enum';
import { ProviderCapabilityStatus } from '../enums/provider-platform.enum';

/**
 * Section 11.4's `ProviderActivation` — the real dispatch-time gate for
 * any non-SIMULATOR mode (`dispatchProviderRequest`, alongside the
 * pre-existing kill switch). One row per `{providerId, capability, mode}`
 * tuple, current-state-only (see `ProviderActivationState`'s own comment
 * for why this isn't a full history table) — updated in place by
 * `activate()`/`deactivate()`, never a fresh row per action.
 *
 * `manifestVersion` is an optimistic lock: `activate()` requires the
 * caller's expected current version (or "no row yet") to match before
 * writing, the same "expected value must match before mutating shared
 * state" discipline `StaleCaseVersionError` already enforces for case
 * updates — here guarding against two operators racing to activate two
 * different manifests for the same tuple.
 *
 * NOT tenant-scoped — same reasoning as `ProviderPromotionManifest`.
 */
@Entity('provider_activations')
@Unique('UQ_provider_activations_tuple', ['providerId', 'capability', 'mode'])
export class ProviderActivation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  providerId!: string;

  @Column({ type: 'enum', enum: ProviderCapabilityStatus })
  capability!: ProviderCapabilityStatus;

  @Column({ type: 'varchar', length: 30 })
  mode!: string;

  @Column({ type: 'uuid' })
  manifestId!: string;

  /** The activated manifest's own `version` — the optimistic-lock value future `activate()` calls compare against. */
  @Column({ type: 'int' })
  manifestVersion!: number;

  @Column({
    type: 'enum',
    enum: ProviderActivationState,
    default: ProviderActivationState.ACTIVE,
  })
  state!: ProviderActivationState;

  @Column({ type: 'varchar', length: 200 })
  activatedBy!: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  activatedAt!: Date;
}
