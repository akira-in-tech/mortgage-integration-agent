import {
  PolicyEvaluationOutcome,
  PolicyFactContext,
  PolicyRuleCondition,
  PolicyRuleDocument,
} from './policy-rule.types';

/**
 * Resolves a dot-path (e.g. "application.monthly_income") against the fact
 * context by plain object navigation — deliberately not `eval`/
 * `Function()` or a general expression language: policy content is
 * authored/reviewed data, not trusted code, and Section 9.7's "no
 * arbitrary... code execution" principle applies just as much to
 * evaluating a rule as it does to the Agent.
 */
function resolveFactPath(
  context: PolicyFactContext,
  path: string,
): number | undefined {
  const segments = path.split('.');
  let current: unknown = context;
  for (const segment of segments) {
    if (
      typeof current !== 'object' ||
      current === null ||
      !(segment in current)
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'number' && Number.isFinite(current)
    ? current
    : undefined;
}

function evaluateCondition(
  condition: PolicyRuleCondition,
  context: PolicyFactContext,
): { matched: boolean; reason: string } {
  switch (condition.kind) {
    case 'difference_percent': {
      const left = resolveFactPath(context, condition.left);
      const right = resolveFactPath(context, condition.right);
      if (left === undefined || right === undefined) {
        return {
          matched: false,
          reason: `cannot evaluate: missing or non-numeric fact(s) for "${condition.left}" and/or "${condition.right}"`,
        };
      }
      if (left === 0) {
        return {
          matched: false,
          reason: `cannot evaluate: "${condition.left}" is 0, percent difference is undefined`,
        };
      }
      // Absolute difference: an unexplained gap is worth reviewing whether
      // the borrower over- or under-stated the value being compared.
      const differencePercent = (Math.abs(right - left) / Math.abs(left)) * 100;
      const matched = differencePercent > condition.greaterThan;
      return {
        matched,
        reason: `difference_percent(${condition.left}=${left}, ${condition.right}=${right}) = ${differencePercent.toFixed(2)}% ${matched ? '>' : '<='} ${condition.greaterThan}%`,
      };
    }
  }
}

/**
 * Deterministically evaluates one parsed policy rule against a fact
 * context — pure function, no I/O, replayable and testable without a
 * database or workflow. This slice evaluates a single rule in isolation;
 * selecting *which* released rule(s) apply to a case (Section 10.3's
 * applicability resolver) is separate, not-yet-built scope.
 */
export function evaluatePolicyRule(
  rule: PolicyRuleDocument,
  context: PolicyFactContext,
): PolicyEvaluationOutcome {
  const { matched, reason } = evaluateCondition(rule.when, context);
  if (!matched) {
    return { matched: false, reason };
  }
  return {
    matched: true,
    condition: rule.outcome.condition,
    route: rule.outcome.route,
    reason,
  };
}
