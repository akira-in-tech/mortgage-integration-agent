import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
 */
@Entity('consent_records')
@Index('IDX_consent_records_tenant_case', ['tenantId', 'caseId'])
export class ConsentRecord {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  caseId!: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 100 })
  purpose!: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 100 })
  scope!: string;

  @ApiProperty()
  @Column({ type: 'timestamptz' })
  grantedAt!: Date;

  /** Null means no fixed expiration — most consent this codebase issues today, since case processing itself is the bounding event. */
  @ApiPropertyOptional()
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @ApiPropertyOptional()
  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 2000, nullable: true })
  revocationReason!: string | null;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
