import { ProviderAuthorizationService } from './provider-authorization.service';
import { ProviderOperationIntentService } from './provider-operation-intent.service';
import { ProviderRegistryService } from './provider-registry.service';
import { ProviderKillSwitchService } from './provider-kill-switch.service';
import { ProviderPromotionService } from './provider-promotion.service';
import {
  ProviderCapability,
  ProviderMode,
  SynchronousProviderReceipt,
} from './types';
import {
  SyntheticProviderRejectionError,
  SyntheticProviderTimeoutError,
} from '../integrations/synthetic-provider-failures';
import { ConsentService } from '../consent/consent.service';

export interface DispatchProviderRequestDeps {
  registry: ProviderRegistryService;
  authorizationService: ProviderAuthorizationService;
  intentService: ProviderOperationIntentService;
  consentService: ConsentService;
  killSwitchService: ProviderKillSwitchService;
  promotionService: ProviderPromotionService;
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

export interface DispatchProviderRequestParams {
  tenantId: string;
  caseId: string;
  borrowerSubjectId: string;
  capability: ProviderCapability;
  mode?: ProviderMode;
  request: Record<string, unknown>;
  purposeCode: string;
  permittedDataClasses: string[];
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
 */
export async function dispatchProviderRequest<TFinding>(
  deps: DispatchProviderRequestDeps,
  params: DispatchProviderRequestParams,
): Promise<TFinding> {
  const mode = params.mode ?? 'SIMULATOR';
  const adapter = deps.registry.resolve(params.capability, mode);

  const active = await deps.killSwitchService.isActive(
    adapter.providerId,
    params.capability,
    mode,
  );
  if (!active) {
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
      throw new ProviderNotActivatedError(
        `provider ${adapter.providerId} capability=${params.capability} mode=${mode} has no active promotion — see provider_activations`,
      );
    }
  }

  // M5-005: attach the case's own active consent record (if any) to the
  // grant being issued, so revalidate() can later confirm it's still
  // granted and unrevoked (Section 11.5) immediately before dispatch.
  const consentRecordId = await deps.consentService.activeRecordId(
    params.tenantId,
    params.caseId,
  );

  const grant = await deps.authorizationService.issue({
    tenantId: params.tenantId,
    caseId: params.caseId,
    borrowerSubjectId: params.borrowerSubjectId,
    providerId: adapter.providerId,
    capability: params.capability,
    purposeCode: params.purposeCode,
    permittedDataClasses: params.permittedDataClasses,
    consentRecordIds: consentRecordId ? [consentRecordId] : [],
  });

  const intent = await deps.intentService.prepare({
    tenantId: params.tenantId,
    caseId: params.caseId,
    providerId: adapter.providerId,
    capability: params.capability,
    effectClass: adapter.operation.effectClass,
    authorizationGrantId: grant.id,
    requestPayloadForFingerprint: params.request,
  });

  const revalidation = await deps.authorizationService.revalidate(grant.id, {
    tenantId: params.tenantId,
    caseId: params.caseId,
    providerId: adapter.providerId,
    capability: params.capability,
  });
  if (!revalidation.valid) {
    await deps.intentService.markFailedFinal(intent.tenantId, intent.id);
    throw new ProviderRevalidationError(revalidation.reason);
  }

  await deps.intentService.markDispatched(intent.tenantId, intent.id);
  try {
    const receipt = (await adapter.submit(
      params.request,
      intent,
      revalidation.grant,
      { tenantId: params.tenantId, caseId: params.caseId },
    )) as SynchronousProviderReceipt<unknown>;
    await deps.intentService.markSucceeded(intent.tenantId, intent.id);
    return adapter.normalize(receipt.payload, {
      tenantId: params.tenantId,
      caseId: params.caseId,
    }) as TFinding;
  } catch (error) {
    if (error instanceof SyntheticProviderRejectionError) {
      await deps.intentService.markFailedFinal(intent.tenantId, intent.id);
    } else if (error instanceof SyntheticProviderTimeoutError) {
      await deps.intentService.markOutcomeUnknown(intent.tenantId, intent.id);
    }
    throw error;
  }
}
