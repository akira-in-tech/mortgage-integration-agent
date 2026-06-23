/// <reference types="jest" />
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { LoanService } from '../src/loan/loan.service';
import { LoanApplication } from '../src/database/entities/loan-application.entity';
import { AgentResult } from '../src/agent/agent.types';
import { EvaluateLoanInput, LoanType } from '../src/loan/loan.model';

const MOCK_APPROVED_RESULT: AgentResult = {
  decision: 'APPROVED',
  confidence: 0.92,
  reasoning:
    'Strong credit score of 740, DTI of 32%, stable full-time employment, and all documents verified.',
  conditions: [],
  incomeVerified: true,
  creditScore: 740,
  documentsValid: true,
  rawIntegrationData: {
    plaid: {
      monthlyIncome: 12000,
      employmentStatus: 'FULL_TIME',
      bankAccountAge: 84,
      incomeStability: 91,
    },
    credit: {
      creditScore: 740,
      debtToIncomeRatio: 0.32,
      paymentHistory: 'EXCELLENT',
      openAccounts: 6,
      derogatoryMarks: 0,
    },
    documents: {
      w2Valid: true,
      payStubValid: true,
      bankStatementValid: true,
      taxReturnValid: true,
      allDocumentsValid: true,
      failedDocuments: [],
    },
  },
};

const MOCK_CONDITIONAL_RESULT: AgentResult = {
  decision: 'CONDITIONAL',
  confidence: 0.71,
  reasoning:
    'Credit score of 655 is below the standard 700 threshold but within FHA program guidelines.',
  conditions: [
    'Provide letter of explanation for credit score below 700',
    'Document compensating factors for DTI exceeding 43%',
  ],
  incomeVerified: true,
  creditScore: 655,
  documentsValid: false,
  rawIntegrationData: {
    plaid: {
      monthlyIncome: 7500,
      employmentStatus: 'FULL_TIME',
      bankAccountAge: 36,
      incomeStability: 78,
    },
    credit: {
      creditScore: 655,
      debtToIncomeRatio: 0.46,
      paymentHistory: 'FAIR',
      openAccounts: 9,
      derogatoryMarks: 1,
    },
    documents: {
      w2Valid: true,
      payStubValid: true,
      bankStatementValid: false,
      taxReturnValid: true,
      allDocumentsValid: false,
      failedDocuments: ['Bank Statement'],
    },
  },
};

const MOCK_DENIED_RESULT: AgentResult = {
  decision: 'DENIED',
  confidence: 0.88,
  reasoning:
    'Credit score of 560 is below the 580 minimum for FHA loans.',
  conditions: [],
  incomeVerified: false,
  creditScore: 560,
  documentsValid: false,
  rawIntegrationData: {
    plaid: {
      monthlyIncome: 3000,
      employmentStatus: 'UNEMPLOYED',
      bankAccountAge: 6,
      incomeStability: 30,
    },
    credit: {
      creditScore: 560,
      debtToIncomeRatio: 0.62,
      paymentHistory: 'POOR',
      openAccounts: 3,
      derogatoryMarks: 3,
    },
    documents: {
      w2Valid: false,
      payStubValid: false,
      bankStatementValid: false,
      taxReturnValid: false,
      allDocumentsValid: false,
      failedDocuments: ['W-2', 'Pay Stub', 'Bank Statement', 'Tax Return'],
    },
  },
};

function validateEvaluateLoanInput(input: EvaluateLoanInput): void {
  if (input.borrowerId.trim() === '') {
    throw new BadRequestException('borrowerId should not be empty');
  }

  if (input.requestedAmount < 10_000) {
    throw new BadRequestException('requestedAmount must be at least 10000');
  }
}

