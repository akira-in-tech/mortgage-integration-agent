import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { WebhookEndpointService } from './webhook-endpoint.service';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { WebhookEndpoint } from '../database/entities/webhook-endpoint.entity';
import { TenantAuthGuard } from '../auth/tenant-auth.guard';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { AuthContext } from '../auth/auth-context';
import { AuditEventService } from '../audit/audit-event.service';
import { UpdateWebhookEndpointDto } from './dto/update-webhook-endpoint.dto';
import {
  CreatedWebhookEndpointResponseDto,
  WebhookEndpointResponseDto,
} from './dto/webhook-endpoint-response.dto';

/**
 * Section 15.1's `POST /v1/webhook-endpoints`. `TenantAuthGuard` (Section
 * 20 M5) resolves the tenant from the caller's own bearer credential — a
 * caller cannot register an endpoint under a different tenant than the
 * one its own credential belongs to, closing what would otherwise be a
 * real cross-tenant vulnerability (registering an endpoint under a
 * spoofed tenantId would have let a caller receive another tenant's
 * webhook events).
 */
@ApiTags('webhooks')
@ApiBearerAuth()
@UseGuards(TenantAuthGuard)
@Controller('v1/webhook-endpoints')
export class WebhookEndpointsController {
  constructor(
    private readonly endpointService: WebhookEndpointService,
    private readonly auditEventService: AuditEventService,
  ) {}

  @ApiOperation({
    operationId: 'createWebhookEndpoint',
    summary:
      'Register a webhook endpoint. The returned secret is shown only here — no endpoint re-exposes it later.',
  })
  @ApiCreatedResponse({ type: CreatedWebhookEndpointResponseDto })
  @ApiBadRequestResponse({
    description:
      'targetUrl is malformed, uses a non-http(s) scheme, or resolves to a private/reserved address (SSRF guard, Section 16.4).',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid API credentials.',
  })
  @Post()
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: CreateWebhookEndpointDto,
  ): Promise<CreatedWebhookEndpointResponseDto> {
    const endpoint = await this.endpointService.create(auth.tenantId, dto);
    await this.auditEventService.record({
      tenantId: auth.tenantId,
      actorId: auth.actorId,
      action: 'WEBHOOK_ENDPOINT_CREATED',
      resourceType: 'webhook_endpoint',
      resourceId: endpoint.id,
      correlationId: auth.correlationId,
      metadata: { targetUrl: dto.targetUrl, eventTypes: dto.eventTypes },
    });
    return this.toCreatedResponse(endpoint);
  }

  @ApiOperation({
    operationId: 'listWebhookEndpoints',
    summary:
      "List this tenant's webhook subscriptions without exposing signing secrets.",
  })
  @ApiOkResponse({ type: WebhookEndpointResponseDto, isArray: true })
  @Get()
  async list(
    @CurrentAuth() auth: AuthContext,
  ): Promise<WebhookEndpointResponseDto[]> {
    const endpoints = await this.endpointService.list(auth.tenantId);
    return endpoints.map((endpoint) => this.toResponse(endpoint));
  }

  @ApiOperation({
    operationId: 'updateWebhookEndpoint',
    summary:
      'Update a webhook destination or event subscriptions for future deliveries.',
  })
  @ApiOkResponse({ type: WebhookEndpointResponseDto })
  @Patch(':endpointId')
  async update(
    @CurrentAuth() auth: AuthContext,
    @Param('endpointId') endpointId: string,
    @Body() dto: UpdateWebhookEndpointDto,
  ): Promise<WebhookEndpointResponseDto> {
    const endpoint = await this.endpointService.update(
      auth.tenantId,
      endpointId,
      dto,
    );
    await this.auditEventService.record({
      tenantId: auth.tenantId,
      actorId: auth.actorId,
      action: 'WEBHOOK_ENDPOINT_UPDATED',
      resourceType: 'webhook_endpoint',
      resourceId: endpoint.id,
      correlationId: auth.correlationId,
      metadata: {
        targetUrl: endpoint.targetUrl,
        eventTypes: endpoint.eventTypes,
      },
    });
    return this.toResponse(endpoint);
  }

  @ApiOperation({
    operationId: 'deleteWebhookEndpoint',
    summary:
      'Revoke a webhook subscription while preserving its signed delivery history.',
  })
  @ApiNoContentResponse({
    description:
      'The endpoint is disabled; past delivery history remains available.',
  })
  @HttpCode(204)
  @Delete(':endpointId')
  async remove(
    @CurrentAuth() auth: AuthContext,
    @Param('endpointId') endpointId: string,
  ): Promise<void> {
    const endpoint = await this.endpointService.disable(
      auth.tenantId,
      endpointId,
    );
    await this.auditEventService.record({
      tenantId: auth.tenantId,
      actorId: auth.actorId,
      action: 'WEBHOOK_ENDPOINT_DISABLED',
      resourceType: 'webhook_endpoint',
      resourceId: endpoint.id,
      correlationId: auth.correlationId,
    });
  }

  private toResponse(endpoint: WebhookEndpoint): WebhookEndpointResponseDto {
    return {
      id: endpoint.id,
      tenantId: endpoint.tenantId,
      targetUrl: endpoint.targetUrl,
      eventTypes: endpoint.eventTypes,
      status: endpoint.status,
      outboundRateLimitPerMinute: endpoint.outboundRateLimitPerMinute,
      createdAt: endpoint.createdAt,
    };
  }

  private toCreatedResponse(
    endpoint: WebhookEndpoint,
  ): CreatedWebhookEndpointResponseDto {
    return { ...this.toResponse(endpoint), secret: endpoint.secret };
  }
}
