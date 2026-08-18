import { Body, Controller, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WebhookEndpointService } from './webhook-endpoint.service';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { WebhookEndpoint } from '../database/entities/webhook-endpoint.entity';

/**
 * Section 15.1's `POST /v1/webhook-endpoints`. No auth/tenant-scoped
 * access control exists yet — the same long-standing gap `CasesController`
 * already has (Section 20 M4 scope doesn't include M5's RBAC/RLS work).
 */
@ApiTags('webhooks')
@Controller('v1/webhook-endpoints')
export class WebhookEndpointsController {
  constructor(private readonly endpointService: WebhookEndpointService) {}

  @ApiOperation({
    operationId: 'createWebhookEndpoint',
    summary:
      'Register a webhook endpoint. The returned secret is shown only here — no endpoint re-exposes it later.',
  })
  @ApiCreatedResponse({ type: WebhookEndpoint })
  @Post()
  async create(
    @Body() dto: CreateWebhookEndpointDto,
  ): Promise<WebhookEndpoint> {
    return this.endpointService.create(dto);
  }
}
