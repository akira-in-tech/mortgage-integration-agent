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
 * `consentRecordIds` now binds the grant to a purpose/data-class-scoped
 * consent, and credit-report grants reference a transaction-specific
 * permissible-purpose decision. `permittedFields` is real as of M5-028:
 * `dispatch-provider-request.ts` filters a provider's normalized finding
 * down to exactly these top-level keys when a caller sets them
 * (`ProviderAuthorizationService.issue()`'s own `permittedFields` input) —
 * null/unset means unfiltered, the same as before this field was wired
 * up. No real Agent-tool/activity caller requests field-scoping today
 * (every current caller wants the whole finding), so the mechanism is
 * real but currently always exercised in its no-op form — the honest,
 * structural-capability parity with `assertNotStructurallyExcluded()`
 * (M5-026): both are real gates a real caller could trigger, neither has
 * one yet.
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

  /** Every dispatch grant carries at least one purpose-bound consent record. */
  @Column({ type: 'jsonb' })
  consentRecordIds!: string[];

  /** Required for consumer-report capabilities; otherwise null. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  permissiblePurposeDecisionId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  issuedAt!: Date;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
