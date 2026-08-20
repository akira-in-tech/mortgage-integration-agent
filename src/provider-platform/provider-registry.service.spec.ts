import { ProviderRegistryService } from './provider-registry.service';
import { AnyProviderAdapter, ProviderCapability } from './types';

function fakeAdapter(
  capability: ProviderCapability,
  mode: 'SIMULATOR' | 'AUTHORIZED_SANDBOX' | 'PRODUCTION_BYOC',
  providerId: string,
): AnyProviderAdapter {
  return {
    providerId,
    capability,
    mode,
    operation: {
      effectClass: 'REUSABLE_LOOKUP',
      supportsStatusLookup: false,
      supportsCancellation: false,
      fallbackPolicy: 'PROHIBITED',
    },
    submit: jest.fn(),
    normalize: jest.fn(),
    healthCheck: jest.fn(),
  };
}

describe('ProviderRegistryService', () => {
  it('resolves an adapter previously registered for the same capability and mode', () => {
    const registry = new ProviderRegistryService();
    const adapter = fakeAdapter(
      ProviderCapability.INCOME,
      'SIMULATOR',
      'plaid-simulator',
    );
    registry.register(adapter);

    expect(registry.resolve(ProviderCapability.INCOME, 'SIMULATOR')).toBe(
      adapter,
    );
  });

  it('throws when resolving a capability/mode with no registered adapter', () => {
    const registry = new ProviderRegistryService();

    expect(() =>
      registry.resolve(ProviderCapability.CREDIT, 'SIMULATOR'),
    ).toThrow(/no provider adapter registered/);
  });

  it('throws when registering a second adapter for the same capability and mode', () => {
    const registry = new ProviderRegistryService();
    registry.register(
      fakeAdapter(ProviderCapability.INCOME, 'SIMULATOR', 'plaid-simulator'),
    );

    expect(() =>
      registry.register(
        fakeAdapter(ProviderCapability.INCOME, 'SIMULATOR', 'other-plaid'),
      ),
    ).toThrow(/already registered/);
  });

  it("throws when registering an adapter declaring a Section 16.4 structurally excluded command class — this codebase's permanent capability denylist", () => {
    const registry = new ProviderRegistryService();
    const excludedAdapter: AnyProviderAdapter = {
      ...fakeAdapter(
        ProviderCapability.INCOME,
        'SIMULATOR',
        'synthetic-test-provider',
      ),
      structurallyExcludedCommandClass: 'FUNDS_MOVEMENT',
    };

    expect(() => registry.register(excludedAdapter)).toThrow(
      /structurally excluded/,
    );
  });

  it('treats the same capability under a different mode as a distinct registration', () => {
    const registry = new ProviderRegistryService();
    const simulator = fakeAdapter(
      ProviderCapability.INCOME,
      'SIMULATOR',
      'plaid-simulator',
    );
    const sandbox = fakeAdapter(
      ProviderCapability.INCOME,
      'AUTHORIZED_SANDBOX',
      'plaid-sandbox',
    );
    registry.register(simulator);
    registry.register(sandbox);

    expect(registry.resolve(ProviderCapability.INCOME, 'SIMULATOR')).toBe(
      simulator,
    );
    expect(
      registry.resolve(ProviderCapability.INCOME, 'AUTHORIZED_SANDBOX'),
    ).toBe(sandbox);
  });

  it('listRegistered returns every registered adapter', () => {
    const registry = new ProviderRegistryService();
    const income = fakeAdapter(
      ProviderCapability.INCOME,
      'SIMULATOR',
      'plaid-simulator',
    );
    const credit = fakeAdapter(
      ProviderCapability.CREDIT,
      'SIMULATOR',
      'credit-simulator',
    );
    registry.register(income);
    registry.register(credit);

    expect(registry.listRegistered()).toEqual(
      expect.arrayContaining([income, credit]),
    );
    expect(registry.listRegistered()).toHaveLength(2);
  });
});
