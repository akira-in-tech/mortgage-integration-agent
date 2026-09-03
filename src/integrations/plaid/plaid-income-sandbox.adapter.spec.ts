import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { PlaidSandboxService } from './plaid-sandbox.service';
import { PlaidIncomeSandboxAdapter } from './plaid-income-sandbox.adapter';

// Requires real PLAID_SANDBOX_CLIENT_ID/PLAID_SANDBOX_SECRET (M4-007) —
// skip instead of failing when they aren't configured, the same
// "real infrastructure, not always available" convention this codebase's
// other describeOrSkip specs already use for DATABASE_URL/TEMPORAL_ADDRESS.
// This makes a REAL network call to sandbox.plaid.com — not a mock.
const HAS_PLAID_CREDENTIALS =
  !!process.env.PLAID_SANDBOX_CLIENT_ID && !!process.env.PLAID_SANDBOX_SECRET;
const describeOrSkip = HAS_PLAID_CREDENTIALS ? describe : describe.skip;

describeOrSkip(
  'PlaidIncomeSandboxAdapter (Section 11.1 AUTHORIZED_SANDBOX, M4-007)',
  () => {
    let adapter: PlaidIncomeSandboxAdapter;

    beforeAll(() => {
      const configService = new ConfigService({
        PLAID_SANDBOX_CLIENT_ID: process.env.PLAID_SANDBOX_CLIENT_ID,
        PLAID_SANDBOX_SECRET: process.env.PLAID_SANDBOX_SECRET,
      });
      adapter = new PlaidIncomeSandboxAdapter(
        new PlaidSandboxService(configService),
      );
    }, 30_000);

    // Identity/capability/mode is already proven generically (against a
    // mocked PlaidSandboxService, unconditionally, not gated on real
    // credentials) by provider-adapters.contract.spec.ts's own
    // 'plaid-income-authorized-sandbox' case — those properties don't
    // depend on which service instance is injected. What only this file can
    // prove is a real network round trip against sandbox.plaid.com itself.
    it('healthCheck() reaches the real sandbox.plaid.com host', async () => {
      const health = await adapter.healthCheck();
      expect(health.healthy).toBe(true);
    }, 15_000);

    it('submit() calls the real Plaid sandbox API end to end and returns real, normalized income data', async () => {
      const receipt = await adapter.submit({
        borrowerId: 'm4007-adapter-spec-borrower',
      });

      expect(receipt.status).toBe('COMPLETE');
      // Real data from Plaid's own "user_bank_income" test persona — this
      // codebase doesn't control these exact numbers, only asserts they're
      // real, sane values in the right shape (Section 11.2's canonical
      // finding shape, same as the SIMULATOR adapter's own output).
      expect(receipt.payload.monthlyIncome).toBeGreaterThan(0);
      expect([
        'FULL_TIME',
        'PART_TIME',
        'SELF_EMPLOYED',
        'UNEMPLOYED',
      ]).toContain(receipt.payload.employmentStatus);
      expect(receipt.payload.bankAccountAge).toBeGreaterThanOrEqual(0);
      expect(receipt.payload.incomeStability).toBeGreaterThanOrEqual(0);
      expect(receipt.payload.incomeStability).toBeLessThanOrEqual(100);

      const normalized = adapter.normalize(receipt.payload);
      expect(normalized).toEqual(receipt.payload);
    }, 30_000);
  },
);
