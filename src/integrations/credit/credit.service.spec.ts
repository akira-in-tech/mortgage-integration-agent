import 'reflect-metadata';
import { CreditService } from './credit.service';

describe('CreditService', () => {
  let service: CreditService;

  beforeEach(() => {
    service = new CreditService();
    jest.spyOn(service as any, 'simulateLatency').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the same data for the same borrowerId (deterministic seed)', async () => {
    const a = await service.getCreditData('B-STABLE');
    const b = await service.getCreditData('B-STABLE');
    expect(a).toEqual(b);
  });

  it('returns different credit scores for different borrowerIds', async () => {
    const a = await service.getCreditData('BORROWER-AAA');
    const b = await service.getCreditData('BORROWER-ZZZ');
    expect(a.creditScore).not.toBe(b.creditScore);
  });

  it('returns creditScore in the range [580, 820]', async () => {
    const data = await service.getCreditData('test-borrower-score');
    expect(data.creditScore).toBeGreaterThanOrEqual(580);
    expect(data.creditScore).toBeLessThanOrEqual(820);
  });

  it('returns debtToIncomeRatio in the range [0.18, 0.55]', async () => {
    const data = await service.getCreditData('test-borrower-dti');
    expect(data.debtToIncomeRatio).toBeGreaterThanOrEqual(0.18);
    expect(data.debtToIncomeRatio).toBeLessThanOrEqual(0.55);
  });

  it('returns a valid paymentHistory grade', async () => {
    const data = await service.getCreditData('test-borrower-history');
    expect(['EXCELLENT', 'GOOD', 'FAIR', 'POOR']).toContain(
      data.paymentHistory,
    );
  });

  it('returns openAccounts in the range [2, 18]', async () => {
    const data = await service.getCreditData('test-borrower-accounts');
    expect(data.openAccounts).toBeGreaterThanOrEqual(2);
    expect(data.openAccounts).toBeLessThanOrEqual(18);
  });

  it('returns derogatoryMarks in the range [0, 2]', async () => {
    const data = await service.getCreditData('test-borrower-derog');
    expect(data.derogatoryMarks).toBeGreaterThanOrEqual(0);
    expect(data.derogatoryMarks).toBeLessThanOrEqual(2);
  });
});
