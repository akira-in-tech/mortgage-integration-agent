import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { CaseList } from './CaseList';
import { CASES_QUERY } from '../graphql/queries';

const { hasDemoSandboxMock, createDemoSandboxCaseMock } = vi.hoisted(() => ({
  hasDemoSandboxMock: vi.fn(),
  createDemoSandboxCaseMock: vi.fn(),
}));

vi.mock('../demo-sandbox', () => ({
  hasDemoSandbox: hasDemoSandboxMock,
  createDemoSandboxCase: createDemoSandboxCaseMock,
}));

const existingCase = {
  __typename: 'LoanCase',
  id: '10000000-0000-4000-8000-000000000001',
  borrowerId: 'synthetic-borrower-1',
  requestedAmount: 425000,
  loanType: 'CONVENTIONAL',
  status: 'DRAFT',
  createdAt: '2026-09-03T12:00:00.000Z',
};

const casesQueryMock: MockedResponse = {
  request: {
    query: CASES_QUERY,
    variables: { status: null, first: 20 },
  },
  result: {
    data: {
      cases: {
        __typename: 'CaseConnection',
        edges: [{ __typename: 'CaseEdge', cursor: 'c1', node: existingCase }],
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
      },
    },
  },
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('CaseList — sandbox "New case" (M7-074)', () => {
  it('shows no "New case" affordance outside a guest sandbox', async () => {
    hasDemoSandboxMock.mockReturnValue(false);

    render(
      <MockedProvider mocks={[casesQueryMock]}>
        <CaseList selectedCaseId={null} onSelectCase={vi.fn()} />
      </MockedProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText('synthetic-borrower-1')).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('button', { name: /New case/ }),
    ).not.toBeInTheDocument();
  });

  it('creates a second case in the same sandbox, refreshes the list, and selects the new case', async () => {
    hasDemoSandboxMock.mockReturnValue(true);
    createDemoSandboxCaseMock.mockResolvedValue(
      '20000000-0000-4000-8000-000000000002',
    );
    const onSelectCase = vi.fn();
    const refetchedCases: MockedResponse = {
      ...casesQueryMock,
      result: {
        data: {
          cases: {
            __typename: 'CaseConnection',
            edges: [
              { __typename: 'CaseEdge', cursor: 'c1', node: existingCase },
              {
                __typename: 'CaseEdge',
                cursor: 'c2',
                node: {
                  ...existingCase,
                  id: '20000000-0000-4000-8000-000000000002',
                  borrowerId: 'synthetic-borrower-2',
                },
              },
            ],
            pageInfo: {
              __typename: 'PageInfo',
              hasNextPage: false,
              endCursor: null,
            },
          },
        },
      },
    };
    const user = userEvent.setup();

    render(
      <MockedProvider mocks={[casesQueryMock, refetchedCases]}>
        <CaseList selectedCaseId={null} onSelectCase={onSelectCase} />
      </MockedProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText('synthetic-borrower-1')).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: '+ New case' }));
    await user.type(
      screen.getByLabelText('Requested loan amount ($)'),
      '600000',
    );
    await user.type(
      screen.getByLabelText('Stated monthly income ($)'),
      '12000',
    );
    await user.click(screen.getByRole('button', { name: 'Create case' }));

    await waitFor(() =>
      expect(onSelectCase).toHaveBeenCalledWith(
        '20000000-0000-4000-8000-000000000002',
      ),
    );
    expect(createDemoSandboxCaseMock).toHaveBeenCalledWith({
      requestedAmount: 600000,
      statedMonthlyIncome: 12000,
    });
    await waitFor(() =>
      expect(screen.getByText('synthetic-borrower-2')).toBeInTheDocument(),
    );
    // The form closes and resets after a successful create, ready for the
    // next scenario.
    expect(
      screen.queryByLabelText('Requested loan amount ($)'),
    ).not.toBeInTheDocument();
  });

  it('shows a real error and keeps the form open when case creation fails', async () => {
    hasDemoSandboxMock.mockReturnValue(true);
    createDemoSandboxCaseMock.mockRejectedValue(
      new Error('Unable to create a new case.'),
    );
    const user = userEvent.setup();

    render(
      <MockedProvider mocks={[casesQueryMock]}>
        <CaseList selectedCaseId={null} onSelectCase={vi.fn()} />
      </MockedProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText('synthetic-borrower-1')).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: '+ New case' }));
    await user.click(screen.getByRole('button', { name: 'Create case' }));

    await waitFor(() =>
      expect(
        screen.getByText('Unable to create a new case.'),
      ).toBeInTheDocument(),
    );
    // The form stays open so the caller can retry without re-entering
    // anything they'd already typed.
    expect(
      screen.getByLabelText('Requested loan amount ($)'),
    ).toBeInTheDocument();
  });
});
