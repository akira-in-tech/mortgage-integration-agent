import { encryptedJsonTransformer } from './encrypted-json.transformer';

describe('encryptedJsonTransformer', () => {
  const originalKeyRing = process.env.PROVIDER_DATA_ENCRYPTION_KEYS;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalKeyRing === undefined) {
      delete process.env.PROVIDER_DATA_ENCRYPTION_KEYS;
    } else {
      process.env.PROVIDER_DATA_ENCRYPTION_KEYS = originalKeyRing;
    }
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('stores an authenticated envelope and returns the original JSON value', () => {
    process.env.NODE_ENV = 'test';
    process.env.PROVIDER_DATA_ENCRYPTION_KEYS = `evidence-v1:${'a'.repeat(64)}`;
    const transformer = encryptedJsonTransformer('evidence-facts:value');
    const plaintext = { monthlyIncome: 9000, borrowerName: 'Synthetic User' };

    const stored = transformer.to(plaintext) as Record<string, unknown>;

    expect(JSON.stringify(stored)).not.toContain('Synthetic User');
    expect(stored).toMatchObject({ v: 1, alg: 'A256GCM', kid: 'evidence-v1' });
    expect(transformer.from(stored)).toEqual(plaintext);
  });

  it('binds ciphertext to its declared column purpose', () => {
    process.env.NODE_ENV = 'test';
    process.env.PROVIDER_DATA_ENCRYPTION_KEYS = `evidence-v1:${'b'.repeat(64)}`;
    const evidence = encryptedJsonTransformer('evidence-facts:value');
    const otherColumn = encryptedJsonTransformer('another-table:value');

    expect(() => otherColumn.from(evidence.to({ amount: 1 }))).toThrow(
      /authentication or decryption failed/,
    );
  });
});
