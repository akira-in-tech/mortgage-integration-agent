/**
 * Section 10.2's policy lifecycle verbs: "create proposed immutable
 * version -> ... -> activate without mutating prior versions -> ...
 * -> supersede, correct, withdraw, or retire while retaining history."
 * A released row is never mutated in place — a correction or supersession
 * is a new row with an explicit relationship back to the prior one
 * (PolicyVersion.supersedesVersionId), never a status flip on the original.
 */
export enum PolicyReleaseStatus {
  DRAFT = 'DRAFT',
  PROPOSED = 'PROPOSED',
  RELEASED = 'RELEASED',
  SUPERSEDED = 'SUPERSEDED',
  WITHDRAWN = 'WITHDRAWN',
  CORRECTED = 'CORRECTED',
}
