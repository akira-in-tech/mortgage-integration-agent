import {
  PolicyRuleApplicability,
  PolicyRuleCondition,
  PolicyRuleDocument,
  PolicyRuleOutcome,
} from './policy-rule.types';

export interface PolicyDslIssue {
  path: string;
  message: string;
}

/**
 * Collects every problem before throwing (same discipline as
 * src/config/env.validation.ts) — a policy author fixing one typo at a
 * time against a hand-authored DSL document is exactly the workflow this
 * is meant to support, not a single opaque failure.
 */
export class PolicyDslValidationError extends Error {
  constructor(public readonly issues: PolicyDslIssue[]) {
    super(
      `Invalid policy rule document:\n  - ${issues
        .map((i) => `${i.path}: ${i.message}`)
        .join('\n  - ')}`,
    );
    this.name = 'PolicyDslValidationError';
  }
}

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(
  value: unknown,
  path: string,
  issues: PolicyDslIssue[],
): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push({ path, message: 'must be a non-empty string' });
    return undefined;
  }
  return value;
}

function requireStringArray(
  value: unknown,
  path: string,
  issues: PolicyDslIssue[],
): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ path, message: 'must be a non-empty array of strings' });
    return undefined;
  }
  if (!value.every((v) => typeof v === 'string' && v.trim().length > 0)) {
    issues.push({ path, message: 'every element must be a non-empty string' });
    return undefined;
  }
  return value as string[];
}

function requireIsoDate(
  value: unknown,
  path: string,
  issues: PolicyDslIssue[],
): string | undefined {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    issues.push({ path, message: 'must be an ISO 8601 date-time string' });
    return undefined;
  }
  return value;
}

function requireFiniteNumber(
  value: unknown,
  path: string,
  issues: PolicyDslIssue[],
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issues.push({ path, message: 'must be a finite number' });
    return undefined;
  }
  return value;
}

function parseApplicability(
  raw: unknown,
  issues: PolicyDslIssue[],
): PolicyRuleApplicability | undefined {
  if (!isRecord(raw)) {
    issues.push({ path: 'rule.applicability', message: 'must be an object' });
    return undefined;
  }
  const jurisdictions = requireStringArray(
    raw.jurisdictions,
    'rule.applicability.jurisdictions',
    issues,
  );
  const product = requireString(
    raw.product,
    'rule.applicability.product',
    issues,
  );
  const lifecycleEvents = requireStringArray(
    raw.lifecycle_events,
    'rule.applicability.lifecycle_events',
    issues,
  );
  const effectiveFrom = requireIsoDate(
    raw.effective_from,
    'rule.applicability.effective_from',
    issues,
  );
  const transitionRule =
    raw.transition_rule === undefined
      ? undefined
      : requireString(
          raw.transition_rule,
          'rule.applicability.transition_rule',
          issues,
        );

  if (!jurisdictions || !product || !lifecycleEvents || !effectiveFrom) {
    return undefined;
  }
  return {
    jurisdictions,
    product,
    lifecycleEvents,
    effectiveFrom,
    transitionRule,
  };
}

/**
 * Only `difference_percent` is a recognized operator (see
 * policy-rule.types.ts's PolicyRuleCondition union) — an unrecognized key
 * under `when` is a validation error, not a silently ignored no-op rule.
 */
function parseWhen(
  raw: unknown,
  issues: PolicyDslIssue[],
): PolicyRuleCondition | undefined {
  if (!isRecord(raw)) {
    issues.push({ path: 'rule.when', message: 'must be an object' });
    return undefined;
  }
  const keys = Object.keys(raw);
  if (keys.length !== 1) {
    issues.push({
      path: 'rule.when',
      message: 'must have exactly one condition operator key',
    });
    return undefined;
  }
  const [operator] = keys;
  if (operator !== 'difference_percent') {
    issues.push({
      path: 'rule.when',
      message: `unrecognized condition operator "${operator}"`,
    });
    return undefined;
  }

  const body = raw.difference_percent;
  if (!isRecord(body)) {
    issues.push({
      path: 'rule.when.difference_percent',
      message: 'must be an object',
    });
    return undefined;
  }
  const left = requireString(
    body.left,
    'rule.when.difference_percent.left',
    issues,
  );
  const right = requireString(
    body.right,
    'rule.when.difference_percent.right',
    issues,
  );
  const greaterThan = requireFiniteNumber(
    body.greater_than,
    'rule.when.difference_percent.greater_than',
    issues,
  );
  if (!left || !right || greaterThan === undefined) {
    return undefined;
  }
  return { kind: 'difference_percent', left, right, greaterThan };
}

function parseOutcome(
  raw: unknown,
  issues: PolicyDslIssue[],
): PolicyRuleOutcome | undefined {
  if (!isRecord(raw)) {
    issues.push({ path: 'rule.outcome', message: 'must be an object' });
    return undefined;
  }
  const condition = requireString(
    raw.condition,
    'rule.outcome.condition',
    issues,
  );
  const route = requireString(raw.route, 'rule.outcome.route', issues);
  if (!condition || !route) {
    return undefined;
  }
  return { condition, route };
}

/**
 * Parses and validates a raw policy DSL document (Section 10.7's shape —
 * `{ rule: { id, version, applicability, when, outcome } }`, as loaded
 * from YAML/JSON) into a `PolicyRuleDocument`. Throws
 * `PolicyDslValidationError` listing every problem found, never just the
 * first (Section 10.2: "validate DSL schema, types, references, units,
 * and boundaries" — an author fixing a rule needs the whole list at once).
 */
export function parsePolicyRule(raw: unknown): PolicyRuleDocument {
  const issues: PolicyDslIssue[] = [];

  if (!isRecord(raw) || !isRecord(raw.rule)) {
    throw new PolicyDslValidationError([
      { path: 'rule', message: 'must be an object with a "rule" key' },
    ]);
  }
  const ruleRaw = raw.rule;

  const id = requireString(ruleRaw.id, 'rule.id', issues);
  const versionValue = ruleRaw.version;
  let version: string | undefined;
  if (typeof versionValue !== 'string' || !SEMVER_PATTERN.test(versionValue)) {
    issues.push({
      path: 'rule.version',
      message: 'must be a semver string, e.g. "1.0.0"',
    });
  } else {
    version = versionValue;
  }
  const applicability = parseApplicability(ruleRaw.applicability, issues);
  const when = parseWhen(ruleRaw.when, issues);
  const outcome = parseOutcome(ruleRaw.outcome, issues);

  if (!id || !version || !applicability || !when || !outcome) {
    throw new PolicyDslValidationError(issues);
  }
  return { id, version, applicability, when, outcome };
}
