import {
  ArrayMinSize,
  ArrayUnique,
  IsIn,
  IsUUID,
  IsUrl,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OutboxEventType } from '../../database/outbox/outbox-event-types';

const KNOWN_EVENT_TYPES = Object.values(OutboxEventType);

export class CreateWebhookEndpointDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  tenantId!: string;

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
