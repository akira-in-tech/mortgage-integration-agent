import 'reflect-metadata';
import { PlaidService } from './plaid.service';

describe('PlaidService', () => {
  let service: PlaidService;

  beforeEach(() => {
    service = new PlaidService();
    jest.spyOn(service as any, 'simulateLatency').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the same data for the same borrowerId (deterministic seed)', async () => {
    const a = await service.getIncomeData('B-STABLE');
    const b = await service.getIncomeData('B-STABLE');
    expect(a).toEqual(b);
  });

  it('returns different income data for different borrowerIds', async () => {
    const a = await service.getIncomeData('BORROWER-AAA');
    const b = await service.getIncomeData('BORROWER-ZZZ');
    // At minimum the monthly incomes should differ across a wide borrower range
    expect(a.monthlyIncome).not.toBe(b.monthlyIncome);
  });

  it('returns monthlyIncome in the range [4000, 25000]', async () => {
    const data = await service.getIncomeData('test-borrower-income');
    expect(data.monthlyIncome).toBeGreaterThanOrEqual(4000);
    expect(data.monthlyIncome).toBeLessThanOrEqual(25_000);
  });

  it('returns bankAccountAge in the range [6, 120]', async () => {
    const data = await service.getIncomeData('test-borrower-age');
    expect(data.bankAccountAge).toBeGreaterThanOrEqual(6);
    expect(data.bankAccountAge).toBeLessThanOrEqual(120);
  });

  it('returns incomeStability in the range [55, 100]', async () => {
    const data = await service.getIncomeData('test-borrower-stability');
    expect(data.incomeStability).toBeGreaterThanOrEqual(55);
    expect(data.incomeStability).toBeLessThanOrEqual(100);
  });

  it('returns one of the valid employment statuses', async () => {
    const data = await service.getIncomeData('test-borrower-employment');
    expect(['FULL_TIME', 'PART_TIME', 'SELF_EMPLOYED']).toContain(
      data.employmentStatus,
    );
  });
});
