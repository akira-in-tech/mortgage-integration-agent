import { getStoredToken } from './auth';
import { getOidcCsrfToken, getOidcTenantId, hasOidcSession } from './oidc';

const API_URL = import.meta.env.VITE_API_URL ?? '';

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

/** REST requests share the same cookie/tenant/CSRF boundary as Apollo. */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (hasOidcSession()) {
    const tenantId = getOidcTenantId();
    const csrfToken = getOidcCsrfToken();
    if (tenantId) headers.set('x-tenant-id', tenantId);
    if (csrfToken) headers.set('x-csrf-token', csrfToken);
  } else {
    const token = getStoredToken();
    if (token) headers.set('authorization', `Bearer ${token}`);
  }
  if (init.body) headers.set('content-type', 'application/json');

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: unknown;
    } | null;
    const message =
      typeof body?.message === 'string'
        ? body.message
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return (await response.json()) as T;
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
