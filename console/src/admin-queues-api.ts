// Talks to the two reviewer queues added in this slice:
//   1. provider operation intents whose real outcome is still unclear
//   2. data-disposition tasks waiting on a delete/anonymize/retain decision
// Both are plain REST routes, REVIEWER-only on the backend, using the
// same shared request() helper as Agent Budget Operations.
import { request } from './api-client';

export interface ProviderOperationIntentQueueItem {
  id: string;
  caseId: string;
  providerId: string;
  capability: string;
  state: string;
  createdAt: string;
}

export interface DataDispositionTaskQueueItem {
  id: string;
  caseId: string;
  taskType: string;
  status: string;
  reason: string;
  createdAt: string;
}

export function listProviderOperationIntentsNeedingReconciliation() {
  return request<ProviderOperationIntentQueueItem[]>(
    '/v1/provider-operation-intents/reconciling?limit=100',
  );
}

export function resolveProviderOperationIntent(
  intentId: string,
  input: {
    outcome: 'SUCCEEDED' | 'FAILED_FINAL' | 'CANCELLED';
    resolutionNote: string;
  },
) {
  return request<ProviderOperationIntentQueueItem>(
    `/v1/provider-operation-intents/${encodeURIComponent(intentId)}/resolve`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function listOpenDataDispositionTasks() {
  return request<DataDispositionTaskQueueItem[]>(
    '/v1/data-disposition-tasks/open?limit=100',
  );
}

export function resolveDataDispositionTask(
  taskId: string,
  input: { action: 'DELETE' | 'ANONYMIZE' | 'RETAIN' },
) {
  return request<DataDispositionTaskQueueItem>(
    `/v1/data-disposition-tasks/${encodeURIComponent(taskId)}/resolve`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}
