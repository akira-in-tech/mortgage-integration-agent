import { IdentityVerificationAdapter } from './identity-verification.adapter';
import { IdentityService } from './identity.service';
import { IdentityVerificationResult } from './identity.types';

const VERIFIED: IdentityVerificationResult = {
  nameMatch: true,
  dateOfBirthMatch: true,
  ssnValid: true,
  addressMatch: true,
  fraudAlertPresent: false,
  identityVerified: true,
};

// Identity/capability/mode/operation-shape and healthCheck() are already
// proven generically by provider-adapters.contract.spec.ts
// (describeProviderAdapterContract) for every adapter, including this one —
// only assertions that contract can't express (exact mock call arguments,
// normalize()'s reference-identity pass-through, raw service-rejection
// propagation) live here.
describe('IdentityVerificationAdapter', () => {
  it('submit() delegates to IdentityService.verifyIdentity and wraps the result as a COMPLETE receipt', async () => {
    const verifyIdentity = jest.fn().mockResolvedValue(VERIFIED);
    const adapter = new IdentityVerificationAdapter({ verifyIdentity } as any);

    const receipt = await adapter.submit({ borrowerId: 'borrower-1' });

    expect(verifyIdentity).toHaveBeenCalledWith('borrower-1');
    expect(receipt).toMatchObject({
      status: 'COMPLETE',
      payload: VERIFIED,
      observedAt: expect.any(String),
    });
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
});
