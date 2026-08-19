/** Section 14.1's `data_disposition_tasks`: "Lineage-aware retention, deletion, anonymization, hold, and verification state." Only `RETENTION_REVIEW` is ever created today (Section 14.2's consent-revocation rule, the one real trigger this codebase drives) — the rest mirror the charter's full vocabulary but have no caller yet (Known gap, same shape as `ProviderOperationIntentStatus`'s undriven `RECONCILING`/`CANCELLED`). */
export enum DataDispositionTaskType {
  RETENTION_REVIEW = 'RETENTION_REVIEW',
  DELETION = 'DELETION',
  ANONYMIZATION = 'ANONYMIZATION',
  LEGAL_HOLD = 'LEGAL_HOLD',
}

/** Only `PENDING` is ever reached today — no resolution workflow exists yet to advance a task to `IN_PROGRESS`/`COMPLETED`/`VERIFIED` (Known gap). */
export enum DataDispositionTaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  VERIFIED = 'VERIFIED',
}
