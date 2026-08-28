import { Injectable, Logger } from '@nestjs/common';
import { LoanDecisionStatus } from '../database/enums/loan-decision.enum';
import { UnderwritingContext, UnderwritingModelResponse } from './agent.types';

interface LoanThresholds {
  minScore: number;
  maxDti: number;
  maxLti: number;
}

/**
 * Deterministic, zero-cost decisioning — DECISION_PROVIDER=rules (the
 * default). Mirrors the same policy boundaries used in
 * OllamaUnderwriterService's prompt so output stays realistic and
 * consistent whichever provider is active. No API key or model server
 * required.
 */
@Injectable()
export class RulesUnderwriterService {
  private readonly logger = new Logger(RulesUnderwriterService.name);

  evaluate(ctx: UnderwritingContext): UnderwritingModelResponse {
    this.logger.log(
      `[RULES] Running simulated readiness rules [borrowerId=${ctx.borrowerId}]`,
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
      conditions.push(
        'Provide letter of explanation for credit score below 700',
      );
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
      const confidence = Math.max(
        0.72,
        Math.min(0.96, 0.96 - problems.length * 0.08),
      );
      return {
        decision: LoanDecisionStatus.DENIED,
        confidence,
        reasoning: `Application denied due to the following underwriting deficiencies: ${problems.join('; ')}. Borrower may reapply after addressing these issues.`,
        conditions: [],
      };
    }

    if (conditions.length > 0) {
      const confidence = Math.max(
        0.6,
        Math.min(0.82, 0.82 - conditions.length * 0.06),
      );
      return {
        decision: LoanDecisionStatus.CONDITIONAL,
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
      decision: LoanDecisionStatus.APPROVED,
      confidence,
      reasoning: `Strong application: credit score ${score} with ${credit.paymentHistory.toLowerCase()} payment history, DTI of ${(dti * 100).toFixed(1)}% well within guidelines, verified ${income.employmentStatus.toLowerCase().replace('_', ' ')} income of $${annualIncome.toLocaleString()}/year, and all documents validated. Loan-to-income ratio of ${lti.toFixed(2)}x is within program limits.`,
      conditions: [],
    };
  }

  private getLoanThresholds(loanType: string): LoanThresholds {
    switch (loanType) {
      case 'FHA':
        return { minScore: 580, maxDti: 0.57, maxLti: 5.0 };
      case 'VA':
        return { minScore: 0, maxDti: 0.41, maxLti: 5.0 };
      case 'JUMBO':
        return { minScore: 720, maxDti: 0.38, maxLti: 4.0 };
      default: // CONVENTIONAL
        return { minScore: 620, maxDti: 0.5, maxLti: 4.5 };
    }
  }
}
