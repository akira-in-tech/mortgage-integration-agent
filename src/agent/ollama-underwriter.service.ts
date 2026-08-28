import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoanDecisionStatus } from '../database/enums/loan-decision.enum';
import {
  UnderwritingContext,
  UnderwritingDecision,
  UnderwritingModelResponse,
} from './agent.types';

interface OllamaChatResponse {
  message?: {
    content?: unknown;
  };
  error?: unknown;
}

/**
 * Local open-weight model decisioning via Ollama — DECISION_PROVIDER=ollama.
 * Mirrors the same policy boundaries as RulesUnderwriterService's thresholds
 * in its prompt so output stays realistic and consistent whichever provider
 * is active.
 */
@Injectable()
export class OllamaUnderwriterService {
  private readonly logger = new Logger(OllamaUnderwriterService.name);
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private httpClient: typeof fetch = fetch;

  constructor(private readonly configService: ConfigService) {
    // Validated once at bootstrap (src/config/env.validation.ts); the
    // defaults below only matter for tests constructing this service
    // directly against a partial mock ConfigService.
    this.baseUrl = this.configService.get<string>(
      'OLLAMA_BASE_URL',
      'http://127.0.0.1:11434',
    );
    this.model = this.configService.get<string>('OLLAMA_MODEL', 'qwen3.5:9b');
    this.timeoutMs = this.configService.get<number>(
      'OLLAMA_TIMEOUT_MS',
      60_000,
    );
  }

  get endpoint(): string {
    return this.baseUrl;
  }

  get modelName(): string {
    return this.model;
  }

