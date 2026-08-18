import 'reflect-metadata';
import { signWebhookDelivery, verifyWebhookSignature } from './webhook-signer';

const SECRET = 'test-webhook-secret-32-characters';
const DELIVERY_ID = '11111111-1111-1111-1111-111111111111';
const TIMESTAMP = '2026-01-01T00:00:00.000Z';
const BODY = JSON.stringify({ id: DELIVERY_ID, type: 'loan_case.created' });

describe('webhook-signer', () => {
  it('produces a verifiable signature', () => {
    const signature = signWebhookDelivery(DELIVERY_ID, TIMESTAMP, BODY, SECRET);

    expect(
      verifyWebhookSignature(DELIVERY_ID, TIMESTAMP, BODY, signature, SECRET, {
        now: new Date(TIMESTAMP),
      }),
    ).toEqual({ valid: true });
  });

  it('fails verification for a tampered body', () => {
    const signature = signWebhookDelivery(DELIVERY_ID, TIMESTAMP, BODY, SECRET);
    const tamperedBody = JSON.stringify({
      id: DELIVERY_ID,
      type: 'loan_case.deleted',
    });

    expect(
      verifyWebhookSignature(
        DELIVERY_ID,
        TIMESTAMP,
        tamperedBody,
        signature,
        SECRET,
        { now: new Date(TIMESTAMP) },
      ).valid,
    ).toBe(false);
  });

  it('fails verification for a delivery id spliced onto a different signature', () => {
    const signature = signWebhookDelivery(DELIVERY_ID, TIMESTAMP, BODY, SECRET);
    const otherDeliveryId = '22222222-2222-2222-2222-222222222222';

    expect(
      verifyWebhookSignature(
        otherDeliveryId,
        TIMESTAMP,
        BODY,
        signature,
        SECRET,
        { now: new Date(TIMESTAMP) },
      ).valid,
    ).toBe(false);
  });

  it('fails verification with the wrong secret', () => {
    const signature = signWebhookDelivery(DELIVERY_ID, TIMESTAMP, BODY, SECRET);

    expect(
      verifyWebhookSignature(
        DELIVERY_ID,
        TIMESTAMP,
        BODY,
        signature,
        'a-different-secret-value',
        { now: new Date(TIMESTAMP) },
      ).valid,
    ).toBe(false);
  });

  it('fails verification for a malformed signature without throwing', () => {
    expect(
      verifyWebhookSignature(
        DELIVERY_ID,
        TIMESTAMP,
        BODY,
        'not-hex-!!',
        SECRET,
        {
          now: new Date(TIMESTAMP),
        },
      ).valid,
    ).toBe(false);
  });

  it('rejects a validly-signed request replayed long after its timestamp — the anti-replay half of the contract', () => {
    const signature = signWebhookDelivery(DELIVERY_ID, TIMESTAMP, BODY, SECRET);
    const muchLater = new Date(Date.parse(TIMESTAMP) + 10 * 60 * 1000); // +10 minutes

    const result = verifyWebhookSignature(
      DELIVERY_ID,
      TIMESTAMP,
      BODY,
      signature,
      SECRET,
      { now: muchLater, maxAgeMs: 5 * 60 * 1000 },
    );

    expect(result.valid).toBe(false);
    expect(result.valid ? undefined : result.reason).toMatch(/replay/);
  });

  it('accepts a signature still within the configured max age', () => {
    const signature = signWebhookDelivery(DELIVERY_ID, TIMESTAMP, BODY, SECRET);
    const aBitLater = new Date(Date.parse(TIMESTAMP) + 60 * 1000); // +1 minute

    expect(
      verifyWebhookSignature(DELIVERY_ID, TIMESTAMP, BODY, signature, SECRET, {
        now: aBitLater,
        maxAgeMs: 5 * 60 * 1000,
      }).valid,
    ).toBe(true);
  });

  it('rejects a malformed timestamp without throwing', () => {
    const result = verifyWebhookSignature(
      DELIVERY_ID,
      'not-a-timestamp',
      BODY,
      'irrelevant',
      SECRET,
    );
    expect(result.valid).toBe(false);
  });
});
