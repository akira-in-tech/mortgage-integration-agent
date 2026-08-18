import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Section 15.3: "timestamped HMAC webhook signatures and replay
 * protection." Unlike `outbox-signer.ts` (which signs a `Record<string,
 * unknown>` read back from Postgres jsonb — key order not guaranteed, so
 * it canonicalizes first), this signs the exact JSON string the
 * dispatcher is about to put on the wire: the signer and the sender share
 * the same literal bytes by construction, so there is no round-trip
 * reordering to canonicalize away.
 *
 * The signed string is `${deliveryId}.${timestampIso}.${rawBody}` — the
 * same "id.timestamp.payload" shape widely used (Stripe, GitHub) so a
 * receiver's verification code has prior art to follow. Binding
 * `deliveryId` and `timestamp` into the signature (not just the body) is
 * what makes this genuinely replay-resistant: a captured, validly-signed
 * request can't be re-sent later with a new timestamp (the signature
 * would no longer match) or spliced onto a different delivery id.
 */
export function signWebhookDelivery(
  deliveryId: string,
  timestampIso: string,
  rawBody: string,
  secret: string,
): string {
  return createHmac('sha256', secret)
    .update(`${deliveryId}.${timestampIso}.${rawBody}`)
    .digest('hex');
}

export interface VerifyWebhookSignatureOptions {
  /** A signature timestamped further in the past than this is rejected as a possible replay of a captured request, even if the HMAC itself is valid. Defaults to 5 minutes. */
  maxAgeMs?: number;
  now?: Date;
}

export type VerifyWebhookSignatureResult =
  { valid: true } | { valid: false; reason: string };

const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * The receiver-side half of the contract above — exported so both this
 * codebase's own dispatch tests and a real external partner integrating
 * against these webhooks can verify a delivery the same way.
 */
export function verifyWebhookSignature(
  deliveryId: string,
  timestampIso: string,
  rawBody: string,
  signature: string,
  secret: string,
  options: VerifyWebhookSignatureOptions = {},
): VerifyWebhookSignatureResult {
  const timestampMs = Date.parse(timestampIso);
  if (Number.isNaN(timestampMs)) {
    return { valid: false, reason: 'timestamp is not a valid ISO 8601 date' };
  }
  const now = options.now ?? new Date();
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  if (Math.abs(now.getTime() - timestampMs) > maxAgeMs) {
    return {
      valid: false,
      reason: `timestamp is more than ${maxAgeMs}ms from now — possible replay`,
    };
  }

  const expected = signWebhookDelivery(
    deliveryId,
    timestampIso,
    rawBody,
    secret,
  );
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');
  const signatureValid =
    expectedBuf.length === actualBuf.length &&
    timingSafeEqual(expectedBuf, actualBuf);

  return signatureValid
    ? { valid: true }
    : { valid: false, reason: 'signature does not match' };
}
