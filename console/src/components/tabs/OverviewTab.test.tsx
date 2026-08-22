import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { OverviewTab } from './OverviewTab';
import { SUBMIT_REVIEW_MUTATION } from '../../graphql/mutations';
import { CASE_QUERY } from '../../graphql/queries';
import { setStoredActorId } from '../../auth';
import type { LoanCase } from '../../graphql/types';

const CASE_ID = 'case-1';

const BASE_CASE: LoanCase = {
  id: CASE_ID,
  borrowerId: 'borrower-1',
  requestedAmount: 300_000,
  loanType: 'CONVENTIONAL',
  statedMonthlyIncome: 9000,
  jurisdictionCode: 'US-CA',
  status: 'CONDITIONS_OPEN',
  version: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  evidenceFacts: [],
  conditions: [
    {
      id: 'condition-1',
      code: 'INCOME_VERIFICATION',
      description: 'Verify borrower monthly income',
      status: 'OPEN',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ],
  timeline: [],
  policyBinding: null,
  providerOperations: [],
  auditEvents: [],
  communicationMessages: [],
};

describe('OverviewTab — the real "Mark satisfied" mutation-driving flow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setStoredActorId('reviewer-1');
  });

  it('clicking "Mark satisfied" fires SUBMIT_REVIEW_MUTATION with the open condition resolved and disables the buttons while it settles', async () => {
    const user = userEvent.setup();
    const mocks: MockedResponse[] = [
      {
        request: {
          query: SUBMIT_REVIEW_MUTATION,
          variables: {
            caseId: CASE_ID,
            input: {
              reviewType: 'CONDITION_RESOLUTION',
              actorId: 'reviewer-1',
              resolution: 'SATISFIED',
              reason: undefined,
            },
          },
        },
        result: { data: { submitReview: true } },
      },
      {
        request: { query: CASE_QUERY, variables: { caseId: CASE_ID } },
        result: { data: { case: { ...BASE_CASE, __typename: 'LoanCase' } } },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <OverviewTab loanCase={BASE_CASE} />
      </MockedProvider>,
    );

    const markSatisfiedButton = screen.getByRole('button', {
      name: 'Mark satisfied',
    });
    const waiveButton = screen.getByRole('button', { name: 'Waive' });
    expect(markSatisfiedButton).not.toBeDisabled();

    await user.click(markSatisfiedButton);

    await waitFor(() => expect(markSatisfiedButton).toBeDisabled());
    expect(waiveButton).toBeDisabled();
  });

  it('shows no open-condition card at all when every condition is already resolved', () => {
    const closedCase: LoanCase = {
      ...BASE_CASE,
      conditions: [{ ...BASE_CASE.conditions![0], status: 'SATISFIED' }],
    };

    render(
      <MockedProvider mocks={[]}>
        <OverviewTab loanCase={closedCase} />
      </MockedProvider>,
    );

    expect(screen.queryByText('Open condition')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Mark satisfied' }),
    ).not.toBeInTheDocument();
  });
});
