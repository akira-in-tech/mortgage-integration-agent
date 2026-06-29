import 'reflect-metadata';
import { DocumentService } from './document.service';

describe('DocumentService', () => {
  let service: DocumentService;

  beforeEach(() => {
    service = new DocumentService();
    jest.spyOn(service as any, 'simulateLatency').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the same result for the same borrowerId (deterministic seed)', async () => {
    const a = await service.verifyDocuments('B-STABLE');
    const b = await service.verifyDocuments('B-STABLE');
    expect(a).toEqual(b);
  });

  it('can produce both valid and invalid document packages', async () => {
    const invalid = await service.verifyDocuments('BORROWER-5');
    const valid = await service.verifyDocuments('BORROWER-ZZZ');

    expect(invalid.allDocumentsValid).toBe(false);
    expect(invalid.failedDocuments.length).toBeGreaterThan(0);
    expect(valid.allDocumentsValid).toBe(true);
    expect(valid.failedDocuments).toHaveLength(0);
  });

  it('allDocumentsValid is true only when failedDocuments is empty', async () => {
    // Test across several borrowerIds to find both valid and invalid cases
    const results = await Promise.all(
      ['AA', 'BB', 'CC', 'DD', 'EE', 'FF'].map((id) =>
        service.verifyDocuments(id),
      ),
    );
    for (const result of results) {
      if (result.allDocumentsValid) {
        expect(result.failedDocuments).toHaveLength(0);
      } else {
        expect(result.failedDocuments.length).toBeGreaterThan(0);
      }
    }
  });

  it('failedDocuments lists only the documents that failed their individual checks', async () => {
    // Try several borrowerIds and verify internal consistency for each
    const ids = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
    const results = await Promise.all(
      ids.map((id) => service.verifyDocuments(id)),
    );

    for (const result of results) {
      const expectedFailed: string[] = [];
      if (!result.w2Valid) expectedFailed.push('W-2');
      if (!result.payStubValid) expectedFailed.push('Pay Stub');
      if (!result.bankStatementValid) expectedFailed.push('Bank Statement');
      if (!result.taxReturnValid) expectedFailed.push('Tax Return');
      expect(result.failedDocuments).toEqual(expectedFailed);
    }
  });
});
