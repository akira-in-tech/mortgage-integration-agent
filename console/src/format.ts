export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatRelativeTime(isoDate: string): string {
  const then = new Date(isoDate).getTime();
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// A short, meaningful one-line summary per evidence type — the raw JSON
// `value` is a multi-field object (income has 4 fields, credit has 5,
// documents has 6); dumping it whole reads as noise in a summary card
// (and, unwrapped, overflows the page). The full JSON stays available in
// the Evidence tab's own detail table.
export function summarizeEvidenceValue(
  factType: string,
  value: unknown,
): string {
  if (typeof value !== 'object' || value === null) return String(value);
  const v = value as Record<string, unknown>;
  switch (factType) {
    case 'INCOME':
      return typeof v.monthlyIncome === 'number'
        ? `${formatCurrency(v.monthlyIncome)} / mo`
        : '—';
    case 'CREDIT':
      return typeof v.creditScore === 'number' ? `score ${v.creditScore}` : '—';
    case 'DOCUMENT':
      return v.allDocumentsValid
        ? 'All documents verified'
        : 'Some documents failed';
    case 'IDENTITY':
      return v.verified ? 'Verified' : 'Not verified';
    case 'ASSET':
      return typeof v.liquidAssets === 'number'
        ? formatCurrency(v.liquidAssets)
        : '—';
    default:
      return '—';
  }
}

const LOAN_TYPE_LABEL: Record<string, string> = {
  CONVENTIONAL: 'Conventional',
  FHA: 'FHA',
  VA: 'VA',
  JUMBO: 'Jumbo',
};

export function formatLoanType(loanType: string): string {
  return LOAN_TYPE_LABEL[loanType] ?? loanType;
}
