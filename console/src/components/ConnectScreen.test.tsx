import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectScreen } from './ConnectScreen';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('ConnectScreen — guest sandbox scenario (M7-071)', () => {
  it('creates a sandbox with no body fields when the scenario is never customized', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({
          authenticated: true,
          tenantId: '10000000-0000-4000-8000-000000000001',
          actorId: '20000000-0000-4000-8000-000000000001',
          csrfToken: 'csrf-token',
          expiresAt: '2026-01-01T00:00:00.000Z',
          caseId: '30000000-0000-4000-8000-000000000001',
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const onSandboxConnected = vi.fn();

    render(
      <ConnectScreen
        onConnected={vi.fn()}
        onSandboxConnected={onSandboxConnected}
        onPlatformAdmin={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Try live sandbox' }));

    expect(onSandboxConnected).toHaveBeenCalledWith(
      '30000000-0000-4000-8000-000000000001',
    );
    const [, init] = fetchMock.mock.calls[0] as [RequestInfo, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({});
  });

  it('sends the caller-entered scenario numbers, and omits a field left blank', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({
          authenticated: true,
          tenantId: '10000000-0000-4000-8000-000000000002',
          actorId: '20000000-0000-4000-8000-000000000002',
          csrfToken: 'csrf-token',
          expiresAt: '2026-01-01T00:00:00.000Z',
          caseId: '30000000-0000-4000-8000-000000000002',
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(
      <ConnectScreen
        onConnected={vi.fn()}
        onSandboxConnected={vi.fn()}
        onPlatformAdmin={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /Customize the scenario/ }),
    );
    await user.type(
      screen.getByLabelText('Requested loan amount ($)'),
      '612000',
    );
    // Stated monthly income left blank on purpose -- must be omitted, not
    // sent as an empty string or 0.
    await user.click(screen.getByRole('button', { name: 'Try live sandbox' }));

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      requestedAmount: 612000,
    });
  });
});
