import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { useQuery } from '@apollo/client';
import { CASE_QUERY } from './graphql/queries';
import { SUBMIT_REVIEW_MUTATION, ESCALATE_CASE_MUTATION } from './graphql/mutations';
import { useCaseMutations } from './useCaseMutations';
import { setStoredActorId, clearStoredToken } from './auth';

const CASE_ID = 'case-1';

function caseData(status: string) {
  return {
    case: {
      __typename: 'LoanCase',
      id: CASE_ID,
      borrowerId: 'borrower-1',
      requestedAmount: 300_000,
      loanType: 'CONVENTIONAL',
      statedMonthlyIncome: 9000,
      jurisdictionCode: 'US-CA',
      status,
      version: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      evidenceFacts: [],
      conditions: [],
      timeline: [],
      policyBinding: null,
      providerOperations: [],
      auditEvents: [],
      communicationMessages: [],
    },
  };
}

function TestHarness({ onMutationsReady }: { onMutationsReady: (m: ReturnType<typeof useCaseMutations>) => void }) {
  const { data } = useQuery(CASE_QUERY, { variables: { caseId: CASE_ID } });
  const mutations = useCaseMutations(CASE_ID);
  onMutationsReady(mutations);
  return <div data-testid="status">{data?.case?.status ?? 'loading'}</div>;
}

describe('useCaseMutations', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setStoredActorId('reviewer-1');
  });

  afterEach(() => {
    clearStoredToken();
    window.localStorage.clear();
  });

  it('resolveCondition keeps resolvingCondition true through the ~2s settle window, then refetches to the caught-up status', async () => {
    const mocks: MockedResponse[] = [
      {
        request: { query: CASE_QUERY, variables: { caseId: CASE_ID } },
        result: { data: caseData('CONDITIONS_OPEN') },
      },
      {
        request: {
          query: SUBMIT_REVIEW_MUTATION,
          variables: {
            caseId: CASE_ID,
            input: { reviewType: 'CONDITION_RESOLUTION', actorId: 'reviewer-1', resolution: 'SATISFIED', reason: undefined },
          },
        },
        result: { data: { submitReview: true } },
      },
      // The mutation's own immediate refetchQueries — real system behavior:
      // the signal was delivered, but the workflow hasn't advanced status yet.
      {
        request: { query: CASE_QUERY, variables: { caseId: CASE_ID } },
        result: { data: caseData('CONDITIONS_OPEN') },
      },
      // The hook's own delayed second refetch, ~2s later — the workflow has
      // since caught up.
      {
        request: { query: CASE_QUERY, variables: { caseId: CASE_ID } },
        result: { data: caseData('READY_FOR_UNDERWRITING') },
      },
    ];

    let mutations!: ReturnType<typeof useCaseMutations>;
    render(
      <MockedProvider mocks={mocks}>
        <TestHarness onMutationsReady={(m) => (mutations = m)} />
      </MockedProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('CONDITIONS_OPEN'));
    expect(mutations.resolvingCondition).toBe(false);

    await act(async () => {
      await mutations.resolveCondition('SATISFIED');
    });

    // Immediately after the mutation resolves (signal delivered, immediate
    // refetch consumed), the settle window must still be holding — this is
    // the exact behavior the eventual-consistency fix (M6-007) added.
    expect(mutations.resolvingCondition).toBe(true);
    expect(screen.getByTestId('status')).toHaveTextContent('CONDITIONS_OPEN');

    // Real timers, not faked — the point of this test is proving the actual
    // ~2s settle window in useCaseMutations.ts is really there, not just
    // that some timer fires eventually.
    await new Promise((resolve) => setTimeout(resolve, 2_200));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('READY_FOR_UNDERWRITING'));
    expect(mutations.resolvingCondition).toBe(false);
  }, 8_000);

  it('escalate has no settle delay — a real synchronous compare-and-swap, unlike resolveCondition', async () => {
    const mocks: MockedResponse[] = [
      {
        request: { query: CASE_QUERY, variables: { caseId: CASE_ID } },
        result: { data: caseData('CONDITIONS_OPEN') },
      },
      {
        request: {
          query: ESCALATE_CASE_MUTATION,
          variables: { caseId: CASE_ID, input: { actorId: 'reviewer-1', reason: 'needs a human' } },
        },
        result: {
          data: {
            escalateCase: { __typename: 'LoanCase', id: CASE_ID, status: 'MANUAL_REVIEW', version: 2 },
          },
        },
      },
      {
        request: { query: CASE_QUERY, variables: { caseId: CASE_ID } },
        result: { data: caseData('MANUAL_REVIEW') },
      },
    ];

    let mutations!: ReturnType<typeof useCaseMutations>;
    render(
      <MockedProvider mocks={mocks}>
        <TestHarness onMutationsReady={(m) => (mutations = m)} />
      </MockedProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('CONDITIONS_OPEN'));

    await act(async () => {
      await mutations.escalate('needs a human');
    });

    // No pending settle window for escalate — status reflects immediately,
    // with no timer left to advance.
    expect(mutations.escalating).toBe(false);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('MANUAL_REVIEW'));
  });

  it('throws without ever calling the mutation when no reviewer identity is stored', async () => {
    window.localStorage.clear();
    const mocks: MockedResponse[] = [
      {
        request: { query: CASE_QUERY, variables: { caseId: CASE_ID } },
        result: { data: caseData('CONDITIONS_OPEN') },
      },
    ];

    let mutations!: ReturnType<typeof useCaseMutations>;
    render(
      <MockedProvider mocks={mocks}>
        <TestHarness onMutationsReady={(m) => (mutations = m)} />
      </MockedProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('CONDITIONS_OPEN'));

    await expect(mutations.resolveCondition('SATISFIED')).rejects.toThrow(/reconnect/i);
  });
});
