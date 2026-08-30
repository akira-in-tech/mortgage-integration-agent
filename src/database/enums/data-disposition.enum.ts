/** Section 14.1's `data_disposition_tasks`: "Lineage-aware retention, deletion, anonymization, hold, and verification state." Only `RETENTION_REVIEW` is ever created today (Section 14.2's consent-revocation rule, the one real trigger this codebase drives) — the rest mirror the charter's full vocabulary but have no caller yet (Known gap, same shape as `ProviderOperationIntentStatus`'s undriven `RECONCILING`/`CANCELLED`). */
export enum DataDispositionTaskType {
  RETENTION_REVIEW = 'RETENTION_REVIEW',
  DELETION = 'DELETION',
  ANONYMIZATION = 'ANONYMIZATION',
  LEGAL_HOLD = 'LEGAL_HOLD',
}

/**
 * Primary deletion/anonymization is synchronous, but COMPLETED remains
 * distinct from VERIFIED while managed backups are inside their retention
 * window. Verification requires separate expiry evidence.
 */
export enum DataDispositionTaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  VERIFIED = 'VERIFIED',
}

/**
 * Section 14.2: "Deletion verification records what was deleted,
 * anonymized, retained under a valid hold, or pending backup expiry without
 * retaining removed content. Pending expiry is represented by task status
 * COMPLETED plus the explicit backup-expiry fields; the outcome continues to
 * record what happened to the primary/derived records.
 */
export enum DataDispositionResolutionOutcome {
  DELETED = 'DELETED',
  ANONYMIZED = 'ANONYMIZED',
  RETAINED_UNDER_HOLD = 'RETAINED_UNDER_HOLD',
}
