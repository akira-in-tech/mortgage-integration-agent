import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CommunicationMessageService } from './communication-message.service';
import { CommunicationApprovalService } from './communication-approval.service';
import {
  CommunicationDeliveryService,
  DeliverCommunicationResult,
} from './communication-delivery.service';
import { CommunicationMessage } from '../database/entities/communication-message.entity';
import { CommunicationApproval } from '../database/entities/communication-approval.entity';
import { ApproveCommunicationMessageDto } from './dto/approve-communication-message.dto';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { RoleGuard } from '../auth/role.guard';
import { RequireRole } from '../auth/require-role.decorator';
import { AuthTenantId } from '../auth/auth-tenant-id.decorator';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { AuthContext } from '../auth/auth-context';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { AuditEventService } from '../audit/audit-event.service';

/**
 * Closes the "no real REST caller" gap M5-018's own dev log named for
 * `CommunicationApprovalService.approve()`, and the matching gap for
 * `CommunicationDeliveryService.deliver()` — Section 9.4's
 * `send_information_request` actual sending mechanism (M5-022). Nested
 * under a case's own path, matching `CasesController`'s convention.
 *
 * `approve` is REVIEWER-gated (Section 6.4: "a human reviewer must
 * approve the exact rendered content"), matching `submitReview`'s own
 * established RBAC pattern (M5-017). `send` is deliberately NOT
 * REVIEWER-gated: `deliver()`'s own state-based readiness check already
 * fails closed for any `PROTECTED` message that isn't `APPROVED`
 * regardless of caller role, so restricting the role here would add no
 * real authorization boundary beyond what that check already enforces —
 * the human-approval gate is `approve`, not `send`.
 */
@ApiTags('communication-messages')
@ApiBearerAuth()
@UseGuards(ApiKeyGuard)
@Controller('v1/loan-cases/:caseId/communication-messages')
export class CommunicationMessagesController {
  constructor(
    private readonly messageService: CommunicationMessageService,
    private readonly approvalService: CommunicationApprovalService,
    private readonly deliveryService: CommunicationDeliveryService,
    private readonly auditEventService: AuditEventService,
  ) {}

  @ApiOperation({
    operationId: 'listCommunicationMessages',
    summary: "List a case's communication messages",
  })
  @ApiParam({ name: 'caseId', format: 'uuid' })
  @ApiOkResponse({ type: CommunicationMessage, isArray: true })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid API credentials.',
  })
  @Get()
  async list(
    @AuthTenantId() tenantId: string,
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ): Promise<CommunicationMessage[]> {
    return this.messageService.listForCase(tenantId, caseId);
  }

  @ApiOperation({
    operationId: 'approveCommunicationMessage',
    summary: 'Approve a PROTECTED communication message for delivery',
  })
  @ApiParam({ name: 'caseId', format: 'uuid' })
  @ApiParam({ name: 'messageId', format: 'uuid' })
  @ApiCreatedResponse({ type: CommunicationApproval })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid API credentials.',
  })
  @ApiForbiddenResponse({
    description:
      'The authenticated API client does not have the REVIEWER role (Section 6.3/6.4, M5-017).',
  })
  @ApiNotFoundResponse({
    description:
      'No communication message with this id owned by the authenticated tenant.',
  })
  @ApiResponse({
    status: 400,
    description: 'The message is not PROTECTED, or is already approved.',
  })
  @Post(':messageId/approve')
  @UseGuards(RoleGuard)
  @RequireRole(ApiClientRole.REVIEWER)
  async approve(
    @CurrentAuth() auth: AuthContext,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: ApproveCommunicationMessageDto,
  ): Promise<CommunicationApproval> {
    return this.approvalService.approve(
      auth.tenantId,
      messageId,
      dto.actorId,
      dto.reason,
      auth.correlationId,
    );
  }

  @ApiOperation({
    operationId: 'sendCommunicationMessage',
    summary: 'Deliver a ready-to-send communication message',
  })
  @ApiParam({ name: 'caseId', format: 'uuid' })
  @ApiParam({ name: 'messageId', format: 'uuid' })
  @ApiOkResponse({ description: 'Delivered.' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid API credentials.',
  })
  @ApiNotFoundResponse({
    description:
      'No communication message with this id owned by the authenticated tenant.',
  })
  @ApiResponse({
    status: 409,
    description:
      'The message is not yet ready to send (ROUTINE+DRAFTED or PROTECTED+APPROVED only).',
  })
  @Post(':messageId/send')
  @HttpCode(HttpStatus.OK)
  async send(
    @CurrentAuth() auth: AuthContext,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ): Promise<Extract<DeliverCommunicationResult, { outcome: 'DELIVERED' }>> {
    const result = await this.deliveryService.deliver(auth.tenantId, messageId);
    if (result.outcome === 'NOT_READY') {
      throw new ConflictException(result.reason);
    }
    await this.auditEventService.record({
      tenantId: auth.tenantId,
      actorId: auth.apiClientId,
      action: 'COMMUNICATION_SENT',
      resourceType: 'communication_message',
      resourceId: messageId,
      correlationId: auth.correlationId,
      metadata: { deliveryReference: result.deliveryReference },
    });
    return result;
  }
}
