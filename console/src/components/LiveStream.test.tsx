import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { LiveStream } from './LiveStream';
import { RECENT_ACTIVITY_QUERY } from '../graphql/queries';

describe('LiveStream', () => {
  it('renders real audit events newest-first from recentActivity, never a fabricated placeholder feed', async () => {
    const mocks: MockedResponse[] = [
      {
        request: { query: RECENT_ACTIVITY_QUERY, variables: { limit: 50 } },
        result: {
          data: {
            recentActivity: [
              {
                __typename: 'AuditEvent',
                id: 'audit-2',
                action: 'CASE_ESCALATED',
                actorId: 'reviewer-1',
                resourceType: 'loan_case',
                resourceId: 'case-2',
                reason: 'needs a human',
                createdAt: '2026-01-02T00:00:00Z',
              },
              {
                __typename: 'AuditEvent',
                id: 'audit-1',
                action: 'CASE_CREATED',
                actorId: 'reviewer-1',
                resourceType: 'loan_case',
                resourceId: 'case-1',
                reason: null,
                createdAt: '2026-01-01T00:00:00Z',
              },
            ],
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <LiveStream />
      </MockedProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText('CASE_ESCALATED')).toBeInTheDocument(),
    );
    expect(screen.getByText('CASE_CREATED')).toBeInTheDocument();
    expect(screen.getByText(/needs a human/)).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('shows a real empty state when there is no activity, not a spinner forever', async () => {
    const mocks: MockedResponse[] = [
      {
        request: { query: RECENT_ACTIVITY_QUERY, variables: { limit: 50 } },
        result: { data: { recentActivity: [] } },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <LiveStream />
      </MockedProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText('No activity recorded yet.')).toBeInTheDocument(),
    );
  });

  it('shows a real error message when the query fails', async () => {
    const mocks: MockedResponse[] = [
      {
        request: { query: RECENT_ACTIVITY_QUERY, variables: { limit: 50 } },
        error: new Error('network down'),
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <LiveStream />
      </MockedProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText(/network down/)).toBeInTheDocument(),
    );
  });
});
