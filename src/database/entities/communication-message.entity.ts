import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { CommunicationTemplate } from './communication-template.entity';
import {
  CommunicationClassification,
  CommunicationMessageStatus,
} from '../enums/communication.enum';

/**
 * One drafted communication (Section 9.4's `draft_information_request`).
 * `renderedContent`/`renderedContentHash` are the "exact rendered
 * content" Section 6.4 requires a human to approve for a `PROTECTED`
 * message — computed and stored at draft time, not re-derived later, so
 * an approval can bind to precisely what was reviewed
 * (`CommunicationApproval.approvedRenderedContentHash`).
 */
@Entity('communication_messages')
@Index('IDX_communication_messages_case', ['tenantId', 'caseId'])
export class CommunicationMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  caseId!: string;

  @Column({ type: 'enum', enum: CommunicationClassification })
  classification!: CommunicationClassification;

  /** Empty for a clean ROUTINE classification; populated with every reason a PROTECTED one was upgraded (Section 6.4's own list). */
  @Column({ type: 'jsonb' })
  classificationReasons!: string[];

  @Column({ type: 'uuid', nullable: true })
  templateId!: string | null;

  @ManyToOne(() => CommunicationTemplate, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'templateId' })
  template?: CommunicationTemplate;

  @Column({ type: 'varchar', length: 50 })
  recipientRelationship!: string;

  @Column({ type: 'varchar', length: 50 })
  channel!: string;

  @Column({ type: 'varchar', length: 10 })
  locale!: string;

  @Column({ type: 'jsonb' })
  variables!: Record<string, string>;

  @Column({ type: 'text' })
  renderedContent!: string;

  @Column({ type: 'varchar', length: 64 })
  renderedContentHash!: string;

  @Column({
    type: 'enum',
    enum: CommunicationMessageStatus,
    default: CommunicationMessageStatus.DRAFTED,
  })
  status!: CommunicationMessageStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /** Set only by a successful `send_information_request` delivery — a synthetic confirmation id from `CommunicationDeliverySimulator`, not a real provider's message id (no real channel exists, Section 11/M4). */
  @Column({ type: 'varchar', length: 100, nullable: true })
  deliveryReference!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt!: Date | null;
}
