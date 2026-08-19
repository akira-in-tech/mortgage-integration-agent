import { ProviderAuthorizationService } from './provider-authorization.service';
import { ProviderOperationIntentService } from './provider-operation-intent.service';
import { ProviderRegistryService } from './provider-registry.service';
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
 * capability today) -> issue a fresh, time-bound authorization grant ->
 * persist the operation intent *before* dispatch (Section 11.5) ->
 * revalidate the grant immediately before the external call, failing
 * closed on any mismatch -> dispatch -> record the real outcome on the
 * intent, classifying a synthetic transient failure as `OUTCOME_UNKNOWN`
 * (Section 11.5: "after an ambiguous timeout, the state becomes
 * OUTCOME_UNKNOWN" — this codebase's own analog of that ambiguity) and a
 * terminal one as `FAILED_FINAL`.
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
    await deps.intentService.markFailedFinal(intent.id);
    throw new ProviderRevalidationError(revalidation.reason);
  }

  await deps.intentService.markDispatched(intent.id);
  try {
    const receipt = (await adapter.submit(
      params.request,
      intent,
      revalidation.grant,
      { tenantId: params.tenantId, caseId: params.caseId },
    )) as SynchronousProviderReceipt<unknown>;
    await deps.intentService.markSucceeded(intent.id);
    return adapter.normalize(receipt.payload, {
      tenantId: params.tenantId,
      caseId: params.caseId,
    }) as TFinding;
  } catch (error) {
    if (error instanceof SyntheticProviderRejectionError) {
      await deps.intentService.markFailedFinal(intent.id);
    } else if (error instanceof SyntheticProviderTimeoutError) {
      await deps.intentService.markOutcomeUnknown(intent.id);
    }
    throw error;
  }
}
