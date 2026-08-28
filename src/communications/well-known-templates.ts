/**
 * M3-024's real `ROUTINE`-eligible template key: the one place
 * `case-conditions.activities.ts`'s `finalizeReadyForUnderwriting` and
 * `npm run seed-communication-template` both need to agree on which
 * template a "case reached READY_FOR_UNDERWRITING" notification looks
 * up. Opt-in per tenant: `sendReadyForUnderwritingNotification` checks
 * for a real `APPROVED` template at this key/version *before* drafting
 * anything — a tenant that has never run the seed script gets no
 * `CommunicationMessage` row and no behavior change at all, not a
 * silent `PROTECTED`-and-unsent draft it never asked for.
 */
export const READY_FOR_UNDERWRITING_TEMPLATE_KEY =
  'READY_FOR_UNDERWRITING_NOTICE';
export const READY_FOR_UNDERWRITING_TEMPLATE_VERSION = '1';
