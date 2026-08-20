/** Section 14.1's `data_disposition_tasks`: "Lineage-aware retention, deletion, anonymization, hold, and verification state." Only `RETENTION_REVIEW` is ever created today (Section 14.2's consent-revocation rule, the one real trigger this codebase drives) — the rest mirror the charter's full vocabulary but have no caller yet (Known gap, same shape as `ProviderOperationIntentStatus`'s undriven `RECONCILING`/`CANCELLED`). */
export enum DataDispositionTaskType {
  RETENTION_REVIEW = 'RETENTION_REVIEW',
  DELETION = 'DELETION',
  ANONYMIZATION = 'ANONYMIZATION',
  LEGAL_HOLD = 'LEGAL_HOLD',
}

/**
 * M5-025: `resolve()` moves a task straight from `PENDING` to `VERIFIED`
 * in one atomic action — this codebase's real deletion/anonymization
 * execution is synchronous and fast, so a distinct `IN_PROGRESS`/
 * `COMPLETED` interval would have no genuine content to represent (no
 * real async execution spans time here); documented simplification, not
 * a silently skipped state.
 */
export enum DataDispositionTaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  VERIFIED = 'VERIFIED',
}

/**
 * Section 14.2: "Deletion verification records what was deleted,
 * anonymized, retained under a valid hold, or pending backup expiry
 * without retaining the removed content itself." `PENDING_BACKUP_EXPIRY`
 * is deliberately not a real value here — this codebase has no backup
 * subsystem at all, so there is nothing real to track a backup's own
 * expiry against (Known gap, not fabricated).
 */
export enum DataDispositionResolutionOutcome {
  DELETED = 'DELETED',
  ANONYMIZED = 'ANONYMIZED',
  RETAINED_UNDER_HOLD = 'RETAINED_UNDER_HOLD',
}
