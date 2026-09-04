import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { OverviewTab } from './OverviewTab';
import {
  SUBMIT_REVIEW_MUTATION,
  CHECK_POLICY_CHANGE_IMPACT_MUTATION,
} from '../../graphql/mutations';
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

  it('checking a policy version’s impact shows the real result, not a guess', async () => {
    const user = userEvent.setup();
    const caseWithBinding: LoanCase = {
      ...BASE_CASE,
      policyBinding: {
        id: 'binding-1',
        dependencyDigest: 'digest-1',
        contextKey: 'US-CA:CONVENTIONAL',
        boundAt: '2026-01-01T00:00:00Z',
        revalidateAfter: '2026-02-01T00:00:00Z',
        invalidatedAt: null,
        policySnapshot: {
          id: 'snapshot-1',
          resolutionStatus: 'RESOLVED',
          resolverVersion: '1',
          contextHash: 'hash-1',
          resolvedAt: '2026-01-01T00:00:00Z',
          versions: [
            {
              policyVersionId: 'new-version-1',
              ruleId: 'income-verification',
              version: '2026.1',
            },
          ],
        },
      },
    };
    const mocks: MockedResponse[] = [
      {
        request: {
          query: CHECK_POLICY_CHANGE_IMPACT_MUTATION,
          variables: {
            caseId: CASE_ID,
            input: { policyVersionId: 'new-version-1' },
          },
        },
        result: {
          data: {
            checkPolicyChangeImpact: {
              __typename: 'PolicyChangeImpactResult',
              assessed: true,
              assessmentId: 'assessment-1',
              impact: 'REQUIRES_REEVALUATION',
              reason: null,
              details: 'resolved policy version set changed from [v1] to [v2]',
            },
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <OverviewTab loanCase={caseWithBinding} />
      </MockedProvider>,
    );

    await user.click(
      screen.getByRole('button', { name: 'Check impact of a policy version' }),
    );
    expect(
      screen.getByRole('combobox', { name: 'Policy version' }),
    ).toHaveValue('new-version-1');
    expect(screen.getByText(/income-verification · 2026.1/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(
      await screen.findByText('Requires re-evaluation'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('resolved policy version set changed from [v1] to [v2]'),
    ).toBeInTheDocument();
  });

  it('shows why a check was not assessed, instead of a fabricated impact', async () => {
    const user = userEvent.setup();
    const caseWithBinding: LoanCase = {
      ...BASE_CASE,
      policyBinding: {
        id: 'binding-1',
        dependencyDigest: 'digest-1',
        contextKey: 'US-CA:CONVENTIONAL',
        boundAt: '2026-01-01T00:00:00Z',
        revalidateAfter: '2026-02-01T00:00:00Z',
        invalidatedAt: null,
        policySnapshot: {
          id: 'snapshot-2',
          resolutionStatus: 'RESOLVED',
          resolverVersion: '1',
          contextHash: 'hash-2',
          resolvedAt: '2026-01-01T00:00:00Z',
          versions: [
            {
              policyVersionId: 'unknown-version',
              ruleId: 'unknown-rule',
              version: 'candidate',
            },
          ],
        },
      },
    };
    const mocks: MockedResponse[] = [
      {
        request: {
          query: CHECK_POLICY_CHANGE_IMPACT_MUTATION,
          variables: {
            caseId: CASE_ID,
            input: { policyVersionId: 'unknown-version' },
          },
        },
        result: {
          data: {
            checkPolicyChangeImpact: {
              __typename: 'PolicyChangeImpactResult',
              assessed: false,
              assessmentId: null,
              impact: null,
              reason: 'no active policy binding exists for this case',
              details: null,
            },
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <OverviewTab loanCase={caseWithBinding} />
      </MockedProvider>,
    );

    await user.click(
      screen.getByRole('button', { name: 'Check impact of a policy version' }),
    );
    expect(
      screen.getByRole('combobox', { name: 'Policy version' }),
    ).toHaveValue('unknown-version');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(
      await screen.findByText(/no active policy binding exists for this case/),
    ).toBeInTheDocument();
  });
});
