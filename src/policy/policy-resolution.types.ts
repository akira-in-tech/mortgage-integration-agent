import { PolicyRuleDocument } from './dsl/policy-rule.types';

/**
 * Server-owned facts that determine which immutable policy versions apply.
 * `asOf` is the evaluation instant; `applicationReceivedAt` is the stable
 * business-time anchor used by grandfathering rules. Callers must never
 * substitute an evaluation retry timestamp for the original application
 * receipt timestamp.
 */
export interface PolicyResolutionContext {
  jurisdictionCode: string;
  productCode: string;
  lifecycleEvent: string;
  asOf: Date;
  applicationReceivedAt?: Date;
}

export interface ResolvedPolicyVersionRef {
  policyVersionId: string;
  ruleId: string;
  version: string;
  rule: PolicyRuleDocument;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

/**
 * In-memory resolution result. `PolicyEvaluationService`
 * (policy-evaluation.service.ts) is what persists this as an immutable
 * `CasePolicySnapshot` and decides whether an existing `CasePolicyBinding`
 * can be reused — `PolicyApplicabilityResolverService` itself stays a
 * stateless, unpersisted resolver (Section 10.3).
 */
export interface PolicyResolutionResult {
  status: 'RESOLVED' | 'REVIEW_REQUIRED';
  versions: ResolvedPolicyVersionRef[];
  unresolvedReasons: string[];
  /** Earliest source-freshness or scheduled policy boundary. */
  revalidateAfter?: Date;
}
