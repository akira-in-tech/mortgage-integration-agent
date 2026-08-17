import {
  proxyActivities,
  setHandler,
  condition,
  log,
  workflowInfo,
} from '@temporalio/workflow';
import type { CaseConditionsActivities } from './case-conditions.activities';
import {
  resolveConditionSignal,
  ResolveConditionSignalPayload,
  resumeInterruptedEvaluationSignal,
  ResumeInterruptedEvaluationSignalPayload,
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

  let interruptResolution: ResumeInterruptedEvaluationSignalPayload | undefined;
  setHandler(resumeInterruptedEvaluationSignal, (payload) => {
    interruptResolution = payload;
  });

  await activities.markCollectingEvidence({ tenantId, caseId });

  try {
    // All three are fetched and recorded for audit purposes and so the
    // Agent run's check_case_completeness tool (src/agent-runtime/tools/)
    // finds them — evaluateConditions reads evidence back from the
    // database itself rather than taking it as an activity parameter.
    await Promise.all([
      activities.fetchIncomeEvidence({ tenantId, caseId, borrowerId }),
      activities.fetchCreditEvidence({ tenantId, caseId, borrowerId }),
      activities.fetchDocumentEvidence({ tenantId, caseId, borrowerId }),
    ]);
  } catch (error) {
    // An activity exhausted its retries (transient classification) or
    // failed immediately (terminal classification) — either way, this
    // case cannot proceed automatically. Route to manual review rather
    // than let the whole workflow fail (Section 9.5's Agent-loop pattern,
    // applied here at the workflow level): a human can still act on it.
    log.warn('Evidence collection failed, routing to manual review', {
      caseId,
      error: String(error),
    });
    await activities.markManualReview({
      tenantId,
      caseId,
      reason: String(error),
    });
    return { finalStatus: CaseStatus.MANUAL_REVIEW };
  }

  let evaluation: Awaited<ReturnType<typeof activities.evaluateConditions>>;
  for (;;) {
    try {
      // Can exhaust its retries when the case keeps changing out from
      // under the evaluation (Section 10.5's compare-and-swap protection,
      // src/agent-runtime/tools/create-condition.tool.ts's
      // StaleCaseVersionError) — Temporal's own retry policy already gives
      // this several tries against the case's latest state before this
      // catch is ever reached.
      evaluation = await activities.evaluateConditions({
        tenantId,
        caseId,
        workflowRunId: workflowInfo().runId,
      });
    } catch (error) {
      log.warn('evaluateConditions failed, routing to manual review', {
        caseId,
        error: String(error),
      });
      await activities.markManualReview({
        tenantId,
        caseId,
        reason: String(error),
      });
      return { finalStatus: CaseStatus.MANUAL_REVIEW };
    }

    if (evaluation.outcome !== 'INTERRUPTED') {
      break;
    }

    // Section 9.5: "ambiguity... interrupt for review" — policy
    // applicability was ambiguous (Section 10.3: missing coverage or an
    // overlapping version conflict). Unlike REVIEW_REQUIRED below, this
    // is not a runtime failure: a reviewer can address the ambiguity (by
    // some means outside this workflow — no dedicated "fix the
    // ambiguity" API exists yet) and signal resumption, which re-runs the
    // whole evaluation rather than continuing mid-run (Section 9.2:
    // Temporal owns durable waiting, the Agent run itself stays bounded
    // and short-lived).
    log.info('Evaluation interrupted for review, waiting to resume', {
      caseId,
      reason: evaluation.reviewReason,
    });
    await activities.markWaitingForReview({
      tenantId,
      caseId,
      reason: evaluation.reviewReason ?? 'ambiguity requires review',
    });
    interruptResolution = undefined;
    await condition(() => interruptResolution !== undefined);
    interruptResolution = undefined;
  }

  if (evaluation.outcome === 'REVIEW_REQUIRED') {
    // A runtime failure other than ambiguity (consent invalid, budget or
    // deadline exhaustion, a tool's own failure — Section 9.5: "budget or
    // runtime failure: route to manual review") reached this activity's
    // fail-closed default. Not resumable the way an interrupted
    // evaluation is, so this routes straight to manual review.
    log.warn('Agent run routed to manual review', {
      caseId,
      reason: evaluation.reviewReason,
    });
    await activities.markManualReview({
      tenantId,
      caseId,
      reason: evaluation.reviewReason ?? 'agent run routed to manual review',
    });
    return { finalStatus: CaseStatus.MANUAL_REVIEW };
  }

  if (evaluation.outcome === 'READY') {
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
