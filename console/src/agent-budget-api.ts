import { request } from './api-client';

export interface AgentBudgetAggregateUsage {
  windowStart: string;
  enabled: boolean;
  currency: string | null;
  providerCallLimit: number | null;
  providerCallUsed: number;
  providerCallReserved: number;
  remainingProviderCalls: number | null;
  costLimitMinorUnits: number | null;
  costUsedMinorUnits: number;
  costReservedMinorUnits: number;
  remainingCostMinorUnits: number | null;
}

export interface AgentBudgetReservationQueueItem {
  id: string;
  ledgerId: string;
  idempotencyKey: string;
  units: {
    stepUnits: number;
    tokenUnits: number;
    providerCallUnits: number;
    costMinorUnits: number;
  };
  status: 'UNKNOWN';
  createdAt: string;
}

interface ReconcileInput {
  outcome: 'COMMITTED' | 'RELEASED';
  resolutionNote: string;
  actualCostMinorUnits?: number;
}

export function getAgentBudgetAggregateUsage() {
  return request<AgentBudgetAggregateUsage>(
    '/v1/agent-budget-reservations/aggregate-usage',
  );
}

export function listUnknownAgentBudgetReservations() {
  return request<AgentBudgetReservationQueueItem[]>(
    '/v1/agent-budget-reservations/unknown?limit=100',
  );
}

export function reconcileAgentBudgetReservation(
  reservationId: string,
  input: ReconcileInput,
) {
  return request(
    `/v1/agent-budget-reservations/${encodeURIComponent(reservationId)}/reconcile`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}
