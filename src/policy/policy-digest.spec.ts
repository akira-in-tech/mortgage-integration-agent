import 'reflect-metadata';
import { computeDigest } from './policy-digest';

describe('computeDigest', () => {
  it('is independent of object key order', () => {
    const a = { status: 'RESOLVED', versions: ['v1'] };
    const b = { versions: ['v1'], status: 'RESOLVED' };
    expect(computeDigest(a)).toBe(computeDigest(b));
  });

  it('is independent of nested object key order', () => {
    const a = { versions: [{ id: '1', from: '2025-01-01' }] };
    const b = { versions: [{ from: '2025-01-01', id: '1' }] };
    expect(computeDigest(a)).toBe(computeDigest(b));
  });

  it('changes when content changes', () => {
    const a = { status: 'RESOLVED', versions: ['v1'] };
    const b = { status: 'RESOLVED', versions: ['v2'] };
    expect(computeDigest(a)).not.toBe(computeDigest(b));
  });

  it('is sensitive to array order (arrays are not sorted)', () => {
    const a = { versions: ['v1', 'v2'] };
    const b = { versions: ['v2', 'v1'] };
    expect(computeDigest(a)).not.toBe(computeDigest(b));
  });
});
