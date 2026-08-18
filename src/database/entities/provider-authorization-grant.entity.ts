import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ProviderCapabilityStatus } from '../enums/provider-platform.enum';

/**
 * Section 11.5's `ProviderAuthorizationGrant`: "revalidates the
 * authorization grant immediately before every external request." Real
 * and genuinely enforced (`ProviderAuthorizationService.revalidate()`
 * fails closed on a mismatched, expired, or revoked grant) — but
 * `consentRecordIds` stays always-empty and `permissiblePurposeDecisionId`
 * always-null, because no consent-record or permissible-purpose subsystem
 * exists yet (the same honest-null pattern `EvaluationInputManifest`
 * already established, M3-014). `permittedFields` stays always-null for
 * the same reason `EvaluationInputManifest` never claims field-level
 * granularity: no capability contract in this codebase exposes
 * field-addressable data yet, so only the coarser
 * `permittedDataClasses` boundary is ever real.
 */
@Entity('provider_authorization_grants')
@Index('IDX_provider_authorization_grants_case', ['tenantId', 'caseId'])
export class ProviderAuthorizationGrant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  caseId!: string;

  @Column({ type: 'varchar', length: 200 })
  borrowerSubjectId!: string;

  @Column({ type: 'varchar', length: 100 })
  providerId!: string;

  @Column({ type: 'enum', enum: ProviderCapabilityStatus })
  capability!: ProviderCapabilityStatus;

  @Column({ type: 'varchar', length: 100 })
  purposeCode!: string;

  @Column({ type: 'jsonb' })
  permittedDataClasses!: string[];

  @Column({ type: 'jsonb', nullable: true })
  permittedFields!: string[] | null;

  /** No consent-record subsystem exists yet — always empty. */
  @Column({ type: 'jsonb' })
  consentRecordIds!: string[];

  /** No permissible-purpose decision subsystem exists yet — always null. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  permissiblePurposeDecisionId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  issuedAt!: Date;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
