/**
 * Section 10.6's dry-run comparison outcomes: "no impact / applies at a
 * future lifecycle event / approved grandfathering rule preserves prior
 * treatment / re-evaluation required / ambiguity requires human review."
 * Simplified to the three outcomes this codebase can actually classify
 * without a transition-rule/grandfathering engine (Known gap) — a real
 * PolicyRuleApplicability.transitionRule column already exists and is
 * parsed, but nothing evaluates it yet.
 */
export enum PolicyChangeImpactKind {
  NO_IMPACT = 'NO_IMPACT',
  REQUIRES_REEVALUATION = 'REQUIRES_REEVALUATION',
  AMBIGUOUS = 'AMBIGUOUS',
}
