const POSTGRES_UNIQUE_VIOLATION = '23505';

/**
 * Shared by every "insert, and if a concurrent request already won a
 * uniqueness race, read back and return its result instead of crashing"
 * pattern in this codebase (`CasesService.createCase`'s idempotency-key
 * race, `PolicyEvaluationService.evaluate()`'s one-active-binding-per-case
 * race) — one detection function so both stay in sync with how the
 * Postgres driver actually reports this.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === POSTGRES_UNIQUE_VIOLATION
  );
}
