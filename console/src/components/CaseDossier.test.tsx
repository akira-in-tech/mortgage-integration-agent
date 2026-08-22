import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { CaseDossier } from './CaseDossier';
import { CASE_QUERY } from '../graphql/queries';

const CASE_ID = 'case-1';

const CASE_RESULT = {
  case: {
    __typename: 'LoanCase',
    id: CASE_ID,
    borrowerId: 'borrower-1',
    requestedAmount: 300_000,
    loanType: 'CONVENTIONAL',
    statedMonthlyIncome: 9000,
    jurisdictionCode: 'US-CA',
    status: 'CONDITIONS_OPEN',
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    evidenceFacts: [
      {
        id: 'fact-1',
        factType: 'INCOME',
        sourceKind: 'SIMULATOR',
        sourceIdentifier: 'plaid-sim',
        value: { monthlyIncome: 9000 },
        observedAt: '2026-01-01T00:00:00Z',
        validThrough: null,
      },
    ],
    conditions: [
      {
        id: 'condition-1',
        code: 'INCOME_VERIFICATION',
        description: 'Verify income',
        status: 'OPEN',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ],
    timeline: [
      {
        kind: 'case.created',
        summary: 'Case created',
        timestamp: '2026-01-01T00:00:00Z',
        detail: null,
      },
    ],
    policyBinding: null,
    providerOperations: [],
    auditEvents: [
      {
        id: 'audit-1',
        action: 'CASE_CREATED',
        actorId: 'reviewer-1',
        resourceType: 'loan_case',
        resourceId: CASE_ID,
        reason: null,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ],
    communicationMessages: [],
  },
};

describe('CaseDossier', () => {
  it('renders every section as one continuous document from real case data', async () => {
    const mocks: MockedResponse[] = [
      {
        request: { query: CASE_QUERY, variables: { caseId: CASE_ID } },
        result: { data: CASE_RESULT },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <CaseDossier caseId={CASE_ID} onClose={() => {}} />
      </MockedProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText('borrower-1')).toBeInTheDocument(),
    );
    expect(screen.getByText('Loan summary')).toBeInTheDocument();
    expect(screen.getByText('Conditions (1)')).toBeInTheDocument();
    expect(screen.getByText('Evidence (1)')).toBeInTheDocument();
    expect(screen.getByText('Audit trail (1)')).toBeInTheDocument();
    expect(screen.getByText('INCOME_VERIFICATION')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
  });

  it('calls onClose when Close is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const mocks: MockedResponse[] = [
      {
        request: { query: CASE_QUERY, variables: { caseId: CASE_ID } },
        result: { data: CASE_RESULT },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <CaseDossier caseId={CASE_ID} onClose={onClose} />
      </MockedProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a real error message when the case fails to load', async () => {
    const mocks: MockedResponse[] = [
      {
        request: { query: CASE_QUERY, variables: { caseId: CASE_ID } },
        error: new Error('not found'),
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <CaseDossier caseId={CASE_ID} onClose={() => {}} />
      </MockedProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText(/not found/)).toBeInTheDocument(),
    );
  });
});
