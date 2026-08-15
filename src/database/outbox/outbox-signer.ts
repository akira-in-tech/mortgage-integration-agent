import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Recursively sorts object keys so the same logical payload always
 * serializes to the same string, regardless of construction order or of
 * Postgres jsonb's own key reordering (jsonb does not preserve the
 * original key order of stored objects) — without this, a signature
 * computed at write time and one recomputed after reading the row back
 * from the database would not reliably match.
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

/** Foundation-level HMAC over an outbox event payload (Section 15.3). */
export function signOutboxPayload(
  payload: Record<string, unknown>,
  secret: string,
): string {
  return createHmac('sha256', secret)
    .update(JSON.stringify(canonicalize(payload)))
    .digest('hex');
}

export function verifyOutboxSignature(
  payload: Record<string, unknown>,
  signature: string,
  secret: string,
): boolean {
  const expected = signOutboxPayload(payload, secret);
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');
  return (
    expectedBuf.length === actualBuf.length &&
    timingSafeEqual(expectedBuf, actualBuf)
  );
}
