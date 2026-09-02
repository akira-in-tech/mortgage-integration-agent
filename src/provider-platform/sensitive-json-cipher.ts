import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

export interface EncryptedJsonEnvelope {
  v: 1;
  alg: 'A256GCM';
  kid: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

const DEV_KEY = createHash('sha256')
  .update('meridian-local-provider-payload-key')
  .digest('hex');

export class SensitiveJsonDecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SensitiveJsonDecryptionError';
  }
}

/**
 * Authenticated field encryption for borrower-derived JSON fields. The first
 * key encrypts; remaining keys form the rotation window. Callers supply a
 * stable field/row binding as AAD so ciphertext cannot be silently moved to a
 * different protected location.
 */
export class SensitiveJsonCipher {
  private readonly currentKeyId: string;
  private readonly keys: Map<string, Buffer>;
  private readonly rejectLegacyPlaintext: boolean;

  constructor(
    keyRing = process.env.PROVIDER_DATA_ENCRYPTION_KEYS,
    nodeEnv = process.env.NODE_ENV ?? 'development',
  ) {
    const entries = (keyRing ?? `local-v1:${DEV_KEY}`).split(',');
    this.keys = new Map(
      entries.map((entry) => {
        const separator = entry.indexOf(':');
        const id = entry.slice(0, separator);
        const hex = entry.slice(separator + 1);
        if (
          !/^[a-zA-Z0-9._-]{1,64}$/.test(id) ||
          !/^[0-9a-fA-F]{64}$/.test(hex)
        ) {
          throw new Error('invalid PROVIDER_DATA_ENCRYPTION_KEYS entry');
        }
        return [id, Buffer.from(hex, 'hex')];
      }),
    );
    this.currentKeyId = entries[0].slice(0, entries[0].indexOf(':'));
    this.rejectLegacyPlaintext =
      nodeEnv === 'production' || nodeEnv === 'staging';
  }

  encrypt(value: unknown, aad: string): EncryptedJsonEnvelope {
    const key = this.keys.get(this.currentKeyId);
    if (!key) throw new Error('current provider encryption key is unavailable');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(aad));
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(value), 'utf8'),
      cipher.final(),
    ]);
    return {
      v: 1,
      alg: 'A256GCM',
      kid: this.currentKeyId,
      iv: iv.toString('base64url'),
      tag: cipher.getAuthTag().toString('base64url'),
      ciphertext: ciphertext.toString('base64url'),
    };
  }

  decrypt(value: unknown, aad: string): unknown {
    if (!this.isEnvelope(value)) {
      if (this.rejectLegacyPlaintext) {
        throw new SensitiveJsonDecryptionError(
          'legacy plaintext sensitive payload is forbidden in staging/production',
        );
      }
      return value;
    }
    try {
      const key = this.keys.get(value.kid);
      if (!key) throw new Error('unknown key id');
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(value.iv, 'base64url'),
      );
      decipher.setAAD(Buffer.from(aad));
      decipher.setAuthTag(Buffer.from(value.tag, 'base64url'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(value.ciphertext, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
      return JSON.parse(plaintext) as unknown;
    } catch {
      throw new SensitiveJsonDecryptionError(
        'sensitive payload authentication or decryption failed',
      );
    }
  }

  isEnvelope(value: unknown): value is EncryptedJsonEnvelope {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return false;
    const candidate = value as Partial<EncryptedJsonEnvelope>;
    return (
      candidate.v === 1 &&
      candidate.alg === 'A256GCM' &&
      typeof candidate.kid === 'string' &&
      typeof candidate.iv === 'string' &&
      typeof candidate.tag === 'string' &&
      typeof candidate.ciphertext === 'string'
    );
  }
}
