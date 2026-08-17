import 'reflect-metadata';
import { sendInformationRequestTool } from './send-information-request.tool';

// The service's own correctness (the ready-to-send gate, status
// transition, signed outbox event) is covered by
// communication-delivery.service.spec.ts's real-database suite — this
// tool has no I/O of its own, only delegates, so a mocked service is the
// right, honest unit under test here.
describe('sendInformationRequestTool', () => {
  const context = { tenantId: 'tenant-1', caseId: 'case-1' };

  it('declares the Section 9.4 registered-tool metadata', () => {
    const tool = sendInformationRequestTool({
      communicationDeliveryService: {} as any,
    });
    expect(tool.name).toBe('send_information_request');
    expect(tool.sideEffect).toBe('EXTERNAL_COMMUNICATION');
    expect(tool.approvalBoundary).toContain('exact human approval');
  });

  it('delegates to CommunicationDeliveryService.deliver', async () => {
    const deliver = jest.fn().mockResolvedValue({
      outcome: 'DELIVERED',
      deliveryReference: 'sim-abc123',
      sentAt: '2026-01-01T00:00:00.000Z',
    });
    const tool = sendInformationRequestTool({
      communicationDeliveryService: { deliver } as any,
    });

    const result = await tool.execute(context, {
      communicationMessageId: 'message-1',
    });

    expect(deliver).toHaveBeenCalledWith('message-1');
    expect(result).toEqual({
      outcome: 'DELIVERED',
      deliveryReference: 'sim-abc123',
      sentAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('surfaces a NOT_READY result unchanged', async () => {
    const deliver = jest.fn().mockResolvedValue({
      outcome: 'NOT_READY',
      reason:
        'communication message message-1 is PROTECTED/AWAITING_APPROVAL, not ready to send',
    });
    const tool = sendInformationRequestTool({
      communicationDeliveryService: { deliver } as any,
    });

    const result = await tool.execute(context, {
      communicationMessageId: 'message-1',
    });

    expect(result).toEqual({
      outcome: 'NOT_READY',
      reason:
        'communication message message-1 is PROTECTED/AWAITING_APPROVAL, not ready to send',
    });
  });
});
