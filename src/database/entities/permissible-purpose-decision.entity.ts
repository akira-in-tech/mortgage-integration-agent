import {
  Column,
  Check,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProviderCapabilityStatus } from '../enums/provider-platform.enum';

export enum PermissiblePurposeDecisionStatus {
  AUTHORIZED = 'AUTHORIZED',
  DENIED = 'DENIED',
}

/**
 * Consumer-report access is authorized per borrower transaction, never by a
 * tenant-wide switch. Simulator decisions remain explicitly synthetic and
 * cannot be reused by a sandbox or production adapter.
 */
@Entity('permissible_purpose_decisions')
@Index('IDX_permissible_purpose_decisions_case', ['tenantId', 'caseId'])
@Check(
  'CHK_permissible_purpose_decision',
  `"decision" IN ('AUTHORIZED','DENIED')`,
)
export class PermissiblePurposeDecision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  caseId!: string;

  @Column({ type: 'varchar', length: 200 })
  borrowerSubjectId!: string;

  @Column({
    type: 'enum',
    enum: ProviderCapabilityStatus,
    // This table intentionally shares the canonical capability enum created
    // for provider grants. Naming it explicitly prevents synchronize/OpenAPI
    // generation from trying to rename and replace a still-referenced type.
    enumName: 'provider_authorization_grants_capability_enum',
  })
  capability!: ProviderCapabilityStatus;

  @Column({ type: 'varchar', length: 100 })
  purposeCode!: string;

  @Column({ type: 'jsonb' })
  permittedDataClasses!: string[];

  @Column({ type: 'varchar', length: 30 })
  decision!: PermissiblePurposeDecisionStatus;

  @Column({ type: 'varchar', length: 100 })
  basisCode!: string;

  @Column({ type: 'varchar', length: 200 })
  decidedBy!: string;

  @Column({ type: 'boolean', default: false })
  syntheticOnly!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  decidedAt!: Date;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
