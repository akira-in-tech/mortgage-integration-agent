import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookDelivery } from '../database/entities/webhook-delivery.entity';
import { TenantAuthGuard } from '../auth/tenant-auth.guard';
import { AuthTenantId } from '../auth/auth-tenant-id.decorator';

/** Section 15.1's `GET /v1/webhook-deliveries/{deliveryId}` — the same id sent as every attempt's `X-Webhook-Id` header. */
@ApiTags('webhooks')
@ApiBearerAuth()
@UseGuards(TenantAuthGuard)
@Controller('v1/webhook-deliveries')
export class WebhookDeliveriesController {
  constructor(private readonly deliveryService: WebhookDeliveryService) {}

  @ApiOperation({
    operationId: 'getWebhookDelivery',
    summary: 'Get one webhook delivery and its full attempt history',
  })
  @ApiParam({ name: 'deliveryId', format: 'uuid' })
  @ApiOkResponse({ type: WebhookDelivery })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid API credentials.',
  })
  @ApiNotFoundResponse({
    description: 'No delivery with this id owned by the authenticated tenant.',
  })
  @Get(':deliveryId')
  async get(
    @AuthTenantId() tenantId: string,
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
  ): Promise<WebhookDelivery> {
    return this.deliveryService.findByIdOrFail(tenantId, deliveryId);
  }
}
