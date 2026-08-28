import 'reflect-metadata';
import { RulesUnderwriterService } from './rules-underwriter.service';
import { LoanType } from '../loan/loan.model';
import { LoanDecisionStatus } from '../database/enums/loan-decision.enum';
import { UnderwritingContext } from './agent.types';
import { PlaidIncomeData } from '../integrations/plaid/plaid.types';
import { CreditBureauData } from '../integrations/credit/credit.types';
import { DocumentVerificationResult } from '../integrations/document/document.types';

// ── Helper factories ─────────────────────────────────────────────────────────

function makeIncome(overrides: Partial<PlaidIncomeData> = {}): PlaidIncomeData {
  return {
    monthlyIncome: 8000,
    employmentStatus: 'FULL_TIME',
    bankAccountAge: 60,
    incomeStability: 85,
    ...overrides,
  };
}

function makeCredit(
  overrides: Partial<CreditBureauData> = {},
): CreditBureauData {
  return {
    creditScore: 750,
    debtToIncomeRatio: 0.3,
    paymentHistory: 'EXCELLENT',
    openAccounts: 5,
    derogatoryMarks: 0,
    ...overrides,
  };
}

function makeDocs(
  overrides: Partial<DocumentVerificationResult> = {},
): DocumentVerificationResult {
  return {
    w2Valid: true,
    payStubValid: true,
    bankStatementValid: true,
    taxReturnValid: true,
    allDocumentsValid: true,
    failedDocuments: [],
    ...overrides,
  };
}

function makeContext(
  overrides: Partial<UnderwritingContext> = {},
): UnderwritingContext {
  return {
    borrowerId: 'B001',
    requestedAmount: 300_000,
    loanType: LoanType.CONVENTIONAL,
    income: makeIncome(),
    credit: makeCredit(),
    documents: makeDocs(),
    ...overrides,
  };
}

