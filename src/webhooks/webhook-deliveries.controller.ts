import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookDelivery } from '../database/entities/webhook-delivery.entity';

/** Section 15.1's `GET /v1/webhook-deliveries/{deliveryId}` — the same id sent as every attempt's `X-Webhook-Id` header. */
@ApiTags('webhooks')
@Controller('v1/webhook-deliveries')
export class WebhookDeliveriesController {
  constructor(private readonly deliveryService: WebhookDeliveryService) {}

  @ApiOperation({
    operationId: 'getWebhookDelivery',
    summary: 'Get one webhook delivery and its full attempt history',
  })
  @ApiParam({ name: 'deliveryId', format: 'uuid' })
  @ApiOkResponse({ type: WebhookDelivery })
  @ApiNotFoundResponse({ description: 'No delivery with this id.' })
  @Get(':deliveryId')
  async get(
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
  ): Promise<WebhookDelivery> {
    return this.deliveryService.findByIdOrFail(deliveryId);
  }
}
