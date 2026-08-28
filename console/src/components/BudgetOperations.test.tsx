import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BudgetOperations } from './BudgetOperations';

const usage = {
  windowStart: '2026-08-01',
  enabled: true,
  currency: 'USD',
  providerCallLimit: 100,
  providerCallUsed: 20,
  providerCallReserved: 1,
  remainingProviderCalls: 79,
  costLimitMinorUnits: 10_000,
  costUsedMinorUnits: 2_000,
  costReservedMinorUnits: 250,
  remainingCostMinorUnits: 7_750,
};

const reservation = {
  id: '33333333-3333-4333-8333-333333333333',
  ledgerId: '44444444-4444-4444-8444-444444444444',
  idempotencyKey: 'workflow:tool:1',
  units: {
    stepUnits: 1,
    tokenUnits: 0,
    providerCallUnits: 1,
    costMinorUnits: 250,
  },
  status: 'UNKNOWN',
  createdAt: '2026-08-22T12:00:00.000Z',
};

afterEach(() => vi.unstubAllGlobals());

describe('BudgetOperations', () => {
  it('renders authoritative aggregate usage and the reviewer queue', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        jsonResponse(
          String(input).includes('aggregate-usage') ? usage : [reservation],
        ),
      ),
    );

    render(<BudgetOperations />);

    expect(await screen.findByText('79 / 100')).toBeInTheDocument();
    expect(screen.getByText('$77.50')).toBeInTheDocument();
    expect(screen.getByText('33333333')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('releases an UNKNOWN reservation only with reviewer evidence', async () => {
    let unresolved = true;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('aggregate-usage')) return jsonResponse(usage);
        if (init?.method === 'POST') {
          unresolved = false;
          return jsonResponse({ status: 'RELEASED' });
        }
        return jsonResponse(unresolved ? [reservation] : []);
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<BudgetOperations />);

    await user.click(await screen.findByRole('button', { name: 'Reconcile' }));
    const release = screen.getByRole('button', { name: 'Release capacity' });
    expect(release).toBeDisabled();
    await user.type(
      screen.getByLabelText('Evidence note'),
      'Provider confirms the request never reached its system.',
    );
    expect(release).toBeEnabled();
    await user.click(release);

    await waitFor(() =>
      expect(
        screen.getByText('No outcome-unknown reservations.'),
      ).toBeInTheDocument(),
    );
    const post = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'POST',
    );
    expect(post?.[1]?.body).toBe(
      JSON.stringify({
        outcome: 'RELEASED',
        resolutionNote:
          'Provider confirms the request never reached its system.',
      }),
    );
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
