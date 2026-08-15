import { PlaidIncomeData } from '../integrations/plaid/plaid.types';
import { CreditBureauData } from '../integrations/credit/credit.types';
import { DocumentVerificationResult } from '../integrations/document/document.types';
import { LoanDecisionStatus } from '../database/enums/loan-decision.enum';

/**
 * The agent always reaches a conclusion, so its output type deliberately
 * excludes PENDING (a persisted state meaning "not yet evaluated") — a
 * narrower view of the same shared LoanDecisionStatus vocabulary used by
 * the API and database, not a fourth parallel decision type.
 */
export type UnderwritingDecision = Exclude<
  LoanDecisionStatus,
  LoanDecisionStatus.PENDING
>;

export interface UnderwritingContext {
  borrowerId: string;
  requestedAmount: number;
  loanType: string;
  income: PlaidIncomeData;
  credit: CreditBureauData;
  documents: DocumentVerificationResult;
}

/** Validated decision shape returned by either the rules or local-model provider. */
export interface UnderwritingModelResponse {
  decision: UnderwritingDecision;
  /** Confidence in the decision, 0.0–1.0 */
  confidence: number;
  /** Plain-English explanation suitable for a loan officer summary */
  reasoning: string;
  /** Conditions the borrower must meet — empty array for APPROVED / DENIED */
  conditions: string[];
}

export interface AgentResult {
  decision: UnderwritingDecision;
  confidence: number;
  reasoning: string;
  conditions: string[];
  incomeVerified: boolean;
  creditScore: number;
  documentsValid: boolean;
  /** Raw payloads from all three integrations, stored for compliance / audit */
  rawIntegrationData: {
    plaid: PlaidIncomeData;
    credit: CreditBureauData;
    documents: DocumentVerificationResult;
  };
}
