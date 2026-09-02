import { ProviderAuthorizationService } from './provider-authorization.service';
import {
  ProviderIntentConflictError,
  ProviderOperationIntentService,
} from './provider-operation-intent.service';
import { ProviderRegistryService } from './provider-registry.service';
import { ProviderKillSwitchService } from './provider-kill-switch.service';
import { ProviderPromotionService } from './provider-promotion.service';
import {
  ProviderCapability,
  ProviderMode,
  SynchronousProviderReceipt,
} from './types';
import { SyntheticProviderRejectionError } from '../integrations/synthetic-provider-failures';
import { ConsentService } from '../consent/consent.service';
import { assertNotStructurallyExcluded } from '../common/structural-exclusions';
import {
  operationalTelemetry,
  ProviderOutcome,
} from '../observability/operational-telemetry';
import { validateProviderFinding } from './provider-finding-contract';
import { PermissiblePurposeService } from './permissible-purpose.service';

export interface DispatchProviderRequestDeps {
  registry: ProviderRegistryService;
  authorizationService: ProviderAuthorizationService;
  intentService: ProviderOperationIntentService;
  consentService: ConsentService;
  killSwitchService: ProviderKillSwitchService;
  promotionService: ProviderPromotionService;
  permissiblePurposeService: PermissiblePurposeService;
}

/**
 * Section 11.4: "a kill switch can suspend a provider or capability
 * without redeploying the application" (M4-006). A platform-operational
 * block, not a per-request authorization failure — thrown before any
 * grant/intent machinery runs, the same "fail before doing unnecessary
 * work" shape `ProviderRevalidationError` uses for a failed revalidation.
 */
export class ProviderDisabledError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'ProviderDisabledError';
  }
}

/**
 * Section 11.4's governed promotion chain (M4-007): a non-`SIMULATOR`
 * mode with no current `ProviderActivation` — distinct from
 * `ProviderDisabledError` (an operator has explicitly turned an otherwise-
 * promoted provider off). This is the default-deny state: nothing is
 * reachable until it has actually gone through propose -> certify ->
 * approve -> activate.
 */
export class ProviderNotActivatedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'ProviderNotActivatedError';
  }
}

/**
 * A grant that failed `revalidate()` — mismatched tenant/case/provider/
 * capability, expired, revoked, or (M5-005) referencing a consent record
 * that's no longer granted and unrevoked. Every one of these is terminal
 * for this specific attempt: retrying the identical request can never
 * turn a mismatched or revoked grant into a valid one, the same
 * "retrying can never fix this" reasoning `SyntheticProviderRejectionError`
 * already carries for a terminal provider rejection — see this error's
 * own classification in `callProviderWithRetryClassification`
 * (case-conditions.activities.ts).
 */
export class ProviderRevalidationError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'ProviderRevalidationError';
  }
}

/** A retry found an existing effect whose state makes another submit unsafe. */
export class ProviderIntentReplayBlockedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'ProviderIntentReplayBlockedError';
  }
}

export class ProviderConsentScopeError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'ProviderConsentScopeError';
  }
}

export class PermissiblePurposeError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'PermissiblePurposeError';
  }
}

export interface DispatchProviderRequestParams {
  tenantId: string;
  caseId: string;
  borrowerSubjectId: string;
  capability: ProviderCapability;
  mode?: ProviderMode;
  request: Record<string, unknown>;
  purposeCode: string;
  permittedDataClasses: string[];
  /** Stable across retries for one logical effect. Defaults to one evidence request per case/capability/purpose. */
  logicalOperationKey?: string;
  /** Section 11.5's field-bound authorization (M5-028) — see `ProviderAuthorizationGrant`'s own entity comment. Unset means every current caller's existing behavior: the normalized finding returns unfiltered. */
  permittedFields?: string[];
  /** Required for non-simulator consumer-report dispatches. Simulator credit creates a marked synthetic-only decision. */
  permissiblePurposeDecisionId?: string;
}

