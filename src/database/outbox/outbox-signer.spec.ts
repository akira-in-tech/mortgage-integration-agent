import 'reflect-metadata';
import { signOutboxPayload, verifyOutboxSignature } from './outbox-signer';

const SECRET = 'test-secret-at-least-16-chars';

describe('outbox-signer', () => {
  it('produces a verifiable signature for a payload', () => {
    const payload = { caseId: 'case-1', status: 'DRAFT' };
    const signature = signOutboxPayload(payload, SECRET);

    expect(verifyOutboxSignature(payload, signature, SECRET)).toBe(true);
  });

  it('is independent of object key order', () => {
    const a = { caseId: 'case-1', status: 'DRAFT', amount: 300_000 };
    const b = { amount: 300_000, status: 'DRAFT', caseId: 'case-1' };

    expect(signOutboxPayload(a, SECRET)).toBe(signOutboxPayload(b, SECRET));
  });

  it('is independent of nested object key order', () => {
    const a = { caseId: 'case-1', meta: { x: 1, y: 2 } };
    const b = { caseId: 'case-1', meta: { y: 2, x: 1 } };

    expect(signOutboxPayload(a, SECRET)).toBe(signOutboxPayload(b, SECRET));
  });

  it('fails verification for a tampered payload', () => {
    const payload = { caseId: 'case-1', status: 'DRAFT' };
    const signature = signOutboxPayload(payload, SECRET);

    expect(
      verifyOutboxSignature({ ...payload, status: 'READY' }, signature, SECRET),
    ).toBe(false);
  });

  it('fails verification with the wrong secret', () => {
    const payload = { caseId: 'case-1', status: 'DRAFT' };
    const signature = signOutboxPayload(payload, SECRET);

    expect(
      verifyOutboxSignature(payload, signature, 'a-different-secret-value'),
    ).toBe(false);
  });

  it('fails verification for a malformed signature without throwing', () => {
    const payload = { caseId: 'case-1' };
    expect(verifyOutboxSignature(payload, 'not-hex-!!', SECRET)).toBe(false);
  });
});
