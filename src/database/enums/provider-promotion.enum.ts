/** Section 11.4's `ProviderCertificationRecord.decision`. */
export enum ProviderCertificationDecision {
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  REVOKED = 'REVOKED',
}

/** Section 11.4's `ProviderApprovalRecord.decision`. */
export enum ProviderApprovalDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REVOKED = 'REVOKED',
}

/**
 * Section 11.4's `ProviderActivation.state`. Binary, not the charter's
 * fuller ACTIVE/SUSPENDED/DISABLED — mirrors `ProviderAdapterState`'s own
 * documented reasoning (M4-006): this codebase has no distinct real
 * consequence for SUSPENDED vs DISABLED, so a third value nothing
 * differentiates would be dishonest ceremony, not a real state.
 * Current-state-only (one row per manifest, updated in place), the same
 * simplicity tradeoff `ProviderAdapterStatus` already made — a full
 * append-only activation history is a documented Known gap.
 */
export enum ProviderActivationState {
  ACTIVE = 'ACTIVE',
  DEACTIVATED = 'DEACTIVATED',
}
