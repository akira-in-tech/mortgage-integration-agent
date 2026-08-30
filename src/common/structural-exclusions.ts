/**
 * Section 2's permanent product boundary: "The platform does not issue
 * credit, originate loans, move money, reproduce an official underwriting
 * result, or replace an authorized decision-maker" — restated as a
 * structural, non-negotiable exclusion list in Section 7.5, and again as
 * a named mitigation in Section 16.4's threat model: "Enforce a permanent
 * capability denylist across registries, manifests, routers, and Agent
 * tools; require a replacement charter and separate activity-specific
 * review before any boundary change."
 *
 * No tool, adapter, or manifest in this codebase has ever declared one of
 * these classes — this is a real, structural gate for a mistake that
 * hasn't happened yet, not ceremony around one that has. Its value is in
 * what it prevents: today, `0` structurally excluded command classes are
 * registered, promoted, or activated anywhere (the charter's own Section
 * 20 M4 exit metric); this is the mechanism that keeps that number `0` by
 * construction rather than by nobody having tried yet.
 *
 * Section 7.5 names four independent checkpoints — "the provider
 * capability registry, Agent tool registry, promotion-manifest validator,
 * and production router must reject excluded command classes even when
 * credentials exist and an adapter is technically certified." A real
 * M4 audit (M7-028) found only two of the four had a direct check;
 * `assertNotStructurallyExcluded` is now called at all four:
 * `buildToolRegistry` (Agent tool registry), `ProviderRegistryService.register()`
 * (provider capability registry), `ProviderPromotionService.propose()`
 * (promotion-manifest validator — checks the manifest's own attested
 * `declaredCommandClass`, not the registered adapter, since the charter's
 * own "even when... an adapter is technically certified" language asks
 * for an independent check here, not a re-derivation of the registry's),
 * and `dispatchProviderRequest()` right after resolving the adapter
 * (production router). The registry/router pair check the same resolved
 * adapter object at two different points in its lifecycle (registration,
 * then every dispatch) — genuine defense-in-depth, not a redundant
 * re-statement of the same fact, since a future bug in registry state
 * (a raw Map mutated some other way, a test double, a hot-reload path)
 * would only be caught by the second check.
 */
export const STRUCTURALLY_EXCLUDED_COMMAND_CLASSES = [
  /** Disbursing, transferring, or otherwise moving loan or borrower funds. */
  'FUNDS_MOVEMENT',
  /** Locking a binding interest rate. */
  'RATE_LOCK',
  /** Issuing a disclosure that carries legal effect. */
  'LEGAL_DISCLOSURE',
  /** Reproducing or replacing an official/authorized underwriting decision. */
  'FORMAL_DECISION',
  /** Declaring a loan clear to close. */
  'CLEAR_TO_CLOSE',
  /** Settlement/closing execution. */
  'SETTLEMENT',
  /** Funding a loan. */
  'FUNDING',
  /** Servicing-payment processing. */
  'SERVICING_PAYMENT',
  /** Delivering loans to capital markets. */
  'CAPITAL_DELIVERY',
] as const;

export type StructurallyExcludedCommandClass =
  (typeof STRUCTURALLY_EXCLUDED_COMMAND_CLASSES)[number];

const EXCLUDED_SET: ReadonlySet<string> = new Set(
  STRUCTURALLY_EXCLUDED_COMMAND_CLASSES,
);

/**
 * Throws (never returns a boolean to check) — this is a boot/registration-
 * time fail-closed gate, not a runtime branch a caller is meant to handle.
 * `declaredCommandClass` is optional because it is optional on the real
 * `AgentTool`/`ProviderAdapter` interfaces themselves: nothing today
 * declares one, and that is the honest, current, permanent state — a tool
 * or adapter that never declares a command class can never match this
 * denylist, by construction.
 */
export function assertNotStructurallyExcluded(subject: {
  kind: 'agent_tool' | 'provider_adapter' | 'provider_promotion_manifest';
  identifier: string;
  declaredCommandClass?: string;
}): void {
  if (
    subject.declaredCommandClass &&
    EXCLUDED_SET.has(subject.declaredCommandClass)
  ) {
    throw new Error(
      `structurally excluded: ${subject.kind} "${subject.identifier}" declares command class ` +
        `"${subject.declaredCommandClass}" — Section 2/7.5's permanent product boundary forbids ` +
        'registering this regardless of provider certification, promotion approval, or Agent ' +
        'configuration (Section 7.5: "cannot expand it"). A replacement charter, separate legal ' +
        'and licensing analysis, and a newly approved architecture are required before this ' +
        'boundary can change.',
    );
  }
}
