import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { AgentBudgetLedger } from '../database/entities/agent-budget-ledger.entity';
import {
  AgentBudgetReservation,
  AgentBudgetReservationStatus,
} from '../database/entities/agent-budget-reservation.entity';
import {
  AgentBudgetError,
  AgentBudgetLedgerInput,
  AgentBudgetLedgerService,
} from './agent-budget-ledger.service';

const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

/**
 * These cases use PostgreSQL rather than repository mocks because the safety
 * property lives in one conditional UPDATE, row locks, and unique constraints.
 */
describeOrSkip('AgentBudgetLedgerService', () => {
  let dataSource: DataSource;
  let service: AgentBudgetLedgerService;
  const tenantIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [AgentBudgetLedger, AgentBudgetReservation],
    });
    await dataSource.initialize();
    service = new AgentBudgetLedgerService(dataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      for (const tenantId of tenantIds) {
        await dataSource.query(
          `DELETE FROM "agent_budget_ledgers" WHERE "tenantId" = $1`,
          [tenantId],
        );
      }
      await dataSource.destroy();
    }
  });

  function input(
    overrides: Partial<AgentBudgetLedgerInput> = {},
  ): AgentBudgetLedgerInput {
    const tenantId = randomUUID();
    tenantIds.push(tenantId);
    const startedAt = new Date(Date.now() - 1_000);
    return {
      tenantId,
      caseId: randomUUID(),
      workflowRunId: `workflow-${randomUUID()}`,
      stepLimit: 2,
      tokenLimit: 100,
      providerCallLimit: 2,
      costLimitMinorUnits: 50,
      currency: 'USD',
      startedAt,
      deadlineAt: new Date(startedAt.getTime() + 60_000),
      ...overrides,
    };
  }

  it('does not reset consumed capacity or the trusted deadline on workflow retry', async () => {
    const initial = input();
    const created = await service.createOrLoad(initial);
    const reservation = await service.reserve({
      tenantId: initial.tenantId,
      ledgerId: created.ledgerId,
      idempotencyKey: 'step-1',
      expectedVersion: created.version,
      units: {
        stepUnits: 1,
        tokenUnits: 10,
        providerCallUnits: 1,
        costMinorUnits: 20,
      },
    });
    const committed = await service.commit({
      tenantId: initial.tenantId,
      reservationId: reservation.reservationId,
      actualCostMinorUnits: 15,
    });

    const retried = await service.createOrLoad({
      ...initial,
      startedAt: new Date(initial.startedAt.getTime() + 10_000),
      deadlineAt: new Date(initial.deadlineAt.getTime() + 10_000),
    });

    expect(retried).toMatchObject({
      ledgerId: created.ledgerId,
      version: committed.ledger.version,
      remainingSteps: 1,
      remainingTokens: 90,
      remainingProviderCalls: 1,
      remainingCostMinorUnits: 35,
      deadlineAt: initial.deadlineAt.toISOString(),
    });
  });

  it('makes reservation keys idempotent and rejects changed units', async () => {
    const ledgerInput = input();
    const ledger = await service.createOrLoad(ledgerInput);
    const request = {
      tenantId: ledgerInput.tenantId,
      ledgerId: ledger.ledgerId,
      idempotencyKey: 'idempotent-tool-call',
      expectedVersion: ledger.version,
      units: {
        stepUnits: 1,
        tokenUnits: 0,
        providerCallUnits: 0,
        costMinorUnits: 0,
      },
    };

    const first = await service.reserve(request);
    const replay = await service.reserve(request);
    expect(replay.reservationId).toBe(first.reservationId);
    expect(replay.ledger.remainingSteps).toBe(1);

    await expect(
      service.reserve({
        ...request,
        units: { ...request.units, tokenUnits: 1 },
      }),
    ).rejects.toMatchObject<Partial<AgentBudgetError>>({
      code: 'RESERVATION_CONFLICT',
    });
  });

  it('allows only one concurrent caller to reserve the final capacity', async () => {
    const ledgerInput = input({ stepLimit: 1 });
    const ledger = await service.createOrLoad(ledgerInput);
    const results = await Promise.allSettled(
      ['concurrent-a', 'concurrent-b'].map((idempotencyKey) =>
        service.reserve({
          tenantId: ledgerInput.tenantId,
          ledgerId: ledger.ledgerId,
          idempotencyKey,
          expectedVersion: ledger.version,
          units: {
            stepUnits: 1,
            tokenUnits: 0,
            providerCallUnits: 0,
            costMinorUnits: 0,
          },
        }),
      ),
    );

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect((rejected as PromiseRejectedResult).reason).toMatchObject({
      code: 'LEDGER_VERSION_CONFLICT',
    });
    expect(
      (await service.observe(ledgerInput.tenantId, ledger.ledgerId))
        .remainingSteps,
    ).toBe(0);
  });

  it('keeps outcome-unknown capacity reserved until explicit reconciliation', async () => {
    const ledgerInput = input({ costLimitMinorUnits: 10 });
    const ledger = await service.createOrLoad(ledgerInput);
    const reserved = await service.reserve({
      tenantId: ledgerInput.tenantId,
      ledgerId: ledger.ledgerId,
      idempotencyKey: 'provider-unknown',
      expectedVersion: ledger.version,
      units: {
        stepUnits: 1,
        tokenUnits: 0,
        providerCallUnits: 1,
        costMinorUnits: 10,
      },
    });

    const unknown = await service.markUnknown(
      ledgerInput.tenantId,
      reserved.reservationId,
    );
    expect(unknown.status).toBe(AgentBudgetReservationStatus.Unknown);
    expect(unknown.ledger.remainingCostMinorUnits).toBe(0);

    const released = await service.release(
      ledgerInput.tenantId,
      reserved.reservationId,
    );
    expect(released.status).toBe(AgentBudgetReservationStatus.Released);
    expect(released.ledger.remainingCostMinorUnits).toBe(10);
  });

  it('rejects expired work and atomically preserves a reservation after cost overage', async () => {
    const expiredStartedAt = new Date(Date.now() - 60_000);
    const expiredInput = input({
      startedAt: expiredStartedAt,
      deadlineAt: new Date(expiredStartedAt.getTime() + 1_000),
    });
    const expired = await service.createOrLoad(expiredInput);
    await expect(
      service.reserve({
        tenantId: expiredInput.tenantId,
        ledgerId: expired.ledgerId,
        idempotencyKey: 'too-late',
        expectedVersion: expired.version,
        units: {
          stepUnits: 1,
          tokenUnits: 0,
          providerCallUnits: 0,
          costMinorUnits: 0,
        },
      }),
    ).rejects.toMatchObject<Partial<AgentBudgetError>>({
      code: 'DEADLINE_EXCEEDED',
    });

    const costInput = input({ costLimitMinorUnits: 5 });
    const costLedger = await service.createOrLoad(costInput);
    const reservation = await service.reserve({
      tenantId: costInput.tenantId,
      ledgerId: costLedger.ledgerId,
      idempotencyKey: 'cost-overage',
      expectedVersion: costLedger.version,
      units: {
        stepUnits: 1,
        tokenUnits: 0,
        providerCallUnits: 1,
        costMinorUnits: 5,
      },
    });
    await expect(
      service.commit({
        tenantId: costInput.tenantId,
        reservationId: reservation.reservationId,
        actualCostMinorUnits: 6,
      }),
    ).rejects.toMatchObject<Partial<AgentBudgetError>>({
      code: 'BUDGET_EXHAUSTED',
    });
    const observed = await service.observe(
      costInput.tenantId,
      costLedger.ledgerId,
    );
    expect(observed.remainingCostMinorUnits).toBe(0);
    const row = await dataSource
      .getRepository(AgentBudgetReservation)
      .findOneByOrFail({
        id: reservation.reservationId,
      });
    expect(row.status).toBe(AgentBudgetReservationStatus.Reserved);
  });
});
