import { ConflictException, UseGuards } from '@nestjs/common';
import { Resolver, Mutation, Args, ID } from '@nestjs/graphql';
import { CommunicationApproval } from '../database/entities/communication-approval.entity';
import { CommunicationApprovalService } from './communication-approval.service';
import { CommunicationDeliveryService } from './communication-delivery.service';
import { CommunicationDeliveryResult } from './communication-delivery-result.model';
import { ApproveCommunicationMessageDto } from './dto/approve-communication-message.dto';
import { TenantAuthGuard } from '../auth/tenant-auth.guard';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { AuthContext } from '../auth/auth-context';
import { RoleGuard } from '../auth/role.guard';
import { RequireRole } from '../auth/require-role.decorator';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { AuditEventService } from '../audit/audit-event.service';

/**
 * Mirrors `CommunicationMessagesController` exactly (Section 6.4, M5-022)
 * — same service calls, same audit-event shape, same `RoleGuard`/
 * `RequireRole(REVIEWER)` gate on `approve` only (REST's own reasoning:
 * `send`'s state-based readiness check already fails closed for any
 * `PROTECTED` message that isn't `APPROVED` regardless of caller role, so
 * restricting the role there would add no real authorization boundary
 * beyond what that check already enforces). Not nested under `case` —
 * both underlying service calls are scoped by `messageId`/`tenantId`
 * alone, exactly as real REST authorization already works despite the
 * REST route's own case-nested URL shape.
 */
@Resolver()
@UseGuards(TenantAuthGuard)
export class CommunicationMessagesResolver {
  constructor(
    private readonly approvalService: CommunicationApprovalService,
    private readonly deliveryService: CommunicationDeliveryService,
    private readonly auditEventService: AuditEventService,
  ) {}

  @Mutation(() => CommunicationApproval, {
    name: 'approveCommunicationMessage',
    description:
      'Approve a PROTECTED communication message for delivery (Section 6.4).',
  })
  @UseGuards(RoleGuard)
  @RequireRole(ApiClientRole.REVIEWER)
  async approveCommunicationMessage(
    @CurrentAuth() auth: AuthContext,
    @Args('messageId', { type: () => ID }) messageId: string,
    @Args('input', { type: () => ApproveCommunicationMessageDto })
    input: ApproveCommunicationMessageDto,
  ): Promise<CommunicationApproval> {
    return this.approvalService.approve(
      auth.tenantId,
      messageId,
      input.actorId,
      input.reason,
      auth.correlationId,
    );
  }

  @Mutation(() => CommunicationDeliveryResult, {
    name: 'sendCommunicationMessage',
    description: 'Deliver a ready-to-send communication message.',
  })
  async sendCommunicationMessage(
    @CurrentAuth() auth: AuthContext,
    @Args('messageId', { type: () => ID }) messageId: string,
  ): Promise<CommunicationDeliveryResult> {
    const result = await this.deliveryService.deliver(auth.tenantId, messageId);
    if (result.outcome === 'NOT_READY') {
      throw new ConflictException(result.reason);
    }
    await this.auditEventService.record({
      tenantId: auth.tenantId,
      actorId: auth.actorId,
      action: 'COMMUNICATION_SENT',
      resourceType: 'communication_message',
      resourceId: messageId,
      correlationId: auth.correlationId,
      metadata: { deliveryReference: result.deliveryReference },
    });
    return result;
  }
}
