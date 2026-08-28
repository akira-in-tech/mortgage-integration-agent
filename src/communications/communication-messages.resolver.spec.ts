import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { CommunicationMessagesResolver } from './communication-messages.resolver';
import { CommunicationApproval } from '../database/entities/communication-approval.entity';
import { AuthContext } from '../auth/auth-context';
import { ApiClientRole } from '../database/enums/api-client.enum';

describe('CommunicationMessagesResolver (Section 6.4, M6-004)', () => {
  let approvalService: { approve: jest.Mock };
  let deliveryService: { deliver: jest.Mock };
  let auditEventService: { record: jest.Mock };
  let resolver: CommunicationMessagesResolver;

  const TENANT_ID = '11111111-1111-1111-1111-111111111111';
  const MESSAGE_ID = '22222222-2222-2222-2222-222222222222';
  const AUTH: AuthContext = {
    tenantId: TENANT_ID,
    actorId: 'client-1',
    role: ApiClientRole.REVIEWER,
    correlationId: 'correlation-1',
  };

  beforeEach(() => {
    approvalService = { approve: jest.fn() };
    deliveryService = { deliver: jest.fn() };
    auditEventService = { record: jest.fn().mockResolvedValue(undefined) };
    resolver = new CommunicationMessagesResolver(
      approvalService as never,
      deliveryService as never,
      auditEventService as never,
    );
  });

  it('approveCommunicationMessage() delegates to CommunicationApprovalService.approve() using the authenticated tenantId/correlationId, exactly matching CommunicationMessagesController’s own call shape', async () => {
    const approval: CommunicationApproval = {
      id: 'approval-1',
      communicationMessageId: MESSAGE_ID,
      actorId: 'reviewer-1',
      approvedRenderedContentHash: 'a'.repeat(64),
      reason: 'content verified',
      approvedAt: new Date(),
    };
    approvalService.approve.mockResolvedValue(approval);
    const input = { actorId: 'reviewer-1', reason: 'content verified' };

    const result = await resolver.approveCommunicationMessage(
      AUTH,
      MESSAGE_ID,
      input,
    );

    expect(result).toBe(approval);
    expect(approvalService.approve).toHaveBeenCalledWith(
      TENANT_ID,
      MESSAGE_ID,
      'reviewer-1',
      'content verified',
      AUTH.correlationId,
    );
  });

  it('sendCommunicationMessage() delegates to CommunicationDeliveryService.deliver(), records a matching COMMUNICATION_SENT audit event, and returns the DELIVERED result', async () => {
    deliveryService.deliver.mockResolvedValue({
      outcome: 'DELIVERED',
      deliveryReference: 'sim-abc123',
      sentAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await resolver.sendCommunicationMessage(AUTH, MESSAGE_ID);

    expect(result).toEqual({
      outcome: 'DELIVERED',
      deliveryReference: 'sim-abc123',
      sentAt: '2026-01-01T00:00:00.000Z',
    });
    expect(deliveryService.deliver).toHaveBeenCalledWith(TENANT_ID, MESSAGE_ID);
    expect(auditEventService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        actorId: AUTH.actorId,
        action: 'COMMUNICATION_SENT',
        resourceType: 'communication_message',
        resourceId: MESSAGE_ID,
        correlationId: AUTH.correlationId,
        metadata: { deliveryReference: 'sim-abc123' },
      }),
    );
  });

  it('sendCommunicationMessage() throws ConflictException for a NOT_READY message and never records an audit event', async () => {
    deliveryService.deliver.mockResolvedValue({
      outcome: 'NOT_READY',
      reason: 'message is PROTECTED/AWAITING_APPROVAL, not ready to send',
    });

    await expect(
      resolver.sendCommunicationMessage(AUTH, MESSAGE_ID),
    ).rejects.toThrow(ConflictException);
    expect(auditEventService.record).not.toHaveBeenCalled();
  });
});
