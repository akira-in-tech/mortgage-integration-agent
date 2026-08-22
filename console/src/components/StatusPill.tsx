import type { CaseStatus } from '../graphql/types';
import { AlertTriangleIcon, FlagIcon, CheckIcon } from './icons';

interface StatusConfig {
  label: string;
  background: string;
  color: string;
  icon?: 'alert' | 'flag' | 'check';
  dotColor?: string;
  /** Solid fill for a chart mark (Ops Dashboard) — same semantic color as
   * this status's pill, just the solid token instead of its wash. */
  barColor: string;
}

// Semantic mapping: gray = not started/terminal, blue = automated in-flight
// (no action needed), amber = needs a routine reviewer action, red = needs
// urgent reviewer action, green = successful outcome. Matches the approved
// mockup's own status system exactly. Exported so every status-colored
// surface (pill, chart) draws from this one reserved mapping (dataviz
// convention: status colors are never redefined per chart).
export const STATUS_CONFIG: Record<CaseStatus, StatusConfig> = {
  DRAFT: {
    label: 'Draft',
    background: 'var(--page)',
    color: 'var(--ink-2)',
    dotColor: 'var(--ink-muted)',
    barColor: 'var(--ink-muted)',
  },
  COLLECTING_EVIDENCE: {
    label: 'Collecting evidence',
    background: 'var(--accent-wash)',
    color: 'var(--blue-500)',
    dotColor: 'var(--blue-500)',
    barColor: 'var(--blue-500)',
  },
  WAITING_FOR_INFORMATION: {
    label: 'Waiting for information',
    background: 'var(--accent-wash)',
    color: 'var(--blue-500)',
    dotColor: 'var(--blue-500)',
    barColor: 'var(--blue-500)',
  },
  CONDITIONS_OPEN: {
    label: 'Conditions open',
    background: 'var(--warning-wash)',
    color: '#8a5c00',
    icon: 'alert',
    barColor: 'var(--warning)',
  },
  WAITING_FOR_REVIEW: {
    label: 'Waiting for review',
    background: 'var(--warning-wash)',
    color: '#8a5c00',
    icon: 'alert',
    barColor: 'var(--warning)',
  },
  MANUAL_REVIEW: {
    label: 'Manual review',
    background: 'var(--critical-wash)',
    color: '#8a2323',
    icon: 'flag',
    barColor: 'var(--critical)',
  },
  READY_FOR_UNDERWRITING: {
    label: 'Ready',
    background: 'var(--good-wash)',
    color: '#08672e',
    icon: 'check',
    barColor: 'var(--good)',
  },
  CLOSED: {
    label: 'Closed',
    background: 'var(--page)',
    color: 'var(--ink-2)',
    dotColor: 'var(--ink-muted)',
    barColor: 'var(--ink-muted)',
  },
};

// Lifecycle order, reused everywhere a fixed status ordering matters
// (the Ops Dashboard's bar chart axis).
export const STATUS_ORDER: CaseStatus[] = [
  'DRAFT',
  'COLLECTING_EVIDENCE',
  'WAITING_FOR_INFORMATION',
  'CONDITIONS_OPEN',
  'WAITING_FOR_REVIEW',
  'MANUAL_REVIEW',
  'READY_FOR_UNDERWRITING',
  'CLOSED',
];

export function StatusPill({ status }: { status: CaseStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className="pill"
      style={{ background: config.background, color: config.color }}
    >
      {config.icon === 'alert' && (
        <AlertTriangleIcon size={10} color="var(--warning)" />
      )}
      {config.icon === 'flag' && <FlagIcon size={10} color="var(--critical)" />}
      {config.icon === 'check' && <CheckIcon size={10} color="var(--good)" />}
      {!config.icon && (
        <span className="dot" style={{ background: config.dotColor }} />
      )}
      {config.label}
    </span>
  );
}
