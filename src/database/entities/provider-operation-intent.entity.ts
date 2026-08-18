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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
