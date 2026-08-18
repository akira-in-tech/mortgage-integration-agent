import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { WebhookEndpoint } from './webhook-endpoint.entity';
import { OutboxEvent } from './outbox-event.entity';
import { WebhookDeliveryStatus } from '../enums/webhook.enum';

/** One entry in `WebhookDelivery.attempts` — the real per-attempt record (Section 14.1: "signed attempt history"), not just a rolling last-attempt summary. */
export class WebhookDeliveryAttempt {
  @ApiProperty()
  attemptNumber!: number;

  @ApiProperty()
  attemptedAt!: string;

  @ApiProperty({
    description:
      'null on a network-level failure (timeout, connection refused) — no HTTP response was ever received.',
  })
  httpStatusCode!: number | null;

  @ApiProperty({ enum: ['SUCCEEDED', 'FAILED'] })
  outcome!: 'SUCCEEDED' | 'FAILED';

  @ApiProperty({ required: false })
  errorMessage?: string;
}

/**
 * Section 14.1's `webhook_deliveries`: "Signed attempt history and replay
 * state." Section 15.1's `GET /v1/webhook-deliveries/{deliveryId}` reads
 * this row by its own `id` — the same id sent as the `X-Webhook-Id` header
 * on every attempt (Section 15.3: "stable event identifiers across
 * retries"), letting a receiver dedupe a retried delivery it already
 * processed. One row per (outbox event, webhook endpoint) pair — a
 * logical delivery, not a single attempt; `attempts` accumulates every
 * physical attempt against it.
 */
@Entity('webhook_deliveries')
@Index('IDX_webhook_deliveries_tenant', ['tenantId'])
@Index('IDX_webhook_deliveries_dispatch_due', ['status', 'nextAttemptAt'])
export class WebhookDelivery {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  webhookEndpointId!: string;

  @ManyToOne(() => WebhookEndpoint, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'webhookEndpointId' })
  webhookEndpoint?: WebhookEndpoint;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  outboxEventId!: string;

  @ManyToOne(() => OutboxEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outboxEventId' })
  outboxEvent?: OutboxEvent;

  /** Denormalized from the outbox event, so this row is filterable/displayable without a join. */
  @ApiProperty()
  @Column({ type: 'varchar', length: 100 })
  eventType!: string;

  @ApiProperty({ enum: WebhookDeliveryStatus })
  @Column({
    type: 'enum',
    enum: WebhookDeliveryStatus,
    default: WebhookDeliveryStatus.PENDING,
  })
  status!: WebhookDeliveryStatus;

  @ApiProperty({ type: [WebhookDeliveryAttempt] })
  @Column({ type: 'jsonb', default: () => "'[]'" })
  attempts!: WebhookDeliveryAttempt[];

  /** Null once `status` is `SUCCEEDED` or `FAILED_FINAL` — nothing left to (re)schedule. */
  @ApiProperty({ required: false })
  @Column({ type: 'timestamptz', nullable: true })
  nextAttemptAt!: Date | null;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