/**
 * Section 11.5's field-bound authorization (M5-028), applied after
 * `normalize()`: restricts a normalized finding to exactly the granted
 * top-level keys. Only ever filters a plain object finding — every real
 * finding shape in this codebase (`PlaidIncomeData`, `CreditBureauData`,
 * etc.) is one, but a non-object finding (or `permittedFields` left
 * unset) passes through completely unchanged, preserving every existing
 * caller's behavior exactly.
 */
export function filterToPermittedFields<T>(
  finding: T,
  permittedFields: string[] | undefined,
): T {
  if (
    !permittedFields ||
    finding === null ||
    typeof finding !== 'object' ||
    Array.isArray(finding)
  ) {
    return finding;
  }
  const allowed = new Set(permittedFields);
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(
    finding as Record<string, unknown>,
  )) {
    if (allowed.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered as T;
}

/**
 * Section 11's real dispatch path, replacing a bare simulator call:
 * resolve the registered adapter (Section 11.6's routing, reduced to its
 * first constraint since only one adapter is ever registered per
 * capability today) -> check the kill switch (Section 11.4, M4-006) ->
 * check the governed promotion chain for any non-SIMULATOR mode (Section
 * 11.4, M4-007) -> issue a fresh, time-bound authorization grant -> persist the operation
 * intent *before* dispatch (Section 11.5) -> revalidate the grant
 * immediately before the external call, failing closed on any mismatch ->
 * dispatch -> record the real outcome on the intent, classifying a
 * synthetic transient failure as `OUTCOME_UNKNOWN` (Section 11.5: "after
 * an ambiguous timeout, the state becomes OUTCOME_UNKNOWN" — this
 * codebase's own analog of that ambiguity) and a terminal one as
 * `FAILED_FINAL`.
 *
 * Every current adapter is synchronous (see `SynchronousProviderReceipt`'s
 * own comment), so this helper unwraps `receipt.payload` before calling
 * `normalize()` — a real asynchronous adapter would need a different
 * dispatch path (poll until terminal, then normalize), not yet built
 * since none exists (Known gap).
 *
 * `assertNotStructurallyExcluded()` right after resolving the adapter is
 * Section 7.5's "production router" checkpoint (M7-028) — the same check
 * `ProviderRegistryService.register()` already ran once at registration
 * time, re-run here at the actual dispatch point. Not a redundant
 * re-statement of the same fact: registration only proves an adapter was
 * clean *when it registered*; this proves the exact adapter this specific
 * request is about to reach is still clean *right now*, independent of
 * whatever path got it into `deps.registry`.
 */
export async function dispatchProviderRequest<TFinding>(
  deps: DispatchProviderRequestDeps,
  params: DispatchProviderRequestParams,
): Promise<TFinding> {
  const mode = params.mode ?? 'SIMULATOR';
  const adapter = deps.registry.resolve(params.capability, mode);
  assertNotStructurallyExcluded({
    kind: 'provider_adapter',
    identifier: `${adapter.providerId}/${params.capability}/${mode}`,
    declaredCommandClass: adapter.structurallyExcludedCommandClass,
  });
  const telemetryStartedAt = performance.now();
  let telemetryOutcome: ProviderOutcome = 'failed';

  try {
    return await operationalTelemetry.withSpan(
      'provider.dispatch',
      {
        capability: params.capability,
        mode,
        effect_class: adapter.operation.effectClass,
      },
      async () => {
        const active = await deps.killSwitchService.isActive(
          adapter.providerId,
          params.capability,
          mode,
        );
        if (!active) {
          telemetryOutcome = 'disabled';
          throw new ProviderDisabledError(
            `provider ${adapter.providerId} capability=${params.capability} mode=${mode} is disabled — see provider_adapter_status for the reason`,
          );
        }

        // M4-007: SIMULATOR stays the free default (Section 11.1) — the
        // governed promotion chain only gates modes real credentials could
        // actually reach.
        if (mode !== 'SIMULATOR') {
          const activated = await deps.promotionService.isActivated(
            adapter.providerId,
            params.capability,
            mode,
          );
          if (!activated) {
            telemetryOutcome = 'not_activated';
            throw new ProviderNotActivatedError(
              `provider ${adapter.providerId} capability=${params.capability} mode=${mode} has no active promotion — see provider_activations`,
            );
          }
        }

        // M5-005: attach the case's own active consent record (if any) to the
        // grant being issued, so revalidate() can later confirm it's still
        // granted and unrevoked (Section 11.5) immediately before dispatch.
        const consentRecord = await deps.consentService.activeRecordForPurpose(
          params.tenantId,
          params.caseId,
          params.purposeCode,
          params.permittedDataClasses,
        );
        if (!consentRecord) {
          telemetryOutcome = 'authorization_rejected';
          throw new ProviderConsentScopeError(
            `no active consent authorizes purpose=${params.purposeCode} dataClasses=${params.permittedDataClasses.join(',')}`,
          );
        }

        const purposeContext = {
          tenantId: params.tenantId,
          caseId: params.caseId,
          borrowerSubjectId: params.borrowerSubjectId,
          capability: params.capability,
          purposeCode: params.purposeCode,
          permittedDataClasses: params.permittedDataClasses,
          mode,
        };
        let permissiblePurposeDecisionId = params.permissiblePurposeDecisionId;
        if (params.capability === ProviderCapability.CREDIT) {
          if (!permissiblePurposeDecisionId && mode === 'SIMULATOR') {
            permissiblePurposeDecisionId =
              await deps.permissiblePurposeService.issueSynthetic(
                purposeContext,
              );
          }
          if (!permissiblePurposeDecisionId) {
            telemetryOutcome = 'authorization_rejected';
            throw new PermissiblePurposeError(
              'consumer-report dispatch requires a transaction-specific permissible-purpose decision',
            );
          }
          const purposeValidation =
            await deps.permissiblePurposeService.validate(
              permissiblePurposeDecisionId,
              purposeContext,
            );
          if (!purposeValidation.valid) {
            telemetryOutcome = 'authorization_rejected';
            throw new PermissiblePurposeError(purposeValidation.reason);
          }
        }

        const grant = await deps.authorizationService.issue({
          tenantId: params.tenantId,
          caseId: params.caseId,
          borrowerSubjectId: params.borrowerSubjectId,
          providerId: adapter.providerId,
          capability: params.capability,
          purposeCode: params.purposeCode,
          permittedDataClasses: params.permittedDataClasses,
          permittedFields: params.permittedFields,
          consentRecordIds: [consentRecord.id],
          permissiblePurposeDecisionId,
        });

        const intent = await deps.intentService.prepare({
          tenantId: params.tenantId,
          caseId: params.caseId,
          providerId: adapter.providerId,
          capability: params.capability,
          effectClass: adapter.operation.effectClass,
          authorizationGrantId: grant.id,
          logicalOperationKey:
            params.logicalOperationKey ??
            `${params.caseId}:${params.capability}:${params.purposeCode}`,
          requestPayloadForFingerprint: params.request,
        });

        if (intent.state === 'SUCCEEDED') {
          if (intent.normalizedFinding === undefined) {
            throw new ProviderIntentReplayBlockedError(
              `logical provider operation "${intent.logicalOperationKey}" already succeeded but has no replayable normalized finding`,
            );
          }
          telemetryOutcome = 'succeeded';
          return intent.normalizedFinding as TFinding;
        }
        if (intent.state !== 'PREPARED') {
          throw new ProviderIntentReplayBlockedError(
            `logical provider operation "${intent.logicalOperationKey}" is ${intent.state}; another provider submission is blocked pending reconciliation or a new logical operation key`,
          );
        }

        const revalidation = await deps.authorizationService.revalidate(
          grant.id,
          {
            tenantId: params.tenantId,
            caseId: params.caseId,
            providerId: adapter.providerId,
            capability: params.capability,
          },
        );
        if (!revalidation.valid) {
          telemetryOutcome = 'authorization_rejected';
          await deps.intentService.markFailedFinal(intent.tenantId, intent.id);
          throw new ProviderRevalidationError(revalidation.reason);
        }

        // Re-check consumer-report authority at the final external-call
        // boundary so expiry or revocation after grant issuance fails closed.
        if (permissiblePurposeDecisionId) {
          const purposeValidation =
            await deps.permissiblePurposeService.validate(
              permissiblePurposeDecisionId,
              purposeContext,
            );
          if (!purposeValidation.valid) {
            telemetryOutcome = 'authorization_rejected';
            await deps.intentService.markFailedFinal(
              intent.tenantId,
              intent.id,
            );
            throw new PermissiblePurposeError(purposeValidation.reason);
          }
        }

        await deps.intentService.markDispatched(intent.tenantId, intent.id);
        let receipt: SynchronousProviderReceipt<unknown> | undefined;
        try {
          receipt = (await adapter.submit(
            params.request,
            intent,
            revalidation.grant,
            { tenantId: params.tenantId, caseId: params.caseId },
          )) as SynchronousProviderReceipt<unknown>;
          const finding = validateProviderFinding(
            params.capability,
            adapter.normalize(receipt.payload, {
              tenantId: params.tenantId,
              caseId: params.caseId,
            }) as TFinding,
            { observedAt: receipt.observedAt },
          );
          // Section 11.5's field-bound authorization (M5-028) — filtered
          // against the freshly revalidated grant's own permittedFields, not
          // params.permittedFields directly, the same "trust the revalidated
          // state, not the original request" discipline revalidate() itself
          // exists for.
          const filteredFinding = filterToPermittedFields(
            finding,
            revalidation.grant.permittedFields,
          );
          await deps.intentService.markSucceeded(
            intent.tenantId,
            intent.id,
            receipt,
            filteredFinding,
          );
          telemetryOutcome = 'succeeded';
          return filteredFinding;
        } catch (error) {
          if (error instanceof SyntheticProviderRejectionError) {
            telemetryOutcome = 'provider_rejected';
            await deps.intentService.markFailedFinal(
              intent.tenantId,
              intent.id,
            );
          } else if (receipt !== undefined) {
            // The provider completed, but its receipt could not be normalized.
            // This is a terminal platform-contract failure, not an ambiguous
            // provider outcome and never a reason to submit the effect again.
            telemetryOutcome = 'provider_rejected';
            await deps.intentService.markFailedFinal(
              intent.tenantId,
              intent.id,
              receipt,
            );
          } else {
            telemetryOutcome = 'outcome_unknown';
            // M5-027: any other failure — including a real one from a real
            // adapter (M4-007's AUTHORIZED_SANDBOX Plaid integration can throw
            // a genuine network/HTTP error this synthetic-only classification
            // never anticipated) — is classified the same conservative way
            // `SyntheticProviderTimeoutError` already was: Section 11.5's own
            // "after an ambiguous timeout, the state becomes OUTCOME_UNKNOWN."
            // Leaving an intent silently stuck at DISPATCHED with an
            // unclassified thrown error, its previous behavior for anything
            // that wasn't a recognized synthetic fault, is strictly worse: it
            // doesn't even signal that the real outcome is unknown.
            // ProviderReconciliationService is what eventually notices an
            // intent stuck here and flags it for a human.
            await deps.intentService.markOutcomeUnknown(
              intent.tenantId,
              intent.id,
            );
          }
          throw error;
        }
      },
    );
  } finally {
    operationalTelemetry.recordProvider(
      {
        capability: params.capability,
        mode,
        effectClass: adapter.operation.effectClass,
        outcome: telemetryOutcome,
      },
      telemetryStartedAt,
    );
  }
}

export { ProviderIntentConflictError };
