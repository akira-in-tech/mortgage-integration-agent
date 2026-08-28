import { DocumentVerificationAdapter } from './document-verification.adapter';
import { DocumentService } from './document.service';
import { DocumentVerificationResult } from './document.types';
import { ProviderCapability } from '../../provider-platform/types';

const ALL_VALID: DocumentVerificationResult = {
  w2Valid: true,
  payStubValid: true,
  bankStatementValid: true,
  taxReturnValid: true,
  allDocumentsValid: true,
  failedDocuments: [],
};

describe('DocumentVerificationAdapter', () => {
  it('declares DOCUMENT/SIMULATOR identity and a reusable-lookup, non-fallback operation profile', () => {
    const adapter = new DocumentVerificationAdapter({} as DocumentService);

    expect(adapter.providerId).toBe('document-verification-simulator');
    expect(adapter.capability).toBe(ProviderCapability.DOCUMENT);
    expect(adapter.mode).toBe('SIMULATOR');
    expect(adapter.operation).toEqual({
      effectClass: 'REUSABLE_LOOKUP',
      supportsStatusLookup: false,
      supportsCancellation: false,
      fallbackPolicy: 'PROHIBITED',
    });
  });

  it('submit() delegates to DocumentService.verifyDocuments and wraps the result as a COMPLETE receipt', async () => {
    const verifyDocuments = jest.fn().mockResolvedValue(ALL_VALID);
    const adapter = new DocumentVerificationAdapter({ verifyDocuments } as any);

    const receipt = await adapter.submit({ borrowerId: 'borrower-1' });

    expect(verifyDocuments).toHaveBeenCalledWith('borrower-1');
    expect(receipt).toEqual({ status: 'COMPLETE', payload: ALL_VALID });
  });

  it('submit() propagates a rejection from the underlying DocumentService unchanged', async () => {
    const error = new Error('synthetic transient failure');
    const verifyDocuments = jest.fn().mockRejectedValue(error);
    const adapter = new DocumentVerificationAdapter({ verifyDocuments } as any);

    await expect(adapter.submit({ borrowerId: 'borrower-2' })).rejects.toThrow(
      'synthetic transient failure',
    );
  });

  it('normalize() returns the receipt payload as-is', () => {
    const adapter = new DocumentVerificationAdapter({} as DocumentService);

    expect(adapter.normalize(ALL_VALID)).toBe(ALL_VALID);
  });

  it('healthCheck() always reports healthy (no real external dependency to be unhealthy)', async () => {
    const adapter = new DocumentVerificationAdapter({} as DocumentService);

    const health = await adapter.healthCheck();

    expect(health.healthy).toBe(true);
    expect(typeof health.checkedAt).toBe('string');
  });
});