describe('Loan Evaluation', () => {
  let loanService: LoanService;
  let mockRunUnderwritingAgent: jest.Mock<Promise<AgentResult>>;
  let mockLoanRepo: {
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(() => {
    mockRunUnderwritingAgent = jest.fn().mockResolvedValue(MOCK_APPROVED_RESULT);
    mockLoanRepo = {
      create: jest.fn().mockImplementation((data: Partial<LoanApplication>) => ({
        ...data,
        createdAt: new Date('2026-06-22T12:00:00.000Z'),
        updatedAt: new Date('2026-06-22T12:00:00.000Z'),
      })),
      save: jest.fn().mockImplementation(async (application) => application),
    };

    loanService = new LoanService(
      mockLoanRepo as never,
      { runUnderwritingAgent: mockRunUnderwritingAgent } as never,
    );
  });

  it('returns APPROVED decision for a qualified borrower', async () => {
    const input: EvaluateLoanInput = {
      borrowerId: 'B001',
      requestedAmount: 450000,
      loanType: LoanType.CONVENTIONAL,
    };

    const evaluateLoan = await loanService.evaluateLoan(input);

    expect(evaluateLoan.decision).toBe('APPROVED');
    expect(evaluateLoan.confidence).toBeCloseTo(0.92);
    expect(evaluateLoan.incomeVerified).toBe(true);
    expect(evaluateLoan.creditScore).toBe(740);
    expect(evaluateLoan.documentsValid).toBe(true);
    expect(evaluateLoan.conditions).toHaveLength(0);
    expect(evaluateLoan.applicationId).toBeDefined();
    expect(evaluateLoan.createdAt).toBeInstanceOf(Date);
    expect(mockRunUnderwritingAgent).toHaveBeenCalledWith(input);
    expect(mockLoanRepo.save).toHaveBeenCalledTimes(1);
  });

  it('returns CONDITIONAL decision with a conditions list', async () => {
    mockRunUnderwritingAgent.mockResolvedValueOnce(MOCK_CONDITIONAL_RESULT);

    const evaluateLoan = await loanService.evaluateLoan({
      borrowerId: 'B002',
      requestedAmount: 280000,
      loanType: LoanType.FHA,
    });

    expect(evaluateLoan.decision).toBe('CONDITIONAL');
    expect(evaluateLoan.conditions.length).toBeGreaterThan(0);
    expect(evaluateLoan.creditScore).toBe(655);
  });

  it('returns DENIED decision for an unqualified borrower', async () => {
    mockRunUnderwritingAgent.mockResolvedValueOnce(MOCK_DENIED_RESULT);

    const evaluateLoan = await loanService.evaluateLoan({
      borrowerId: 'B003',
      requestedAmount: 500000,
      loanType: LoanType.JUMBO,
    });

    expect(evaluateLoan.decision).toBe('DENIED');
    expect(evaluateLoan.conditions).toHaveLength(0);
  });

  it('rejects a negative loan amount', () => {
    expect(() =>
      validateEvaluateLoanInput({
        borrowerId: 'B004',
        requestedAmount: -5000,
        loanType: LoanType.CONVENTIONAL,
      }),
    ).toThrow(BadRequestException);
    expect(mockRunUnderwritingAgent).not.toHaveBeenCalled();
  });

  it('rejects an empty borrowerId', () => {
    expect(() =>
      validateEvaluateLoanInput({
        borrowerId: '',
        requestedAmount: 300000,
        loanType: LoanType.CONVENTIONAL,
      }),
    ).toThrow(BadRequestException);
    expect(mockRunUnderwritingAgent).not.toHaveBeenCalled();
  });

  it('handles all four loan types without error', async () => {
    for (const loanType of [
      LoanType.CONVENTIONAL,
      LoanType.FHA,
      LoanType.VA,
      LoanType.JUMBO,
    ]) {
      const evaluateLoan = await loanService.evaluateLoan({
        borrowerId: `B-${loanType}`,
        requestedAmount: 350000,
        loanType,
      });

      expect(evaluateLoan.decision).toBe('APPROVED');
    }
  });
});

