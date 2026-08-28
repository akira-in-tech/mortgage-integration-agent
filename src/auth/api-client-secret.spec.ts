import {
  generateApiClientSecret,
  hashApiClientSecret,
  verifyApiClientSecret,
} from './api-client-secret';

describe('api-client-secret', () => {
  it('generateApiClientSecret produces a fresh 64-hex-char secret each call', () => {
    const a = generateApiClientSecret();
    const b = generateApiClientSecret();

    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it('verifies a secret against its own hash', () => {
    const secret = generateApiClientSecret();
    const hashed = hashApiClientSecret(secret);

    expect(verifyApiClientSecret(secret, hashed)).toBe(true);
  });

  it('produces a different hash each call for the same secret (random salt)', () => {
    const secret = generateApiClientSecret();

    expect(hashApiClientSecret(secret)).not.toBe(hashApiClientSecret(secret));
  });

  it('rejects the wrong secret', () => {
    const secret = generateApiClientSecret();
    const hashed = hashApiClientSecret(secret);
    const wrongSecret = generateApiClientSecret();

    expect(verifyApiClientSecret(wrongSecret, hashed)).toBe(false);
  });

  it('rejects a malformed stored hash without throwing', () => {
    expect(verifyApiClientSecret('anything', 'not-a-valid-stored-hash')).toBe(
      false,
    );
    expect(verifyApiClientSecret('anything', '')).toBe(false);
  });
});
