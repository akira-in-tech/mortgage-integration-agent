/**
 * Parsed, validated shape of the Section 10.7 policy DSL. `PolicyVersion
 * .dsl` (src/database/entities/policy-version.entity.ts) stores the raw
 * jsonb this type describes — this module is what actually understands
 * that content, the schema itself stays opaque to it (M3-001's own
 * Known gaps).
 */
export interface PolicyRuleApplicability {
  jurisdictions: string[];
  product: string;
  lifecycleEvents: string[];
  effectiveFrom: string;
  transitionRule?: string;
}

/**
 * Discriminated by the single key present under `when` in the DSL source
 * (Section 10.7: `when: { difference_percent: {...} }`). Only one operator
 * exists so far — the charter gives no second example to generalize from,
 * and inventing others would be speculative. Modeled as a union (not a
 * single flat shape) so a second operator is an additive union member,
 * not a breaking change to this one.
 */
export interface DifferencePercentCondition {
  kind: 'difference_percent';
  left: string;
  right: string;
  greaterThan: number;
}

export type PolicyRuleCondition = DifferencePercentCondition;

export interface PolicyRuleOutcome {
  condition: string;
  route: string;
}

export interface PolicyRuleDocument {
  id: string;
  version: string;
  applicability: PolicyRuleApplicability;
  when: PolicyRuleCondition;
  outcome: PolicyRuleOutcome;
}

/** Server-owned fact context a rule's `when` clause is evaluated against. */
export interface PolicyFactContext {
  application: Record<string, unknown>;
  evidence: Record<string, unknown>;
}

export interface PolicyEvaluationOutcome {
  matched: boolean;
  /** Present only when matched — mirrors the rule's own outcome block. */
  condition?: string;
  route?: string;
  /** Human-readable trace of what was compared and why, for audit/explanation. */
  reason: string;
}
