import 'reflect-metadata';
import { parsePolicyRule } from './policy-rule-parser';
import { evaluatePolicyRule } from './policy-rule-evaluator';
import { PolicyFactContext } from './policy-rule.types';

const RULE = parsePolicyRule({
  rule: {
    id: 'synthetic-income-discrepancy-review',
    version: '1.0.0',
    applicability: {
      jurisdictions: ['US-CA'],
      product: 'CONVENTIONAL_MORTGAGE',
      lifecycle_events: ['UNDERWRITING_REVIEW'],
      effective_from: '2027-01-01T00:00:00-08:00',
      transition_rule: 'application_received_on_or_after_effective_date',
    },
    when: {
      difference_percent: {
        left: 'application.monthly_income',
        right: 'evidence.verified_monthly_income',
        greater_than: 10,
      },
    },
    outcome: {
      condition: 'VERIFY_INCOME_DISCREPANCY',
      route: 'MANUAL_REVIEW',
    },
  },
});

describe('evaluatePolicyRule', () => {
  it('matches when the discrepancy exceeds the threshold', () => {
    const context: PolicyFactContext = {
      application: { monthly_income: 10_000 },
      evidence: { verified_monthly_income: 8_000 }, // 20% under-stated
    };

    const result = evaluatePolicyRule(RULE, context);

    expect(result).toMatchObject({
      matched: true,
      condition: 'VERIFY_INCOME_DISCREPANCY',
      route: 'MANUAL_REVIEW',
    });
    expect(result.reason).toContain('20.00%');
  });

  it('matches on an over-statement too (absolute difference, not signed)', () => {
    const context: PolicyFactContext = {
      application: { monthly_income: 8_000 },
      evidence: { verified_monthly_income: 10_000 }, // 25% over-stated
    };

    expect(evaluatePolicyRule(RULE, context).matched).toBe(true);
  });

  it('does not match when the discrepancy is within the threshold', () => {
    const context: PolicyFactContext = {
      application: { monthly_income: 10_000 },
      evidence: { verified_monthly_income: 9_500 }, // 5% under-stated
    };

    const result = evaluatePolicyRule(RULE, context);
    expect(result.matched).toBe(false);
    expect(result.condition).toBeUndefined();
  });

  it('does not match, and explains why, when a referenced fact is missing', () => {
    const context: PolicyFactContext = {
      application: {},
      evidence: { verified_monthly_income: 8_000 },
    };

    const result = evaluatePolicyRule(RULE, context);
    expect(result.matched).toBe(false);
    expect(result.reason).toContain('missing or non-numeric fact');
  });

  it('does not match, and explains why, when a referenced fact is non-numeric', () => {
    const context: PolicyFactContext = {
      application: { monthly_income: 'ten thousand' },
      evidence: { verified_monthly_income: 8_000 },
    };

    const result = evaluatePolicyRule(RULE, context);
    expect(result.matched).toBe(false);
    expect(result.reason).toContain('missing or non-numeric fact');
  });

  it('does not match, and explains why, when the left fact is zero', () => {
    const context: PolicyFactContext = {
      application: { monthly_income: 0 },
      evidence: { verified_monthly_income: 8_000 },
    };

    const result = evaluatePolicyRule(RULE, context);
    expect(result.matched).toBe(false);
    expect(result.reason).toContain('percent difference is undefined');
  });

  it('is exactly at the boundary: equal to the threshold does not match (strictly greater-than)', () => {
    const context: PolicyFactContext = {
      application: { monthly_income: 10_000 },
      evidence: { verified_monthly_income: 9_000 }, // exactly 10%
    };

    expect(evaluatePolicyRule(RULE, context).matched).toBe(false);
  });
});
