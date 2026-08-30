import 'reflect-metadata';
import {
  assertNotStructurallyExcluded,
  STRUCTURALLY_EXCLUDED_COMMAND_CLASSES,
} from './structural-exclusions';

describe('assertNotStructurallyExcluded (Section 2/7.5/16.4)', () => {
  it('allows a subject with no declared command class', () => {
    expect(() =>
      assertNotStructurallyExcluded({
        kind: 'agent_tool',
        identifier: 'check_case_completeness',
      }),
    ).not.toThrow();
  });

  it('allows a subject whose declared command class is not on the excluded list', () => {
    expect(() =>
      assertNotStructurallyExcluded({
        kind: 'provider_adapter',
        identifier: 'plaid-sandbox/INCOME/AUTHORIZED_SANDBOX',
        declaredCommandClass: 'NOT_A_REAL_EXCLUDED_CLASS',
      }),
    ).not.toThrow();
  });

  it.each(STRUCTURALLY_EXCLUDED_COMMAND_CLASSES)(
    'rejects an agent_tool declaring the excluded class %s',
    (excludedClass) => {
      expect(() =>
        assertNotStructurallyExcluded({
          kind: 'agent_tool',
          identifier: 'synthetic_test_tool',
          declaredCommandClass: excludedClass,
        }),
      ).toThrow(/structurally excluded/);
    },
  );

  it.each(STRUCTURALLY_EXCLUDED_COMMAND_CLASSES)(
    'rejects a provider_adapter declaring the excluded class %s',
    (excludedClass) => {
      expect(() =>
        assertNotStructurallyExcluded({
          kind: 'provider_adapter',
          identifier: 'synthetic-test-provider/INCOME/SIMULATOR',
          declaredCommandClass: excludedClass,
        }),
      ).toThrow(/structurally excluded/);
    },
  );

  // M7-028: the promotion-manifest validator is its own independent
  // checkpoint (Section 7.5's "even when... an adapter is technically
  // certified") — this proves the check works for that kind too, not
  // just the two kinds that already existed.
  it.each(STRUCTURALLY_EXCLUDED_COMMAND_CLASSES)(
    'rejects a provider_promotion_manifest declaring the excluded class %s',
    (excludedClass) => {
      expect(() =>
        assertNotStructurallyExcluded({
          kind: 'provider_promotion_manifest',
          identifier: 'synthetic-test-provider/INCOME/SIMULATOR',
          declaredCommandClass: excludedClass,
        }),
      ).toThrow(/structurally excluded/);
    },
  );

  it('names the offending identifier and command class in the error message', () => {
    expect(() =>
      assertNotStructurallyExcluded({
        kind: 'agent_tool',
        identifier: 'move_funds_tool',
        declaredCommandClass: 'FUNDS_MOVEMENT',
      }),
    ).toThrow(/move_funds_tool.*FUNDS_MOVEMENT/s);
  });
});
