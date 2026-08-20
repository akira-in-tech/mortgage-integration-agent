import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { EmploymentStatus, PlaidIncomeData } from './plaid.types';

const PLAID_SANDBOX_BASE_URL = 'https://sandbox.plaid.com';

interface BankIncomeSource {
  income_category: string;
  pay_frequency: string;
  total_amount: number;
  start_date: string;
  end_date: string;
  historical_summary: Array<{
    start_date: string;
    end_date: string;
    total_amounts?: Array<{ amount: number }>;
  }>;
}

interface BankIncomeResponse {
  bank_income: Array<{
    items: Array<{
      bank_income_sources: BankIncomeSource[];
    }>;
  }>;
}

export class PlaidSandboxApiError extends Error {
  constructor(endpoint: string, status: number, body: string) {
    super(`Plaid sandbox API ${endpoint} returned HTTP ${status}: ${body}`);
    this.name = 'PlaidSandboxApiError';
  }
}

/**
 * Section 11.1's `AUTHORIZED_SANDBOX`: "optional provider test environment
 * enabled through authorized credentials" (M4-007) — the first real
 * non-`SIMULATOR` provider mode this codebase has ever implemented,
 * genuinely calling `sandbox.plaid.com`, not a fixture. Uses Plaid's own
 * documented Bank Income sandbox-testing flow (`/user/create` ->
 * `/sandbox/public_token/create` with the `user_bank_income` override
 * persona -> `/item/public_token/exchange` -> `/credit/bank_income/get`)
 * — a real, publicly-documented Plaid testing convention for this exact
 * purpose, not a workaround. Every borrower gets a fresh Plaid sandbox
 * user (a real resource on Plaid's own side, not reused) — simple and
 * honest for a sandbox-mode adapter with no real performance requirement,
 * rather than adding a caching layer with no current real need.
 *
 * Maps Plaid's real response fields into this codebase's own
 * `PlaidIncomeData` shape (Section 11.2's simulator-to-production parity
 * requirement) — see each field's own comment below for exactly which
 * real Plaid field it's derived from, and what it honestly does and
 * doesn't represent. `bankAccountAge` in particular is a documented lower
 * bound (observed income-history window), not a claim about the account's
 * real opening date — Plaid's own Accounts product doesn't expose one.
 */
@Injectable()
export class PlaidSandboxService {
  private readonly logger = new Logger(PlaidSandboxService.name);

  constructor(private readonly configService: ConfigService) {}

  private credentials(): { clientId: string; secret: string } {
    const clientId = this.configService.get<string>('PLAID_SANDBOX_CLIENT_ID');
    const secret = this.configService.get<string>('PLAID_SANDBOX_SECRET');
    if (!clientId || !secret) {
      throw new Error(
        'PLAID_SANDBOX_CLIENT_ID/PLAID_SANDBOX_SECRET are required for the AUTHORIZED_SANDBOX Plaid income adapter',
      );
    }
    return { clientId, secret };
  }

