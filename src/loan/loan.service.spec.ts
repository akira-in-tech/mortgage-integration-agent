import 'reflect-metadata';
import { InternalServerErrorException } from '@nestjs/common';
import { LoanService } from './loan.service';
import { LoanApplication } from '../database/entities/loan-application.entity';
import { AgentResult } from '../agent/agent.types';
import { EvaluateLoanInput, LoanType } from './loan.model';

const MOCK_APPROVED_RESULT: AgentResult = {
  decision: 'APPROVED',
  confidence: 0.92,
  reasoning:
    'Strong credit score of 740, DTI of 32%, stable employment, all documents verified.',
  conditions: [],
  incomeVerified: true,
  creditScore: 740,
  documentsValid: true,
  rawIntegrationData: {
    plaid: {
      monthlyIncome: 12_000,
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
  reasoning: 'Credit score below 700 threshold but within FHA guidelines.',
  conditions: [
    'Provide letter of explanation for credit score below 700',
    'Document compensating factors for DTI exceeding 43%',
  ],
  incomeVerified: true,
  creditScore: 655,
  documentsValid: false,
  rawIntegrationData: {
    plaid: {
      monthlyIncome: 7_500,
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
  reasoning: 'Credit score of 560 is below the 580 minimum for FHA loans.',
  conditions: [],
  incomeVerified: false,
  creditScore: 560,
  documentsValid: false,
  rawIntegrationData: {
    plaid: {
      monthlyIncome: 3_000,
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

describe('LoanService', () => {
  let loanService: LoanService;
  let mockRunUnderwritingAgent: jest.Mock<Promise<AgentResult>>;
  let mockLoanRepo: { create: jest.Mock; save: jest.Mock };

  const BASE_INPUT: EvaluateLoanInput = {
    borrowerId: 'B001',
    requestedAmount: 450_000,
    loanType: LoanType.CONVENTIONAL,
  };

  beforeEach(() => {
    mockRunUnderwritingAgent = jest
      .fn()
      .mockResolvedValue(MOCK_APPROVED_RESULT);
    mockLoanRepo = {
      create: jest
        .fn()
        .mockImplementation((data: Partial<LoanApplication>) => ({
          ...data,
          createdAt: new Date('2026-06-28T12:00:00.000Z'),
          updatedAt: new Date('2026-06-28T12:00:00.000Z'),
        })),
      save: jest.fn().mockImplementation(async (app) => app),
    };
    loanService = new LoanService(
      mockLoanRepo as never,
      { runUnderwritingAgent: mockRunUnderwritingAgent } as never,
    );
  });

  it('returns an APPROVED result with all fields populated', async () => {
    const result = await loanService.evaluateLoan(BASE_INPUT);

    expect(result.decision).toBe('APPROVED');
    expect(result.confidence).toBeCloseTo(0.92);
    expect(result.incomeVerified).toBe(true);
    expect(result.creditScore).toBe(740);
    expect(result.documentsValid).toBe(true);
    expect(result.conditions).toHaveLength(0);
    expect(result.reasoning).toContain('credit score');
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('returns a CONDITIONAL result and preserves the conditions list', async () => {
    mockRunUnderwritingAgent.mockResolvedValueOnce(MOCK_CONDITIONAL_RESULT);

    const result = await loanService.evaluateLoan({
      ...BASE_INPUT,
      loanType: LoanType.FHA,
    });

    expect(result.decision).toBe('CONDITIONAL');
    expect(result.conditions.length).toBeGreaterThan(0);
    expect(result.creditScore).toBe(655);
  });

  it('returns a DENIED result with an empty conditions list', async () => {
    mockRunUnderwritingAgent.mockResolvedValueOnce(MOCK_DENIED_RESULT);

    const result = await loanService.evaluateLoan({
      ...BASE_INPUT,
      loanType: LoanType.FHA,
    });

    expect(result.decision).toBe('DENIED');
    expect(result.conditions).toHaveLength(0);
  });

  it('generates a valid UUID v4 applicationId for every evaluation', async () => {
    const result = await loanService.evaluateLoan(BASE_INPUT);

    expect(result.applicationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('persists the loan application to the database exactly once', async () => {
    await loanService.evaluateLoan(BASE_INPUT);

    expect(mockRunUnderwritingAgent).toHaveBeenCalledWith(BASE_INPUT);
    expect(mockLoanRepo.save).toHaveBeenCalledTimes(1);
  });

  it('returns the createdAt value populated by the database save', async () => {
    const createdAt = new Date('2026-06-28T13:00:00.000Z');
    mockLoanRepo.create.mockImplementationOnce((data) => ({ ...data }));
    mockLoanRepo.save.mockImplementationOnce(async (application) => ({
      ...application,
      createdAt,
    }));

    const result = await loanService.evaluateLoan(BASE_INPUT);

    expect(result.createdAt).toBe(createdAt);
  });

  it('throws InternalServerErrorException when the database save fails', async () => {
    mockLoanRepo.save.mockRejectedValueOnce(new Error('connection refused'));

    await expect(loanService.evaluateLoan(BASE_INPUT)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
