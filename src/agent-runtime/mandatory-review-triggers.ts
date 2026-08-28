/**
 * Section 9.6 lists twelve mandatory review triggers; this codebase can
 * currently detect four of them (or their closest real analog — see each
 * category's own comment). Section 9.5's own Agent-loop text draws
 * exactly two routes for all of them combined: "ambiguity or protected
 * action: interrupt for review" (resumable — a reviewer resolves the
 * judgment call and the same evaluation retries) vs. "budget or runtime
 * failure: route to manual review" (terminal — something about the run
 * itself is unsafe to just resume). Section 20's exit evidence B
 * ("designated review cases always interrupt") reads, taken literally,
 * as contradicting that two-route design — but Section 9.5's distinction
 * is clearly intentional (it's the charter's own load-bearing text, not
 * an oversight), so this module treats "unify mandatory-review routing"
 * as making the *classification* centralized, named, and auditable —
 * one place that decides which category a trigger belongs to and which
 * of the two charter-defined routes it takes — not as collapsing both
 * routes into one. See `docs/DEVELOPMENT_LOG.md`'s M3-021 entry for the
 * full reasoning.
 *
 * Before this module existed, `lending-operations-agent-runtime.ts` made
 * this same routing decision four separate times, inline, each with its
 * own ad hoc reason string and no shared category label — functionally
 * consistent (verified by this module's own test), but not centrally
 * auditable, and every persisted `AgentRun`/outbox record only ever
 * carried a free-text reason, never a queryable category.
 */

export enum MandatoryReviewCategory {
  /**
   * Section 9.6: "consent revoked mid-case..." — the sharpest-matching
   * named trigger. Also covers `MISSING`/`EXPIRED` consent, which Section
   * 9.6 doesn't name separately but which fail the same Section 6.3
   * authority boundary ("Consent... may stop processing").
   */
  CONSENT_INVALID = 'CONSENT_INVALID',
  /** Section 9.6: "step, token, time, or provider-cost budget exhaustion." */
  BUDGET_OR_DEADLINE_EXHAUSTED = 'BUDGET_OR_DEADLINE_EXHAUSTED',
  /** Section 9.6: "unresolved jurisdiction, effective-date, or transition-rule conflict." */
  POLICY_AMBIGUITY = 'POLICY_AMBIGUITY',
  /**
   * Not literally one of Section 9.6's twelve named triggers — this
   * codebase's own honest label for a registered tool's own execution
   * failure, the closest real analog to Section 9.5's "runtime failure"
   * bucket. Not conflated with Section 9.6's "malformed model or tool
   * output" (a *content* problem with a successful call), since this
   * Agent makes no model calls and every current tool failure is a
   * genuine execution exception, not a malformed-but-successful result.
   */
  TOOL_EXECUTION_FAILURE = 'TOOL_EXECUTION_FAILURE',
}

export type MandatoryReviewRoute =
  'INTERRUPT_FOR_REVIEW' | 'ROUTE_TO_MANUAL_REVIEW';

/** The one table this whole module exists to centralize — see the module comment for why each mapping is what it is. */
const CATEGORY_ROUTES: Record<MandatoryReviewCategory, MandatoryReviewRoute> = {
  [MandatoryReviewCategory.POLICY_AMBIGUITY]: 'INTERRUPT_FOR_REVIEW',
  [MandatoryReviewCategory.CONSENT_INVALID]: 'ROUTE_TO_MANUAL_REVIEW',
  [MandatoryReviewCategory.BUDGET_OR_DEADLINE_EXHAUSTED]:
    'ROUTE_TO_MANUAL_REVIEW',
  [MandatoryReviewCategory.TOOL_EXECUTION_FAILURE]: 'ROUTE_TO_MANUAL_REVIEW',
};

export interface MandatoryReviewTrigger {
  category: MandatoryReviewCategory;
  route: MandatoryReviewRoute;
  /** Human-readable, includes the category so a reviewer reading only this string still knows which Section 9.6 concern it is. */
  reason: string;
}

export function classifyMandatoryReviewTrigger(
  category: MandatoryReviewCategory,
  detail: string,
): MandatoryReviewTrigger {
  return {
    category,
    route: CATEGORY_ROUTES[category],
    reason: `[${category}] ${detail}`,
  };
}
