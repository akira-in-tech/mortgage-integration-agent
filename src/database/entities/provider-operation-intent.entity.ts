import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import {
  ProviderCapabilityStatus,
  ProviderOperationIntentStatus,
} from '../enums/provider-platform.enum';

/**
 * Section 11.5's `ProviderOperationIntent`: "The platform persists the
 * operation intent before dispatch." One row per provider call attempt —
 * a Temporal retry of the enclosing activity prepares a new intent rather
 * than reusing the failed one, so the state history of every real attempt
 * stays intact (Section 11.5: "a stable platform idempotency key and
 * request fingerprint are reused only for the same logical intent").
 */
@Entity('provider_operation_intents')
@Index('IDX_provider_operation_intents_case', ['tenantId', 'caseId'])
export class ProviderOperationIntent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  caseId!: string;

  @Column({ type: 'varchar', length: 100 })
  providerId!: string;

  @Column({ type: 'enum', enum: ProviderCapabilityStatus })
  capability!: ProviderCapabilityStatus;

  @Column({ type: 'varchar', length: 30 })
  effectClass!: string;

  @Column({ type: 'varchar', length: 64 })
  requestFingerprint!: string;

  @Column({ type: 'varchar', length: 200 })
  idempotencyKey!: string;

  @Column({ type: 'uuid' })
  authorizationGrantId!: string;

  @Column({
    type: 'enum',
    enum: ProviderOperationIntentStatus,
    default: ProviderOperationIntentStatus.PREPARED,
  })
  state!: ProviderOperationIntentStatus;

  /** Set only by a real, human, out-of-band manual resolution (M5-027) — an operator investigating a `RECONCILING`/`OUTCOME_UNKNOWN` intent and recording what actually happened. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  resolvedBy!: string | null;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  resolutionNote!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
