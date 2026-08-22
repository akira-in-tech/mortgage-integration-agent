import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
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
@Injectable()
export class AgentBudgetLedgerService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async listUnknown(
    tenantId: string,
    limit = 50,
  ): Promise<AgentBudgetReservation[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new AgentBudgetError(
        'RESERVATION_CONFLICT',
        'Unknown-reservation page size must be between 1 and 100',
      );
    }
    return runInTenantContext(this.dataSource, tenantId, (manager) =>
      manager.getRepository(AgentBudgetReservation).find({
        where: {
          tenantId,
          status: AgentBudgetReservationStatus.Unknown,
        },
        order: { createdAt: 'ASC', id: 'ASC' },
        take: limit,
      }),
    );
  }

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
          const aggregateWindowStart = await this.reserveTenantAggregate(
            manager,
            input.tenantId,
            ledgers[0].currency.trim(),
            input.units,
          );
          const reservation = await manager
            .getRepository(AgentBudgetReservation)
            .save(
              manager.getRepository(AgentBudgetReservation).create({
                tenantId: input.tenantId,
                ledgerId: input.ledgerId,
                idempotencyKey: input.idempotencyKey,
                ...input.units,
                aggregateWindowStart,
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
    requireUnknown?: boolean;
    resolvedBy?: string;
    resolutionNote?: string;
  }): Promise<AgentBudgetReservationReceipt> {
    if (input.actualCostMinorUnits !== undefined) {
      this.assertNonnegativeInt(input.actualCostMinorUnits, 'actual cost');
    }
    if (input.requireUnknown) {
      this.validateManualResolution(input.resolvedBy, input.resolutionNote);
    }
    return this.resolveReservation(
      input.tenantId,
      input.reservationId,
      async (manager, reservation, ledger) => {
        if (reservation.status === AgentBudgetReservationStatus.Committed) {
          if (input.requireUnknown) {
            throw new AgentBudgetError(
              'RESERVATION_CONFLICT',
              'Only an UNKNOWN reservation can be reconciled manually',
            );
          }
          return this.receipt(reservation, ledger, false);
        }
        if (
          input.requireUnknown &&
          reservation.status !== AgentBudgetReservationStatus.Unknown
        ) {
          throw new AgentBudgetError(
            'RESERVATION_CONFLICT',
            'Only an UNKNOWN reservation can be reconciled manually',
          );
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
        await this.commitTenantAggregate(manager, reservation, actualCost);
        reservation.status = AgentBudgetReservationStatus.Committed;
        reservation.actualCostMinorUnits = actualCost;
        reservation.resolvedAt = new Date();
        reservation.resolvedBy = input.resolvedBy ?? null;
        reservation.resolutionNote = input.resolutionNote ?? null;
        await manager.getRepository(AgentBudgetReservation).save(reservation);
        return this.receipt(reservation, rows[0], false);
      },
    );
  }

  async release(
    tenantId: string,
    reservationId: string,
    resolution?: {
      requireUnknown: true;
      resolvedBy: string;
      resolutionNote: string;
    },
  ): Promise<AgentBudgetReservationReceipt> {
    if (resolution?.requireUnknown) {
      this.validateManualResolution(
        resolution.resolvedBy,
        resolution.resolutionNote,
      );
    }
    return this.resolveReservation(
      tenantId,
      reservationId,
      async (manager, reservation, ledger) => {
        if (reservation.status === AgentBudgetReservationStatus.Released) {
          if (resolution?.requireUnknown) {
            throw new AgentBudgetError(
              'RESERVATION_CONFLICT',
              'Only an UNKNOWN reservation can be reconciled manually',
            );
          }
          return this.receipt(reservation, ledger, false);
        }
        if (
          resolution?.requireUnknown &&
          reservation.status !== AgentBudgetReservationStatus.Unknown
        ) {
          throw new AgentBudgetError(
            'RESERVATION_CONFLICT',
            'Only an UNKNOWN reservation can be reconciled manually',
          );
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
        if (!rows[0]) {
          throw new AgentBudgetError(
            'RESERVATION_CONFLICT',
            'The reservation ledger could not release capacity',
          );
        }
        await this.releaseTenantAggregate(manager, reservation);
        reservation.status = AgentBudgetReservationStatus.Released;
        reservation.resolvedAt = new Date();
        reservation.resolvedBy = resolution?.resolvedBy ?? null;
        reservation.resolutionNote = resolution?.resolutionNote ?? null;
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

  /**
   * Claims the tenant's UTC calendar-month allowance in the same transaction
   * as the workflow claim. A missing configuration is deliberate fail-closed
   * behavior for any tool that declares provider calls or monetary cost.
   */
  private async reserveTenantAggregate(
    manager: EntityManager,
    tenantId: string,
    currency: string,
    units: AgentBudgetUnits,
  ): Promise<string | null> {
    if (units.providerCallUnits === 0 && units.costMinorUnits === 0)
      return null;

    await manager.query(
      `INSERT INTO "tenant_agent_budget_usage" (
         "tenantId", "windowStart", "currency"
       )
       SELECT t."id", date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date,
              t."agentBudgetCurrency"
         FROM "tenants" t
        WHERE t."id" = $1
          AND t."agentMonthlyProviderCallLimit" IS NOT NULL
          AND t."agentMonthlyCostLimitMinorUnits" IS NOT NULL
          AND btrim(t."agentBudgetCurrency") = $2
       ON CONFLICT ("tenantId", "windowStart") DO NOTHING`,
      [tenantId, currency],
    );
    const [rows] = (await manager.query(
      `UPDATE "tenant_agent_budget_usage" u
          SET "providerCallReserved" = u."providerCallReserved" + $3,
              "costReservedMinorUnits" = u."costReservedMinorUnits" + $4,
              "updatedAt" = now()
         FROM "tenants" t
        WHERE u."tenantId" = $1
          AND u."windowStart" = date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
          AND t."id" = u."tenantId"
          AND btrim(u."currency") = $2
          AND btrim(t."agentBudgetCurrency") = $2
          AND u."providerCallUsed" + u."providerCallReserved" + $3
                <= t."agentMonthlyProviderCallLimit"
          AND u."costUsedMinorUnits" + u."costReservedMinorUnits" + $4
                <= t."agentMonthlyCostLimitMinorUnits"
       RETURNING u."windowStart"`,
      [tenantId, currency, units.providerCallUnits, units.costMinorUnits],
    )) as [Array<{ windowStart: string | Date }>, number];
    if (!rows[0]) {
      throw new AgentBudgetError(
        'BUDGET_EXHAUSTED',
        'Tenant aggregate Agent budget is unavailable or exhausted',
      );
    }
    const windowStart = rows[0].windowStart;
    return windowStart instanceof Date
      ? windowStart.toISOString().slice(0, 10)
      : windowStart;
  }

  /** Finalizes the same aggregate window reserved before external work. */
  private async commitTenantAggregate(
    manager: EntityManager,
    reservation: AgentBudgetReservation,
    actualCostMinorUnits: number,
  ): Promise<void> {
    if (!reservation.aggregateWindowStart) return;
    const [rows] = (await manager.query(
      `UPDATE "tenant_agent_budget_usage" u
          SET "providerCallReserved" = u."providerCallReserved" - $3,
              "providerCallUsed" = u."providerCallUsed" + $3,
              "costReservedMinorUnits" = u."costReservedMinorUnits" - $4,
              "costUsedMinorUnits" = u."costUsedMinorUnits" + $5,
              "updatedAt" = now()
        WHERE u."tenantId" = $1 AND u."windowStart" = $2
          AND u."providerCallReserved" >= $3
          AND u."costReservedMinorUnits" >= $4
          AND (
            $5 <= $4 OR EXISTS (
              SELECT 1 FROM "tenants" t
               WHERE t."id" = u."tenantId"
                 AND btrim(t."agentBudgetCurrency") = btrim(u."currency")
                 AND u."costUsedMinorUnits" + u."costReservedMinorUnits" - $4 + $5
                       <= t."agentMonthlyCostLimitMinorUnits"
            )
          )
       RETURNING u."tenantId"`,
      [
        reservation.tenantId,
        reservation.aggregateWindowStart,
        reservation.providerCallUnits,
        reservation.costMinorUnits,
        actualCostMinorUnits,
      ],
    )) as [Array<{ tenantId: string }>, number];
    if (!rows[0]) {
      throw new AgentBudgetError(
        'BUDGET_EXHAUSTED',
        'Actual provider cost exceeds the tenant aggregate Agent budget',
      );
    }
  }

  /** Releases aggregate capacity only after the external effect is disproved. */
  private async releaseTenantAggregate(
    manager: EntityManager,
    reservation: AgentBudgetReservation,
  ): Promise<void> {
    if (!reservation.aggregateWindowStart) return;
    const [rows] = (await manager.query(
      `UPDATE "tenant_agent_budget_usage"
          SET "providerCallReserved" = "providerCallReserved" - $3,
              "costReservedMinorUnits" = "costReservedMinorUnits" - $4,
              "updatedAt" = now()
        WHERE "tenantId" = $1 AND "windowStart" = $2
          AND "providerCallReserved" >= $3
          AND "costReservedMinorUnits" >= $4
       RETURNING "tenantId"`,
      [
        reservation.tenantId,
        reservation.aggregateWindowStart,
        reservation.providerCallUnits,
        reservation.costMinorUnits,
      ],
    )) as [Array<{ tenantId: string }>, number];
    if (!rows[0]) {
      throw new AgentBudgetError(
        'RESERVATION_CONFLICT',
        'Tenant aggregate reservation no longer exists',
      );
    }
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

  private validateManualResolution(
    resolvedBy: string | undefined,
    resolutionNote: string | undefined,
  ): void {
    if (!resolvedBy?.trim() || resolvedBy.length > 200) {
      throw new AgentBudgetError(
        'RESERVATION_CONFLICT',
        'Manual reconciliation requires a bounded reviewer identity',
      );
    }
    if (
      !resolutionNote?.trim() ||
      resolutionNote.length < 10 ||
      resolutionNote.length > 2000
    ) {
      throw new AgentBudgetError(
        'RESERVATION_CONFLICT',
        'Manual reconciliation requires a 10-2000 character evidence note',
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