describe('RulesUnderwriterService', () => {
  // No constructor dependencies — no mocking needed.
  const service = new RulesUnderwriterService();

  // ── APPROVED decisions ────────────────────────────────────────────────────

  describe('APPROVED decisions', () => {
    it('approves a strong CONVENTIONAL application', () => {
      const result = service.evaluate(makeContext());
      expect(result.decision).toBe(LoanDecisionStatus.APPROVED);
      expect(result.conditions).toHaveLength(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('approves an FHA application with score 720 (above both FHA min and 700 threshold)', () => {
      const result = service.evaluate(
        makeContext({
          loanType: LoanType.FHA,
          credit: makeCredit({ creditScore: 720, debtToIncomeRatio: 0.4 }),
        }),
      );
      expect(result.decision).toBe(LoanDecisionStatus.APPROVED);
    });

    it('approves a VA application regardless of credit score (no VA minimum)', () => {
      // VA has no minScore — score 720 is above 700 so no condition either
      const result = service.evaluate(
        makeContext({
          loanType: LoanType.VA,
          credit: makeCredit({ creditScore: 720, debtToIncomeRatio: 0.35 }),
        }),
      );
      expect(result.decision).toBe(LoanDecisionStatus.APPROVED);
    });

    it('approves a JUMBO application with score 750 and low DTI', () => {
      const result = service.evaluate(
        makeContext({
          loanType: LoanType.JUMBO,
          // annualIncome=240k, LTI=1.25 — well within JUMBO maxLti=4.0
          income: makeIncome({ monthlyIncome: 20_000 }),
          credit: makeCredit({ creditScore: 750, debtToIncomeRatio: 0.3 }),
        }),
      );
      expect(result.decision).toBe(LoanDecisionStatus.APPROVED);
    });
  });

  // ── CONDITIONAL decisions ─────────────────────────────────────────────────

  describe('CONDITIONAL decisions', () => {
    it('issues condition for credit score 620–699 (CONVENTIONAL)', () => {
      const result = service.evaluate(
        makeContext({ credit: makeCredit({ creditScore: 650 }) }),
      );
      expect(result.decision).toBe(LoanDecisionStatus.CONDITIONAL);
      expect(
        result.conditions.some((c) => c.includes('letter of explanation')),
      ).toBe(true);
    });

    it('issues condition for DTI between 43% and 50% (CONVENTIONAL)', () => {
      const result = service.evaluate(
        makeContext({
          credit: makeCredit({ creditScore: 720, debtToIncomeRatio: 0.46 }),
        }),
      );
      expect(result.decision).toBe(LoanDecisionStatus.CONDITIONAL);
      expect(
        result.conditions.some((c) => c.includes('compensating factors')),
      ).toBe(true);
    });

    it('issues condition for self-employed borrower', () => {
      const result = service.evaluate(
        makeContext({
          income: makeIncome({ employmentStatus: 'SELF_EMPLOYED' }),
        }),
      );
      expect(result.decision).toBe(LoanDecisionStatus.CONDITIONAL);
      expect(result.conditions.some((c) => c.includes('profit & loss'))).toBe(
        true,
      );
    });

    it('issues condition for a single missing document', () => {
      const result = service.evaluate(
        makeContext({
          documents: makeDocs({
            bankStatementValid: false,
            allDocumentsValid: false,
            failedDocuments: ['Bank Statement'],
          }),
        }),
      );
      expect(result.decision).toBe(LoanDecisionStatus.CONDITIONAL);
      expect(result.conditions.some((c) => c.includes('Resubmit'))).toBe(true);
    });

    it('issues condition for exactly one derogatory mark', () => {
      const result = service.evaluate(
        makeContext({ credit: makeCredit({ derogatoryMarks: 1 }) }),
      );
      expect(result.decision).toBe(LoanDecisionStatus.CONDITIONAL);
      expect(result.conditions.some((c) => c.includes('derogatory'))).toBe(
        true,
      );
    });
  });

  // ── DENIED decisions ──────────────────────────────────────────────────────

  describe('DENIED decisions', () => {
    it('denies FHA application with score below 580', () => {
      const result = service.evaluate(
        makeContext({
          loanType: LoanType.FHA,
          credit: makeCredit({ creditScore: 570 }),
        }),
      );
      expect(result.decision).toBe(LoanDecisionStatus.DENIED);
      expect(result.conditions).toHaveLength(0);
    });

    it('denies CONVENTIONAL application with score below 620', () => {
      const result = service.evaluate(
        makeContext({ credit: makeCredit({ creditScore: 610 }) }),
      );
      expect(result.decision).toBe(LoanDecisionStatus.DENIED);
    });

    it('denies JUMBO application with score below 720', () => {
      const result = service.evaluate(
        makeContext({
          loanType: LoanType.JUMBO,
          credit: makeCredit({ creditScore: 700 }),
        }),
      );
      expect(result.decision).toBe(LoanDecisionStatus.DENIED);
    });

    it('denies application with DTI exceeding CONVENTIONAL limit (50%)', () => {
      const result = service.evaluate(
        makeContext({
          credit: makeCredit({ creditScore: 720, debtToIncomeRatio: 0.55 }),
        }),
      );
      expect(result.decision).toBe(LoanDecisionStatus.DENIED);
    });

    it('denies application for unemployed borrower', () => {
      const result = service.evaluate(
        makeContext({ income: makeIncome({ employmentStatus: 'UNEMPLOYED' }) }),
      );
      expect(result.decision).toBe(LoanDecisionStatus.DENIED);
    });

    it('denies application with more than one missing document', () => {
      const result = service.evaluate(
        makeContext({
          documents: makeDocs({
            w2Valid: false,
            payStubValid: false,
            allDocumentsValid: false,
            failedDocuments: ['W-2', 'Pay Stub'],
          }),
        }),
      );
      expect(result.decision).toBe(LoanDecisionStatus.DENIED);
    });

    it('denies application with two or more derogatory marks', () => {
      const result = service.evaluate(
        makeContext({ credit: makeCredit({ derogatoryMarks: 2 }) }),
      );
      expect(result.decision).toBe(LoanDecisionStatus.DENIED);
    });
  });
});
