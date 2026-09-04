import { expect, test, type Page } from '@playwright/test';

test.skip(
  process.env.RUN_STAGING_ACCEPTANCE !== 'true',
  'Mutates only disposable synthetic records in the deployed guest sandbox.',
);

async function startSandbox(page: Page): Promise<void> {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Connect to Meridian' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Try live sandbox' }).click();
  await expect(page.getByRole('heading', { name: 'Cases' })).toBeVisible();
  await expect(page.getByText(/^synthetic-borrower-/).first()).toBeVisible();
}

test.afterEach(async ({ page }) => {
  const disconnect = page.getByRole('button', { name: 'Disconnect' });
  if (await disconnect.isVisible().catch(() => false)) {
    await disconnect.click();
  }
});

test('clears tenant-shaped results before rendering a replacement sandbox', async ({
  page,
}) => {
  await startSandbox(page);
  const oldBorrower = await page
    .getByText(/^synthetic-borrower-/)
    .first()
    .textContent();
  expect(oldBorrower).toBeTruthy();

  await page.getByRole('button', { name: 'Disconnect' }).click();
  await expect(
    page.getByRole('heading', { name: 'Connect to Meridian' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Try live sandbox' }).click();
  await expect(page.getByRole('heading', { name: 'Cases' })).toBeVisible();

  await expect(page.getByText(oldBorrower as string, { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText(/^synthetic-borrower-/).first()).toBeVisible();
});

test('completes the guest workflow, governance actions, and operations views', async ({
  page,
}) => {
  await startSandbox(page);
  await page.getByRole('button', { name: 'Run simulated evaluation' }).click();

  await expect(
    page.getByText('VERIFY_INCOME_DISCREPANCY').first(),
  ).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Agent run reached PROPOSED_ACTION/)).toBeVisible();

  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  for (const type of ['INCOME', 'CREDIT', 'DOCUMENT', 'ASSET', 'IDENTITY']) {
    await expect(page.getByRole('cell', { name: type, exact: true })).toBeVisible();
  }

  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page
    .getByRole('button', { name: 'Check impact of a policy version' })
    .click();
  await expect(
    page.getByRole('combobox', { name: 'Policy version' }),
  ).not.toHaveValue('');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(
    page.getByText(/No impact|Requires re-evaluation|Ambiguous|Not assessed/),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Communications', exact: true }).click();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByText(/APPROVED · drafted/)).toBeVisible();
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText(/SENT · drafted/)).toBeVisible();

  await page.getByRole('button', { name: /Conditions 1/ }).click();
  await page.getByRole('button', { name: 'Mark satisfied' }).click();
  await expect(page.getByText('SATISFIED', { exact: true })).toBeVisible();
  await expect(page.getByText('Ready', { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole('button', { name: 'Audit', exact: true }).click();
  await expect(page.getByText('REVIEW_CONDITION_RESOLUTION')).toBeVisible();
  await page.getByRole('button', { name: 'View dossier' }).click();
  await expect(page.getByText('Case Dossier')).toBeVisible();
  await expect(page.getByText('Evidence (5)')).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  await page.getByRole('button', { name: 'Ops Dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Ops Dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Live Stream' }).click();
  await expect(page.getByText('COMMUNICATION_SENT')).toBeVisible();
  await page.getByRole('button', { name: 'Agent Budget Operations' }).click();
  await expect(page.getByText('Outcome-unknown reservations')).toBeVisible();
  await page.getByRole('button', { name: 'Admin Queues' }).click();
  await expect(page.getByText('Workflow operations')).toBeVisible();

  await page.getByRole('button', { name: 'Triage Queue' }).click();
  await page.getByRole('button', { name: '+ New case' }).click();
  await page.getByRole('spinbutton', { name: 'Requested loan amount ($)' }).fill('300000');
  await page.getByRole('spinbutton', { name: 'Stated monthly income ($)' }).fill('15000');
  await page.getByRole('button', { name: 'Create case' }).click();
  await expect(page.getByText('$300,000', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Escalate' }).click();
  await page
    .getByRole('textbox', { name: 'Reason for escalation…' })
    .fill('Synthetic staging acceptance test');
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Escalated for reviewer attention')).toBeVisible();
  await expect(page.getByText(/No evaluation is running/)).toBeVisible();
});
