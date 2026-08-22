import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusPill } from './StatusPill';
import { STATUS_CONFIG, STATUS_ORDER } from './StatusPill';
import type { CaseStatus } from '../graphql/types';

describe('StatusPill', () => {
  it('renders every real CaseStatus value with a real, non-empty label', () => {
    const allStatuses: CaseStatus[] = [
      'DRAFT',
      'COLLECTING_EVIDENCE',
      'CONDITIONS_OPEN',
      'WAITING_FOR_INFORMATION',
      'WAITING_FOR_REVIEW',
      'READY_FOR_UNDERWRITING',
      'MANUAL_REVIEW',
      'CLOSED',
    ];
    for (const status of allStatuses) {
      const { unmount } = render(<StatusPill status={status} />);
      expect(screen.getByText(STATUS_CONFIG[status].label)).toBeInTheDocument();
      unmount();
    }
  });

  it('STATUS_ORDER names exactly the same 8 statuses STATUS_CONFIG defines, with none missing or duplicated', () => {
    expect(new Set(STATUS_ORDER).size).toBe(STATUS_ORDER.length);
    expect(STATUS_ORDER.slice().sort()).toEqual(
      Object.keys(STATUS_CONFIG).sort(),
    );
  });
});
