import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { WebhookEndpointService } from './webhook-endpoint.service';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { WebhookEndpoint } from '../database/entities/webhook-endpoint.entity';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { AuthTenantId } from '../auth/auth-tenant-id.decorator';

/**
 * Section 15.1's `POST /v1/webhook-endpoints`. `ApiKeyGuard` (Section 20
 * M5) resolves the tenant from the caller's own bearer credential — a
 * caller cannot register an endpoint under a different tenant than the
 * one its own credential belongs to, closing what would otherwise be a
 * real cross-tenant vulnerability (registering an endpoint under a
 * spoofed tenantId would have let a caller receive another tenant's
 * webhook events).
 */
@ApiTags('webhooks')
@ApiBearerAuth()
@UseGuards(ApiKeyGuard)
@Controller('v1/webhook-endpoints')
export class WebhookEndpointsController {
  constructor(private readonly endpointService: WebhookEndpointService) {}

  @ApiOperation({
    operationId: 'createWebhookEndpoint',
    summary:
      'Register a webhook endpoint. The returned secret is shown only here — no endpoint re-exposes it later.',
  })
  @ApiCreatedResponse({ type: WebhookEndpoint })
  @ApiBadRequestResponse({
    description:
      'targetUrl is malformed, uses a non-http(s) scheme, or resolves to a private/reserved address (SSRF guard, Section 16.4).',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid API credentials.',
  })
  @Post()
  async create(
    @AuthTenantId() tenantId: string,
    @Body() dto: CreateWebhookEndpointDto,
  ): Promise<WebhookEndpoint> {
    return this.endpointService.create(tenantId, dto);
  }
}
