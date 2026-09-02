/**
 * A research trigger describes why the platform needs new policy-analysis
 * material. It is deliberately not an evaluation outcome: no value here may
 * publish policy or make a lending decision.
 */
export enum PolicyResearchTrigger {
  NEW_SOURCE_REVISION = 'NEW_SOURCE_REVISION',
  SOURCE_FRESHNESS_EXPIRED = 'SOURCE_FRESHNESS_EXPIRED',
  COVERAGE_GAP = 'COVERAGE_GAP',
  APPLICABILITY_CONFLICT = 'APPLICABILITY_CONFLICT',
}

/** Durable queue state for citation-bound policy research. */
export enum PolicyResearchStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
