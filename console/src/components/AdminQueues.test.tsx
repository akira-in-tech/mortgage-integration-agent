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

const workflow = {
  caseId: '77777777-7777-4777-8777-777777777777',
  workflowId: 'case-conditions-77777777-7777-4777-8777-777777777777',
  runId: '88888888-8888-4888-8888-888888888888',
  status: 'CANCELLED' as const,
  caseStatus: 'MANUAL_REVIEW',
  caseUpdatedAt: '2026-08-30T12:00:00.000Z',
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
        if (url.includes('workflow-operations'))
          return jsonResponse([workflow]);
        throw new Error(`unexpected request: ${url}`);
      }),
    );

    render(<AdminQueues />);

    expect(
      await screen.findByText('plaid-income-simulator'),
    ).toBeInTheDocument();
    expect(screen.getByText('Consent was revoked.')).toBeInTheDocument();
    expect(screen.getByText('CANCELLED')).toBeInTheDocument();
  });

  it('starts recovery for a terminal workflow with a reviewer reason', async () => {
    let workflowOpen = true;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('provider-operation-intents')) return jsonResponse([]);
        if (url.includes('data-disposition-tasks')) return jsonResponse([]);
        if (init?.method === 'POST') {
          return jsonResponse({
            workflowId: workflow.workflowId,
            runId: 'new-run',
          });
        }
        return jsonResponse(workflowOpen ? [workflow] : []);
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<AdminQueues />);

    const section = (
      await screen.findByRole('heading', { name: 'Workflow operations' })
    ).closest('section')!;
    await user.click(within(section).getByRole('button', { name: 'Recover' }));
    const action = screen.getByRole('button', { name: 'Start recovery' });
    expect(action).toBeDisabled();
    await user.type(
      screen.getByLabelText(/What did you find/),
      'Confirmed that the interrupted run may be safely resumed.',
    );
    await user.click(action);

    await waitFor(() =>
      expect(
        screen.getByText('Recovery started as new-run.'),
      ).toBeInTheDocument(),
    );
    const post = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'POST',
    );
    expect(String(post?.[0])).toContain('/recover');
    expect(post?.[1]?.body).toBe(
      JSON.stringify({
        reason: 'Confirmed that the interrupted run may be safely resumed.',
      }),
    );
  });

  it('requests cancellation for a running workflow with a reviewer reason', async () => {
    const runningWorkflow = { ...workflow, status: 'RUNNING' as const };
    let workflowOpen = true;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('provider-operation-intents')) return jsonResponse([]);
        if (url.includes('data-disposition-tasks')) return jsonResponse([]);
        if (init?.method === 'POST') {
          workflowOpen = false;
          return jsonResponse({
            ...runningWorkflow,
            status: 'CANCELLED',
          });
        }
        return jsonResponse(workflowOpen ? [runningWorkflow] : []);
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<AdminQueues />);

    const section = (
      await screen.findByRole('heading', { name: 'Workflow operations' })
    ).closest('section')!;
    await user.click(within(section).getByRole('button', { name: 'Cancel' }));
    const action = screen.getByRole('button', { name: 'Request cancellation' });
    expect(action).toBeDisabled();
    await user.type(
      screen.getByLabelText(/What did you find/),
      'Reviewer requested cancellation pending a policy re-check.',
    );
    await user.click(action);

    await waitFor(() =>
      expect(
        screen.getByText(
          'Cancellation requested. Provider outcomes remain subject to reconciliation.',
        ),
      ).toBeInTheDocument(),
    );
    const post = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'POST',
    );
    expect(String(post?.[0])).toContain(
      `/workflow-runs/${runningWorkflow.runId}/cancel`,
    );
    expect(post?.[1]?.body).toBe(
      JSON.stringify({
        reason: 'Reviewer requested cancellation pending a policy re-check.',
      }),
    );
    // The queue re-fetches after a successful action — a running workflow
    // that a cancellation just moved off RUNNING no longer offers a redundant
    // Cancel action.
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Cancel' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('resolves a provider-operation intent with a real note, and removes it from that queue only', async () => {
    let intentStillOpen = true;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('data-disposition-tasks')) return jsonResponse([task]);
        if (url.includes('workflow-operations')) return jsonResponse([]);
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
        if (url.includes('workflow-operations')) return jsonResponse([]);
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
        if (url.includes('workflow-operations')) return jsonResponse([]);
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
