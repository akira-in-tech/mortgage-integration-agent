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
        // Delete the child explicitly: shared synchronize-based test suites
        // may rebuild this table without the migration's cascade constraint.
        await dataSource.query(
          `DELETE FROM "agent_budget_reservations" WHERE "tenantId" = $1`,
          [tenantId],
        );
        await dataSource.query(
          `DELETE FROM "agent_budget_ledgers" WHERE "tenantId" = $1`,
          [tenantId],
        );
      }
      await dataSource.query(
        `DELETE FROM "tenants" WHERE "id" = ANY($1::uuid[])`,
        [tenantIds],
      );
      await dataSource.destroy();
    }
  });

  function input(
    overrides: Partial<AgentBudgetLedgerInput> = {},
  ): AgentBudgetLedgerInput {
    const tenantId = overrides.tenantId ?? randomUUID();
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

  async function authorizeCostBearingWork(
    tenantId: string,
    providerCallLimit = 100,
    costLimitMinorUnits = 10_000,
  ): Promise<void> {
    await dataSource.query(
      `INSERT INTO "tenants" (
         "id", "name", "agentMonthlyProviderCallLimit",
         "agentMonthlyCostLimitMinorUnits", "agentBudgetCurrency"
       ) VALUES ($1, $2, $3, $4, 'USD')
       ON CONFLICT ("id") DO UPDATE SET
         "agentMonthlyProviderCallLimit" = EXCLUDED."agentMonthlyProviderCallLimit",
         "agentMonthlyCostLimitMinorUnits" = EXCLUDED."agentMonthlyCostLimitMinorUnits",
         "agentBudgetCurrency" = EXCLUDED."agentBudgetCurrency"`,
      [
        tenantId,
        `Agent budget spec ${tenantId}`,
        providerCallLimit,
        costLimitMinorUnits,
      ],
    );
  }

  it('does not reset consumed capacity or the trusted deadline on workflow retry', async () => {
    const initial = input();
    await authorizeCostBearingWork(initial.tenantId);
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
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
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
    await authorizeCostBearingWork(ledgerInput.tenantId);
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

    expect(await service.listUnknown(ledgerInput.tenantId)).toHaveLength(1);
    const released = await service.release(
      ledgerInput.tenantId,
      reserved.reservationId,
      {
        requireUnknown: true,
        resolvedBy: 'reviewer-spec',
        resolutionNote: 'Provider dashboard proves no operation occurred.',
      },
    );
    expect(released.status).toBe(AgentBudgetReservationStatus.Released);
    expect(released.ledger.remainingCostMinorUnits).toBe(10);
    expect(await service.listUnknown(ledgerInput.tenantId)).toEqual([]);
    expect(
      await dataSource.query(
        `SELECT "providerCallReserved", "costReservedMinorUnits"
           FROM "tenant_agent_budget_usage" WHERE "tenantId" = $1`,
        [ledgerInput.tenantId],
      ),
    ).toEqual([{ providerCallReserved: 0, costReservedMinorUnits: 0 }]);
    const resolved = await dataSource
      .getRepository(AgentBudgetReservation)
      .findOneByOrFail({ id: reserved.reservationId });
    expect(resolved).toMatchObject({
      resolvedBy: 'reviewer-spec',
      resolutionNote: 'Provider dashboard proves no operation occurred.',
    });
  });

  it('commits UNKNOWN work with reviewer evidence and rejects repeat disposition', async () => {
    const ledgerInput = input({ costLimitMinorUnits: 10 });
    await authorizeCostBearingWork(ledgerInput.tenantId);
    const ledger = await service.createOrLoad(ledgerInput);
    const reserved = await service.reserve({
      tenantId: ledgerInput.tenantId,
      ledgerId: ledger.ledgerId,
      idempotencyKey: 'provider-confirmed',
      expectedVersion: ledger.version,
      units: {
        stepUnits: 1,
        tokenUnits: 0,
        providerCallUnits: 1,
        costMinorUnits: 10,
      },
    });
    await service.markUnknown(ledgerInput.tenantId, reserved.reservationId);

    const committed = await service.commit({
      tenantId: ledgerInput.tenantId,
      reservationId: reserved.reservationId,
      actualCostMinorUnits: 7,
      requireUnknown: true,
      resolvedBy: 'reviewer-spec',
      resolutionNote: 'Provider receipt confirms one completed lookup.',
    });

    expect(committed.status).toBe(AgentBudgetReservationStatus.Committed);
    expect(committed.actualCostMinorUnits).toBe(7);
    expect(committed.ledger.remainingCostMinorUnits).toBe(3);
    expect(
      await dataSource.query(
        `SELECT "providerCallUsed", "providerCallReserved",
                "costUsedMinorUnits", "costReservedMinorUnits"
           FROM "tenant_agent_budget_usage" WHERE "tenantId" = $1`,
        [ledgerInput.tenantId],
      ),
    ).toEqual([
      {
        providerCallUsed: 1,
        providerCallReserved: 0,
        costUsedMinorUnits: 7,
        costReservedMinorUnits: 0,
      },
    ]);
    await expect(
      service.commit({
        tenantId: ledgerInput.tenantId,
        reservationId: reserved.reservationId,
        requireUnknown: true,
        resolvedBy: 'second-reviewer',
        resolutionNote: 'Attempting to overwrite the completed disposition.',
      }),
    ).rejects.toMatchObject<Partial<AgentBudgetError>>({
      code: 'RESERVATION_CONFLICT',
    });
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
    await authorizeCostBearingWork(costInput.tenantId);
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

  it('fails closed for cost-bearing work without tenant aggregate authority', async () => {
    const ledgerInput = input();
    const ledger = await service.createOrLoad(ledgerInput);

    await expect(
      service.reserve({
        tenantId: ledgerInput.tenantId,
        ledgerId: ledger.ledgerId,
        idempotencyKey: 'unconfigured-provider',
        expectedVersion: ledger.version,
        units: {
          stepUnits: 1,
          tokenUnits: 0,
          providerCallUnits: 1,
          costMinorUnits: 1,
        },
      }),
    ).rejects.toMatchObject<Partial<AgentBudgetError>>({
      code: 'BUDGET_EXHAUSTED',
    });
    expect(
      await service.observe(ledgerInput.tenantId, ledger.ledgerId),
    ).toMatchObject({ version: 1, remainingSteps: 2 });
  });

  it('atomically shares one monthly tenant allowance across concurrent workflows', async () => {
    const tenantId = randomUUID();
    tenantIds.push(tenantId);
    await authorizeCostBearingWork(tenantId, 1, 10);
    const firstInput = input({
      tenantId,
      workflowRunId: `first-${randomUUID()}`,
    });
    const secondInput = input({
      tenantId,
      workflowRunId: `second-${randomUUID()}`,
    });
    const [first, second] = await Promise.all([
      service.createOrLoad(firstInput),
      service.createOrLoad(secondInput),
    ]);
    const results = await Promise.allSettled([
      service.reserve({
        tenantId,
        ledgerId: first.ledgerId,
        idempotencyKey: 'tenant-final-capacity-a',
        expectedVersion: first.version,
        units: {
          stepUnits: 1,
          tokenUnits: 0,
          providerCallUnits: 1,
          costMinorUnits: 10,
        },
      }),
      service.reserve({
        tenantId,
        ledgerId: second.ledgerId,
        idempotencyKey: 'tenant-final-capacity-b',
        expectedVersion: second.version,
        units: {
          stepUnits: 1,
          tokenUnits: 0,
          providerCallUnits: 1,
          costMinorUnits: 10,
        },
      }),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      (
        results.find(
          (result) => result.status === 'rejected',
        ) as PromiseRejectedResult
      ).reason,
    ).toMatchObject({ code: 'BUDGET_EXHAUSTED' });
    const usage = await dataSource.query(
      `SELECT "providerCallReserved", "costReservedMinorUnits"
         FROM "tenant_agent_budget_usage" WHERE "tenantId" = $1`,
      [tenantId],
    );
    expect(usage).toEqual([
      { providerCallReserved: 1, costReservedMinorUnits: 10 },
    ]);
  });

  it('rolls back a known actual-cost overage against the tenant cap', async () => {
    const ledgerInput = input({ costLimitMinorUnits: 20 });
    await authorizeCostBearingWork(ledgerInput.tenantId, 2, 10);
    const ledger = await service.createOrLoad(ledgerInput);
    const reservation = await service.reserve({
      tenantId: ledgerInput.tenantId,
      ledgerId: ledger.ledgerId,
      idempotencyKey: 'tenant-cost-overage',
      expectedVersion: ledger.version,
      units: {
        stepUnits: 1,
        tokenUnits: 0,
        providerCallUnits: 1,
        costMinorUnits: 10,
      },
    });

    await expect(
      service.commit({
        tenantId: ledgerInput.tenantId,
        reservationId: reservation.reservationId,
        actualCostMinorUnits: 11,
      }),
    ).rejects.toMatchObject<Partial<AgentBudgetError>>({
      code: 'BUDGET_EXHAUSTED',
    });
    expect(
      await service.observe(ledgerInput.tenantId, ledger.ledgerId),
    ).toMatchObject({ remainingCostMinorUnits: 10 });
  });
});
