import { AssetVerificationAdapter } from './asset-verification.adapter';
import { AssetService } from './asset.service';
import { AssetVerificationData } from './asset.types';
import { ProviderCapability } from '../../provider-platform/types';

const GOOD_ASSETS: AssetVerificationData = {
  liquidAssets: 42000,
  investmentAssets: 88000,
  accountCount: 3,
  reserveMonths: 9,
};

describe('AssetVerificationAdapter', () => {
  it('declares ASSET/SIMULATOR identity and a reusable-lookup, non-fallback operation profile', () => {
    const adapter = new AssetVerificationAdapter({} as AssetService);

    expect(adapter.providerId).toBe('asset-verification-simulator');
    expect(adapter.capability).toBe(ProviderCapability.ASSET);
    expect(adapter.mode).toBe('SIMULATOR');
    expect(adapter.operation).toEqual({
      effectClass: 'REUSABLE_LOOKUP',
      supportsStatusLookup: false,
      supportsCancellation: false,
      fallbackPolicy: 'PROHIBITED',
    });
  });

  it('submit() delegates to AssetService.getAssetData and wraps the result as a COMPLETE receipt', async () => {
    const getAssetData = jest.fn().mockResolvedValue(GOOD_ASSETS);
    const adapter = new AssetVerificationAdapter({ getAssetData } as any);

    const receipt = await adapter.submit({ borrowerId: 'borrower-1' });

    expect(getAssetData).toHaveBeenCalledWith('borrower-1');
    expect(receipt).toMatchObject({
      status: 'COMPLETE',
      payload: GOOD_ASSETS,
      observedAt: expect.any(String),
    });
  });

  it('submit() propagates a rejection from the underlying AssetService unchanged', async () => {
    const error = new Error('synthetic terminal failure');
    const getAssetData = jest.fn().mockRejectedValue(error);
    const adapter = new AssetVerificationAdapter({ getAssetData } as any);

    await expect(adapter.submit({ borrowerId: 'borrower-2' })).rejects.toThrow(
      'synthetic terminal failure',
    );
  });

  it('normalize() returns the receipt payload as-is', () => {
    const adapter = new AssetVerificationAdapter({} as AssetService);

    expect(adapter.normalize(GOOD_ASSETS)).toBe(GOOD_ASSETS);
  });

  it('healthCheck() always reports healthy (no real external dependency to be unhealthy)', async () => {
    const adapter = new AssetVerificationAdapter({} as AssetService);

    const health = await adapter.healthCheck();

    expect(health.healthy).toBe(true);
    expect(typeof health.checkedAt).toBe('string');
  });
});
