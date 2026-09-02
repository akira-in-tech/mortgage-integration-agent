import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { WebhookEndpointStatus } from '../enums/webhook.enum';

/**
 * Section 14.1's `webhook_endpoints`: "Destination, secret reference,
 * subscriptions, and state." `secret` is the real HMAC signing secret
 * itself, not a reference to one in an external secrets manager — this
 * codebase has no such manager (the same honest scope
 * `OUTBOX_SIGNING_SECRET` already has as a plain env var). Returned to
 * the caller once, at creation (`WebhooksController.createEndpoint`) —
 * never re-exposed on a later read.
 */
@Entity('webhook_endpoints')
@Index('IDX_webhook_endpoints_tenant', ['tenantId'])
export class WebhookEndpoint {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ type: 'uuid' })
  tenantId!: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 2000 })
  targetUrl!: string;

  @ApiProperty({
    description:
      'The HMAC signing secret for this endpoint. Only ever returned here, at creation — a later read of this row (there is none yet) must not re-expose it.',
  })
  @Column({ type: 'varchar', length: 64 })
  secret!: string;

  /** Section 14.1's "subscriptions" — the `OutboxEventType` members this endpoint receives. No implicit "all events" wildcard: a future event type is never silently delivered to an endpoint that never opted into it. */
  @ApiProperty({ type: [String] })
  @Column({ type: 'jsonb' })
  eventTypes!: string[];

  @ApiProperty({ enum: WebhookEndpointStatus })
  @Column({
    type: 'enum',
    enum: WebhookEndpointStatus,
    default: WebhookEndpointStatus.ACTIVE,
  })
  status!: WebhookEndpointStatus;

  /** Durable per-endpoint ceiling for outbound attempts. */
  @ApiProperty({ minimum: 1, maximum: 600 })
  @Column({ type: 'int', default: 60 })
  outboundRateLimitPerMinute!: number;

  @Column({ type: 'timestamptz', nullable: true })
  rateWindowStartedAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  rateWindowAttempts!: number;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
