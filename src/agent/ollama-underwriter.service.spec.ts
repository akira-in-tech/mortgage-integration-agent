import 'reflect-metadata';
import { InternalServerErrorException } from '@nestjs/common';
import { OllamaUnderwriterService } from './ollama-underwriter.service';
import { LoanType } from '../loan/loan.model';
import { UnderwritingContext } from './agent.types';
import { PlaidIncomeData } from '../integrations/plaid/plaid.types';
import { CreditBureauData } from '../integrations/credit/credit.types';
import { DocumentVerificationResult } from '../integrations/document/document.types';

const mockFetch = jest.fn();

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

const CONTEXT: UnderwritingContext = {
  borrowerId: 'B001',
  requestedAmount: 300_000,
  loanType: LoanType.CONVENTIONAL,
  income: makeIncome(),
  credit: makeCredit(),
  documents: makeDocs(),
};

function buildService(): OllamaUnderwriterService {
  const service = new OllamaUnderwriterService({
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const values: Record<string, unknown> = {
        OLLAMA_BASE_URL: 'http://ollama.test:11434',
        OLLAMA_MODEL: 'qwen3.5:9b',
        OLLAMA_TIMEOUT_MS: 5000,
      };
      return key in values ? values[key] : defaultValue;
    }),
  } as any);
  Object.defineProperty(service, 'httpClient', { value: mockFetch });
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

describe('OllamaUnderwriterService', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  async function runWithModelContent(content: unknown) {
    mockFetch.mockResolvedValueOnce(ollamaResponse(content));
    return buildService().evaluate(CONTEXT);
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

    await expect(buildService().evaluate(CONTEXT)).rejects.toThrow(
      'Local AI provider is unavailable',
    );
  });

  it('throws when Ollama returns an HTTP error', async () => {
    mockFetch.mockResolvedValueOnce(ollamaResponse(undefined, false));

    await expect(buildService().evaluate(CONTEXT)).rejects.toThrow(
      'Local AI provider returned an error response',
    );
  });

  it('throws when Ollama returns no message content', async () => {
    mockFetch.mockResolvedValueOnce(ollamaResponse(undefined));

    await expect(buildService().evaluate(CONTEXT)).rejects.toThrow(
      'Local AI provider returned no message content',
    );
  });
});
