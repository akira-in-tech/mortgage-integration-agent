import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ObjectType, Field, ID } from '@nestjs/graphql';

/**
 * Section 14.1's `consent_records`: "Purpose, scope, policy version,
 * grant, expiration, and revocation evidence." One record per case, not
 * per purpose — a deliberate simplification against the charter's fuller
 * per-purpose model, matched to the single scalar `consentStatus` field
 * `LendingOperationsAgentState` (Section 9.3) actually consumes today;
 * `purpose`/`scope` are descriptive, not yet a real per-purpose grant
 * boundary. `policyVersionId` (the charter's "policy version" dimension)
 * is not modeled — no policy-version-scoped consent requirement exists
 * yet to bind it to (Known gap, M5-005).
 *
 * `getStatus()`'s (`ConsentService`) ordering by `grantedAt` descending
 * means a case can have more than one row over time (e.g. a REVOKE
 * followed by a fresh GRANT) without needing to delete or overwrite the
 * revoked one — `revokedAt`/`revocationReason` on the OLD row stay the
 * real, permanent record of what happened and why, matching the
 * append-only reasoning `ConditionTransition` already uses for condition
 * history.
 *
 * `@ObjectType()`/`@Field()` (M6-003) — this table's first GraphQL
 * exposure, backing `submitConsentAction`'s mutation return type;
 * `tenantId` stays off the GraphQL surface, matching every other
 * dual-decorated entity's own convention.
 */
@Entity('consent_records')
@ObjectType()
@Index('IDX_consent_records_tenant_case', ['tenantId', 'caseId'])
export class ConsentRecord {
  @ApiProperty({ format: 'uuid' })
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  @Field(() => ID)
  @Column({ type: 'uuid' })
  caseId!: string;

  @ApiProperty()
  @Field()
  @Column({ type: 'varchar', length: 100 })
  purpose!: string;

  @ApiProperty()
  @Field()
  @Column({ type: 'varchar', length: 100 })
  scope!: string;

  @ApiProperty()
  @Field()
  @Column({ type: 'timestamptz' })
  grantedAt!: Date;

  /** Null means no fixed expiration — most consent this codebase issues today, since case processing itself is the bounding event. */
  @ApiPropertyOptional()
  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @ApiPropertyOptional()
  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @ApiPropertyOptional()
  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 2000, nullable: true })
  revocationReason!: string | null;

  @ApiProperty()
  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
