import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlatformAdminConsole } from './PlatformAdminConsole';
import {
  setStoredPlatformAdminToken,
  getStoredPlatformAdminToken,
} from '../platform-admin-auth';

const TOKEN = `11111111-1111-4111-8111-111111111111.${'a'.repeat(64)}`;

const manifest = {
  id: '22222222-2222-4222-8222-222222222222',
  providerId: 'plaid-sandbox',
  capability: 'INCOME',
  mode: 'AUTHORIZED_SANDBOX',
  version: 1,
  adapterVersion: '1.0.0',
  endpointAllowlist: ['https://sandbox.plaid.com'],
  dataClassifications: ['INCOME'],
  contentHash: 'a'.repeat(64),
  proposedBy: 'admin-1',
  proposedAt: '2026-08-01T00:00:00.000Z',
  validFrom: '2026-08-01T00:00:00.000Z',
  validUntil: null,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function routeFetch(
  handlers: Record<
    string,
    (init?: RequestInit) => Response | Promise<Response>
  >,
) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    for (const [match, handler] of Object.entries(handlers)) {
      if (url.includes(match)) return handler(init);
    }
    throw new Error(`unexpected request: ${url} ${init?.method ?? 'GET'}`);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('PlatformAdminConsole — a separate credential world from the tenant console', () => {
  it('shows the sign-in screen with no stored token, and connecting stores the pasted token', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      routeFetch({
        manifests: () => jsonResponse([]),
        activations: () => jsonResponse([]),
        'evaluation-reports': () => jsonResponse([]),
      }),
    );

    render(<PlatformAdminConsole onExit={() => {}} />);

    expect(getStoredPlatformAdminToken()).toBeNull();
    await user.type(
      screen.getByPlaceholderText(/00000000-0000-0000-0000-000000000000/),
      TOKEN,
    );
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    expect(getStoredPlatformAdminToken()).toBe(TOKEN);
    expect(
      await screen.findByText('No manifests proposed yet.'),
    ).toBeInTheDocument();
  });

  it('loads and renders real manifests and activations, not a guess', async () => {
    setStoredPlatformAdminToken(TOKEN);
    vi.stubGlobal(
      'fetch',
      routeFetch({
        manifests: () => jsonResponse([manifest]),
        activations: () => jsonResponse([]),
        'evaluation-reports': () => jsonResponse([]),
      }),
    );

    render(<PlatformAdminConsole onExit={() => {}} />);

    expect(await screen.findByText('plaid-sandbox')).toBeInTheDocument();
    expect(screen.getByText('AUTHORIZED_SANDBOX')).toBeInTheDocument();
    expect(screen.getByText('admin-1')).toBeInTheDocument();
  });

  it('proposing a manifest sends the real fields the admin typed, then refreshes the list', async () => {
    setStoredPlatformAdminToken(TOKEN);
    let proposed = false;
    const fetchMock = routeFetch({
      activations: () => jsonResponse([]),
      'evaluation-reports': () => jsonResponse([]),
      manifests: (init) => {
        if (init?.method === 'POST') {
          proposed = true;
          return jsonResponse(manifest);
        }
        return jsonResponse(proposed ? [manifest] : []);
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<PlatformAdminConsole onExit={() => {}} />);

    await screen.findByText('No manifests proposed yet.');
    await user.click(screen.getByRole('button', { name: 'Propose manifest' }));
    await user.type(screen.getByLabelText('Provider id'), 'plaid-sandbox');
    await user.type(screen.getByLabelText('Adapter version'), '1.0.0');
    await user.type(
      screen.getByLabelText(/Endpoint allowlist/),
      'https://sandbox.plaid.com',
    );
    await user.type(screen.getByLabelText(/Data classifications/), 'INCOME');
    await user.click(screen.getByRole('button', { name: 'Propose' }));

    await waitFor(() =>
      expect(screen.getByText('plaid-sandbox')).toBeInTheDocument(),
    );
    const post = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith('/manifests') && init?.method === 'POST',
    );
    expect(post?.[1]?.body).toBe(
      JSON.stringify({
        providerId: 'plaid-sandbox',
        capability: 'INCOME',
        mode: 'SIMULATOR',
        adapterVersion: '1.0.0',
        endpointAllowlist: ['https://sandbox.plaid.com'],
        dataClassifications: ['INCOME'],
      }),
    );
  });

  it('viewing a manifest loads its real detail, and recording a certification calls the real endpoint', async () => {
    setStoredPlatformAdminToken(TOKEN);
    const fetchMock = routeFetch({
      activations: () => jsonResponse([]),
      'evaluation-reports': () => jsonResponse([]),
      certifications: () =>
        jsonResponse({
          id: 'cert-1',
          environment: 'sandbox',
          certifiedBy: 'admin-1',
          decision: 'PASSED',
          evidenceRef: 'evidence://real-run',
          decidedAt: '2026-08-02T00:00:00.000Z',
          expiresAt: null,
        }),
      [`manifests/${manifest.id}`]: () =>
        jsonResponse({
          manifest,
          certifications: [],
          approvals: [],
          currentActivation: null,
        }),
      manifests: () => jsonResponse([manifest]),
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<PlatformAdminConsole onExit={() => {}} />);

    await user.click(await screen.findByRole('button', { name: 'View' }));
    expect(
      await screen.findByText('This tuple has never been activated.'),
    ).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText('evidence reference (link or note)'),
      'evidence://real-run',
    );
    await user.click(
      screen.getByRole('button', { name: 'Record certification' }),
    );

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).includes('certifications') && init?.method === 'POST',
      );
      expect(post?.[1]?.body).toBe(
        JSON.stringify({
          environment: 'sandbox',
          decision: 'PASSED',
          evidenceRef: 'evidence://real-run',
        }),
      );
    });
  });

  it('emergency-stopping an active provider calls the real deactivate endpoint with its real identity', async () => {
    setStoredPlatformAdminToken(TOKEN);
    const activation = {
      id: 'activation-1',
      providerId: 'plaid-sandbox',
      capability: 'INCOME',
      mode: 'AUTHORIZED_SANDBOX',
      manifestId: manifest.id,
      manifestVersion: 1,
      state: 'ACTIVE',
      activatedBy: 'admin-1',
      activatedAt: '2026-08-03T00:00:00.000Z',
    };
    let deactivated = false;
    const fetchMock = routeFetch({
      manifests: () => jsonResponse([]),
      'evaluation-reports': () => jsonResponse([]),
      deactivate: () => {
        deactivated = true;
        return jsonResponse({ ...activation, state: 'DEACTIVATED' });
      },
      activations: () =>
        jsonResponse(
          deactivated
            ? [{ ...activation, state: 'DEACTIVATED' }]
            : [activation],
        ),
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<PlatformAdminConsole onExit={() => {}} />);

    await user.click(
      await screen.findByRole('button', { name: 'Emergency-stop' }),
    );

    await waitFor(() =>
      expect(screen.queryByText('Emergency-stop')).not.toBeInTheDocument(),
    );
    const post = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith('/deactivate') && init?.method === 'POST',
    );
    expect(post?.[1]?.body).toBe(
      JSON.stringify({
        providerId: 'plaid-sandbox',
        capability: 'INCOME',
        mode: 'AUTHORIZED_SANDBOX',
      }),
    );
  });

  it('disconnecting clears the stored token and returns to the sign-in screen', async () => {
    setStoredPlatformAdminToken(TOKEN);
    vi.stubGlobal(
      'fetch',
      routeFetch({
        manifests: () => jsonResponse([]),
        activations: () => jsonResponse([]),
        'evaluation-reports': () => jsonResponse([]),
      }),
    );
    const user = userEvent.setup();
    render(<PlatformAdminConsole onExit={() => {}} />);

    await user.click(await screen.findByRole('button', { name: 'Disconnect' }));

    expect(getStoredPlatformAdminToken()).toBeNull();
    expect(
      await screen.findByPlaceholderText(
        /00000000-0000-0000-0000-000000000000/,
      ),
    ).toBeInTheDocument();
  });

  it('loads and renders real evaluation reports, not a guess', async () => {
    setStoredPlatformAdminToken(TOKEN);
    vi.stubGlobal(
      'fetch',
      routeFetch({
        manifests: () => jsonResponse([]),
        activations: () => jsonResponse([]),
        'evaluation-reports': () =>
          jsonResponse([
            {
              id: 'report-1',
              generatedAt: '2026-08-01T00:00:00.000Z',
              gitCommit: 'abc1234def',
              gitBranch: 'main',
              totalCases: 12,
              passed: 11,
              failed: 1,
              conditionRecall: 0.9,
              conditionPrecision: null,
            },
          ]),
      }),
    );

    render(<PlatformAdminConsole onExit={() => {}} />);

    expect(await screen.findByText('abc1234d')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('inspects immutable evaluation evidence with category metrics and failed fixtures', async () => {
    setStoredPlatformAdminToken(TOKEN);
    vi.stubGlobal(
      'fetch',
      routeFetch({
        manifests: () => jsonResponse([]),
        activations: () => jsonResponse([]),
        'evaluation-reports/report-1': () =>
          jsonResponse({
            id: 'report-1',
            report: {
              generatedAt: '2026-08-01T00:00:00.000Z',
              codeRevision: { gitCommit: 'abc1234def', gitBranch: 'main' },
              summary: {
                totalCases: 2,
                passed: 1,
                failed: 1,
                conditionRecall: 1,
                conditionPrecision: 0.5,
                byCategory: {
                  normal: { total: 1, passed: 1 },
                  boundary: { total: 1, passed: 0 },
                },
              },
              results: [
                {
                  fixtureId: 'boundary-income-difference',
                  category: 'boundary',
                  expectedOutcome: 'CONDITION_OPENED',
                  actualOutcome: 'NO_CONDITION',
                  actualConditionCode: undefined,
                  passed: false,
                  detail: 'Expected a condition at the threshold boundary.',
                },
              ],
            },
          }),
        'evaluation-reports': () =>
          jsonResponse([
            {
              id: 'report-1',
              generatedAt: '2026-08-01T00:00:00.000Z',
              gitCommit: 'abc1234def',
              gitBranch: 'main',
              totalCases: 2,
              passed: 1,
              failed: 1,
              conditionRecall: 1,
              conditionPrecision: 0.5,
            },
          ]),
      }),
    );
    const user = userEvent.setup();
    render(<PlatformAdminConsole onExit={() => {}} />);

    await user.click(await screen.findByRole('button', { name: 'Inspect' }));

    expect(
      await screen.findByRole('heading', { name: 'Evaluation run dashboard' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('50%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('boundary-income-difference')).toBeInTheDocument();
    expect(
      screen.getByText('Expected a condition at the threshold boundary.'),
    ).toBeInTheDocument();
  });

  it('downloading a report fetches the real file with the admin credential and hands the browser a real filename', async () => {
    setStoredPlatformAdminToken(TOKEN);
    const reportBody = JSON.stringify({ some: 'real report content' });
    let downloadAuthHeader: string | null = null;
    vi.stubGlobal(
      'fetch',
      routeFetch({
        manifests: () => jsonResponse([]),
        activations: () => jsonResponse([]),
        'evaluation-reports/report-1/download': (init) => {
          downloadAuthHeader =
            new Headers(init?.headers).get('authorization') ?? null;
          return new Response(reportBody, {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'content-disposition':
                'attachment; filename="evaluation-report-report-1.json"',
            },
          });
        },
        'evaluation-reports': () =>
          jsonResponse([
            {
              id: 'report-1',
              generatedAt: '2026-08-01T00:00:00.000Z',
              gitCommit: null,
              gitBranch: null,
              totalCases: 1,
              passed: 1,
              failed: 0,
              conditionRecall: null,
              conditionPrecision: null,
            },
          ]),
      }),
    );
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    const user = userEvent.setup();

    render(<PlatformAdminConsole onExit={() => {}} />);
    await user.click(await screen.findByRole('button', { name: 'Download' }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    expect(downloadAuthHeader).toBe(`Bearer ${TOKEN}`);
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    clickSpy.mockRestore();
  });
});
