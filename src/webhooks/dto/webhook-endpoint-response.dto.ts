import { ApiProperty } from '@nestjs/swagger';
import { WebhookEndpointStatus } from '../../database/enums/webhook.enum';

/**
 * Safe endpoint representation for every read and mutation after creation.
 * The HMAC secret is an enrollment credential, not routine operational data;
 * exposing it beyond the one creation response would turn a harmless list
 * request into a credential-disclosure path.
 */
export class WebhookEndpointResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty()
  targetUrl!: string;

  @ApiProperty({ type: [String] })
  eventTypes!: string[];

  @ApiProperty({ enum: WebhookEndpointStatus })
  status!: WebhookEndpointStatus;

  @ApiProperty({ minimum: 1, maximum: 600 })
  outboundRateLimitPerMinute!: number;

  @ApiProperty()
  createdAt!: Date;
}

/** The enrollment secret is returned exactly once, in the create response. */
export class CreatedWebhookEndpointResponseDto extends WebhookEndpointResponseDto {
  @ApiProperty({
    description:
      'HMAC signing secret. Store it now: future reads and mutations never return it.',
  })
  secret!: string;
}
