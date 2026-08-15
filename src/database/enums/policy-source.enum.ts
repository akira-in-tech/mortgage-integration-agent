/**
 * Section 10.6: "Initial launch uses curated synthetic policy sources and
 * change events. Future official-source connectors are read-only ingestion
 * adapters..." — CONNECTOR is reserved for that future work, not used yet.
 */
export enum PolicySourceRetrievalMode {
  SYNTHETIC = 'SYNTHETIC',
  MANUAL = 'MANUAL',
  CONNECTOR = 'CONNECTOR',
}
