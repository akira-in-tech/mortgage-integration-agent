import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlaidService } from '../integrations/plaid/plaid.service';
import { CreditService } from '../integrations/credit/credit.service';
import { DocumentService } from '../integrations/document/document.service';
import { EvaluateLoanInput } from '../loan/loan.model';
import { DecisionProvider } from '../config/env.validation';
import { RulesUnderwriterService } from './rules-underwriter.service';
import { OllamaUnderwriterService } from './ollama-underwriter.service';
import { AgentResult, UnderwritingContext } from './agent.types';

/**
 * AgentService is the orchestration core of the mortgage underwriting
 * pipeline. Decisioning itself lives in RulesUnderwriterService (the
 * deterministic default) and OllamaUnderwriterService (the local-model
 * path) — this class only fans out to the integrations, picks which
 * provider to ask, and assembles the result.
 *
 * Flow:
 *  1. Fan out to Plaid, Credit Bureau, and Document Parser in parallel
 *  2. Assemble a structured underwriting context
 *  3. Delegate decisioning to the configured provider
 *  4. Return a typed AgentResult to the caller
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly decisionProvider: DecisionProvider;

  constructor(
    private readonly configService: ConfigService,
    private readonly plaidService: PlaidService,
    private readonly creditService: CreditService,
    private readonly documentService: DocumentService,
    private readonly rulesUnderwriter: RulesUnderwriterService,
    private readonly ollamaUnderwriter: OllamaUnderwriterService,
  ) {
    // Validated once at bootstrap (src/config/env.validation.ts); no
    // re-validation needed at this internal boundary. The default value
    // only matters for tests constructing AgentService directly against a
    // partial mock ConfigService.
    this.decisionProvider = this.configService.get<DecisionProvider>(
      'DECISION_PROVIDER',
      DecisionProvider.Rules,
    );

    if (this.decisionProvider === DecisionProvider.Rules) {
      this.logger.warn(
        '*** RULES PROVIDER ACTIVE — no model server or API key required ***',
      );
    } else {
      this.logger.log(
        `Local model provider active [model=${this.ollamaUnderwriter.modelName}, endpoint=${this.ollamaUnderwriter.endpoint}]`,
      );
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

    // ── Step 2: Decisioning — deterministic rules or local Ollama ──────────
    const decision =
      this.decisionProvider === DecisionProvider.Rules
        ? this.rulesUnderwriter.evaluate(context)
        : await this.ollamaUnderwriter.evaluate(context);

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
}
