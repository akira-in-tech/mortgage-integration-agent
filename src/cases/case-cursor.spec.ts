import { encodeCaseCursor, decodeCaseCursor } from './case-cursor';

describe('case-cursor (Section 15.2/15.3, M6-002)', () => {
  it('round-trips createdAt/id through encode then decode', () => {
    const createdAt = new Date('2026-01-15T10:30:00.123Z');
    const id = '11111111-1111-1111-1111-111111111111';

    const cursor = encodeCaseCursor({ createdAt, id });
    const decoded = decodeCaseCursor(cursor);

    expect(decoded.createdAt.toISOString()).toBe(createdAt.toISOString());
    expect(decoded.id).toBe(id);
  });

  it('produces an opaque, non-guessable string, not the raw timestamp/id', () => {
    const cursor = encodeCaseCursor({
      createdAt: new Date('2026-01-15T10:30:00.000Z'),
      id: '11111111-1111-1111-1111-111111111111',
    });
    expect(cursor).not.toContain('2026-01-15');
    expect(cursor).not.toContain('11111111');
  });

  it('rejects a cursor with no separator', () => {
    expect(() =>
      decodeCaseCursor(Buffer.from('garbage').toString('base64')),
    ).toThrow(/Malformed "after" cursor/);
  });

  it('rejects a cursor whose timestamp half is not a valid date', () => {
    const malformed = Buffer.from('not-a-date|some-id', 'utf-8').toString(
      'base64',
    );
    expect(() => decodeCaseCursor(malformed)).toThrow(
      /Malformed "after" cursor/,
    );
  });

  it('rejects arbitrary non-base64 garbage', () => {
    expect(() => decodeCaseCursor('not-a-real-cursor')).toThrow(
      /Malformed "after" cursor/,
    );
  });
});
