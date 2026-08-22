import { ConflictException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { runInTenantContext } from '../database/tenant-context';
import { AgentBudgetLedger } from '../database/entities/agent-budget-ledger.entity';
import {
  AgentBudgetReservation,
  AgentBudgetReservationStatus,
} from '../database/entities/agent-budget-reservation.entity';

export type AgentBudgetFailureCode =
  | 'BUDGET_EXHAUSTED'
  | 'DEADLINE_EXCEEDED'
  | 'LEDGER_VERSION_CONFLICT'
  | 'LEDGER_CLOSED'
  | 'RESERVATION_CONFLICT';

export class AgentBudgetError extends ConflictException {
  constructor(
    readonly code: AgentBudgetFailureCode,
    message: string,
  ) {
    super(message);
  }
}

export interface AgentBudgetLedgerInput {
  tenantId: string;
  caseId: string;
  workflowRunId: string;
  stepLimit: number;
  tokenLimit: number;
  providerCallLimit: number;
  costLimitMinorUnits: number;
  currency: string;
  startedAt: Date;
  deadlineAt: Date;
}

export interface AgentBudgetUnits {
  stepUnits: number;
  tokenUnits: number;
  providerCallUnits: number;
  costMinorUnits: number;
}

export interface AgentBudgetSnapshot {
  ledgerId: string;
  version: number;
  remainingSteps: number;
  remainingTokens: number;
  remainingProviderCalls: number;
  remainingCostMinorUnits: number;
  remainingDurationMs: number;
  currency: string;
  startedAt: string;
  deadlineAt: string;
  closed: boolean;
}

export interface AgentBudgetReservationReceipt {
  reservationId: string;
  idempotencyKey: string;
  status: AgentBudgetReservationStatus;
  units: AgentBudgetUnits;
  actualCostMinorUnits: number | null;
  /** True when this idempotency key resolved to a pre-existing claim. */
  replayed: boolean;
  ledger: AgentBudgetSnapshot;
}

/**
 * PostgreSQL authority for Agent budgets. Every reservation is one atomic
 * conditional ledger update plus an idempotency record in the same tenant
 * transaction. A stale graph snapshot can fail, but it can never overspend.
 */
export class AgentBudgetLedgerService {
  constructor(private readonly dataSource: DataSource) {}

  async createOrLoad(
    input: AgentBudgetLedgerInput,
  ): Promise<AgentBudgetSnapshot> {
    this.validateLedgerInput(input);
    const ledger = await runInTenantContext(
      this.dataSource,
      input.tenantId,
      async (manager) => {
        const rows = (await manager.query(
          `INSERT INTO "agent_budget_ledgers" (
             "tenantId", "caseId", "workflowRunId", "stepLimit",
             "tokenLimit", "providerCallLimit", "costLimitMinorUnits",
             "currency", "startedAt", "deadlineAt"
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT ("tenantId", "workflowRunId") DO NOTHING
           RETURNING *`,
          [
            input.tenantId,
            input.caseId,
            input.workflowRunId,
            input.stepLimit,
            input.tokenLimit,
            input.providerCallLimit,
            input.costLimitMinorUnits,
            input.currency,
            input.startedAt,
            input.deadlineAt,
          ],
        )) as AgentBudgetLedger[];
        return (
          rows[0] ??
          (await manager.getRepository(AgentBudgetLedger).findOneByOrFail({
            tenantId: input.tenantId,
            workflowRunId: input.workflowRunId,
          }))
        );
      },
    );
    this.assertSameLedgerConfiguration(ledger, input);
    return this.snapshot(ledger);
  }

  async observe(
    tenantId: string,
    ledgerId: string,
  ): Promise<AgentBudgetSnapshot> {
    return runInTenantContext(this.dataSource, tenantId, async (manager) =>
      this.snapshot(
        await manager.getRepository(AgentBudgetLedger).findOneByOrFail({
          id: ledgerId,
          tenantId,
        }),
      ),
    );
  }

  async reserve(input: {
    tenantId: string;
    ledgerId: string;
    idempotencyKey: string;
    expectedVersion: number;
    units: AgentBudgetUnits;
  }): Promise<AgentBudgetReservationReceipt> {
    this.validateUnits(input.units);
    if (!input.idempotencyKey || input.idempotencyKey.length > 200) {
      throw new AgentBudgetError(
        'RESERVATION_CONFLICT',
        'Budget reservation requires a bounded idempotency key',
      );
    }
    try {
      return await runInTenantContext(
        this.dataSource,
        input.tenantId,
        async (manager) => {
          const existing = await manager
            .getRepository(AgentBudgetReservation)
            .findOneBy({
              ledgerId: input.ledgerId,
              tenantId: input.tenantId,
              idempotencyKey: input.idempotencyKey,
            });
          if (existing) {
            this.assertSameUnits(existing, input.units);
            return this.receiptFor(manager, existing, true);
          }

          const [ledgers] = (await manager.query(
            `UPDATE "agent_budget_ledgers"
               SET "stepReserved" = "stepReserved" + $3,
                   "tokenReserved" = "tokenReserved" + $4,
                   "providerCallReserved" = "providerCallReserved" + $5,
                   "costReservedMinorUnits" = "costReservedMinorUnits" + $6,
                   "version" = "version" + 1,
                   "updatedAt" = now()
             WHERE "id" = $1 AND "tenantId" = $2
               AND "version" = $7 AND "closedAt" IS NULL
               AND "deadlineAt" > now()
               AND "stepUsed" + "stepReserved" + $3 <= "stepLimit"
               AND "tokenUsed" + "tokenReserved" + $4 <= "tokenLimit"
               AND "providerCallUsed" + "providerCallReserved" + $5 <= "providerCallLimit"
               AND "costUsedMinorUnits" + "costReservedMinorUnits" + $6 <= "costLimitMinorUnits"
             RETURNING *`,
            [
              input.ledgerId,
              input.tenantId,
              input.units.stepUnits,
              input.units.tokenUnits,
              input.units.providerCallUnits,
              input.units.costMinorUnits,
              input.expectedVersion,
            ],
          )) as [AgentBudgetLedger[], number];
          if (!ledgers[0]) {
            await this.throwReservationFailure(manager, input);
          }
          const reservation = await manager
            .getRepository(AgentBudgetReservation)
            .save(
              manager.getRepository(AgentBudgetReservation).create({
                tenantId: input.tenantId,
                ledgerId: input.ledgerId,
                idempotencyKey: input.idempotencyKey,
                ...input.units,
                actualCostMinorUnits: null,
                status: AgentBudgetReservationStatus.Reserved,
                resolvedAt: null,
              }),
            );
          return this.receipt(reservation, ledgers[0], false);
        },
      );
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      return runInTenantContext(
        this.dataSource,
        input.tenantId,
        async (manager) => {
          const existing = await manager
            .getRepository(AgentBudgetReservation)
            .findOneByOrFail({
              ledgerId: input.ledgerId,
              tenantId: input.tenantId,
              idempotencyKey: input.idempotencyKey,
            });
          this.assertSameUnits(existing, input.units);
          return this.receiptFor(manager, existing, true);
        },
      );
    }
  }

  async commit(input: {
    tenantId: string;
    reservationId: string;
    actualCostMinorUnits?: number;
  }): Promise<AgentBudgetReservationReceipt> {
    if (input.actualCostMinorUnits !== undefined) {
      this.assertNonnegativeInt(input.actualCostMinorUnits, 'actual cost');
    }
    return this.resolveReservation(
      input.tenantId,
      input.reservationId,
      async (manager, reservation, ledger) => {
        if (reservation.status === AgentBudgetReservationStatus.Committed) {
          return this.receipt(reservation, ledger, false);
        }
        if (reservation.status === AgentBudgetReservationStatus.Released) {
          throw new AgentBudgetError(
            'RESERVATION_CONFLICT',
            'A released budget reservation cannot be committed',
          );
        }
        const actualCost =
          input.actualCostMinorUnits ?? reservation.costMinorUnits;
        const [rows] = (await manager.query(
          `UPDATE "agent_budget_ledgers"
           SET "stepReserved" = "stepReserved" - $3,
               "stepUsed" = "stepUsed" + $3,
               "tokenReserved" = "tokenReserved" - $4,
               "tokenUsed" = "tokenUsed" + $4,
               "providerCallReserved" = "providerCallReserved" - $5,
               "providerCallUsed" = "providerCallUsed" + $5,
               "costReservedMinorUnits" = "costReservedMinorUnits" - $6,
               "costUsedMinorUnits" = "costUsedMinorUnits" + $7,
               "version" = "version" + 1,
               "updatedAt" = now()
         WHERE "id" = $1 AND "tenantId" = $2
           AND "costUsedMinorUnits" + "costReservedMinorUnits" - $6 + $7 <= "costLimitMinorUnits"
         RETURNING *`,
          [
            ledger.id,
            input.tenantId,
            reservation.stepUnits,
            reservation.tokenUnits,
            reservation.providerCallUnits,
            reservation.costMinorUnits,
            actualCost,
          ],
        )) as [AgentBudgetLedger[], number];
        if (!rows[0]) {
          throw new AgentBudgetError(
            'BUDGET_EXHAUSTED',
            'Actual provider cost exceeds the authoritative budget',
          );
        }
        reservation.status = AgentBudgetReservationStatus.Committed;
        reservation.actualCostMinorUnits = actualCost;
        reservation.resolvedAt = new Date();
        await manager.getRepository(AgentBudgetReservation).save(reservation);
        return this.receipt(reservation, rows[0], false);
      },
    );
  }

  async release(
    tenantId: string,
    reservationId: string,
  ): Promise<AgentBudgetReservationReceipt> {
    return this.resolveReservation(
      tenantId,
      reservationId,
      async (manager, reservation, ledger) => {
        if (reservation.status === AgentBudgetReservationStatus.Released) {
          return this.receipt(reservation, ledger, false);
        }
        if (reservation.status === AgentBudgetReservationStatus.Committed) {
          throw new AgentBudgetError(
            'RESERVATION_CONFLICT',
            'A committed budget reservation cannot be released',
          );
        }
        const [rows] = (await manager.query(
          `UPDATE "agent_budget_ledgers"
           SET "stepReserved" = "stepReserved" - $3,
               "tokenReserved" = "tokenReserved" - $4,
               "providerCallReserved" = "providerCallReserved" - $5,
               "costReservedMinorUnits" = "costReservedMinorUnits" - $6,
               "version" = "version" + 1,
               "updatedAt" = now()
         WHERE "id" = $1 AND "tenantId" = $2 RETURNING *`,
          [
            ledger.id,
            tenantId,
            reservation.stepUnits,
            reservation.tokenUnits,
            reservation.providerCallUnits,
            reservation.costMinorUnits,
          ],
        )) as [AgentBudgetLedger[], number];
        reservation.status = AgentBudgetReservationStatus.Released;
        reservation.resolvedAt = new Date();
        await manager.getRepository(AgentBudgetReservation).save(reservation);
        return this.receipt(reservation, rows[0], false);
      },
    );
  }

  async markUnknown(
    tenantId: string,
    reservationId: string,
  ): Promise<AgentBudgetReservationReceipt> {
    return this.resolveReservation(
      tenantId,
      reservationId,
      async (manager, reservation, ledger) => {
        if (reservation.status === AgentBudgetReservationStatus.Reserved) {
          reservation.status = AgentBudgetReservationStatus.Unknown;
          await manager.getRepository(AgentBudgetReservation).save(reservation);
        } else if (
          reservation.status !== AgentBudgetReservationStatus.Unknown
        ) {
          throw new AgentBudgetError(
            'RESERVATION_CONFLICT',
            'Only an unresolved reservation can become outcome-unknown',
          );
        }
        return this.receipt(reservation, ledger, false);
      },
    );
  }

  private async resolveReservation(
    tenantId: string,
    reservationId: string,
    action: (
      manager: EntityManager,
      reservation: AgentBudgetReservation,
      ledger: AgentBudgetLedger,
    ) => Promise<AgentBudgetReservationReceipt>,
  ): Promise<AgentBudgetReservationReceipt> {
    return runInTenantContext(this.dataSource, tenantId, async (manager) => {
      const reservations = (await manager.query(
        `SELECT * FROM "agent_budget_reservations"
          WHERE "id" = $1 AND "tenantId" = $2 FOR UPDATE`,
        [reservationId, tenantId],
      )) as AgentBudgetReservation[];
      const reservation = reservations[0];
      if (!reservation) {
        throw new AgentBudgetError(
          'RESERVATION_CONFLICT',
          'Budget reservation does not exist',
        );
      }
      const ledgers = (await manager.query(
        `SELECT * FROM "agent_budget_ledgers"
          WHERE "id" = $1 AND "tenantId" = $2 FOR UPDATE`,
        [reservation.ledgerId, tenantId],
      )) as AgentBudgetLedger[];
      if (!ledgers[0]) {
        throw new AgentBudgetError(
          'RESERVATION_CONFLICT',
          'The reservation ledger no longer exists',
        );
      }
      return action(manager, reservation, ledgers[0]);
    });
  }

  private async receiptFor(
    manager: EntityManager,
    reservation: AgentBudgetReservation,
    replayed: boolean,
  ): Promise<AgentBudgetReservationReceipt> {
    const ledger = await manager
      .getRepository(AgentBudgetLedger)
      .findOneByOrFail({
        id: reservation.ledgerId,
        tenantId: reservation.tenantId,
      });
    return this.receipt(reservation, ledger, replayed);
  }

  private receipt(
    reservation: AgentBudgetReservation,
    ledger: AgentBudgetLedger,
    replayed: boolean,
  ): AgentBudgetReservationReceipt {
    return {
      reservationId: reservation.id,
      idempotencyKey: reservation.idempotencyKey,
      status: reservation.status,
      units: {
        stepUnits: reservation.stepUnits,
        tokenUnits: reservation.tokenUnits,
        providerCallUnits: reservation.providerCallUnits,
        costMinorUnits: reservation.costMinorUnits,
      },
      actualCostMinorUnits: reservation.actualCostMinorUnits,
      replayed,
      ledger: this.snapshot(ledger),
    };
  }

  private snapshot(ledger: AgentBudgetLedger): AgentBudgetSnapshot {
    return {
      ledgerId: ledger.id,
      version: Number(ledger.version),
      remainingSteps: Math.max(
        0,
        ledger.stepLimit - ledger.stepUsed - ledger.stepReserved,
      ),
      remainingTokens: Math.max(
        0,
        ledger.tokenLimit - ledger.tokenUsed - ledger.tokenReserved,
      ),
      remainingProviderCalls: Math.max(
        0,
        ledger.providerCallLimit -
          ledger.providerCallUsed -
          ledger.providerCallReserved,
      ),
      remainingCostMinorUnits: Math.max(
        0,
        ledger.costLimitMinorUnits -
          ledger.costUsedMinorUnits -
          ledger.costReservedMinorUnits,
      ),
      remainingDurationMs: Math.max(
        0,
        new Date(ledger.deadlineAt).getTime() - Date.now(),
      ),
      currency: ledger.currency.trim(),
      startedAt: new Date(ledger.startedAt).toISOString(),
      deadlineAt: new Date(ledger.deadlineAt).toISOString(),
      closed: ledger.closedAt !== null,
    };
  }

  private async throwReservationFailure(
    manager: EntityManager,
    input: {
      tenantId: string;
      ledgerId: string;
      expectedVersion: number;
      units: AgentBudgetUnits;
    },
  ): Promise<never> {
    const ledger = await manager
      .getRepository(AgentBudgetLedger)
      .findOneByOrFail({
        id: input.ledgerId,
        tenantId: input.tenantId,
      });
    if (ledger.closedAt) {
      throw new AgentBudgetError(
        'LEDGER_CLOSED',
        'Agent budget ledger is closed',
      );
    }
    if (ledger.deadlineAt.getTime() <= Date.now()) {
      throw new AgentBudgetError(
        'DEADLINE_EXCEEDED',
        'Agent run deadline has been exceeded',
      );
    }
    if (ledger.version !== input.expectedVersion) {
      throw new AgentBudgetError(
        'LEDGER_VERSION_CONFLICT',
        'Agent budget ledger version is stale',
      );
    }
    throw new AgentBudgetError(
      'BUDGET_EXHAUSTED',
      'Agent budget capacity is exhausted',
    );
  }

  private validateLedgerInput(input: AgentBudgetLedgerInput): void {
    for (const [name, value] of [
      ['step limit', input.stepLimit],
      ['token limit', input.tokenLimit],
      ['provider-call limit', input.providerCallLimit],
      ['cost limit', input.costLimitMinorUnits],
    ] as const) {
      this.assertNonnegativeInt(value, name);
    }
    if (!/^[A-Z]{3}$/.test(input.currency)) {
      throw new AgentBudgetError(
        'RESERVATION_CONFLICT',
        'Budget currency must be a three-letter uppercase code',
      );
    }
    if (input.deadlineAt.getTime() <= input.startedAt.getTime()) {
      throw new AgentBudgetError(
        'DEADLINE_EXCEEDED',
        'Agent deadline must be after its trusted start time',
      );
    }
  }

  private validateUnits(units: AgentBudgetUnits): void {
    for (const [name, value] of Object.entries(units)) {
      this.assertNonnegativeInt(value, name);
    }
    if (Object.values(units).every((value) => value === 0)) {
      throw new AgentBudgetError(
        'RESERVATION_CONFLICT',
        'A budget reservation must claim at least one unit',
      );
    }
  }

  private assertNonnegativeInt(value: number, name: string): void {
    if (!Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647) {
      throw new AgentBudgetError(
        'RESERVATION_CONFLICT',
        `${name} must be a nonnegative 32-bit safe integer`,
      );
    }
  }

  private assertSameLedgerConfiguration(
    ledger: AgentBudgetLedger,
    input: AgentBudgetLedgerInput,
  ): void {
    if (
      ledger.caseId !== input.caseId ||
      ledger.stepLimit !== input.stepLimit ||
      ledger.tokenLimit !== input.tokenLimit ||
      ledger.providerCallLimit !== input.providerCallLimit ||
      ledger.costLimitMinorUnits !== input.costLimitMinorUnits ||
      ledger.currency.trim() !== input.currency
    ) {
      throw new AgentBudgetError(
        'RESERVATION_CONFLICT',
        'A workflow retry cannot reset or alter its existing budget ledger',
      );
    }
  }

  private assertSameUnits(
    reservation: AgentBudgetReservation,
    units: AgentBudgetUnits,
  ): void {
    if (
      reservation.stepUnits !== units.stepUnits ||
      reservation.tokenUnits !== units.tokenUnits ||
      reservation.providerCallUnits !== units.providerCallUnits ||
      reservation.costMinorUnits !== units.costMinorUnits
    ) {
      throw new AgentBudgetError(
        'RESERVATION_CONFLICT',
        'A reservation idempotency key cannot be reused for different units',
      );
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    const candidate = error as {
      code?: string;
      driverError?: { code?: string };
    };
    return (
      candidate.code === '23505' || candidate.driverError?.code === '23505'
    );
  }
}
