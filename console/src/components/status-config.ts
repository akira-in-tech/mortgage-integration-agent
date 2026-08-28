import type { CaseStatus } from '../graphql/types';

interface StatusConfig {
  label: string;
  background: string;
  color: string;
  icon?: 'alert' | 'flag' | 'check';
  dotColor?: string;
  /** Solid chart fill using the same semantic color as the status pill. */
  barColor: string;
}

// One semantic mapping serves every status-colored surface. Keeping these
// constants outside the component module also lets React Fast Refresh treat
// StatusPill.tsx as a component-only boundary.
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

/** Lifecycle order for axes and other fixed-order status summaries. */
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
