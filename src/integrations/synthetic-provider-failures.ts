/**
 * Deterministic fault injection for the M2 synthetic launch scenario —
 * mirrors hasSyntheticDiscrepancy (case-conditions.activities.ts): no real
 * provider integration exists yet to observe actual failure modes from, so
 * a borrowerId-prefix trigger stands in for one, the same way test-mode
 * payment processors use magic card numbers to trigger specific declines.
 *
 * This module only simulates what a raw provider failure looks like
 * (shared by Plaid/credit/document simulators, since a real provider
 * failure is provider-agnostic at this level). Deciding which of these is
 * safe to retry is retry-classification INTELLIGENCE, and deliberately
 * lives in src/workflows/case-conditions.activities.ts instead — activities
 * interpret and normalize provider outcomes (Section 12.2), simulators
 * just simulate providers.
 */
export const SYNTHETIC_TRANSIENT_FAILURE_PREFIX =
  'SYNTHETIC-TRANSIENT-FAILURE-';
export const SYNTHETIC_TERMINAL_FAILURE_PREFIX = 'SYNTHETIC-TERMINAL-FAILURE-';

/** Provider failed in a way worth retrying (e.g. rate limit, timeout). */
export class SyntheticProviderTimeoutError extends Error {
  constructor(providerName: string) {
    super(`${providerName}: synthetic timeout (transient)`);
    this.name = 'SyntheticProviderTimeoutError';
  }
}

/** Provider rejected the request in a way retrying can never fix (e.g. malformed input, permanent denial). */
export class SyntheticProviderRejectionError extends Error {
  constructor(providerName: string) {
    super(`${providerName}: synthetic rejection (terminal)`);
    this.name = 'SyntheticProviderRejectionError';
  }
}

/** Called at the top of each simulator method, before generating any data. */
export function maybeThrowSyntheticProviderFailure(
  borrowerId: string,
  providerName: string,
): void {
  if (borrowerId.startsWith(SYNTHETIC_TRANSIENT_FAILURE_PREFIX)) {
    throw new SyntheticProviderTimeoutError(providerName);
  }
  if (borrowerId.startsWith(SYNTHETIC_TERMINAL_FAILURE_PREFIX)) {
    throw new SyntheticProviderRejectionError(providerName);
  }
}
