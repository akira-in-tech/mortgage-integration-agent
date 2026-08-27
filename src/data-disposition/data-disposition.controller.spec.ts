import { BadRequestException } from '@nestjs/common';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { DataDispositionService } from './data-disposition.service';
import { DataDispositionController } from './data-disposition.controller';
import { AuditEventService } from '../audit/audit-event.service';

const AUTH = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  actorId: 'reviewer-1',
  role: ApiClientRole.REVIEWER,
  correlationId: '22222222-2222-2222-2222-222222222222',
};
const TASK_ID = '33333333-3333-3333-3333-333333333333';

describe('DataDispositionController', () => {
  const resolvedTask = {
    id: TASK_ID,
    caseId: '44444444-4444-4444-4444-444444444444',
    taskType: 'RETENTION_REVIEW',
    status: 'VERIFIED',
    reason: 'Consent was revoked.',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
  let dispositionService: { listOpen: jest.Mock; resolve: jest.Mock };
  let auditEventService: { record: jest.Mock };
  let controller: DataDispositionController;

  beforeEach(() => {
    dispositionService = {
      listOpen: jest.fn().mockResolvedValue([]),
      resolve: jest.fn().mockResolvedValue(resolvedTask),
    };
    auditEventService = { record: jest.fn().mockResolvedValue(undefined) };
    controller = new DataDispositionController(
      dispositionService as unknown as DataDispositionService,
      auditEventService as unknown as AuditEventService,
    );
  });

  it('lists only within the authenticated tenant and requested bound', async () => {
    await controller.listOpen(AUTH, 25);
    expect(dispositionService.listOpen).toHaveBeenCalledWith(AUTH.tenantId, 25);
  });

  it('resolves a task with the authenticated reviewer as the actor, not a client-supplied value', async () => {
    const result = await controller.resolve(AUTH, TASK_ID, {
      action: 'DELETE',
    });

    expect(dispositionService.resolve).toHaveBeenCalledWith(
      AUTH.tenantId,
      TASK_ID,
      'DELETE',
      AUTH.actorId,
    );
    expect(result.id).toBe(TASK_ID);
  });

  it('records an audit event with the chosen action', async () => {
    await controller.resolve(AUTH, TASK_ID, { action: 'ANONYMIZE' });

    expect(auditEventService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: AUTH.tenantId,
        actorId: AUTH.actorId,
        correlationId: AUTH.correlationId,
        resourceId: TASK_ID,
        action: 'DATA_DISPOSITION_TASK_RESOLVED',
      }),
    );
  });

  it('passes through the service’s own BadRequestException (e.g. an active legal hold) unchanged', async () => {
    const holdError = new BadRequestException(
      'cannot DELETE task — case has an active legal hold',
    );
    dispositionService.resolve.mockRejectedValue(holdError);

    await expect(
      controller.resolve(AUTH, TASK_ID, { action: 'DELETE' }),
    ).rejects.toBe(holdError);
    expect(auditEventService.record).not.toHaveBeenCalled();
  });

  it('turns an unexpected error into a 400, not an unhandled 500', async () => {
    dispositionService.resolve.mockRejectedValue(new Error('boom'));

    await expect(
      controller.resolve(AUTH, TASK_ID, { action: 'RETAIN' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
