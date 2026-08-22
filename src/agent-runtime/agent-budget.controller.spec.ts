import { BadRequestException } from '@nestjs/common';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { AgentBudgetLedgerService } from './agent-budget-ledger.service';
import { AgentBudgetController } from './agent-budget.controller';
import { AgentBudgetResolutionOutcome } from './dto/reconcile-agent-budget-reservation.dto';
import { AuditEventService } from '../audit/audit-event.service';

const AUTH = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  actorId: 'reviewer-1',
  role: ApiClientRole.REVIEWER,
  correlationId: '22222222-2222-2222-2222-222222222222',
};
const RESERVATION_ID = '33333333-3333-3333-3333-333333333333';

describe('AgentBudgetController', () => {
  const receipt = {
    reservationId: RESERVATION_ID,
    idempotencyKey: 'tool-call',
    status: 'COMMITTED',
    units: {
      stepUnits: 1,
      tokenUnits: 0,
      providerCallUnits: 1,
      costMinorUnits: 10,
    },
    actualCostMinorUnits: 7,
    replayed: false,
    ledger: { version: 4 },
  };
  let budgetService: {
    listUnknown: jest.Mock;
    commit: jest.Mock;
    release: jest.Mock;
  };
  let auditEventService: { record: jest.Mock };
  let controller: AgentBudgetController;

  beforeEach(() => {
    budgetService = {
      listUnknown: jest.fn().mockResolvedValue([]),
      commit: jest.fn().mockResolvedValue(receipt),
      release: jest.fn().mockResolvedValue({
        ...receipt,
        status: 'RELEASED',
        actualCostMinorUnits: null,
      }),
    };
    auditEventService = { record: jest.fn().mockResolvedValue(undefined) };
    controller = new AgentBudgetController(
      budgetService as unknown as AgentBudgetLedgerService,
      auditEventService as unknown as AuditEventService,
    );
  });

  it('lists only within the authenticated tenant and requested bound', async () => {
    await controller.listUnknown(AUTH, 25);
    expect(budgetService.listUnknown).toHaveBeenCalledWith(AUTH.tenantId, 25);
  });

  it('commits UNKNOWN capacity with the authenticated reviewer and audit provenance', async () => {
    await controller.reconcile(AUTH, RESERVATION_ID, {
      outcome: AgentBudgetResolutionOutcome.Committed,
      resolutionNote: 'Provider receipt confirms the lookup completed.',
      actualCostMinorUnits: 7,
    });

    expect(budgetService.commit).toHaveBeenCalledWith({
      tenantId: AUTH.tenantId,
      reservationId: RESERVATION_ID,
      actualCostMinorUnits: 7,
      requireUnknown: true,
      resolvedBy: AUTH.actorId,
      resolutionNote: 'Provider receipt confirms the lookup completed.',
    });
    expect(auditEventService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: AUTH.tenantId,
        actorId: AUTH.actorId,
        correlationId: AUTH.correlationId,
        resourceId: RESERVATION_ID,
        action: 'AGENT_BUDGET_RESERVATION_RECONCILED',
      }),
    );
  });

  it('rejects actual cost on RELEASED instead of silently discarding it', async () => {
    await expect(
      controller.reconcile(AUTH, RESERVATION_ID, {
        outcome: AgentBudgetResolutionOutcome.Released,
        resolutionNote: 'Provider confirms the operation never occurred.',
        actualCostMinorUnits: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(budgetService.release).not.toHaveBeenCalled();
    expect(auditEventService.record).not.toHaveBeenCalled();
  });
});
