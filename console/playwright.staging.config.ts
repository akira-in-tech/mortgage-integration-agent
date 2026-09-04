import { defineConfig, devices } from '@playwright/test';

/**
 * Acceptance gate for the deployed CloudFront console and its real ECS,
 * Temporal, PostgreSQL, and Qwen dependencies. It deliberately has no local
 * webServer: a green result must come from the supplied staging URL.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'guest-staging-acceptance.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 5 * 60_000,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL:
      process.env.STAGING_CONSOLE_URL ??
      'https://d136v61al3mroo.cloudfront.net',
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
