import { ValueTransformer } from 'typeorm';
import { SensitiveJsonCipher } from '../provider-platform/sensitive-json-cipher';

/**
 * TypeORM boundary for encrypted JSONB columns. A new cipher is resolved for
 * each conversion so a key-ring change is visible without module reload in
 * administrative rotation tests; production processes still restart when
 * secrets rotate. The AAD is deliberately column-specific.
 */
export function encryptedJsonTransformer(aad: string): ValueTransformer {
  return {
    to(value: unknown): unknown {
      if (value === null || value === undefined) return value;
      return new SensitiveJsonCipher().encrypt(value, aad);
    },
    from(value: unknown): unknown {
      if (value === null || value === undefined) return value;
      return new SensitiveJsonCipher().decrypt(value, aad);
    },
  };
}
