import { DocumentContentCipher } from './document-content-cipher';

describe('DocumentContentCipher', () => {
  it('round-trips bytes only with the same case-bound AAD', () => {
    const cipher = new DocumentContentCipher(
      `current:${'a'.repeat(64)},previous:${'b'.repeat(64)}`,
    );
    const plaintext = Buffer.from('synthetic W-2 bytes', 'utf8');
    const encrypted = cipher.encrypt(plaintext, 'tenant-a:case-a:document-a');

    expect(encrypted).not.toEqual(plaintext);
    expect(cipher.decrypt(encrypted, 'tenant-a:case-a:document-a')).toEqual(
      plaintext,
    );
    expect(() =>
      cipher.decrypt(encrypted, 'tenant-a:case-b:document-a'),
    ).toThrow();
  });

  it('decrypts content encrypted with a still-retained rotation key', () => {
    const oldCipher = new DocumentContentCipher(`old:${'b'.repeat(64)}`);
    const encrypted = oldCipher.encrypt(
      Buffer.from('content'),
      'tenant:case:id',
    );
    const rotatingCipher = new DocumentContentCipher(
      `new:${'a'.repeat(64)},old:${'b'.repeat(64)}`,
    );

    expect(rotatingCipher.decrypt(encrypted, 'tenant:case:id').toString()).toBe(
      'content',
    );
  });
});
