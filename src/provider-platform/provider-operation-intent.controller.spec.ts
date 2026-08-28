import { BadRequestException } from '@nestjs/common';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { ProviderOperationIntentService } from './provider-operation-intent.service';
import { ProviderOperationIntentController } from './provider-operation-intent.controller';
import { ProviderOperationResolutionOutcome } from './dto/provider-operation-intent-response.dto';
import { AuditEventService } from '../audit/audit-event.service';

const AUTH = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  actorId: 'reviewer-1',
  role: ApiClientRole.REVIEWER,
  correlationId: '22222222-2222-2222-2222-222222222222',
};
const INTENT_ID = '33333333-3333-3333-3333-333333333333';

describe('ProviderOperationIntentController', () => {
  const resolvedIntent = {
    id: INTENT_ID,
    caseId: '44444444-4444-4444-4444-444444444444',
    providerId: 'plaid-income-simulator',
    capability: 'INCOME',
    state: 'SUCCEEDED',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
  let intentService: {
    listNeedingReconciliation: jest.Mock;
    resolveManually: jest.Mock;
  };
  let auditEventService: { record: jest.Mock };
  let controller: ProviderOperationIntentController;

  beforeEach(() => {
    intentService = {
      listNeedingReconciliation: jest.fn().mockResolvedValue([]),
      resolveManually: jest.fn().mockResolvedValue(resolvedIntent),
    };
    auditEventService = { record: jest.fn().mockResolvedValue(undefined) };
    controller = new ProviderOperationIntentController(
      intentService as unknown as ProviderOperationIntentService,
      auditEventService as unknown as AuditEventService,
    );
  });

  it('lists only within the authenticated tenant and requested bound', async () => {
    await controller.listReconciling(AUTH, 25);
    expect(intentService.listNeedingReconciliation).toHaveBeenCalledWith(
      AUTH.tenantId,
      25,
    );
  });

  it('resolves an intent with the authenticated reviewer as resolvedBy, not a client-supplied value', async () => {
    const result = await controller.resolve(AUTH, INTENT_ID, {
      outcome: ProviderOperationResolutionOutcome.Succeeded,
      resolutionNote: 'Confirmed complete via the provider dashboard.',
    });

    expect(intentService.resolveManually).toHaveBeenCalledWith(
      AUTH.tenantId,
      INTENT_ID,
      'SUCCEEDED',
      AUTH.actorId,
      'Confirmed complete via the provider dashboard.',
    );
    expect(result.id).toBe(INTENT_ID);
    expect(result.state).toBe('SUCCEEDED');
  });

  it('records an audit event with the real outcome and reviewer', async () => {
    await controller.resolve(AUTH, INTENT_ID, {
      outcome: ProviderOperationResolutionOutcome.FailedFinal,
      resolutionNote: 'Provider confirms the request was never received.',
    });

    expect(auditEventService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: AUTH.tenantId,
        actorId: AUTH.actorId,
        correlationId: AUTH.correlationId,
        resourceId: INTENT_ID,
        action: 'PROVIDER_OPERATION_INTENT_RESOLVED',
      }),
    );
  });

  it('turns a service error (e.g. wrong state) into a 400, not an unhandled 500', async () => {
    intentService.resolveManually.mockRejectedValue(
      new Error('intent is not in a reconcilable state'),
    );

    await expect(
      controller.resolve(AUTH, INTENT_ID, {
        outcome: ProviderOperationResolutionOutcome.Cancelled,
        resolutionNote: 'Trying to resolve an already-resolved intent.',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(auditEventService.record).not.toHaveBeenCalled();
  });
});
