/** Two states, matching `ProviderAdapterState`'s own binary precedent (M4-006) — this codebase has no distinct real meaning for an intermediate hold state yet. */
export enum LegalHoldStatus {
  ACTIVE = 'ACTIVE',
  RELEASED = 'RELEASED',
}
