import {
  ArrayMinSize,
  ArrayUnique,
  IsIn,
  IsInt,
  IsOptional,
  IsUrl,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OutboxEventType } from '../../database/outbox/outbox-event-types';

const KNOWN_EVENT_TYPES = Object.values(OutboxEventType);

/**
 * Mutable subscription fields only. A signing secret is deliberately absent:
 * secret rotation is a separate security-sensitive operation, never an
 * accidental side effect of editing a receiver URL or subscriptions.
 */
export class UpdateWebhookEndpointDto {
  @ApiPropertyOptional({
    description: 'Replacement HTTPS destination for future signed deliveries.',
    example: 'https://partner.example.com/webhooks/mortgage-agent-v2',
  })
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  targetUrl?: string;

  @ApiPropertyOptional({ type: [String], enum: KNOWN_EVENT_TYPES })
  @IsOptional()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(KNOWN_EVENT_TYPES, { each: true })
  eventTypes?: string[];

  @ApiPropertyOptional({ minimum: 1, maximum: 600 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  outboundRateLimitPerMinute?: number;
}
