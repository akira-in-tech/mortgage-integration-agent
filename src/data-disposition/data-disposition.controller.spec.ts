import { BadRequestException } from '@nestjs/common';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { DataDispositionService } from './data-disposition.service';
import { DataDispositionController } from './data-disposition.controller';

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
  let controller: DataDispositionController;

  beforeEach(() => {
    dispositionService = {
      listOpen: jest.fn().mockResolvedValue([]),
      resolve: jest.fn().mockResolvedValue(resolvedTask),
    };
    controller = new DataDispositionController(
      dispositionService as unknown as DataDispositionService,
    );
  });

  it('lists only within the authenticated tenant and requested bound', async () => {
    await controller.listOpen(AUTH, 25);
    expect(dispositionService.listOpen).toHaveBeenCalledWith(AUTH.tenantId, 25);
  });

  // M7-028: the audit-event write moved into DataDispositionService.resolve()
  // itself (see that service's own spec for the real audit_events
  // assertion) — resolve-data-disposition-task.ts calls the service
  // directly and was producing no audit trail at all under the old
  // controller-only write. The controller's own job now is just passing
  // the authenticated reviewer's identity and correlationId through, not
  // a client-supplied value.
  it('resolves a task with the authenticated reviewer as the actor and correlationId, not a client-supplied value', async () => {
    const result = await controller.resolve(AUTH, TASK_ID, {
      action: 'DELETE',
    });

    expect(dispositionService.resolve).toHaveBeenCalledWith(
      AUTH.tenantId,
      TASK_ID,
      'DELETE',
      AUTH.actorId,
      AUTH.correlationId,
    );
    expect(result.id).toBe(TASK_ID);
  });

  it('passes through the service’s own BadRequestException (e.g. an active legal hold) unchanged', async () => {
    const holdError = new BadRequestException(
      'cannot DELETE task — case has an active legal hold',
    );
    dispositionService.resolve.mockRejectedValue(holdError);

    await expect(
      controller.resolve(AUTH, TASK_ID, { action: 'DELETE' }),
    ).rejects.toBe(holdError);
  });

  it('turns an unexpected error into a 400, not an unhandled 500', async () => {
    dispositionService.resolve.mockRejectedValue(new Error('boom'));

    await expect(
      controller.resolve(AUTH, TASK_ID, { action: 'RETAIN' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
