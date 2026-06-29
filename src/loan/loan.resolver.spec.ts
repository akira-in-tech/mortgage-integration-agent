import 'reflect-metadata';
import { LoanResolver } from './loan.resolver';
import { LoanService } from './loan.service';
import {
  EvaluateLoanInput,
  LoanDecisionStatus,
  LoanEvaluationResult,
  LoanType,
} from './loan.model';

const MOCK_EVALUATION_RESULT: LoanEvaluationResult = {
  applicationId: '550e8400-e29b-41d4-a716-446655440000',
  decision: LoanDecisionStatus.APPROVED,
  confidence: 0.92,
  reasoning: 'Strong application.',
  incomeVerified: true,
  creditScore: 740,
  documentsValid: true,
  conditions: [],
  createdAt: new Date('2026-06-28T12:00:00.000Z'),
};

describe('LoanResolver', () => {
  let resolver: LoanResolver;
  let mockLoanService: jest.Mocked<Pick<LoanService, 'evaluateLoan'>>;

  const SAMPLE_INPUT: EvaluateLoanInput = {
    borrowerId: 'B001',
    requestedAmount: 350_000,
    loanType: LoanType.CONVENTIONAL,
  };

  beforeEach(() => {
    mockLoanService = {
      evaluateLoan: jest.fn().mockResolvedValue(MOCK_EVALUATION_RESULT),
    };
    resolver = new LoanResolver(mockLoanService as unknown as LoanService);
  });

  describe('health()', () => {
    it('returns the string "ok"', () => {
      expect(resolver.health()).toBe('ok');
    });
  });

  describe('evaluateLoan()', () => {
    it('delegates to LoanService.evaluateLoan with the exact input', async () => {
      await resolver.evaluateLoan(SAMPLE_INPUT);
      expect(mockLoanService.evaluateLoan).toHaveBeenCalledWith(SAMPLE_INPUT);
    });

    it('returns the result from LoanService unchanged', async () => {
      const result = await resolver.evaluateLoan(SAMPLE_INPUT);
      expect(result).toBe(MOCK_EVALUATION_RESULT);
    });

    it('propagates errors thrown by LoanService', async () => {
      mockLoanService.evaluateLoan.mockRejectedValueOnce(
        new Error('downstream failure'),
      );
      await expect(resolver.evaluateLoan(SAMPLE_INPUT)).rejects.toThrow(
        'downstream failure',
      );
    });
  });
});
