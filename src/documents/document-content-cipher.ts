import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const DEV_KEY = createHash('sha256')
  .update('meridian-local-document-content-key')
  .digest();
const FORMAT_VERSION = 1;

/**
 * Encrypts document bytes before they cross the object-storage boundary.
 * The envelope carries only key-selection and AEAD material; the plaintext
 * hash and document metadata stay in the database lineage record, never in
 * the object key or bucket metadata.
 */
export class DocumentContentCipher {
  private readonly currentKeyId: string;
  private readonly keys: Map<string, Buffer>;

  constructor(keyRing = process.env.PROVIDER_DATA_ENCRYPTION_KEYS) {
    const entries = (keyRing ?? `local-v1:${DEV_KEY.toString('hex')}`).split(
      ',',
    );
    this.keys = new Map(
      entries.map((entry) => {
        const separator = entry.indexOf(':');
        const id = entry.slice(0, separator);
        const hex = entry.slice(separator + 1);
        if (
          !/^[A-Za-z0-9._-]{1,64}$/.test(id) ||
          !/^[0-9a-fA-F]{64}$/.test(hex)
        ) {
          throw new Error('invalid PROVIDER_DATA_ENCRYPTION_KEYS entry');
        }
        return [id, Buffer.from(hex, 'hex')];
      }),
    );
    this.currentKeyId = entries[0].slice(0, entries[0].indexOf(':'));
  }

  encrypt(plaintext: Buffer, aad: string): Buffer {
    const key = this.keys.get(this.currentKeyId);
    if (!key) throw new Error('current document encryption key is unavailable');
    const keyId = Buffer.from(this.currentKeyId, 'utf8');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(aad));
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    return Buffer.concat([
      Buffer.from([FORMAT_VERSION, keyId.length]),
      keyId,
      iv,
      cipher.getAuthTag(),
      ciphertext,
    ]);
  }

  decrypt(envelope: Buffer, aad: string): Buffer {
    const keyLength = envelope[1];
    if (
      envelope[0] !== FORMAT_VERSION ||
      !keyLength ||
      envelope.length < 30 + keyLength
    ) {
      throw new Error('invalid encrypted document envelope');
    }
    const keyId = envelope.subarray(2, 2 + keyLength).toString('utf8');
    const key = this.keys.get(keyId);
    if (!key) throw new Error('document encryption key is unavailable');
    const ivStart = 2 + keyLength;
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      envelope.subarray(ivStart, ivStart + 12),
    );
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(envelope.subarray(ivStart + 12, ivStart + 28));
    return Buffer.concat([
      decipher.update(envelope.subarray(ivStart + 28)),
      decipher.final(),
    ]);
  }
}
