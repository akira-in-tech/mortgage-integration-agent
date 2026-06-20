import { PlaidIncomeData } from '../integrations/plaid/plaid.types';
import { CreditBureauData } from '../integrations/credit/credit.types';
import { DocumentVerificationResult } from '../integrations/document/document.types';

export type UnderwritingDecision = 'APPROVED' | 'CONDITIONAL' | 'DENIED';

export interface UnderwritingContext {
  borrowerId: string;
  requestedAmount: number;
  loanType: string;
  income: PlaidIncomeData;
  credit: CreditBureauData;
  documents: DocumentVerificationResult;
}

/** Shape of JSON we instruct Claude to return */
export interface ClaudeUnderwritingResponse {
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
