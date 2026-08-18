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
