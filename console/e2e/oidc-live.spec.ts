import { expect, test } from '@playwright/test';

test.skip(
  process.env.RUN_LIVE_OIDC !== 'true',
  'Requires the local API, migrated PostgreSQL, and Keycloak realm.',
);

/**
 * Credential-backed release evidence for the complete browser identity path.
 * It is opt-in so the deterministic default gate remains runnable without
 * services or secrets; the seeded Keycloak account contains synthetic data.
 */
test('completes a live Keycloak login through the durable BFF session', async ({
  page,
}) => {
  let graphqlHeaders: Record<string, string> | undefined;
  page.on('request', (request) => {
    if (request.url().endsWith('/graphql')) graphqlHeaders = request.headers();
  });

  // The configured callback and post-logout URI use localhost. Starting on
  // the same hostname ensures cookie scope exactly matches the release flow.
  await page.goto('http://localhost:5173/');
  await page.getByRole('button', { name: 'Sign in with SSO' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page).toHaveURL(/\/realms\/mortgage-agent\/protocol\/openid-connect\/auth/);
  await page.locator('#username').fill('reviewer@example.com');
  await page.locator('#password').fill('reviewer-dev-password');
  await page.locator('#kc-login').click();

  await expect(page.getByRole('heading', { name: 'Cases' })).toBeVisible({
    timeout: 15_000,
  });
  await expect.poll(() => graphqlHeaders).toBeTruthy();
  expect(graphqlHeaders?.authorization).toBeUndefined();
  expect(graphqlHeaders?.['x-tenant-id']).toBe(
    '20000000-0000-4000-8000-000000000002',
  );
  expect(graphqlHeaders?.['x-csrf-token']).toBeTruthy();

  const cookies = await page.context().cookies('http://localhost:5173');
  expect(cookies.find((cookie) => cookie.name === 'meridian_session')).toMatchObject({
    httpOnly: true,
    sameSite: 'Lax',
  });
  expect(cookies.find((cookie) => cookie.name === 'meridian_csrf')).toMatchObject({
    httpOnly: false,
    sameSite: 'Lax',
  });
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        /accessToken|refreshToken|idToken|expiresAt/.test(key),
      ),
    ),
  ).toEqual([]);

  await page.getByRole('button', { name: 'Disconnect' }).click();
  await expect(
    page.getByRole('heading', { name: 'Connect to Meridian' }),
  ).toBeVisible({ timeout: 15_000 });
});
