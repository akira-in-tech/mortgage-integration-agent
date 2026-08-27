import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminQueues } from './AdminQueues';

const intent = {
  id: '33333333-3333-4333-8333-333333333333',
  caseId: '44444444-4444-4444-8444-444444444444',
  providerId: 'plaid-income-simulator',
  capability: 'INCOME',
  state: 'OUTCOME_UNKNOWN',
  createdAt: '2026-08-22T12:00:00.000Z',
};

const task = {
  id: '55555555-5555-4555-8555-555555555555',
  caseId: '66666666-6666-4666-8666-666666666666',
  taskType: 'RETENTION_REVIEW',
  status: 'PENDING',
  reason: 'Consent was revoked.',
  createdAt: '2026-08-22T12:00:00.000Z',
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('AdminQueues', () => {
  it('renders both real queues at once', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('provider-operation-intents'))
          return jsonResponse([intent]);
        if (url.includes('data-disposition-tasks')) return jsonResponse([task]);
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    render(<AdminQueues />);

    expect(
      await screen.findByText('plaid-income-simulator'),
    ).toBeInTheDocument();
    expect(screen.getByText('Consent was revoked.')).toBeInTheDocument();
  });

  it('resolves a provider-operation intent with a real note, and removes it from that queue only', async () => {
    let intentStillOpen = true;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('data-disposition-tasks')) return jsonResponse([task]);
        if (init?.method === 'POST') {
          intentStillOpen = false;
          return jsonResponse({ ...intent, state: 'SUCCEEDED' });
        }
        return jsonResponse(intentStillOpen ? [intent] : []);
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<AdminQueues />);

    const providerSection = (
      await screen.findByRole('heading', {
        name: /Provider calls needing reconciliation/,
      })
    ).closest('section')!;
    await user.click(
      within(providerSection).getByRole('button', { name: 'Resolve' }),
    );
    const succeeded = screen.getByRole('button', { name: 'Succeeded' });
    expect(succeeded).toBeDisabled();
    await user.type(
      screen.getByLabelText(/What did you find/),
      'Confirmed complete via the provider dashboard.',
    );
    expect(succeeded).toBeEnabled();
    await user.click(succeeded);

    await waitFor(() =>
      expect(
        screen.getByText('Nothing needs reconciliation right now.'),
      ).toBeInTheDocument(),
    );
    // The other queue's task must still be there — resolving one queue
    // never touches the other.
    expect(screen.getByText('Consent was revoked.')).toBeInTheDocument();

    const post = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'POST',
    );
    expect(post?.[1]?.body).toBe(
      JSON.stringify({
        outcome: 'SUCCEEDED',
        resolutionNote: 'Confirmed complete via the provider dashboard.',
      }),
    );
  });

  it('resolves a data-disposition task with no note required', async () => {
    let taskStillOpen = true;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('provider-operation-intents')) return jsonResponse([]);
        if (init?.method === 'POST') {
          taskStillOpen = false;
          return jsonResponse({ ...task, status: 'VERIFIED' });
        }
        return jsonResponse(taskStillOpen ? [task] : []);
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<AdminQueues />);

    const dispositionSection = (
      await screen.findByRole('heading', { name: 'Data disposition' })
    ).closest('section')!;
    await user.click(
      within(dispositionSection).getByRole('button', { name: 'Resolve' }),
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(
        screen.getByText('No data-disposition tasks are waiting.'),
      ).toBeInTheDocument(),
    );
    const post = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'POST',
    );
    expect(post?.[1]?.body).toBe(JSON.stringify({ action: 'DELETE' }));
  });

  it('shows a real error for a queue the reviewer cannot load, without hiding the other queue', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('provider-operation-intents')) {
          return new Response(
            JSON.stringify({ message: 'REVIEWER role required.' }),
            {
              status: 403,
            },
          );
        }
        return jsonResponse([task]);
      }),
    );

    render(<AdminQueues />);

    expect(
      await screen.findByText(/REVIEWER role required/),
    ).toBeInTheDocument();
    expect(screen.getByText('Consent was revoked.')).toBeInTheDocument();
  });
});
