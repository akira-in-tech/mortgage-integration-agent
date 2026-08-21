import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { CommunicationTemplate } from './communication-template.entity';
import {
  CommunicationClassification,
  CommunicationMessageStatus,
} from '../enums/communication.enum';

registerEnumType(CommunicationClassification, {
  name: 'CommunicationClassification',
});
registerEnumType(CommunicationMessageStatus, {
  name: 'CommunicationMessageStatus',
});

/**
 * One drafted communication (Section 9.4's `draft_information_request`).
 * `renderedContent`/`renderedContentHash` are the "exact rendered
 * content" Section 6.4 requires a human to approve for a `PROTECTED`
 * message — computed and stored at draft time, not re-derived later, so
 * an approval can bind to precisely what was reviewed
 * (`CommunicationApproval.approvedRenderedContentHash`).
 *
 * `@ObjectType()`/`@Field()` (M6-004) — this table's first GraphQL
 * exposure, backing `approveCommunicationMessage`'s own related
 * `CommunicationApproval` return type's parent; `tenantId` stays off the
 * GraphQL surface and `template` stays an id-only reference (no
 * `@ResolveField()` for the relation itself — nothing has asked to
 * traverse it from here yet), matching every other dual-decorated
 * entity's own convention.
 */
@Entity('communication_messages')
@ObjectType()
@Index('IDX_communication_messages_case', ['tenantId', 'caseId'])
export class CommunicationMessage {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Field(() => ID)
  @Column({ type: 'uuid' })
  caseId!: string;

  @Field(() => CommunicationClassification)
  @Column({ type: 'enum', enum: CommunicationClassification })
  classification!: CommunicationClassification;

  /** Empty for a clean ROUTINE classification; populated with every reason a PROTECTED one was upgraded (Section 6.4's own list). */
  @Field(() => [String])
  @Column({ type: 'jsonb' })
  classificationReasons!: string[];

  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  templateId!: string | null;

  @ManyToOne(() => CommunicationTemplate, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'templateId' })
  template?: CommunicationTemplate;

  @Field()
  @Column({ type: 'varchar', length: 50 })
  recipientRelationship!: string;

  @Field()
  @Column({ type: 'varchar', length: 50 })
  channel!: string;

  @Field()
  @Column({ type: 'varchar', length: 10 })
  locale!: string;

  @Field()
  @Column({ type: 'text' })
  renderedContent!: string;

  @Field()
  @Column({ type: 'varchar', length: 64 })
  renderedContentHash!: string;

  @Field(() => GraphQLJSON)
  @Column({ type: 'jsonb' })
  variables!: Record<string, string>;

  @Field(() => CommunicationMessageStatus)
  @Column({
    type: 'enum',
    enum: CommunicationMessageStatus,
    default: CommunicationMessageStatus.DRAFTED,
  })
  status!: CommunicationMessageStatus;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /** Set only by a successful `send_information_request` delivery — a synthetic confirmation id from `CommunicationDeliverySimulator`, not a real provider's message id (no real channel exists, Section 11/M4). */
  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  deliveryReference!: string | null;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  sentAt!: Date | null;
}
