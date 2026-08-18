import { ArrayMinSize, ArrayUnique, IsIn, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OutboxEventType } from '../../database/outbox/outbox-event-types';

const KNOWN_EVENT_TYPES = Object.values(OutboxEventType);

/**
 * No `tenantId` field (Section 20 M5, same reasoning as `CreateCaseDto`):
 * the tenant is always the one `ApiKeyGuard` resolved from the caller's
 * own bearer credential.
 */
export class CreateWebhookEndpointDto {
  @ApiProperty({
    description: 'Where signed delivery attempts are POSTed.',
    example: 'https://partner.example.com/webhooks/mortgage-agent',
  })
  @IsUrl({ require_tld: false, require_protocol: true })
  targetUrl!: string;

  /** No implicit "all events" option — a caller lists exactly the event types it wants, so a future event type is never silently delivered to an endpoint that never opted into it. */
  @ApiProperty({ type: [String], enum: KNOWN_EVENT_TYPES })
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(KNOWN_EVENT_TYPES, { each: true })
  eventTypes!: string[];
}
