import {
  SensitiveJsonCipher,
  SensitiveJsonDecryptionError,
} from './sensitive-json-cipher';

const KEY_V1 = `v1:${'a'.repeat(64)}`;
const KEY_V2 = `v2:${'b'.repeat(64)}`;

describe('SensitiveJsonCipher', () => {
  it('encrypts authenticated JSON without retaining plaintext', () => {
    const cipher = new SensitiveJsonCipher(KEY_V1, 'production');
    const envelope = cipher.encrypt(
      { monthlyIncome: 9000, borrowerId: 'sensitive-borrower' },
      'tenant:intent:finding',
    );

    expect(envelope).toMatchObject({ v: 1, alg: 'A256GCM', kid: 'v1' });
    expect(JSON.stringify(envelope)).not.toContain('sensitive-borrower');
    expect(cipher.decrypt(envelope, 'tenant:intent:finding')).toEqual({
      monthlyIncome: 9000,
      borrowerId: 'sensitive-borrower',
    });
  });

  it('detects ciphertext and AAD tampering', () => {
    const cipher = new SensitiveJsonCipher(KEY_V1, 'production');
    const envelope = cipher.encrypt({ value: 1 }, 'correct-aad');
    expect(() => cipher.decrypt(envelope, 'wrong-aad')).toThrow(
      SensitiveJsonDecryptionError,
    );
    expect(() =>
      cipher.decrypt(
        { ...envelope, ciphertext: `${envelope.ciphertext}x` },
        'correct-aad',
      ),
    ).toThrow(SensitiveJsonDecryptionError);
  });

  it('decrypts an old key while encrypting with the first rotation key', () => {
    const oldCipher = new SensitiveJsonCipher(KEY_V1, 'production');
    const oldEnvelope = oldCipher.encrypt({ value: 'old' }, 'aad');
    const rotating = new SensitiveJsonCipher(
      `${KEY_V2},${KEY_V1}`,
      'production',
    );

    expect(rotating.decrypt(oldEnvelope, 'aad')).toEqual({ value: 'old' });
    expect(rotating.encrypt({ value: 'new' }, 'aad').kid).toBe('v2');
  });

  it('rejects legacy plaintext in staging/production but reads it in synthetic development', () => {
    expect(() =>
      new SensitiveJsonCipher(KEY_V1, 'staging').decrypt({ value: 1 }, 'aad'),
    ).toThrow(/legacy plaintext/);
    expect(
      new SensitiveJsonCipher(KEY_V1, 'development').decrypt(
        { value: 1 },
        'aad',
      ),
    ).toEqual({ value: 1 });
  });
});
