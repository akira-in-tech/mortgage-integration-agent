/**
 * Section 14.1's `webhook_endpoints`/`webhook_deliveries` tables (Section
 * 20 M4 scope: "webhook subscriptions, delivery retries, history, and
 * replay protection").
 */
export enum WebhookEndpointStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

/**
 * One row per (outbox event, webhook endpoint) pair — `PENDING` covers
 * both "never attempted yet" and "failed at least once, more retries
 * scheduled" (see `WebhookDelivery.nextAttemptAt`); `FAILED_FINAL` is
 * reached only after the dispatcher's own max-attempt budget is
 * exhausted, never on the first failure.
 */
export enum WebhookDeliveryStatus {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED_FINAL = 'FAILED_FINAL',
}
