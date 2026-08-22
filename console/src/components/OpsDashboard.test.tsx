import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { OpsDashboard } from './OpsDashboard';
import { CASE_STATUS_COUNTS_QUERY } from '../graphql/queries';

describe('OpsDashboard', () => {
  it('renders real KPI totals and a bar per status, computed from caseStatusCounts — never a fabricated status row', async () => {
    const mocks: MockedResponse[] = [
      {
        request: { query: CASE_STATUS_COUNTS_QUERY },
        result: {
          data: {
            caseStatusCounts: [
              { __typename: 'CaseStatusCount', status: 'DRAFT', count: 4 },
              { __typename: 'CaseStatusCount', status: 'CONDITIONS_OPEN', count: 2 },
              { __typename: 'CaseStatusCount', status: 'READY_FOR_UNDERWRITING', count: 1 },
            ],
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <OpsDashboard />
      </MockedProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('stat-total')).toHaveTextContent('7')); // total = 4+2+1

    // Needs attention = CONDITIONS_OPEN(2) + WAITING_FOR_REVIEW(0) + MANUAL_REVIEW(0) = 2
    expect(screen.getByTestId('stat-attention')).toHaveTextContent('2');
    // Ready for underwriting = 1
    expect(screen.getByTestId('stat-ready')).toHaveTextContent('1');

    // Every status in STATUS_ORDER renders a row, including ones absent
    // from the real API response (rendered as a real, computed 0 — not
    // an API-fabricated zero row).
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('shows a real error message when the query fails, not a silent blank dashboard', async () => {
    const mocks: MockedResponse[] = [
      {
        request: { query: CASE_STATUS_COUNTS_QUERY },
        error: new Error('network down'),
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <OpsDashboard />
      </MockedProvider>,
    );

    await waitFor(() => expect(screen.getByText(/network down/)).toBeInTheDocument());
  });
});
