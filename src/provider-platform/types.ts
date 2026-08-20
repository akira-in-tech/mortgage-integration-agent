/**
 * Section 11's provider platform, honestly scoped to what this codebase
 * can back today: five real simulator adapters (income/credit/document/
 * asset/identity) behind one real capability contract, plus (M4-007) one
 * real `AUTHORIZED_SANDBOX` adapter — Plaid's actual sandbox API — gated
 * behind a real governed promotion chain (`ProviderPromotionService`:
 * propose -> certify -> approve -> activate, Section 11.4). `PRODUCTION_BYOC`
 * stays as vocabulary only (Section 11.1 names all three modes), never as
 * a claim that this codebase can talk to a real production provider — no
 * real production credentials or BYOC onboarding flow exists yet (see
 * docs/DEVELOPMENT_LOG.md's M4-001 and M4-007 entries).
 */

/** Section 7.2's target capability vocabulary. Only INCOME/CREDIT/DOCUMENT have a real registered adapter — ASSET/IDENTITY are named but unbuilt (Known gap). */
export enum ProviderCapability {
  INCOME = 'INCOME',
  ASSET = 'ASSET',
  CREDIT = 'CREDIT',
  IDENTITY = 'IDENTITY',
  DOCUMENT = 'DOCUMENT',
}

/** Section 11.1. Only `SIMULATOR` has a real implementation anywhere in this codebase. */
export type ProviderMode =
  'SIMULATOR' | 'AUTHORIZED_SANDBOX' | 'PRODUCTION_BYOC';

/** Section 11.5. */
export type ProviderEffectClass =
  | 'READ_ONLY'
  | 'REUSABLE_LOOKUP'
  | 'COST_BEARING_ORDER'
  | 'CONSUMER_IMPACTING'
  | 'IRREVERSIBLE';

/** Section 11.5's `ProviderOperationIntent.state` — mirrored as a persisted enum in `database/enums/provider-platform.enum.ts`. */
export type ProviderOperationIntentState =
  | 'PREPARED'
  | 'DISPATCHED'
  | 'SUCCEEDED'
  | 'FAILED_FINAL'
  | 'OUTCOME_UNKNOWN'
  | 'RECONCILING'
  | 'CANCELLED';

export interface ProviderHealth {
  healthy: boolean;
  checkedAt: string;
  detail?: string;
}

/** Section 11.3's `poll()` return shape — not named explicitly in the charter, defined minimally here since no adapter implements `poll()` yet (every current simulator is synchronous, never needs status polling). */
export interface ProviderStatus {
  state: 'PENDING' | 'COMPLETE' | 'FAILED';
  detail?: string;
}

/**
 * This codebase's own convention for its `SIMULATOR`-only, synchronous
 * adapters — not a shape the charter mandates. Every current `submit()`
 * both dispatches and completes in one call, so its receipt is always
 * already terminal; `dispatch-provider-request.ts`'s generic dispatch
 * helper relies on every registered adapter's receipt following this
 * shape so it can extract the raw payload for `normalize()` without
 * knowing each adapter's concrete `TReceipt` type. A real asynchronous
 * adapter (`poll()`-based) would not use this shape.
 */
export interface SynchronousProviderReceipt<TPayload> {
  status: 'COMPLETE';
  payload: TPayload;
}

/** Section 11.5. */
export interface ProviderOperationDescriptor {
  effectClass: ProviderEffectClass;
  providerIdempotencyScope?: string;
  supportsStatusLookup: boolean;
  supportsCancellation: boolean;
  fallbackPolicy: 'AUTOMATIC' | 'REAUTHORIZE' | 'HUMAN_REVIEW' | 'PROHIBITED';
}

/** Not explicitly shaped in the charter's own snippets — minimal, matching `AgentToolContext`'s own {tenantId, caseId} convention for consistency across this codebase's port interfaces. */
export interface ProviderContext {
  tenantId: string;
  caseId: string;
}

/**
 * Section 11.5's `ProviderAuthorizationGrant`. `consentRecordIds` stays
 * always-empty and `permissiblePurposeDecisionId` always-undefined — no
 * consent-record or permissible-purpose subsystem exists yet (the same
 * honest-null pattern `EvaluationInputManifest` already established).
 */
export interface ProviderAuthorizationGrant {
  id: string;
  tenantId: string;
  caseId: string;
  borrowerSubjectId: string;
  providerId: string;
  capability: ProviderCapability;
  purposeCode: string;
  permittedDataClasses: string[];
  permittedFields?: string[];
  consentRecordIds: string[];
  permissiblePurposeDecisionId?: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string;
}

/** Section 11.5's `ProviderOperationIntent`. */
export interface ProviderOperationIntent {
  id: string;
  tenantId: string;
  caseId: string;
  providerId: string;
  capability: ProviderCapability;
  effectClass: ProviderEffectClass;
  requestFingerprint: string;
  idempotencyKey: string;
  authorizationGrantId: string;
  state: ProviderOperationIntentState;
}

/**
 * Section 11.3's `ProviderAdapter<TRequest, TReceipt, TFinding>`. Every
 * current implementation is `SIMULATOR`-mode and synchronous — `submit()`
 * both dispatches and completes in one call, so `TReceipt` is always
 * already in a terminal state and `poll()`/`cancel()` are never
 * implemented (there's nothing asynchronous to poll or cancel). The
 * interface still declares them optional exactly as the charter does, so
 * a real async adapter could implement them later without a contract
 * change.
 */
export interface ProviderAdapter<TRequest, TReceipt, TFinding> {
  readonly providerId: string;
  readonly capability: ProviderCapability;
  readonly mode: ProviderMode;
  readonly operation: ProviderOperationDescriptor;
  submit(
    request: TRequest,
    intent: ProviderOperationIntent,
    authorization: ProviderAuthorizationGrant,
    context: ProviderContext,
  ): Promise<TReceipt>;
  poll?(receipt: TReceipt, context: ProviderContext): Promise<ProviderStatus>;
  normalize(payload: unknown, context: ProviderContext): TFinding;
  cancel?(receipt: TReceipt, context: ProviderContext): Promise<void>;
  healthCheck(): Promise<ProviderHealth>;
}

/** Type-erased view for a registry that doesn't know each adapter's concrete request/receipt/finding types — same pattern as `AnyAgentTool` (agent-tool.types.ts). */
export type AnyProviderAdapter = ProviderAdapter<unknown, unknown, unknown>;
