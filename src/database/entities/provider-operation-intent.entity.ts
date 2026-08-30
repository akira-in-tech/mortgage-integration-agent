import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import {
  ProviderCapabilityStatus,
  ProviderOperationIntentStatus,
} from '../enums/provider-platform.enum';

registerEnumType(ProviderCapabilityStatus, {
  name: 'ProviderCapabilityStatus',
});
registerEnumType(ProviderOperationIntentStatus, {
  name: 'ProviderOperationIntentStatus',
});

/**
 * Section 11.5's `ProviderOperationIntent`: "The platform persists the
 * operation intent before dispatch." One row per provider call attempt —
 * a Temporal retry of the enclosing activity prepares a new intent rather
 * than reusing the failed one, so the state history of every real attempt
 * stays intact (Section 11.5: "a stable platform idempotency key and
 * request fingerprint are reused only for the same logical intent").
 * `@ObjectType()`/`@Field()` (M5-031) — this table's first real read
 * surface of any kind.
 */
@Entity('provider_operation_intents')
@ObjectType()
@Index('IDX_provider_operation_intents_case', ['tenantId', 'caseId'])
@Index(
  'UQ_provider_operation_intents_logical_effect',
  ['tenantId', 'providerId', 'capability', 'logicalOperationKey'],
  { unique: true },
)
export class ProviderOperationIntent {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Field(() => ID)
  @Column({ type: 'uuid' })
  caseId!: string;

  @Field()
  @Column({ type: 'varchar', length: 100 })
  providerId!: string;

  @Field(() => ProviderCapabilityStatus)
  @Column({ type: 'enum', enum: ProviderCapabilityStatus })
  capability!: ProviderCapabilityStatus;

  @Field()
  @Column({ type: 'varchar', length: 30 })
  effectClass!: string;

  @Field()
  @Column({ type: 'varchar', length: 64 })
  requestFingerprint!: string;

  @Field()
  @Column({ type: 'varchar', length: 200 })
  idempotencyKey!: string;

  /** Stable caller-owned identity for one logical external effect across Temporal retries and process restarts. */
  @Column({ type: 'varchar', length: 200 })
  logicalOperationKey!: string;

  @Field(() => ID)
  @Column({ type: 'uuid' })
  authorizationGrantId!: string;

  /** Persisted before a successful normalized result is exposed, enabling safe replay without a second provider submission. */
  @Column({ type: 'jsonb', nullable: true })
  providerReceipt!: unknown | null;

  /** Canonical normalized result returned on a replay of an already-succeeded logical operation. */
  @Column({ type: 'jsonb', nullable: true })
  normalizedFinding!: unknown | null;

  @Field(() => ProviderOperationIntentStatus)
  @Column({
    type: 'enum',
    enum: ProviderOperationIntentStatus,
    default: ProviderOperationIntentStatus.PREPARED,
  })
  state!: ProviderOperationIntentStatus;

  /** Set only by a real, human, out-of-band manual resolution (M5-027) — an operator investigating a `RECONCILING`/`OUTCOME_UNKNOWN` intent and recording what actually happened. */
  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 200, nullable: true })
  resolvedBy!: string | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 2000, nullable: true })
  resolutionNote!: string | null;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
