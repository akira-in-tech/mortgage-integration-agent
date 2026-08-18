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

export interface DispatchProviderRequestDeps {
  registry: ProviderRegistryService;
  authorizationService: ProviderAuthorizationService;
  intentService: ProviderOperationIntentService;
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

  const grant = await deps.authorizationService.issue({
    tenantId: params.tenantId,
    caseId: params.caseId,
    borrowerSubjectId: params.borrowerSubjectId,
    providerId: adapter.providerId,
    capability: params.capability,
    purposeCode: params.purposeCode,
    permittedDataClasses: params.permittedDataClasses,
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
    throw new Error(revalidation.reason);
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
