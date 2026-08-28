import 'reflect-metadata';
import { AgentService } from './agent.service';
import { LoanType } from '../loan/loan.model';
import { DecisionProvider } from '../config/env.validation';
import { LoanDecisionStatus } from '../database/enums/loan-decision.enum';
import { UnderwritingModelResponse } from './agent.types';
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

const DEFAULT_DECISION: UnderwritingModelResponse = {
  decision: LoanDecisionStatus.APPROVED,
  confidence: 0.9,
  reasoning: 'Mocked decision.',
  conditions: [],
};

// ── Shared test state ─────────────────────────────────────────────────────────

const BASE_INPUT = { borrowerId: 'B001', requestedAmount: 300_000 };

describe('AgentService (orchestration)', () => {
  let mockPlaid: { getIncomeData: jest.Mock };
  let mockCredit: { getCreditData: jest.Mock };
  let mockDocument: { verifyDocuments: jest.Mock };
  let mockRulesUnderwriter: { evaluate: jest.Mock };
  let mockOllamaUnderwriter: {
    evaluate: jest.Mock;
    endpoint: string;
    modelName: string;
  };

  beforeEach(() => {
    mockPlaid = { getIncomeData: jest.fn() };
    mockCredit = { getCreditData: jest.fn() };
    mockDocument = { verifyDocuments: jest.fn() };
    mockRulesUnderwriter = {
      evaluate: jest.fn().mockReturnValue(DEFAULT_DECISION),
    };
    mockOllamaUnderwriter = {
      evaluate: jest.fn().mockResolvedValue(DEFAULT_DECISION),
      endpoint: 'http://ollama.test:11434',
      modelName: 'qwen3.5:9b',
    };
  });

  // Mocks ConfigService.get(key, defaultValue)'s real contract — returning
  // the caller's default when a key is absent — since AgentService relies
  // on that fallback rather than doing its own `?? fallback` logic
  // (validation and defaulting live in src/config/env.validation.ts).
  function buildService(
    decisionProvider: DecisionProvider = DecisionProvider.Rules,
  ): AgentService {
    return new AgentService(
      {
        get: jest.fn((key: string, defaultValue?: unknown) =>
          key === 'DECISION_PROVIDER' ? decisionProvider : defaultValue,
        ),
      } as any,
      mockPlaid as any,
      mockCredit as any,
      mockDocument as any,
      mockRulesUnderwriter as any,
      mockOllamaUnderwriter as any,
    );
  }

  function setIntegrations(
    income = makeIncome(),
    credit = makeCredit(),
    docs = makeDocs(),
  ) {
    mockPlaid.getIncomeData.mockResolvedValue(income);
    mockCredit.getCreditData.mockResolvedValue(credit);
    mockDocument.verifyDocuments.mockResolvedValue(docs);
  }

  // ── Provider dispatch ─────────────────────────────────────────────────────

  describe('provider dispatch', () => {
    it('defaults to the rules underwriter when DECISION_PROVIDER is not configured', async () => {
      setIntegrations();
      const config = {
        get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
      };
      const service = new AgentService(
        config as any,
        mockPlaid as any,
        mockCredit as any,
        mockDocument as any,
        mockRulesUnderwriter as any,
        mockOllamaUnderwriter as any,
      );

      await service.runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });

      expect(mockRulesUnderwriter.evaluate).toHaveBeenCalledTimes(1);
      expect(mockOllamaUnderwriter.evaluate).not.toHaveBeenCalled();
    });

    it('calls the rules underwriter when DECISION_PROVIDER=rules', async () => {
      setIntegrations();
      await buildService(DecisionProvider.Rules).runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });

      expect(mockRulesUnderwriter.evaluate).toHaveBeenCalledTimes(1);
      expect(mockOllamaUnderwriter.evaluate).not.toHaveBeenCalled();
    });

    it('calls the Ollama underwriter when DECISION_PROVIDER=ollama', async () => {
      setIntegrations();
      await buildService(DecisionProvider.Ollama).runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });

      expect(mockOllamaUnderwriter.evaluate).toHaveBeenCalledTimes(1);
      expect(mockRulesUnderwriter.evaluate).not.toHaveBeenCalled();
    });

    it('passes the assembled underwriting context to the chosen provider', async () => {
      const income = makeIncome({ monthlyIncome: 12_000 });
      const credit = makeCredit({ creditScore: 733 });
      const docs = makeDocs();
      setIntegrations(income, credit, docs);

      await buildService(DecisionProvider.Rules).runUnderwritingAgent({
        borrowerId: 'B002',
        requestedAmount: 450_000,
        loanType: LoanType.FHA,
      });

      expect(mockRulesUnderwriter.evaluate).toHaveBeenCalledWith({
        borrowerId: 'B002',
        requestedAmount: 450_000,
        loanType: LoanType.FHA,
        income,
        credit,
        documents: docs,
      });
    });

    it('clamps a provider confidence value into the 0-1 range', async () => {
      setIntegrations();
      mockRulesUnderwriter.evaluate.mockReturnValue({
        ...DEFAULT_DECISION,
        confidence: 1.4,
      });

      const result = await buildService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });

      expect(result.confidence).toBe(1.0);
    });
  });

  // ── incomeVerified logic ─────────────────────────────────────────────────────

  describe('incomeVerified calculation', () => {
    it('is true for full-time employment with high income stability', async () => {
      setIntegrations(
        makeIncome({ employmentStatus: 'FULL_TIME', incomeStability: 85 }),
      );
      const result = await buildService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(result.incomeVerified).toBe(true);
    });

    it('is false for unemployed borrower', async () => {
      setIntegrations(
        makeIncome({ employmentStatus: 'UNEMPLOYED', incomeStability: 90 }),
      );
      const result = await buildService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(result.incomeVerified).toBe(false);
    });

    it('is false when income stability is 60 or below (threshold is strictly > 60)', async () => {
      setIntegrations(
        makeIncome({ employmentStatus: 'FULL_TIME', incomeStability: 60 }),
      );
      const result = await buildService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(result.incomeVerified).toBe(false);
    });
  });

  // ── Integration orchestration ────────────────────────────────────────────────

  describe('parallel integration calls', () => {
    it('calls all three integrations exactly once per evaluation', async () => {
      setIntegrations();
      await buildService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(mockPlaid.getIncomeData).toHaveBeenCalledTimes(1);
      expect(mockCredit.getCreditData).toHaveBeenCalledTimes(1);
      expect(mockDocument.verifyDocuments).toHaveBeenCalledTimes(1);
    });

    it('passes borrowerId to every integration service', async () => {
      setIntegrations();
      await buildService().runUnderwritingAgent({
        borrowerId: 'BORROWER-XYZ',
        requestedAmount: 300_000,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(mockPlaid.getIncomeData).toHaveBeenCalledWith('BORROWER-XYZ');
      expect(mockCredit.getCreditData).toHaveBeenCalledWith('BORROWER-XYZ');
      expect(mockDocument.verifyDocuments).toHaveBeenCalledWith('BORROWER-XYZ');
    });

    it('stores raw integration payloads in the result', async () => {
      const income = makeIncome();
      const credit = makeCredit();
      const docs = makeDocs();
      setIntegrations(income, credit, docs);
      const result = await buildService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(result.rawIntegrationData.plaid).toEqual(income);
      expect(result.rawIntegrationData.credit).toEqual(credit);
      expect(result.rawIntegrationData.documents).toEqual(docs);
    });

    it('returns creditScore from the credit bureau data', async () => {
      setIntegrations(makeIncome(), makeCredit({ creditScore: 742 }));
      const result = await buildService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(result.creditScore).toBe(742);
    });

    it('returns documentsValid reflecting whether all docs passed', async () => {
      setIntegrations(
        makeIncome(),
        makeCredit(),
        makeDocs({
          allDocumentsValid: false,
          failedDocuments: ['W-2'],
          w2Valid: false,
        }),
      );
      const result = await buildService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(result.documentsValid).toBe(false);
    });
  });
});
