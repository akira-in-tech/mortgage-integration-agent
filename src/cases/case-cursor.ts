import { BadRequestException } from '@nestjs/common';

/**
 * Opaque forward-only cursor for `cases(first, after)` (Section 15.2/15.3:
 * "cursor pagination") — base64 of `${createdAt ISO}|${id}`, matching the
 * query's own `(createdAt, id)` DESC keyset ordering. The `id` tie-breaker
 * keeps pagination stable when two cases share the same millisecond
 * timestamp, a real possibility under a burst of creations.
 */
export interface CaseCursor {
  createdAt: Date;
  id: string;
}

export function encodeCaseCursor(cursor: CaseCursor): string {
  return Buffer.from(
    `${cursor.createdAt.toISOString()}|${cursor.id}`,
    'utf-8',
  ).toString('base64');
}

export function decodeCaseCursor(cursor: string): CaseCursor {
  const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
  const separatorIndex = decoded.lastIndexOf('|');
  const isoTimestamp =
    separatorIndex === -1 ? '' : decoded.slice(0, separatorIndex);
  const id = separatorIndex === -1 ? '' : decoded.slice(separatorIndex + 1);
  const createdAt = new Date(isoTimestamp);
  if (id.length === 0 || Number.isNaN(createdAt.getTime())) {
    throw new BadRequestException(`Malformed "after" cursor: ${cursor}`);
  }
  return { createdAt, id };
}
