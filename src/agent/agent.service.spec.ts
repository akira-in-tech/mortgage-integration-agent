import 'reflect-metadata';
import { InternalServerErrorException } from '@nestjs/common';
import { AgentService } from './agent.service';
import { LoanType } from '../loan/loan.model';
import { PlaidIncomeData } from '../integrations/plaid/plaid.types';
import { CreditBureauData } from '../integrations/credit/credit.types';
import { DocumentVerificationResult } from '../integrations/document/document.types';

const mockFetch = jest.fn();

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

// ── Shared test state ─────────────────────────────────────────────────────────

const BASE_INPUT = { borrowerId: 'B001', requestedAmount: 300_000 };

describe('AgentService', () => {
  let mockPlaid: { getIncomeData: jest.Mock };
  let mockCredit: { getCreditData: jest.Mock };
  let mockDocument: { verifyDocuments: jest.Mock };

  beforeEach(() => {
    mockFetch.mockReset();
    mockPlaid = { getIncomeData: jest.fn() };
    mockCredit = { getCreditData: jest.fn() };
    mockDocument = { verifyDocuments: jest.fn() };
  });

  function buildDemoService(): AgentService {
    return new AgentService(
      {
        get: jest.fn((key: string) =>
          key === 'DECISION_PROVIDER' ? 'rules' : undefined,
        ),
      } as any,
      mockPlaid as any,
      mockCredit as any,
      mockDocument as any,
    );
  }

  function buildOllamaService(): AgentService {
    const service = new AgentService(
      {
        get: jest.fn((key: string) => {
          const values: Record<string, string> = {
            DECISION_PROVIDER: 'ollama',
            OLLAMA_BASE_URL: 'http://ollama.test:11434',
            OLLAMA_MODEL: 'qwen3.5:9b',
            OLLAMA_TIMEOUT_MS: '5000',
          };
          return values[key];
        }),
      } as any,
      mockPlaid as any,
      mockCredit as any,
      mockDocument as any,
    );
    Object.defineProperty(service, 'httpClient', {
      value: mockFetch,
    });
    return service;
  }

  function ollamaResponse(content: unknown, ok = true): Response {
    return {
      ok,
      status: ok ? 200 : 500,
      statusText: ok ? 'OK' : 'Internal Server Error',
      json: jest.fn().mockResolvedValue({
        message: content === undefined ? undefined : { content },
      }),
    } as unknown as Response;
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

  // ── Demo underwriter — APPROVED decisions ───────────────────────────────────

  describe('demo mode — APPROVED decisions', () => {
    it('defaults to rules mode when DECISION_PROVIDER is not configured', async () => {
      setIntegrations();
      const config = {
        get: jest.fn().mockReturnValue(undefined),
        getOrThrow: jest.fn(),
      };
      const service = new AgentService(
        config as any,
        mockPlaid as any,
        mockCredit as any,
        mockDocument as any,
      );

      const result = await service.runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });

      expect(result.decision).toBe('APPROVED');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('approves a strong CONVENTIONAL application', async () => {
      setIntegrations();
      const result = await buildDemoService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(result.decision).toBe('APPROVED');
      expect(result.conditions).toHaveLength(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('approves an FHA application with score 720 (above both FHA min and 700 threshold)', async () => {
      setIntegrations(
        makeIncome(),
        makeCredit({ creditScore: 720, debtToIncomeRatio: 0.4 }),
      );
      const result = await buildDemoService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.FHA,
      });
      expect(result.decision).toBe('APPROVED');
    });

    it('approves a VA application regardless of credit score (no VA minimum)', async () => {
      // VA has no minScore — score 720 is above 700 so no condition either
      setIntegrations(
        makeIncome(),
        makeCredit({ creditScore: 720, debtToIncomeRatio: 0.35 }),
      );
      const result = await buildDemoService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.VA,
      });
      expect(result.decision).toBe('APPROVED');
    });

    it('approves a JUMBO application with score 750 and low DTI', async () => {
      setIntegrations(
        makeIncome({ monthlyIncome: 20_000 }), // annualIncome=240k, LTI=1.25 — well within JUMBO maxLti=4.0
        makeCredit({ creditScore: 750, debtToIncomeRatio: 0.3 }),
      );
      const result = await buildDemoService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.JUMBO,
      });
      expect(result.decision).toBe('APPROVED');
    });
  });

  // ── Demo underwriter — CONDITIONAL decisions ─────────────────────────────────

  describe('demo mode — CONDITIONAL decisions', () => {
    it('issues condition for credit score 620–699 (CONVENTIONAL)', async () => {
      setIntegrations(makeIncome(), makeCredit({ creditScore: 650 }));
      const result = await buildDemoService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(result.decision).toBe('CONDITIONAL');
      expect(
        result.conditions.some((c) => c.includes('letter of explanation')),
      ).toBe(true);
    });

    it('issues condition for DTI between 43% and 50% (CONVENTIONAL)', async () => {
      setIntegrations(
        makeIncome(),
        makeCredit({ creditScore: 720, debtToIncomeRatio: 0.46 }),
      );
      const result = await buildDemoService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(result.decision).toBe('CONDITIONAL');
      expect(
        result.conditions.some((c) => c.includes('compensating factors')),
      ).toBe(true);
    });

    it('issues condition for self-employed borrower', async () => {
      setIntegrations(makeIncome({ employmentStatus: 'SELF_EMPLOYED' }));
      const result = await buildDemoService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(result.decision).toBe('CONDITIONAL');
      expect(result.conditions.some((c) => c.includes('profit & loss'))).toBe(
        true,
      );
    });

    it('issues condition for a single missing document', async () => {
      setIntegrations(
        makeIncome(),
        makeCredit(),
        makeDocs({
          bankStatementValid: false,
          allDocumentsValid: false,
          failedDocuments: ['Bank Statement'],
        }),
      );
      const result = await buildDemoService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(result.decision).toBe('CONDITIONAL');
      expect(result.conditions.some((c) => c.includes('Resubmit'))).toBe(true);
    });

    it('issues condition for exactly one derogatory mark', async () => {
      setIntegrations(makeIncome(), makeCredit({ derogatoryMarks: 1 }));
      const result = await buildDemoService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(result.decision).toBe('CONDITIONAL');
      expect(result.conditions.some((c) => c.includes('derogatory'))).toBe(
        true,
      );
    });
  });

  // ── Demo underwriter — DENIED decisions ──────────────────────────────────────

  describe('demo mode — DENIED decisions', () => {
    it('denies FHA application with score below 580', async () => {
      setIntegrations(makeIncome(), makeCredit({ creditScore: 570 }));
      const result = await buildDemoService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.FHA,
      });
      expect(result.decision).toBe('DENIED');
      expect(result.conditions).toHaveLength(0);
    });

    it('denies CONVENTIONAL application with score below 620', async () => {
      setIntegrations(makeIncome(), makeCredit({ creditScore: 610 }));
      const result = await buildDemoService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(result.decision).toBe('DENIED');
    });

    it('denies JUMBO application with score below 720', async () => {
      setIntegrations(makeIncome(), makeCredit({ creditScore: 700 }));
      const result = await buildDemoService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.JUMBO,
      });
      expect(result.decision).toBe('DENIED');
    });

    it('denies application with DTI exceeding CONVENTIONAL limit (50%)', async () => {
      setIntegrations(
        makeIncome(),
        makeCredit({ creditScore: 720, debtToIncomeRatio: 0.55 }),
      );
      const result = await buildDemoService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(result.decision).toBe('DENIED');
    });

    it('denies application for unemployed borrower', async () => {
      setIntegrations(makeIncome({ employmentStatus: 'UNEMPLOYED' }));
      const result = await buildDemoService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(result.decision).toBe('DENIED');
    });

    it('denies application with more than one missing document', async () => {
      setIntegrations(
        makeIncome(),
        makeCredit(),
        makeDocs({
          w2Valid: false,
          payStubValid: false,
          allDocumentsValid: false,
          failedDocuments: ['W-2', 'Pay Stub'],
        }),
      );
      const result = await buildDemoService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(result.decision).toBe('DENIED');
    });

    it('denies application with two or more derogatory marks', async () => {
      setIntegrations(makeIncome(), makeCredit({ derogatoryMarks: 2 }));
      const result = await buildDemoService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(result.decision).toBe('DENIED');
    });
  });

  // ── incomeVerified logic ─────────────────────────────────────────────────────

  describe('incomeVerified calculation', () => {
    it('is true for full-time employment with high income stability', async () => {
      setIntegrations(
        makeIncome({ employmentStatus: 'FULL_TIME', incomeStability: 85 }),
      );
      const result = await buildDemoService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(result.incomeVerified).toBe(true);
    });

    it('is false for unemployed borrower', async () => {
      setIntegrations(
        makeIncome({ employmentStatus: 'UNEMPLOYED', incomeStability: 90 }),
      );
      const result = await buildDemoService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(result.incomeVerified).toBe(false);
    });

    it('is false when income stability is 60 or below (threshold is strictly > 60)', async () => {
      setIntegrations(
        makeIncome({ employmentStatus: 'FULL_TIME', incomeStability: 60 }),
      );
      const result = await buildDemoService().runUnderwritingAgent({
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
      await buildDemoService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(mockPlaid.getIncomeData).toHaveBeenCalledTimes(1);
      expect(mockCredit.getCreditData).toHaveBeenCalledTimes(1);
      expect(mockDocument.verifyDocuments).toHaveBeenCalledTimes(1);
    });

    it('passes borrowerId to every integration service', async () => {
      setIntegrations();
      await buildDemoService().runUnderwritingAgent({
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
      const result = await buildDemoService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(result.rawIntegrationData.plaid).toEqual(income);
      expect(result.rawIntegrationData.credit).toEqual(credit);
      expect(result.rawIntegrationData.documents).toEqual(docs);
    });

    it('returns creditScore from the credit bureau data', async () => {
      setIntegrations(makeIncome(), makeCredit({ creditScore: 742 }));
      const result = await buildDemoService().runUnderwritingAgent({
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
      // This produces DENIED (single missing doc is actually condition, but let's verify documentsValid field)
      // With 1 failed doc, it's a condition → CONDITIONAL
      // We just care that documentsValid = false here
      const result = await buildDemoService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
      expect(result.documentsValid).toBe(false);
    });
  });

  // ── Local Ollama mode ────────────────────────────────────────────────────────

  describe('Ollama mode — structured local-model response', () => {
    beforeEach(() => {
      setIntegrations();
    });

    async function runWithModelContent(content: unknown) {
      mockFetch.mockResolvedValueOnce(ollamaResponse(content));
      return buildOllamaService().runUnderwritingAgent({
        ...BASE_INPUT,
        loanType: LoanType.CONVENTIONAL,
      });
    }

    it('calls the local Ollama chat API with a JSON schema', async () => {
      const content = JSON.stringify({
        decision: 'APPROVED',
        confidence: 0.91,
        reasoning: 'Solid app.',
        conditions: [],
      });

      const result = await runWithModelContent(content);

      expect(result.decision).toBe('APPROVED');
      expect(result.confidence).toBe(0.91);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://ollama.test:11434/api/chat',
        expect.objectContaining({ method: 'POST' }),
      );

      const request = mockFetch.mock.calls[0][1] as RequestInit;
      const body = JSON.parse(request.body as string) as Record<string, any>;
      expect(body.model).toBe('qwen3.5:9b');
      expect(body.stream).toBe(false);
      expect(body.format.properties.decision.enum).toEqual([
        'APPROVED',
        'CONDITIONAL',
        'DENIED',
      ]);
    });

    it('strips markdown code fences before parsing', async () => {
      const result = await runWithModelContent(
        '```json\n{ "decision": "CONDITIONAL", "confidence": 0.72, "reasoning": "Borderline.", "conditions": ["Provide letter"] }\n```',
      );
      expect(result.decision).toBe('CONDITIONAL');
      expect(result.conditions).toEqual(['Provide letter']);
    });

    it('rejects malformed or semantically invalid model responses', async () => {
      const invalidResponses = [
        'I cannot provide that information.',
        JSON.stringify({
          decision: 'MAYBE',
          confidence: 0.5,
          reasoning: 'Unclear.',
          conditions: [],
        }),
        JSON.stringify({
          decision: 'APPROVED',
          confidence: 1.5,
          reasoning: 'Great.',
          conditions: [],
        }),
        JSON.stringify({
          decision: 'APPROVED',
          confidence: 0.9,
          conditions: [],
        }),
        JSON.stringify({
          decision: 'APPROVED',
          confidence: 0.9,
          reasoning: 'Good.',
          conditions: 'none',
        }),
        'null',
        JSON.stringify({
          decision: 'CONDITIONAL',
          confidence: 0.7,
          reasoning: 'Borderline.',
          conditions: [42],
        }),
        JSON.stringify({
          decision: 'APPROVED',
          confidence: 0.9,
          reasoning: 'Approved.',
          conditions: ['Provide another document'],
        }),
        JSON.stringify({
          decision: 'CONDITIONAL',
          confidence: 0.7,
          reasoning: 'Borderline.',
          conditions: [],
        }),
      ];

      for (const invalidResponse of invalidResponses) {
        await expect(runWithModelContent(invalidResponse)).rejects.toThrow(
          InternalServerErrorException,
        );
      }
    });

    it('throws when Ollama is unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      await expect(
        buildOllamaService().runUnderwritingAgent({
          ...BASE_INPUT,
          loanType: LoanType.CONVENTIONAL,
        }),
      ).rejects.toThrow('Local AI provider is unavailable');
    });

    it('throws when Ollama returns an HTTP error', async () => {
      mockFetch.mockResolvedValueOnce(ollamaResponse(undefined, false));

      await expect(
        buildOllamaService().runUnderwritingAgent({
          ...BASE_INPUT,
          loanType: LoanType.CONVENTIONAL,
        }),
      ).rejects.toThrow('Local AI provider returned an error response');
    });

    it('throws when Ollama returns no message content', async () => {
      mockFetch.mockResolvedValueOnce(ollamaResponse(undefined));

      await expect(
        buildOllamaService().runUnderwritingAgent({
          ...BASE_INPUT,
          loanType: LoanType.CONVENTIONAL,
        }),
      ).rejects.toThrow('Local AI provider returned no message content');
    });
  });

  describe('provider configuration', () => {
    it('rejects an unsupported provider', () => {
      expect(
        () =>
          new AgentService(
            { get: jest.fn().mockReturnValue('unknown') } as any,
            mockPlaid as any,
            mockCredit as any,
            mockDocument as any,
          ),
      ).toThrow('DECISION_PROVIDER must be either "rules" or "ollama"');
    });
  });
});
