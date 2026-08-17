import { PolicyRuleDocument } from './dsl/policy-rule.types';

/**
 * Simplified stand-in for Section 10.3's `PolicyResolutionContext` — this
 * slice resolves by exact jurisdiction/product/lifecycle-event match at a
 * point in time, not the full bitemporal, jurisdiction-ancestry-aware
 * design (see PolicyApplicabilityResolverService's class comment for what
 * is and isn't implemented yet).
 */
export interface PolicyResolutionContext {
  jurisdictionCode: string;
  productCode: string;
  lifecycleEvent: string;
  asOf: Date;
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
}