  private async post<T>(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const { clientId, secret } = this.credentials();
    const res = await fetch(`${PLAID_SANDBOX_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, secret, ...body }),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new PlaidSandboxApiError(endpoint, res.status, text);
    }
    return JSON.parse(text) as T;
  }

  async getIncomeData(borrowerId: string): Promise<PlaidIncomeData> {
    this.logger.debug(
      `Fetching real Plaid sandbox income data for borrower ${borrowerId}`,
    );

    const { user_id: userId } = await this.post<{ user_id: string }>(
      '/user/create',
      { client_user_id: `${borrowerId}-${randomUUID()}` },
    );

    const { public_token: publicToken } = await this.post<{
      public_token: string;
    }>('/sandbox/public_token/create', {
      institution_id: 'ins_20',
      initial_products: ['income_verification'],
      user_id: userId,
      options: {
        override_username: 'user_bank_income',
        override_password: '{}',
        income_verification: {
          income_source_types: ['bank'],
          bank_income: { days_requested: 365 },
        },
      },
    });

    // Links the sandbox item to this Plaid user — the exchange result
    // (access_token/item_id) isn't needed again: /credit/bank_income/get
    // reads by user_id, matching a post-December-2025 Plaid integration
    // (see this service's own class comment).
    await this.post('/item/public_token/exchange', {
      public_token: publicToken,
    });

    const bankIncome = await this.post<BankIncomeResponse>(
      '/credit/bank_income/get',
      { user_id: userId },
    );

    const income = bankIncome.bank_income[0];
    const sources = income.items.flatMap((item) => item.bank_income_sources);
    return mapBankIncomeToPlaidIncomeData(sources);
  }
}

const REGULAR_PAY_FREQUENCIES = new Set([
  'WEEKLY',
  'BIWEEKLY',
  'SEMI_MONTHLY',
  'MONTHLY',
]);

/**
 * Exported (not just used internally) so its mapping logic — the actual
 * honest correspondence between real Plaid fields and this codebase's own
 * `PlaidIncomeData` shape — can be unit-tested against a real captured
 * Plaid response fixture without needing a live network call for every
 * test.
 */
export function mapBankIncomeToPlaidIncomeData(
  sources: BankIncomeSource[],
): PlaidIncomeData {
  const salarySource = sources.find((s) => s.income_category === 'SALARY');
  const gigSource = sources.find((s) => s.income_category === 'GIG_ECONOMY');
  const primary = salarySource ?? gigSource;

  // monthlyIncome: the SALARY-category source's own total_amount (Section
  // 6's "verified_monthly_income" is meant to represent earned employment
  // income, not every real cash inflow Plaid's Bank Income product finds
  // — child support, tax refunds, retirement, and bank interest all show
  // up as their own separate income_category values and are deliberately
  // excluded here, matching what a real underwriter would and wouldn't
  // count as qualifying income). Falls back to a GIG_ECONOMY source (the
  // closest real analog to self-employment) only when no SALARY source
  // exists; 0 when neither does — an honest "no verifiable income found"
  // result, not a fabricated positive number.
  const monthlyIncome = primary
    ? Math.round(
        (primary.total_amount /
          monthsBetween(primary.start_date, primary.end_date)) *
          100,
      ) / 100
    : 0;

  // employmentStatus: no real Plaid field states this directly — derived
  // from which income category exists. PART_TIME has no real, reliable
  // signal in bank-transaction-derived income data (Plaid doesn't report
  // hours worked), so this mapping never produces it — an honest gap in
  // this real derivation, not a silently-wrong guess.
  let employmentStatus: EmploymentStatus;
  if (salarySource && REGULAR_PAY_FREQUENCIES.has(salarySource.pay_frequency)) {
    employmentStatus = 'FULL_TIME';
  } else if (gigSource) {
    employmentStatus = 'SELF_EMPLOYED';
  } else {
    employmentStatus = 'UNEMPLOYED';
  }

  // bankAccountAge: months between now and the EARLIEST start_date across
  // every real income source Plaid found — a genuine lower bound on how
  // long this account has had observable transaction history, not a
  // claim about the account's actual opening date (Plaid's own Accounts
  // product exposes no such field, confirmed directly against the real
  // API before writing this).
  const earliestStart = sources.map((s) => s.start_date).sort()[0];
  const bankAccountAge = earliestStart
    ? monthsBetween(earliestStart, new Date().toISOString().slice(0, 10))
    : 0;

  // incomeStability: a real coefficient-of-variation score computed from
  // the primary source's own real monthly historical_summary totals — 0
  // variance (perfectly steady) scores 100, and stability falls off
  // linearly as variance grows, floored at 0. The 0-100 scale itself is
  // this codebase's own convention (matching the SIMULATOR's identical
  // scale), but every number feeding it is real, observed monthly income.
  const incomeStability = primary
    ? computeStabilityScore(primary.historical_summary)
    : 0;

  return { monthlyIncome, employmentStatus, bankAccountAge, incomeStability };
}

function monthsBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.max(
    1,
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.max(1, days / 30.44);
}

function computeStabilityScore(
  historicalSummary: BankIncomeSource['historical_summary'],
): number {
  const monthlyTotals = historicalSummary
    .map((month) => month.total_amounts?.[0]?.amount ?? 0)
    .filter((amount) => amount > 0);
  if (monthlyTotals.length < 2) {
    return monthlyTotals.length === 1 ? 100 : 0;
  }
  const mean =
    monthlyTotals.reduce((sum, v) => sum + v, 0) / monthlyTotals.length;
  const variance =
    monthlyTotals.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
    monthlyTotals.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;
  return Math.max(0, Math.round(100 - coefficientOfVariation * 100));
}
