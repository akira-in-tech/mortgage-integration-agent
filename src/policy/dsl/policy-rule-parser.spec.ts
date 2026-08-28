import 'reflect-metadata';
import {
  parsePolicyRule,
  PolicyDslValidationError,
} from './policy-rule-parser';

// The literal Section 10.7 example — the charter's own canonical DSL
// document, in its original YAML-shaped (snake_case) form as it would
// arrive after parsing YAML/JSON, before this module normalizes it.
const SECTION_10_7_EXAMPLE = {
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
};

describe('parsePolicyRule', () => {
  it('parses the Section 10.7 example into a normalized document', () => {
    const result = parsePolicyRule(SECTION_10_7_EXAMPLE);

    expect(result).toEqual({
      id: 'synthetic-income-discrepancy-review',
      version: '1.0.0',
      applicability: {
        jurisdictions: ['US-CA'],
        product: 'CONVENTIONAL_MORTGAGE',
        lifecycleEvents: ['UNDERWRITING_REVIEW'],
        effectiveFrom: '2027-01-01T00:00:00-08:00',
        transitionRule: 'application_received_on_or_after_effective_date',
      },
      when: {
        kind: 'difference_percent',
        left: 'application.monthly_income',
        right: 'evidence.verified_monthly_income',
        greaterThan: 10,
      },
      outcome: {
        condition: 'VERIFY_INCOME_DISCREPANCY',
        route: 'MANUAL_REVIEW',
      },
    });
  });

  it('accepts a document with no transition_rule (optional field)', () => {
    const withoutTransition = {
      rule: {
        ...SECTION_10_7_EXAMPLE.rule,
        applicability: {
          ...SECTION_10_7_EXAMPLE.rule.applicability,
          transition_rule: undefined,
        },
      },
    };
    const result = parsePolicyRule(withoutTransition);
    expect(result.applicability.transitionRule).toBeUndefined();
  });

  it('rejects a document missing the top-level "rule" key', () => {
    expect(() => parsePolicyRule({ notARule: true })).toThrow(
      PolicyDslValidationError,
    );
  });

  it('rejects a non-semver version', () => {
    const invalid = {
      rule: { ...SECTION_10_7_EXAMPLE.rule, version: 'v1' },
    };
    expect(() => parsePolicyRule(invalid)).toThrow(/rule\.version/);
  });

  it('rejects an unrecognized condition operator', () => {
    const invalid = {
      rule: {
        ...SECTION_10_7_EXAMPLE.rule,
        when: { some_future_operator: {} },
      },
    };
    expect(() => parsePolicyRule(invalid)).toThrow(
      /unrecognized condition operator/,
    );
  });

  it('rejects a non-ISO effective_from', () => {
    const invalid = {
      rule: {
        ...SECTION_10_7_EXAMPLE.rule,
        applicability: {
          ...SECTION_10_7_EXAMPLE.rule.applicability,
          effective_from: 'not-a-date',
        },
      },
    };
    expect(() => parsePolicyRule(invalid)).toThrow(
      /applicability\.effective_from/,
    );
  });

  it('collects every problem at once rather than failing on the first', () => {
    const invalid = { rule: { id: '', version: 'not-semver' } };
    try {
      parsePolicyRule(invalid);
      fail('expected parsePolicyRule to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(PolicyDslValidationError);
      const issues = (error as PolicyDslValidationError).issues;
      const paths = issues.map((i) => i.path);
      expect(paths).toContain('rule.id');
      expect(paths).toContain('rule.version');
      expect(paths).toContain('rule.applicability');
      expect(paths).toContain('rule.when');
      expect(paths).toContain('rule.outcome');
    }
  });

  it('rejects an empty jurisdictions array', () => {
    const invalid = {
      rule: {
        ...SECTION_10_7_EXAMPLE.rule,
        applicability: {
          ...SECTION_10_7_EXAMPLE.rule.applicability,
          jurisdictions: [],
        },
      },
    };
    expect(() => parsePolicyRule(invalid)).toThrow(
      /applicability\.jurisdictions/,
    );
  });

  it('rejects a difference_percent condition with a non-numeric greater_than', () => {
    const invalid = {
      rule: {
        ...SECTION_10_7_EXAMPLE.rule,
        when: {
          difference_percent: {
            left: 'application.monthly_income',
            right: 'evidence.verified_monthly_income',
            greater_than: 'ten',
          },
        },
      },
    };
    expect(() => parsePolicyRule(invalid)).toThrow(
      /when\.difference_percent\.greater_than/,
    );
  });
});
