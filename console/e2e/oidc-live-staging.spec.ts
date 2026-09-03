import { expect, test } from '@playwright/test';

test.skip(
  process.env.RUN_LIVE_STAGING_OIDC !== 'true',
  'Requires the real deployed staging console URL and the real Cognito ' +
    'synthetic-reviewer credential (see docs/OPERATIONS.md).',
);

const CONSOLE_URL =
  process.env.STAGING_CONSOLE_URL ?? 'https://d136v61al3mroo.cloudfront.net';
const USERNAME = process.env.STAGING_REVIEWER_USERNAME ?? 'synthetic-reviewer';
const PASSWORD = process.env.STAGING_REVIEWER_PASSWORD;

/**
 * The real-Keycloak sibling test (oidc-live.spec.ts) proves the browser
 * identity path against local docker-compose. It has never proven the real
 * deployed edge: PROJECT_CHARTER.md's own Section 22 status named "a human
 * browser click-through of the Cognito hosted-UI login has never been
 * recorded against this deployed edge" as the one remaining open item after
 * M7-050/M7-052. This is that recording — a real Chromium browser driven by
 * Playwright, not a human's own hand on the mouse, but exercising the exact
 * same real CloudFront console, real Cognito hosted UI, and real BFF session
 * cookies a person would. The credential is the pre-provisioned
 * `aws_cognito_user.synthetic_reviewer` (terraform/staging/edge.tf), whose
 * password lives only in AWS Secrets Manager
 * (`mortgage-agent-staging/synthetic-reviewer-password`) -- never hardcoded
 * here, never checked into this repo, passed in only via environment
 * variable when this opt-in test is actually run.
 */
test('completes a live Cognito login against the real deployed staging edge', async ({
  page,
}) => {
  test.skip(!PASSWORD, 'STAGING_REVIEWER_PASSWORD is not set.');

  let graphqlHeaders: Record<string, string> | undefined;
  page.on('request', (request) => {
    if (request.url().endsWith('/graphql')) graphqlHeaders = request.headers();
  });

  await page.goto(CONSOLE_URL);
  await page.getByRole('button', { name: 'Sign in with SSO' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page).toHaveURL(/\.auth\.[a-z0-9-]+\.amazoncognito\.com\//, {
    timeout: 15_000,
  });
  // Cognito's classic hosted UI renders both a desktop and a mobile variant
  // of this form in the DOM at once (CSS hides one) -- both share the same
  // id, so this scopes to whichever is actually visible instead of
  // colliding on a `#id` locator.
  await page.locator('#signInFormUsername:visible').fill(USERNAME);
  await page.locator('#signInFormPassword:visible').fill(PASSWORD as string);
  await page.locator('input[name="signInSubmitButton"]:visible').click();

  // The staging console has no seeded case data behind the synthetic
  // reviewer's tenant (unlike the local Keycloak fixture) -- a real,
  // successful post-login screen is the observable evidence here, not a
  // specific case list.
  await expect(
    page.getByRole('heading', { name: 'Cases' }),
  ).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => graphqlHeaders).toBeTruthy();
  expect(graphqlHeaders?.authorization).toBeUndefined();
  expect(graphqlHeaders?.['x-tenant-id']).toMatch(
    /^[0-9a-f-]{36}$/,
  );
  expect(graphqlHeaders?.['x-csrf-token']).toBeTruthy();

  const cookies = await page
    .context()
    .cookies(CONSOLE_URL);
  expect(cookies.find((cookie) => cookie.name === 'meridian_session')).toMatchObject(
    { httpOnly: true, sameSite: 'Lax' },
  );
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
