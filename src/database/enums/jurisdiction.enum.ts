/** Section 10.1: "jurisdiction codes and jurisdiction level". */
export enum JurisdictionLevel {
  FEDERAL = 'FEDERAL',
  STATE = 'STATE',
  LOCAL = 'LOCAL',
}

/**
 * Section 14.1 (`jurisdictions`: "...and supported coverage status");
 * Section 10.6: "No connector is described as complete coverage until
 * that coverage is reviewed and tested" — coverage is an explicit,
 * reviewed fact about a jurisdiction, never an implicit default.
 */
export enum JurisdictionCoverageStatus {
  COVERED = 'COVERED',
  PARTIAL = 'PARTIAL',
  NOT_COVERED = 'NOT_COVERED',
}
