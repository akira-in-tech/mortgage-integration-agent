import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { CommunicationMessage } from './communication-message.entity';

/**
 * Section 6.4: "a human reviewer must approve the exact rendered
 * content, recipient, channel, locale, attachments, and authoritative
 * sender before platform delivery." `approvedRenderedContentHash` binds
 * this approval to one specific rendered message — if the message's own
 * `renderedContentHash` ever differed from what's recorded here, the
 * approval would not apply (this codebase has no path that could change
 * a `CommunicationMessage` after creation, so that mismatch cannot
 * currently occur, but the binding is still recorded explicitly rather
 * than assumed).
 */
@Entity('communication_approvals')
@Index('IDX_communication_approvals_message', ['communicationMessageId'])
export class CommunicationApproval {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  communicationMessageId!: string;

  @ManyToOne(() => CommunicationMessage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'communicationMessageId' })
  communicationMessage?: CommunicationMessage;

  @Column({ type: 'varchar', length: 200 })
  actorId!: string;

  @Column({ type: 'varchar', length: 64 })
  approvedRenderedContentHash!: string;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  approvedAt!: Date;
}
