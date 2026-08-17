import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { CommunicationTemplateStatus } from '../enums/communication.enum';

/**
 * Section 6.4: "a version-pinned tenant-approved template" is the only
 * thing a routine operational communication may be built from. Immutable
 * once approved — a content change is a new version, never an in-place
 * edit, the same discipline `PolicyVersion` already uses for the same
 * reason (Section 10.2/10.8).
 */
@Entity('communication_templates')
@Unique('UQ_communication_templates_tenant_key_version', [
  'tenantId',
  'templateKey',
  'version',
])
export class CommunicationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  /** e.g. "REQUEST_INCOME_EVIDENCE". */
  @Column({ type: 'varchar', length: 100 })
  templateKey!: string;

  @Column({ type: 'varchar', length: 50 })
  version!: string;

  @Column({ type: 'varchar', length: 50 })
  channel!: string;

  @Column({ type: 'varchar', length: 10 })
  locale!: string;

  /** Section 6.4: "an allowlisted recipient relationship" — e.g. "BORROWER", "THIRD_PARTY". */
  @Column({ type: 'varchar', length: 50 })
  recipientRelationship!: string;

  /** `{{variableName}}` placeholders, substituted at render time — never free-form text appended around it. */
  @Column({ type: 'text' })
  bodyTemplate!: string;

  @Column({ type: 'jsonb' })
  allowedVariables!: string[];

  @Column({ type: 'boolean', default: false })
  attachmentsAllowed!: boolean;

  @Column({
    type: 'enum',
    enum: CommunicationTemplateStatus,
    default: CommunicationTemplateStatus.DRAFT,
  })
  status!: CommunicationTemplateStatus;

  @Column({ type: 'varchar', length: 200, nullable: true })
  approvedBy!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