  async evaluate(
    context: UnderwritingContext,
  ): Promise<UnderwritingModelResponse> {
    const systemPrompt = `You are an AI assistant producing a simulated mortgage readiness assessment for a loan officer.

This is not a legally binding credit decision and you must not claim it is an official AUS, lender, Fannie Mae, or Freddie Mac result.

Your job is to analyze loan application data and return a structured JSON underwriting decision.

Underwriting guidelines you must follow:
- APPROVED: Credit score ≥ 700, DTI ≤ 0.43, stable income, all documents valid, loan-to-income ratio ≤ 4.5x annual
- CONDITIONAL: Credit score 620–699, or DTI 0.43–0.50, or minor document issues — list specific conditions required
- DENIED: Credit score < 620, or DTI > 0.50, or critical document failures, or unemployed borrower

Loan type adjustments:
- FHA: allows credit score ≥ 580 (otherwise DENIED), more lenient DTI up to 0.57
- VA: no minimum credit score guideline, but DTI must be ≤ 0.41
- JUMBO: requires credit score ≥ 720 and DTI ≤ 0.38 (stricter)
- CONVENTIONAL: standard guidelines above

You MUST return ONLY valid JSON with exactly these fields, no markdown, no explanation outside the JSON:
{
  "decision": "APPROVED" | "CONDITIONAL" | "DENIED",
  "confidence": <float 0.0–1.0>,
  "reasoning": "<plain English explanation for the loan officer, 2–4 sentences>",
  "conditions": ["<condition 1>", "<condition 2>"]
}

The conditions array must be empty [] for APPROVED and DENIED decisions.
Set confidence to reflect how clearly the data supports your decision (0.95+ means unambiguous, 0.6–0.8 means borderline).`;

    const userMessage = `Please evaluate the following mortgage application and return your underwriting decision as JSON.

Application:
- Borrower ID: ${context.borrowerId}
- Requested Loan Amount: $${context.requestedAmount.toLocaleString()}
- Loan Type: ${context.loanType}

Income Verification (Plaid):
- Monthly Gross Income: $${context.income.monthlyIncome.toLocaleString()}
- Annual Gross Income: $${(context.income.monthlyIncome * 12).toLocaleString()}
- Employment Status: ${context.income.employmentStatus}
- Bank Account Age: ${context.income.bankAccountAge} months
- Income Stability Score: ${context.income.incomeStability}/100

Credit Report (Bureau):
- Credit Score: ${context.credit.creditScore}
- Debt-to-Income Ratio: ${(context.credit.debtToIncomeRatio * 100).toFixed(1)}%
- Payment History: ${context.credit.paymentHistory}
- Open Accounts: ${context.credit.openAccounts}
- Derogatory Marks: ${context.credit.derogatoryMarks}

Document Verification:
- W-2 Valid: ${context.documents.w2Valid}
- Pay Stub Valid: ${context.documents.payStubValid}
- Bank Statement Valid: ${context.documents.bankStatementValid}
- Tax Return Valid: ${context.documents.taxReturnValid}
- Failed Documents: ${context.documents.failedDocuments.length > 0 ? context.documents.failedDocuments.join(', ') : 'None'}

Loan-to-Annual-Income Ratio: ${(context.requestedAmount / (context.income.monthlyIncome * 12)).toFixed(2)}x`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.httpClient(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          think: false,
          format: {
            type: 'object',
            properties: {
              decision: {
                type: 'string',
                enum: ['APPROVED', 'CONDITIONAL', 'DENIED'],
              },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              reasoning: { type: 'string', minLength: 1 },
              conditions: {
                type: 'array',
                items: { type: 'string', minLength: 1 },
              },
            },
            required: ['decision', 'confidence', 'reasoning', 'conditions'],
            additionalProperties: false,
          },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          options: { temperature: 0 },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(`Ollama request failed: ${detail}`);
      throw new InternalServerErrorException(
        'Local AI provider is unavailable; start Ollama or use DECISION_PROVIDER=rules',
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      this.logger.error(
        `Ollama returned HTTP ${response.status} ${response.statusText}`,
      );
      throw new InternalServerErrorException(
        'Local AI provider returned an error response',
      );
    }

    let payload: OllamaChatResponse;
    try {
      payload = (await response.json()) as OllamaChatResponse;
    } catch {
      throw new InternalServerErrorException(
        'Local AI provider returned invalid JSON',
      );
    }

    if (typeof payload.message?.content !== 'string') {
      const providerError =
        typeof payload.error === 'string' ? `: ${payload.error}` : '';
      this.logger.error(`Ollama returned no message content${providerError}`);
      throw new InternalServerErrorException(
        'Local AI provider returned no message content',
      );
    }

    return this.parseModelResponse(payload.message.content);
  }

  private parseModelResponse(rawText: string): UnderwritingModelResponse {
    let parsed: unknown;
    try {
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      this.logger.error(`Local model returned non-JSON response: ${rawText}`);
      throw new InternalServerErrorException(
        'AI underwriting engine returned an invalid response format',
      );
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new InternalServerErrorException(
        'AI underwriting engine returned an invalid response format',
      );
    }

    const response = parsed as Record<string, unknown>;

    const validDecisions = new Set<string>([
      LoanDecisionStatus.APPROVED,
      LoanDecisionStatus.CONDITIONAL,
      LoanDecisionStatus.DENIED,
    ]);
    if (
      typeof response['decision'] !== 'string' ||
      !validDecisions.has(response['decision'])
    ) {
      throw new InternalServerErrorException(
        `Invalid decision value from AI: ${String(response['decision'])}`,
      );
    }
    if (
      typeof response['confidence'] !== 'number' ||
      !Number.isFinite(response['confidence']) ||
      response['confidence'] < 0 ||
      response['confidence'] > 1
    ) {
      throw new InternalServerErrorException(
        'Invalid confidence value from AI',
      );
    }
    if (
      typeof response['reasoning'] !== 'string' ||
      response['reasoning'].trim().length === 0
    ) {
      throw new InternalServerErrorException('Missing reasoning from AI');
    }
    if (
      !Array.isArray(response['conditions']) ||
      !response['conditions'].every(
        (condition) =>
          typeof condition === 'string' && condition.trim().length > 0,
      )
    ) {
      throw new InternalServerErrorException(
        'Missing conditions array from AI',
      );
    }

    // Validated above against validDecisions (every LoanDecisionStatus
    // member except PENDING, which UnderwritingDecision excludes by type).
    const decision = response['decision'] as UnderwritingDecision;
    const conditions = (response['conditions'] as string[]).map((condition) =>
      condition.trim(),
    );
    if (
      (decision === LoanDecisionStatus.CONDITIONAL &&
        conditions.length === 0) ||
      (decision !== LoanDecisionStatus.CONDITIONAL && conditions.length > 0)
    ) {
      throw new InternalServerErrorException(
        'Conditions do not match the AI underwriting decision',
      );
    }

    return {
      decision,
      confidence: response['confidence'] as number,
      reasoning: response['reasoning'].trim(),
      conditions,
    };
  }
}
