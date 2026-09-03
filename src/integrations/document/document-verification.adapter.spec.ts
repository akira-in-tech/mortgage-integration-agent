import { DocumentVerificationAdapter } from './document-verification.adapter';
import { DocumentService } from './document.service';
import { DocumentVerificationResult } from './document.types';

const ALL_VALID: DocumentVerificationResult = {
  w2Valid: true,
  payStubValid: true,
  bankStatementValid: true,
  taxReturnValid: true,
  allDocumentsValid: true,
  failedDocuments: [],
};

// Identity/capability/mode/operation-shape and healthCheck() are already
// proven generically by provider-adapters.contract.spec.ts
// (describeProviderAdapterContract) for every adapter, including this one —
// only assertions that contract can't express (exact mock call arguments,
// normalize()'s reference-identity pass-through, raw service-rejection
// propagation) live here.
describe('DocumentVerificationAdapter', () => {
  it('submit() delegates to DocumentService.verifyDocuments and wraps the result as a COMPLETE receipt', async () => {
    const verifyDocuments = jest.fn().mockResolvedValue(ALL_VALID);
    const adapter = new DocumentVerificationAdapter({ verifyDocuments } as any);

    const receipt = await adapter.submit({ borrowerId: 'borrower-1' });

    expect(verifyDocuments).toHaveBeenCalledWith('borrower-1');
    expect(receipt).toMatchObject({
      status: 'COMPLETE',
      payload: ALL_VALID,
      observedAt: expect.any(String),
    });
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
});
