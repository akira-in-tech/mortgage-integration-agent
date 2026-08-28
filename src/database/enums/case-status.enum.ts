/**
 * Section 6.1 — describes workflow readiness, not a formal credit decision.
 * Defined standalone, not inside loan-case.entity.ts: the Temporal workflow
 * (src/workflows/case-conditions.workflow.ts) needs this value at runtime
 * inside its sandboxed V8 isolate, which cannot load TypeORM's decorator
 * machinery — importing anything from an `@Entity()`-decorated file would
 * pull that in even if only the enum is used.
 */
export enum CaseStatus {
  DRAFT = 'DRAFT',
  COLLECTING_EVIDENCE = 'COLLECTING_EVIDENCE',
  CONDITIONS_OPEN = 'CONDITIONS_OPEN',
  WAITING_FOR_INFORMATION = 'WAITING_FOR_INFORMATION',
  WAITING_FOR_REVIEW = 'WAITING_FOR_REVIEW',
  READY_FOR_UNDERWRITING = 'READY_FOR_UNDERWRITING',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  CLOSED = 'CLOSED',
}
