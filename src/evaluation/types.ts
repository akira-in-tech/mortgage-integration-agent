import { LoanType } from '../database/enums/loan-type.enum';

/**
 * Section 18.2's corpus categories, narrowed to what this codebase's
 * current maturity can honestly exercise (see `docs/DEVELOPMENT_LOG.md`'s
 * M3-019 entry for the full reasoning): `contradiction` and `adversarial`
 * are omitted rather than faked, since no contradiction detector or
 * document/model-facing surface exists yet to genuinely test against.
 */
export type EvaluationCategory =
  | 'normal'
  | 'boundary'
  | 'missing-data'
  | 'policy-coverage'
  | 'provider-failure';

export type ExpectedOutcome =
  | 'CONDITION_OPENED'
  | 'NO_CONDITION'
  | 'REVIEW_REQUIRED'
  | 'PROVIDER_TRANSIENT_FAILURE'
  | 'PROVIDER_TERMINAL_FAILURE';

export interface EvaluationCaseFixture {
  id: string;
  description: string;
  category: EvaluationCategory;
  borrowerId: string;
  jurisdictionCode: string;
  loanType: LoanType;
  statedMonthlyIncome: number;
  requestedAmount: number;
  /**
   * Only for `category: 'missing-data'` — inserted directly as the
   * case's INCOME evidence value instead of calling the real Plaid
   * simulator, to exercise the DSL evaluator's own missing-fact
   * fail-safe (`policy-rule-evaluator.ts`'s "cannot evaluate: missing"
   * branch) rather than the ordinary simulator path.
   */
  incomeEvidenceOverride?: Record<string, unknown>;
  /** Only for `category: 'provider-failure'` — which fetch step is expected to fail. */
  failingStep?: 'income' | 'credit' | 'document';
  expected: {
    outcome: ExpectedOutcome;
    conditionCode?: string;
  };
}

export interface EvaluationCaseResult {
  fixtureId: string;
  category: EvaluationCategory;
  description: string;
  expectedOutcome: ExpectedOutcome;
  actualOutcome: ExpectedOutcome | 'ERROR';
  actualConditionCode?: string;
  passed: boolean;
  detail: string;
}

export interface EvaluationReport {
  generatedAt: string;
  codeRevision: { gitCommit: string | null; gitBranch: string | null };
  policyDataset: {
    resolverVersion: string;
    releasedPolicyVersionIds: string[];
  };
  /**
   * Explicitly recorded, not omitted — Section 18.3 requires "model,
   * prompt... revisions are pinned in every report." The M3 Agent graph
   * makes no model calls at all (see `lending-operations-agent-runtime
   * .ts`'s own comments), so there is nothing real to pin. Reporting
   * `null` with this explanation is honest; a placeholder version string
   * would not be.
   */
  modelAndPromptRevisions: null;
  modelAndPromptRevisionsNote: string;
  corpus: { totalCases: number; source: string };
  results: EvaluationCaseResult[];
  summary: {
    totalCases: number;
    passed: number;
    failed: number;
    byCategory: Record<EvaluationCategory, { total: number; passed: number }>;
    /** Of cases the corpus expected to open a condition, the fraction that actually did. Null when the corpus has no such cases. */
    conditionRecall: number | null;
    /** Of cases that actually opened a condition, the fraction the corpus expected to. Null when no case actually opened one. */
    conditionPrecision: number | null;
  };
}
