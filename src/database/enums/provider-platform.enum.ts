/** Mirrors `ProviderCapability` (src/provider-platform/types.ts) as a persisted enum. */
export enum ProviderCapabilityStatus {
  INCOME = 'INCOME',
  ASSET = 'ASSET',
  CREDIT = 'CREDIT',
  IDENTITY = 'IDENTITY',
  DOCUMENT = 'DOCUMENT',
}

/** Mirrors `ProviderOperationIntentState` (src/provider-platform/types.ts) as a persisted enum. */
export enum ProviderOperationIntentStatus {
  PREPARED = 'PREPARED',
  DISPATCHED = 'DISPATCHED',
  SUCCEEDED = 'SUCCEEDED',
  FAILED_FINAL = 'FAILED_FINAL',
  OUTCOME_UNKNOWN = 'OUTCOME_UNKNOWN',
  RECONCILING = 'RECONCILING',
  CANCELLED = 'CANCELLED',
}

/**
 * M4-006's own scoped-down `ProviderActivation` (Section 11.4): a binary
 * kill switch, not the full ACTIVE/SUSPENDED/DISABLED state machine the
 * charter's fuller interface names — this codebase has no distinct real
 * meaning for SUSPENDED vs DISABLED yet (both would mean "don't dispatch"
 * with no different real consequence), so collapsing to two states is
 * honest rather than declaring a third value nothing differentiates.
 */
export enum ProviderAdapterState {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}
