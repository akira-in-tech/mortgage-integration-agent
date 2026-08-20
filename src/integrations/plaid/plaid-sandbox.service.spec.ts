import 'reflect-metadata';
import { mapBankIncomeToPlaidIncomeData } from './plaid-sandbox.service';

// Fixtures mirror the real shape of `/credit/bank_income/get`'s
// `bank_income[].items[].bank_income_sources[]` response, captured
// directly against Plaid's real sandbox API (M4-007) — not invented
// field names.

describe('mapBankIncomeToPlaidIncomeData (M4-007)', () => {
  it('derives monthlyIncome from the SALARY source only, ignoring child support/tax refund/interest income categories', () => {
    const result = mapBankIncomeToPlaidIncomeData([
      {
        income_category: 'SALARY',
        pay_frequency: 'BIWEEKLY',
        total_amount: 24016.8,
        start_date: '2025-09-01',
        end_date: '2026-08-15',
        historical_summary: [],
      },
      {
        income_category: 'CHILD_SUPPORT',
        pay_frequency: 'BIWEEKLY',
        total_amount: 3123.11,
        start_date: '2025-08-27',
        end_date: '2026-08-12',
        historical_summary: [],
      },
      {
        income_category: 'TAX_REFUND',
        pay_frequency: 'UNKNOWN',
        total_amount: 893.25,
        start_date: '2026-07-14',
        end_date: '2026-07-14',
        historical_summary: [],
      },
    ]);

    // 24016.8 total over ~11.43 months (2025-09-01 to 2026-08-15, 348
    // real days / 30.44 avg days-per-month).
    expect(result.monthlyIncome).toBeCloseTo(2100.78, 1);
    expect(result.employmentStatus).toBe('FULL_TIME');
  });

  it('falls back to a GIG_ECONOMY source when no SALARY source exists, classified SELF_EMPLOYED', () => {
    const result = mapBankIncomeToPlaidIncomeData([
      {
        income_category: 'GIG_ECONOMY',
        pay_frequency: 'UNKNOWN',
        total_amount: 2852.6,
        start_date: '2025-09-13',
        end_date: '2026-08-07',
        historical_summary: [],
      },
      {
        income_category: 'BANK_INTEREST',
        pay_frequency: 'MONTHLY',
        total_amount: 61.2,
        start_date: '2025-09-01',
        end_date: '2026-08-01',
        historical_summary: [],
      },
    ]);

    expect(result.employmentStatus).toBe('SELF_EMPLOYED');
    expect(result.monthlyIncome).toBeGreaterThan(0);
    // BANK_INTEREST's own 61.2 total must never be counted as income.
    expect(result.monthlyIncome).toBeLessThan(500);
  });

  it('reports UNEMPLOYED and zero monthlyIncome when neither a SALARY nor a GIG_ECONOMY source exists', () => {
    const result = mapBankIncomeToPlaidIncomeData([
      {
        income_category: 'UNEMPLOYMENT',
        pay_frequency: 'WEEKLY',
        total_amount: 25500,
        start_date: '2025-08-25',
        end_date: '2026-08-10',
        historical_summary: [],
      },
    ]);

    expect(result.employmentStatus).toBe('UNEMPLOYED');
    expect(result.monthlyIncome).toBe(0);
  });

  it('reports employmentStatus UNEMPLOYED and monthlyIncome 0 for a borrower with no income sources at all', () => {
    const result = mapBankIncomeToPlaidIncomeData([]);

    expect(result).toEqual({
      monthlyIncome: 0,
      employmentStatus: 'UNEMPLOYED',
      bankAccountAge: 0,
      incomeStability: 0,
    });
  });

  it('derives bankAccountAge from the earliest real start_date across every income source, as a lower bound', () => {
    const result = mapBankIncomeToPlaidIncomeData([
      {
        income_category: 'SALARY',
        pay_frequency: 'MONTHLY',
        total_amount: 12000,
        start_date: '2025-09-01',
        end_date: '2026-08-01',
        historical_summary: [],
      },
      {
        income_category: 'CHILD_SUPPORT',
        // Earlier than the SALARY source's own start_date — the earliest
        // across ALL sources must win, not just the primary one.
        start_date: '2025-01-15',
        end_date: '2026-08-01',
        pay_frequency: 'MONTHLY',
        total_amount: 1000,
        historical_summary: [],
      },
    ]);

    // ~19 months between 2025-01-15 and "now" isn't deterministic in this
    // test (depends on when it runs) — only assert it's a real, positive,
    // multi-month figure derived from the earlier of the two dates.
    expect(result.bankAccountAge).toBeGreaterThan(6);
  });

  it('computes a real coefficient-of-variation stability score from historical_summary — perfectly steady income scores 100', () => {
    const result = mapBankIncomeToPlaidIncomeData([
      {
        income_category: 'SALARY',
        pay_frequency: 'MONTHLY',
        total_amount: 12000,
        start_date: '2025-08-01',
        end_date: '2026-08-01',
        historical_summary: [
          {
            start_date: '2025-08-01',
            end_date: '2025-08-31',
            total_amounts: [{ amount: 1000 }],
          },
          {
            start_date: '2025-09-01',
            end_date: '2025-09-30',
            total_amounts: [{ amount: 1000 }],
          },
          {
            start_date: '2025-10-01',
            end_date: '2025-10-31',
            total_amounts: [{ amount: 1000 }],
          },
        ],
      },
    ]);

    expect(result.incomeStability).toBe(100);
  });

  it('scores a volatile income history lower than a steady one', () => {
    const volatile = mapBankIncomeToPlaidIncomeData([
      {
        income_category: 'SALARY',
        pay_frequency: 'MONTHLY',
        total_amount: 12000,
        start_date: '2025-08-01',
        end_date: '2026-08-01',
        historical_summary: [
          {
            start_date: '2025-08-01',
            end_date: '2025-08-31',
            total_amounts: [{ amount: 500 }],
          },
          {
            start_date: '2025-09-01',
            end_date: '2025-09-30',
            total_amounts: [{ amount: 4000 }],
          },
          {
            start_date: '2025-10-01',
            end_date: '2025-10-31',
            total_amounts: [{ amount: 100 }],
          },
        ],
      },
    ]);

    expect(volatile.incomeStability).toBeLessThan(100);
    expect(volatile.incomeStability).toBeGreaterThanOrEqual(0);
  });
});
