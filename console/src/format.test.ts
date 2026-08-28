import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatCurrency,
  formatRelativeTime,
  formatDateTime,
  formatLoanType,
  summarizeEvidenceValue,
} from './format';

describe('formatCurrency', () => {
  it('formats a whole-dollar USD amount with no decimals', () => {
    expect(formatCurrency(300_000)).toBe('$300,000');
  });

  it('rounds a fractional amount to the nearest dollar', () => {
    expect(formatCurrency(1234.6)).toBe('$1,235');
  });
});

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports "just now" for a timestamp under a minute old', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:30Z'));
    expect(formatRelativeTime('2026-01-01T00:00:00Z')).toBe('just now');
  });

  it('reports whole minutes under an hour', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:45:00Z'));
    expect(formatRelativeTime('2026-01-01T00:00:00Z')).toBe('45m ago');
  });

  it('reports whole hours under a day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T05:00:00Z'));
    expect(formatRelativeTime('2026-01-01T00:00:00Z')).toBe('5h ago');
  });

  it('reports whole days at or beyond 24 hours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-03T00:00:00Z'));
    expect(formatRelativeTime('2026-01-01T00:00:00Z')).toBe('2d ago');
  });
});

describe('formatDateTime', () => {
  it('renders a real localized date and time, not the raw ISO string', () => {
    const result = formatDateTime('2026-03-15T14:30:00Z');
    expect(result).not.toBe('2026-03-15T14:30:00Z');
    expect(result).toMatch(/2026/);
  });
});

describe('formatLoanType', () => {
  it('maps every known loan type to its display label', () => {
    expect(formatLoanType('CONVENTIONAL')).toBe('Conventional');
    expect(formatLoanType('FHA')).toBe('FHA');
    expect(formatLoanType('VA')).toBe('VA');
    expect(formatLoanType('JUMBO')).toBe('Jumbo');
  });

  it('falls back to the raw value for an unrecognized loan type', () => {
    expect(formatLoanType('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });
});

describe('summarizeEvidenceValue', () => {
  it('summarizes INCOME as a monthly figure', () => {
    expect(summarizeEvidenceValue('INCOME', { monthlyIncome: 9000 })).toBe(
      '$9,000 / mo',
    );
  });

  it('summarizes CREDIT as a score', () => {
    expect(summarizeEvidenceValue('CREDIT', { creditScore: 720 })).toBe(
      'score 720',
    );
  });

  it('summarizes DOCUMENT verification outcome', () => {
    expect(
      summarizeEvidenceValue('DOCUMENT', { allDocumentsValid: true }),
    ).toBe('All documents verified');
    expect(
      summarizeEvidenceValue('DOCUMENT', { allDocumentsValid: false }),
    ).toBe('Some documents failed');
  });

  it('summarizes IDENTITY verification outcome', () => {
    expect(summarizeEvidenceValue('IDENTITY', { verified: true })).toBe(
      'Verified',
    );
    expect(summarizeEvidenceValue('IDENTITY', { verified: false })).toBe(
      'Not verified',
    );
  });

  it('summarizes ASSET as a currency figure', () => {
    expect(summarizeEvidenceValue('ASSET', { liquidAssets: 50_000 })).toBe(
      '$50,000',
    );
  });

  it('falls back to an em dash for an unrecognized fact type', () => {
    expect(summarizeEvidenceValue('SOMETHING_NEW', { foo: 'bar' })).toBe('—');
  });

  it('falls back to an em dash when the expected numeric field is missing', () => {
    expect(summarizeEvidenceValue('INCOME', {})).toBe('—');
  });

  it('never returns raw unwrapped JSON — the exact overflow bug this helper fixed', () => {
    const value = {
      monthlyIncome: 9000,
      employer: 'Acme Corp',
      verifiedAt: '2026-01-01',
    };
    const result = summarizeEvidenceValue('INCOME', value);
    expect(result).not.toContain('{');
    expect(result).not.toContain('employer');
  });
});
