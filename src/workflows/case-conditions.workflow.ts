import {
  proxyActivities,
  setHandler,
  condition,
  log,
} from '@temporalio/workflow';
import type { CaseConditionsActivities } from './case-conditions.activities';
import {
  resolveConditionSignal,
  ResolveConditionSignalPayload,
} from './case-conditions.signals';
import {
  CaseConditionsWorkflowInput,
  CaseConditionsWorkflowResult,
} from './case-conditions.types';
import { CaseStatus } from '../database/enums/case-status.enum';

const activities = proxyActivities<CaseConditionsActivities>({
  startToCloseTimeout: '30s',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

/**
 * M2 durable conditions vertical slice (Section 20, M2 / Section 7.1): a
 * synthetic case enters a condition workflow, waits, receives a resolution,
 * resumes after restart, and reaches a readiness state. Temporal owns the
 * durable lifecycle and the wait; this function only sequences activities
 * and reacts to the signal — no I/O happens directly here (Section 9.2:
 * durable business state lives outside model/workflow context, in this
 * case in Postgres via the activities in case-conditions.activities.ts).
 */
export async function caseConditionsWorkflow(
  input: CaseConditionsWorkflowInput,
): Promise<CaseConditionsWorkflowResult> {
  const { tenantId, caseId, borrowerId } = input;

  let resolution: ResolveConditionSignalPayload | undefined;
  setHandler(resolveConditionSignal, (payload) => {
    resolution = payload;
  });

  await activities.markCollectingEvidence({ tenantId, caseId });

  const [income, credit, documents] = await Promise.all([
    activities.fetchIncomeEvidence({ tenantId, caseId, borrowerId }),
    activities.fetchCreditEvidence({ tenantId, caseId, borrowerId }),
    activities.fetchDocumentEvidence({ tenantId, caseId, borrowerId }),
  ]);

  const evaluation = await activities.evaluateConditions({
    tenantId,
    caseId,
    income,
    credit,
    documents,
  });

  if (!evaluation.hasOpenCondition) {
    return { finalStatus: CaseStatus.READY_FOR_UNDERWRITING };
  }

  log.info('Case waiting for condition resolution', {
    caseId,
    conditionId: evaluation.conditionId,
  });

  // Durable wait: this suspends the workflow and persists its state
  // server-side. A worker crash or restart here loses no acknowledged
  // work — a new worker resumes exactly at this point once it picks the
  // workflow task back up, and the signal that unblocks `condition()` can
  // arrive at any time, including while no worker is running at all.
  await condition(() => resolution !== undefined);

  await activities.resolveCondition({
    tenantId,
    caseId,
    conditionId: evaluation.conditionId!,
    actorId: resolution!.actorId,
    resolution: resolution!.resolution,
    reason: resolution!.reason,
  });
  await activities.markReadyForUnderwriting({ tenantId, caseId });

  return {
    finalStatus: CaseStatus.READY_FOR_UNDERWRITING,
    conditionId: evaluation.conditionId,
  };
}
