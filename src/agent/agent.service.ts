import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PlaidService } from '../integrations/plaid/plaid.service';
import { CreditService } from '../integrations/credit/credit.service';
import { DocumentService } from '../integrations/document/document.service';
import { EvaluateLoanInput } from '../loan/loan.model';
import {
  AgentResult,
  ClaudeUnderwritingResponse,
  UnderwritingContext,
} from './agent.types';

/**
 * AgentService is the orchestration core of the mortgage underwriting pipeline.
 *
 * Flow:
 *  1. Fan out to Plaid, Credit Bureau, and Document Parser in parallel
 *  2. Assemble a structured underwriting context
 *  3. Send that context to Claude as a decisioning prompt  (or demo engine if DEMO_MODE=true)
 *  4. Parse and validate the JSON response
 *  5. Return a typed AgentResult to the caller
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly isDemoMode: boolean;
  private anthropic: Anthropic | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly plaidService: PlaidService,
    private readonly creditService: CreditService,
    private readonly documentService: DocumentService,
  ) {
    this.isDemoMode =
      this.configService.get<string>('DEMO_MODE')?.toLowerCase() === 'true';

    if (this.isDemoMode) {
      this.logger.warn(
        '*** DEMO MODE ACTIVE — Claude API will not be called ***',
      );
    } else {
      this.anthropic = new Anthropic({
        apiKey: this.configService.getOrThrow<string>('ANTHROPIC_API_KEY'),
      });
    }
  }

  async runUnderwritingAgent(input: EvaluateLoanInput): Promise<AgentResult> {
    const { borrowerId, requestedAmount, loanType } = input;

    // ── Step 1: Fan out to all integrations simultaneously ──────────────────
    this.logger.log(
      `Fetching integration data in parallel [borrowerId=${borrowerId}]`,
    );

    const [income, credit, documents] = await Promise.all([
      this.plaidService.getIncomeData(borrowerId),
      this.creditService.getCreditData(borrowerId),
      this.documentService.verifyDocuments(borrowerId),
    ]);

    const context: UnderwritingContext = {
      borrowerId,
      requestedAmount,
      loanType,
      income,
      credit,
      documents,
    };

    // ── Step 2: Decisioning — demo engine or Claude API ────────────────────
    const decision = this.isDemoMode
      ? this.runDemoUnderwriter(context)
      : await this.invokeClaudeUnderwriter(context);

    // ── Step 3: Assemble final result ──────────────────────────────────────
    return {
      decision: decision.decision,
      confidence: Math.min(1.0, Math.max(0.0, decision.confidence)),
      reasoning: decision.reasoning,
      conditions: decision.conditions,
      incomeVerified:
        income.employmentStatus !== 'UNEMPLOYED' && income.incomeStability > 60,
      creditScore: credit.creditScore,
      documentsValid: documents.allDocumentsValid,
      rawIntegrationData: { plaid: income, credit, documents },
    };
  }

  // ── Demo underwriter ──────────────────────────────────────────────────────
  // Mirrors the same rules in the Claude system prompt so demo output is
  // realistic and consistent. No API key required.

  private runDemoUnderwriter(
    ctx: UnderwritingContext,
  ): ClaudeUnderwritingResponse {
    this.logger.log(
      `[DEMO] Running rule-based underwriter [borrowerId=${ctx.borrowerId}]`,
    );

    const { credit, income, documents, requestedAmount, loanType } = ctx;
    const annualIncome = income.monthlyIncome * 12;
    const lti = requestedAmount / annualIncome; // loan-to-income ratio
    const dti = credit.debtToIncomeRatio;
    const score = credit.creditScore;

    // Effective thresholds per loan program
    const thresholds = this.getLoanThresholds(loanType);

    const conditions: string[] = [];
    const problems: string[] = [];

    // ── Credit score check ────────────────────────────────────────────────
    if (score < thresholds.minScore) {
      problems.push(
        `Credit score ${score} is below the ${thresholds.minScore} minimum for ${loanType}`,
      );
    } else if (score < 700) {
      conditions.push('Provide letter of explanation for credit score below 700');
    }

    // ── DTI check ─────────────────────────────────────────────────────────
    if (dti > thresholds.maxDti) {
      problems.push(
        `DTI of ${(dti * 100).toFixed(1)}% exceeds ${(thresholds.maxDti * 100).toFixed(0)}% limit for ${loanType}`,
      );
    } else if (dti > 0.43) {
      conditions.push(
        `Document compensating factors for DTI of ${(dti * 100).toFixed(1)}% exceeding 43%`,
      );
    }

    // ── Employment / income ────────────────────────────────────────────────
    if (income.employmentStatus === 'UNEMPLOYED') {
      problems.push('Borrower is currently unemployed');
    } else if (income.employmentStatus === 'SELF_EMPLOYED') {
      conditions.push('Provide 2 years CPA-prepared profit & loss statements');
    }

    // ── Loan-to-income ratio ───────────────────────────────────────────────
    if (lti > thresholds.maxLti) {
      problems.push(
        `Loan-to-income ratio of ${lti.toFixed(2)}x exceeds ${thresholds.maxLti}x guideline`,
      );
    }

    // ── Documents ─────────────────────────────────────────────────────────
    if (!documents.allDocumentsValid) {
      const failed = documents.failedDocuments.join(', ');
      if (documents.failedDocuments.length > 1) {
        problems.push(`Multiple missing documents: ${failed}`);
      } else {
        conditions.push(`Resubmit missing document(s): ${failed}`);
      }
    }

    // ── Derogatory marks ──────────────────────────────────────────────────
    if (credit.derogatoryMarks >= 2) {
      problems.push(
        `${credit.derogatoryMarks} derogatory marks exceed acceptable threshold`,
      );
    } else if (credit.derogatoryMarks === 1) {
      conditions.push('Provide written explanation for derogatory credit mark');
    }

    // ── Final decision ─────────────────────────────────────────────────────
    if (problems.length > 0) {
      const confidence = Math.max(0.72, Math.min(0.96, 0.96 - problems.length * 0.08));
      return {
        decision: 'DENIED',
        confidence,
        reasoning: `Application denied due to the following underwriting deficiencies: ${problems.join('; ')}. Borrower may reapply after addressing these issues.`,
        conditions: [],
      };
    }

    if (conditions.length > 0) {
      const confidence = Math.max(0.60, Math.min(0.82, 0.82 - conditions.length * 0.06));
      return {
        decision: 'CONDITIONAL',
        confidence,
        reasoning: `Application is conditionally approved pending resolution of ${conditions.length} item(s). Credit score is ${score}, DTI is ${(dti * 100).toFixed(1)}%, and income qualifies at $${annualIncome.toLocaleString()} annually.`,
        conditions,
      };
    }

    const confidence = Math.min(
      0.99,
      0.78 +
        (score - 700) / 1000 +
        (0.43 - dti) * 0.5 +
        (documents.allDocumentsValid ? 0.05 : 0),
    );
    return {
      decision: 'APPROVED',
      confidence,
      reasoning: `Strong application: credit score ${score} with ${credit.paymentHistory.toLowerCase()} payment history, DTI of ${(dti * 100).toFixed(1)}% well within guidelines, verified ${income.employmentStatus.toLowerCase().replace('_', ' ')} income of $${annualIncome.toLocaleString()}/year, and all documents validated. Loan-to-income ratio of ${lti.toFixed(2)}x is within program limits.`,
      conditions: [],
    };
  }

  private getLoanThresholds(loanType: string): {
    minScore: number;
    maxDti: number;
    maxLti: number;
  } {
    switch (loanType) {
      case 'FHA':
        return { minScore: 580, maxDti: 0.57, maxLti: 5.0 };
      case 'VA':
        return { minScore: 0, maxDti: 0.41, maxLti: 5.0 };
      case 'JUMBO':
        return { minScore: 720, maxDti: 0.38, maxLti: 4.0 };
      default: // CONVENTIONAL
        return { minScore: 620, maxDti: 0.50, maxLti: 4.5 };
    }
  }

  // ── Claude API underwriter ────────────────────────────────────────────────

  private async invokeClaudeUnderwriter(
    context: UnderwritingContext,
  ): Promise<ClaudeUnderwritingResponse> {
    if (!this.anthropic) {
      throw new InternalServerErrorException(
        'Anthropic client not initialised — set ANTHROPIC_API_KEY or enable DEMO_MODE=true',
      );
    }

    const systemPrompt = `You are an AI mortgage underwriting decisioning engine for a regulated US lender.

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

    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const rawContent = message.content[0];
    if (rawContent.type !== 'text') {
      throw new InternalServerErrorException(
        'Unexpected response type from Claude API',
      );
    }

    return this.parseClaudeResponse(rawContent.text);
  }

  private parseClaudeResponse(rawText: string): ClaudeUnderwritingResponse {
    let parsed: unknown;
    try {
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      this.logger.error(`Claude returned non-JSON response: ${rawText}`);
      throw new InternalServerErrorException(
        'AI underwriting engine returned an invalid response format',
      );
    }

    const response = parsed as Record<string, unknown>;

    const validDecisions = new Set(['APPROVED', 'CONDITIONAL', 'DENIED']);
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
      response['confidence'] < 0 ||
      response['confidence'] > 1
    ) {
      throw new InternalServerErrorException('Invalid confidence value from AI');
    }
    if (typeof response['reasoning'] !== 'string') {
      throw new InternalServerErrorException('Missing reasoning from AI');
    }
    if (!Array.isArray(response['conditions'])) {
      throw new InternalServerErrorException('Missing conditions array from AI');
    }

    return {
      decision: response['decision'] as 'APPROVED' | 'CONDITIONAL' | 'DENIED',
      confidence: response['confidence'] as number,
      reasoning: response['reasoning'] as string,
      conditions: response['conditions'] as string[],
    };
  }
}
