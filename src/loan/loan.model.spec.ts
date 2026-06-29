import 'reflect-metadata';
import { validate } from 'class-validator';
import { EvaluateLoanInput, LoanType } from './loan.model';

function makeInput(
  overrides: Partial<EvaluateLoanInput> = {},
): EvaluateLoanInput {
  return Object.assign(new EvaluateLoanInput(), {
    borrowerId: 'B001',
    requestedAmount: 300_000,
    loanType: LoanType.CONVENTIONAL,
    ...overrides,
  });
}

describe('EvaluateLoanInput', () => {
  it('accepts a valid loan request', async () => {
    await expect(validate(makeInput())).resolves.toHaveLength(0);
  });

  it('rejects a whitespace-only borrowerId', async () => {
    const errors = await validate(makeInput({ borrowerId: '   ' }));

    expect(errors.some((error) => error.property === 'borrowerId')).toBe(true);
  });

  it('rejects borrowerId values longer than the database column', async () => {
    const errors = await validate(makeInput({ borrowerId: 'B'.repeat(101) }));

    expect(errors.some((error) => error.property === 'borrowerId')).toBe(true);
  });

  it('rejects loan amounts below the minimum', async () => {
    const errors = await validate(makeInput({ requestedAmount: 9_999 }));

    expect(errors.some((error) => error.property === 'requestedAmount')).toBe(
      true,
    );
  });
});
