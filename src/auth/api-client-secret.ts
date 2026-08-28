import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_KEY_LENGTH = 64;

/**
 * A fresh, random 32-byte hex secret — the half of the bearer token this
 * codebase never stores. Node's built-in `scrypt` (not a new dependency)
 * hashes it with a per-credential random salt, matching the `{salt}:
 * {digest}` shape `hashSecret`/`verifySecret` share.
 */
export function generateApiClientSecret(): string {
  return randomBytes(32).toString('hex');
}

export function hashApiClientSecret(secret: string): string {
  const salt = randomBytes(16).toString('hex');
  const digest = scryptSync(secret, salt, SCRYPT_KEY_LENGTH).toString('hex');
  return `${salt}:${digest}`;
}

export function verifyApiClientSecret(
  secret: string,
  hashedSecret: string,
): boolean {
  const [salt, digestHex] = hashedSecret.split(':');
  if (!salt || !digestHex) {
    return false;
  }
  const expected = scryptSync(secret, salt, SCRYPT_KEY_LENGTH);
  const actual = Buffer.from(digestHex, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
