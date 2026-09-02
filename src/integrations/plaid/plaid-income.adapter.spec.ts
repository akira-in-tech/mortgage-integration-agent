import { PlaidIncomeAdapter } from './plaid-income.adapter';
import { PlaidService } from './plaid.service';
import { PlaidIncomeData } from './plaid.types';
import { ProviderCapability } from '../../provider-platform/types';

const GOOD_INCOME: PlaidIncomeData = {
  monthlyIncome: 9000,
  employmentStatus: 'FULL_TIME',
  bankAccountAge: 48,
  incomeStability: 88,
};

describe('PlaidIncomeAdapter', () => {
  it('declares INCOME/SIMULATOR identity and a reusable-lookup, non-fallback operation profile', () => {
    const adapter = new PlaidIncomeAdapter({} as PlaidService);

    expect(adapter.providerId).toBe('plaid-simulator');
    expect(adapter.capability).toBe(ProviderCapability.INCOME);
    expect(adapter.mode).toBe('SIMULATOR');
    expect(adapter.operation).toEqual({
      effectClass: 'REUSABLE_LOOKUP',
      supportsStatusLookup: false,
      supportsCancellation: false,
      fallbackPolicy: 'PROHIBITED',
    });
  });

  it('submit() delegates to PlaidService.getIncomeData and wraps the result as a COMPLETE receipt', async () => {
    const getIncomeData = jest.fn().mockResolvedValue(GOOD_INCOME);
    const adapter = new PlaidIncomeAdapter({ getIncomeData } as any);

    const receipt = await adapter.submit({ borrowerId: 'borrower-1' });

    expect(getIncomeData).toHaveBeenCalledWith('borrower-1');
    expect(receipt).toMatchObject({
      status: 'COMPLETE',
      payload: GOOD_INCOME,
      observedAt: expect.any(String),
    });
  });

  it('submit() propagates a rejection from the underlying PlaidService unchanged', async () => {
    const error = new Error('synthetic transient failure');
    const getIncomeData = jest.fn().mockRejectedValue(error);
    const adapter = new PlaidIncomeAdapter({ getIncomeData } as any);

    await expect(adapter.submit({ borrowerId: 'borrower-2' })).rejects.toThrow(
      'synthetic transient failure',
    );
  });

  it('normalize() returns the receipt payload as-is', () => {
    const adapter = new PlaidIncomeAdapter({} as PlaidService);

    expect(adapter.normalize(GOOD_INCOME)).toBe(GOOD_INCOME);
  });

  it('healthCheck() always reports healthy (no real external dependency to be unhealthy)', async () => {
    const adapter = new PlaidIncomeAdapter({} as PlaidService);

    const health = await adapter.healthCheck();

    expect(health.healthy).toBe(true);
    expect(typeof health.checkedAt).toBe('string');
  });
});
