import { IdentityVerificationAdapter } from './identity-verification.adapter';
import { IdentityService } from './identity.service';
import { IdentityVerificationResult } from './identity.types';
import { ProviderCapability } from '../../provider-platform/types';

const VERIFIED: IdentityVerificationResult = {
  nameMatch: true,
  dateOfBirthMatch: true,
  ssnValid: true,
  addressMatch: true,
  fraudAlertPresent: false,
  identityVerified: true,
};

describe('IdentityVerificationAdapter', () => {
  it('declares IDENTITY/SIMULATOR identity and a reusable-lookup, non-fallback operation profile', () => {
    const adapter = new IdentityVerificationAdapter({} as IdentityService);

    expect(adapter.providerId).toBe('identity-verification-simulator');
    expect(adapter.capability).toBe(ProviderCapability.IDENTITY);
    expect(adapter.mode).toBe('SIMULATOR');
    expect(adapter.operation).toEqual({
      effectClass: 'REUSABLE_LOOKUP',
      supportsStatusLookup: false,
      supportsCancellation: false,
      fallbackPolicy: 'PROHIBITED',
    });
  });

  it('submit() delegates to IdentityService.verifyIdentity and wraps the result as a COMPLETE receipt', async () => {
    const verifyIdentity = jest.fn().mockResolvedValue(VERIFIED);
    const adapter = new IdentityVerificationAdapter({ verifyIdentity } as any);

    const receipt = await adapter.submit({ borrowerId: 'borrower-1' });

    expect(verifyIdentity).toHaveBeenCalledWith('borrower-1');
    expect(receipt).toEqual({ status: 'COMPLETE', payload: VERIFIED });
  });

  it('submit() propagates a rejection from the underlying IdentityService unchanged', async () => {
    const error = new Error('synthetic transient failure');
    const verifyIdentity = jest.fn().mockRejectedValue(error);
    const adapter = new IdentityVerificationAdapter({ verifyIdentity } as any);

    await expect(adapter.submit({ borrowerId: 'borrower-2' })).rejects.toThrow(
      'synthetic transient failure',
    );
  });

  it('normalize() returns the receipt payload as-is', () => {
    const adapter = new IdentityVerificationAdapter({} as IdentityService);

    expect(adapter.normalize(VERIFIED)).toBe(VERIFIED);
  });

  it('healthCheck() always reports healthy (no real external dependency to be unhealthy)', async () => {
    const adapter = new IdentityVerificationAdapter({} as IdentityService);

    const health = await adapter.healthCheck();

    expect(health.healthy).toBe(true);
    expect(typeof health.checkedAt).toBe('string');
  });
});
