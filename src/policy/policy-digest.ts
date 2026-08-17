import { createHash } from 'node:crypto';

/**
 * Recursively sorts object keys so the same logical value always
 * serializes to the same string regardless of construction order —
 * same rationale as outbox-signer.ts's canonicalize, reused here because
 * a digest computed from a differently-ordered (but equal) object must
 * still compare equal.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
    );
    return Object.fromEntries(
      entries.map(([key, val]) => [key, canonicalize(val)]),
    );
  }
  return value;
}

/**
 * A plain content fingerprint, not an authenticated signature (compare
 * outbox-signer.ts, which signs with a secret because its output crosses
 * a trust boundary). This only needs to answer "did the thing this was
 * computed from change since last time" for one process talking to its
 * own database — no HMAC secret is warranted.
 */
export function computeDigest(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}
