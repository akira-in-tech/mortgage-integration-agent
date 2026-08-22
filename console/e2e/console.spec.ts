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
  await page.route('**/v1/auth/session', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: false, memberships: [] }),
    });
  });
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
  let graphqlTenantHeader: string | undefined;
  let graphqlCsrfHeader: string | undefined;
  let graphqlAuthorization: string | undefined;
  await page.route('**/v1/auth/session', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        userId: '30000000-0000-4000-8000-000000000003',
        email: 'reviewer@example.com',
        csrfToken: 'csrf-e2e-token',
        memberships: [
          {
            tenantId: TENANT_ID,
            tenantName: 'E2E Lending',
            role: 'REVIEWER',
          },
        ],
      }),
    });
  });
  await page.route('**/graphql', async (route) => {
    graphqlTenantHeader = route.request().headers()['x-tenant-id'];
    graphqlCsrfHeader = route.request().headers()['x-csrf-token'];
    graphqlAuthorization = route.request().headers().authorization;
    await replyWithCases(route);
  });
  await page.route('**/v1/auth/session/logout', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers()['x-csrf-token']).toBe('csrf-e2e-token');
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        logoutUrl: 'http://127.0.0.1:5173/oidc-logout-complete',
      }),
    });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Cases' })).toBeVisible();
  await expect(page.getByText('BORROWER-E2E')).toBeVisible();
  expect(graphqlTenantHeader).toBe(TENANT_ID);
  expect(graphqlCsrfHeader).toBe('csrf-e2e-token');
  expect(graphqlAuthorization).toBeUndefined();

  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        /accessToken|refreshToken|idToken|expiresAt/.test(key),
      ),
    ),
  ).toEqual([]);

  await page.getByRole('button', { name: 'Disconnect' }).click();
  await page.waitForURL(/oidc-logout-complete/);
});
