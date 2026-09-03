import { CreditReportAdapter } from './credit-report.adapter';
import { CreditService } from './credit.service';
import { CreditBureauData } from './credit.types';

const GOOD_CREDIT: CreditBureauData = {
  creditScore: 720,
  debtToIncomeRatio: 0.34,
  paymentHistory: 'GOOD',
  openAccounts: 8,
  derogatoryMarks: 0,
};

// Identity/capability/mode/operation-shape and healthCheck() are already
// proven generically by provider-adapters.contract.spec.ts
// (describeProviderAdapterContract) for every adapter, including this one —
// only assertions that contract can't express (exact mock call arguments,
// normalize()'s reference-identity pass-through, raw service-rejection
// propagation) live here.
describe('CreditReportAdapter', () => {
  it('submit() delegates to CreditService.getCreditData and wraps the result as a COMPLETE receipt', async () => {
    const getCreditData = jest.fn().mockResolvedValue(GOOD_CREDIT);
    const adapter = new CreditReportAdapter({ getCreditData } as any);

    const receipt = await adapter.submit({ borrowerId: 'borrower-1' });

    expect(getCreditData).toHaveBeenCalledWith('borrower-1');
    expect(receipt).toMatchObject({
      status: 'COMPLETE',
      payload: GOOD_CREDIT,
      observedAt: expect.any(String),
    });
  });

  it('submit() propagates a rejection from the underlying CreditService unchanged', async () => {
    const error = new Error('synthetic terminal failure');
    const getCreditData = jest.fn().mockRejectedValue(error);
    const adapter = new CreditReportAdapter({ getCreditData } as any);

    await expect(adapter.submit({ borrowerId: 'borrower-2' })).rejects.toThrow(
      'synthetic terminal failure',
    );
  });

  it('normalize() returns the receipt payload as-is', () => {
    const adapter = new CreditReportAdapter({} as CreditService);

    expect(adapter.normalize(GOOD_CREDIT)).toBe(GOOD_CREDIT);
  });
});
