import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

const CASE_ID = '10000000-0000-4000-8000-000000000001';
const TENANT_ID = '20000000-0000-4000-8000-000000000002';

async function replyWithCases(route: Route): Promise<void> {
  const body = route.request().postDataJSON() as { operationName?: string };
  if (body.operationName !== 'Cases') {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ errors: [{ message: 'Unexpected operation' }] }),
    });
    return;
  }
  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        cases: {
          edges: [
            {
              cursor: 'cursor-1',
              node: {
                id: CASE_ID,
                borrowerId: 'BORROWER-E2E',
                requestedAmount: 425000,
                loanType: 'CONVENTIONAL',
                status: 'WAITING_FOR_REVIEW',
                createdAt: '2026-01-01T00:00:00.000Z',
              },
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: 'cursor-1' },
        },
      },
    }),
  });
}

async function expectNoAutomaticAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test('connects with a bearer credential and sends it on the case query', async ({
  page,
}) => {
  let authorization: string | undefined;
  await page.route('**/graphql', async (route) => {
    authorization = route.request().headers().authorization;
    await replyWithCases(route);
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Connect to Meridian' }),
  ).toBeVisible();
  await expectNoAutomaticAccessibilityViolations(page);

  await page.getByLabel('Bearer token').fill('e2e-bearer-token');
  await page.getByLabel('Your name').fill('Akira Reviewer');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Cases' })).toBeVisible();
  await expect(page.getByText('BORROWER-E2E')).toBeVisible();
  expect(authorization).toBe('Bearer e2e-bearer-token');
  await page.getByLabel('Search borrower or case ID').fill('no-match');
  await expect(page.getByText('No cases match.')).toBeVisible();
  await expectNoAutomaticAccessibilityViolations(page);
});

test('discovers an OIDC tenant before sending tenant-scoped requests and performs RP logout', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('meridian.e2e.oidcSeeded')) return;
    sessionStorage.setItem('meridian.e2e.oidcSeeded', 'true');
    localStorage.setItem('meridian.oidc.accessToken', 'oidc-access-token');
    localStorage.setItem(
      'meridian.oidc.expiresAt',
      String(Date.now() + 10 * 60 * 1000),
    );
    localStorage.setItem('meridian.oidc.idToken', 'oidc-id-token');
    localStorage.setItem('meridian.actorId', 'reviewer@example.com');
  });

  let discoveryTenantHeader: string | undefined;
  let graphqlTenantHeader: string | undefined;
  await page.route('**/v1/auth/me/tenants', async (route) => {
    discoveryTenantHeader = route.request().headers()['x-tenant-id'];
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          tenantId: TENANT_ID,
          tenantName: 'E2E Lending',
          role: 'REVIEWER',
        },
      ]),
    });
  });
  await page.route('**/graphql', async (route) => {
    graphqlTenantHeader = route.request().headers()['x-tenant-id'];
    await replyWithCases(route);
  });
  await page.route('**/.well-known/openid-configuration', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        end_session_endpoint:
          'http://127.0.0.1:5173/oidc-logout-complete',
      }),
    });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Cases' })).toBeVisible();
  await expect(page.getByText('BORROWER-E2E')).toBeVisible();
  expect(discoveryTenantHeader).toBeUndefined();
  expect(graphqlTenantHeader).toBe(TENANT_ID);

  await page.getByRole('button', { name: 'Disconnect' }).click();
  await page.waitForURL(/oidc-logout-complete/);
  const logoutUrl = new URL(page.url());
  expect(logoutUrl.searchParams.get('client_id')).toBe('mortgage-agent-app');
  expect(logoutUrl.searchParams.get('id_token_hint')).toBe('oidc-id-token');
  expect(logoutUrl.searchParams.get('post_logout_redirect_uri')).toBe(
    'http://127.0.0.1:5173/',
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem('meridian.oidc.accessToken'),
    ),
  ).toBeNull();
});
