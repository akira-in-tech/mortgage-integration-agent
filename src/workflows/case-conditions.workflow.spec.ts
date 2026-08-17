import 'reflect-metadata';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { ApplicationFailure } from '@temporalio/common';
import { v4 as uuidv4 } from 'uuid';
import { caseConditionsWorkflow } from './case-conditions.workflow';
import {
  resolveConditionSignal,
  resumeInterruptedEvaluationSignal,
} from './case-conditions.signals';
import { CaseStatus } from '../database/enums/case-status.enum';
import type { CaseConditionsActivities } from './case-conditions.activities';

// Requires a reachable Temporal server, opted into via TEMPORAL_ADDRESS
// (same "skip instead of failing" convention as test/loan.e2e-spec.ts and
// the migration integration tests) — this exercises the real Temporal
// server's workflow/signal/history behavior, not a re-implementation of it.
// Activities are mocked here on purpose: this suite tests the workflow's
// own control flow (signal handling, activity call sequencing, the durable
// wait), not the database/simulator behavior those activities perform —
// see case-conditions.activities.ts and the manual end-to-end verification
// recorded in the M2 development-log entry for that.
const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS;
const describeOrSkip = TEMPORAL_ADDRESS ? describe : describe.skip;

function makeMockActivities(
  overrides: Partial<CaseConditionsActivities> = {},
): CaseConditionsActivities {
  return {
    markCollectingEvidence: jest.fn().mockResolvedValue(undefined),
    fetchIncomeEvidence: jest.fn().mockResolvedValue({
      monthlyIncome: 8000,
      employmentStatus: 'FULL_TIME',
      bankAccountAge: 60,
      incomeStability: 85,
    }),
    fetchCreditEvidence: jest.fn().mockResolvedValue({
      creditScore: 750,
      debtToIncomeRatio: 0.3,
      paymentHistory: 'EXCELLENT',
      openAccounts: 5,
      derogatoryMarks: 0,
    }),
    fetchDocumentEvidence: jest.fn().mockResolvedValue({
      w2Valid: true,
      payStubValid: true,
      bankStatementValid: true,
      taxReturnValid: true,
      allDocumentsValid: true,
      failedDocuments: [],
    }),
    evaluateConditions: jest.fn().mockResolvedValue({ outcome: 'READY' }),
    resolveCondition: jest.fn().mockResolvedValue(undefined),
    markReadyForUnderwriting: jest.fn().mockResolvedValue(undefined),
    markWaitingForReview: jest.fn().mockResolvedValue(undefined),
    markManualReview: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as CaseConditionsActivities;
}

describeOrSkip('caseConditionsWorkflow', () => {
  let env: TestWorkflowEnvironment;

  beforeAll(async () => {
    env = await TestWorkflowEnvironment.createFromExistingServer({
      address: TEMPORAL_ADDRESS,
    });
  }, 30_000);

  afterAll(async () => {
    await env?.teardown();
  });

  async function runWorker<T>(
    activities: CaseConditionsActivities,
    taskQueue: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('./case-conditions.workflow'),
      activities,
    });
    const runPromise = worker.run();
    try {
      return await fn();
    } finally {
      worker.shutdown();
      await runPromise;
    }
  }

  it('completes straight-through when evaluateConditions finds no open condition', async () => {
    const activities = makeMockActivities();
    const taskQueue = `test-${uuidv4()}`;

    const result = await runWorker(activities, taskQueue, () =>
      env.client.workflow.execute(caseConditionsWorkflow, {
        taskQueue,
        workflowId: `test-${uuidv4()}`,
        args: [
          { tenantId: 'tenant-1', caseId: 'case-1', borrowerId: 'borrower-1' },
        ],
      }),
    );

    expect(result).toEqual({ finalStatus: CaseStatus.READY_FOR_UNDERWRITING });
    expect(activities.markCollectingEvidence).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      caseId: 'case-1',
    });
    expect(activities.fetchIncomeEvidence).toHaveBeenCalledTimes(1);
    expect(activities.fetchCreditEvidence).toHaveBeenCalledTimes(1);
    expect(activities.fetchDocumentEvidence).toHaveBeenCalledTimes(1);
    // Straight-through: evaluateConditions itself sets the case ready, so
    // the workflow must not also call resolveCondition/markReadyForUnderwriting.
    expect(activities.resolveCondition).not.toHaveBeenCalled();
    expect(activities.markReadyForUnderwriting).not.toHaveBeenCalled();
  });

  it('durably waits for resolveCondition, then completes', async () => {
    const activities = makeMockActivities({
      evaluateConditions: jest.fn().mockResolvedValue({
        outcome: 'CONDITION_OPENED',
        conditionId: 'condition-1',
      }),
    });
    const taskQueue = `test-${uuidv4()}`;

    const result = await runWorker(activities, taskQueue, async () => {
      const handle = await env.client.workflow.start(caseConditionsWorkflow, {
        taskQueue,
        workflowId: `test-${uuidv4()}`,
        args: [
          { tenantId: 'tenant-1', caseId: 'case-1', borrowerId: 'borrower-1' },
        ],
      });

      // Give the workflow time to reach the durable wait before signaling —
      // signaling too early would race the evaluateConditions activity call.
      await new Promise((resolve) => setTimeout(resolve, 500));

      await handle.signal(resolveConditionSignal, {
        actorId: 'reviewer-1',
        resolution: 'SATISFIED',
        reason: 'Looks fine.',
      });

      return handle.result();
    });

    expect(result).toEqual({
      finalStatus: CaseStatus.READY_FOR_UNDERWRITING,
      conditionId: 'condition-1',
    });
    expect(activities.resolveCondition).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      conditionId: 'condition-1',
      actorId: 'reviewer-1',
      resolution: 'SATISFIED',
      reason: 'Looks fine.',
    });
    expect(activities.markReadyForUnderwriting).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      caseId: 'case-1',
    });
  });

  it('loses no acknowledged work across a worker restart while durably waiting', async () => {
    const activities = makeMockActivities({
      evaluateConditions: jest.fn().mockResolvedValue({
        outcome: 'CONDITION_OPENED',
        conditionId: 'condition-2',
      }),
    });
    const taskQueue = `test-${uuidv4()}`;
    const workflowId = `test-${uuidv4()}`;

    // First worker: start the workflow and let it reach the durable wait,
    // then shut this worker down entirely (simulating a crash/restart) —
    // note there is no `handle.result()` awaited here, so nothing is
    // blocking on this worker staying alive.
    await runWorker(activities, taskQueue, async () => {
      await env.client.workflow.start(caseConditionsWorkflow, {
        taskQueue,
        workflowId,
        args: [
          { tenantId: 'tenant-1', caseId: 'case-1', borrowerId: 'borrower-1' },
        ],
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    // No worker is running at all right now. Signal anyway — Temporal
    // persists the signal server-side regardless of worker availability.
    const handle = env.client.workflow.getHandle(workflowId);
    await handle.signal(resolveConditionSignal, {
      actorId: 'reviewer-2',
      resolution: 'WAIVED',
    });

    // Second, independent worker picks up the already-queued signal and
    // completes the workflow from where the first worker left off.
    const result = await runWorker(activities, taskQueue, () =>
      handle.result(),
    );

    expect(result).toEqual({
      finalStatus: CaseStatus.READY_FOR_UNDERWRITING,
      conditionId: 'condition-2',
    });
    expect(activities.resolveCondition).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'reviewer-2', resolution: 'WAIVED' }),
    );
    // markCollectingEvidence and the fetch* activities must not be
    // re-executed by the second worker — Temporal's replay reconstructs
    // that history rather than re-running already-completed activities.
    expect(activities.markCollectingEvidence).toHaveBeenCalledTimes(1);
    expect(activities.fetchIncomeEvidence).toHaveBeenCalledTimes(1);
  });

  it('rejects a duplicate signal payload without creating a duplicate resolution', async () => {
    const activities = makeMockActivities({
      evaluateConditions: jest.fn().mockResolvedValue({
        outcome: 'CONDITION_OPENED',
        conditionId: 'condition-3',
      }),
    });
    const taskQueue = `test-${uuidv4()}`;

    const result = await runWorker(activities, taskQueue, async () => {
      const handle = await env.client.workflow.start(caseConditionsWorkflow, {
        taskQueue,
        workflowId: `test-${uuidv4()}`,
        args: [
          { tenantId: 'tenant-1', caseId: 'case-1', borrowerId: 'borrower-1' },
        ],
      });
      await new Promise((resolve) => setTimeout(resolve, 500));

      const payload = {
        actorId: 'reviewer-3',
        resolution: 'SATISFIED' as const,
      };
      // Send the same signal twice in a row, simulating a duplicate
      // delivery (e.g. an at-least-once webhook retry from a future REST
      // layer). The workflow's handler only ever records the latest value
      // in a single variable — a second signal cannot make resolveCondition
      // fire twice, since `condition()` only unblocks the wait once.
      await handle.signal(resolveConditionSignal, payload);
      await handle.signal(resolveConditionSignal, payload);

      return handle.result();
    });

    expect(result).toEqual({
      finalStatus: CaseStatus.READY_FOR_UNDERWRITING,
      conditionId: 'condition-3',
    });
    expect(activities.resolveCondition).toHaveBeenCalledTimes(1);
    expect(activities.markReadyForUnderwriting).toHaveBeenCalledTimes(1);
  });

  it('routes to MANUAL_REVIEW when evaluateConditions reports a runtime failure (REVIEW_REQUIRED)', async () => {
    // REVIEW_REQUIRED is the Agent run's fail-closed default for a
    // runtime failure (consent invalid, budget/deadline exhaustion, a
    // tool's own failure — Section 9.5: "budget or runtime failure:
    // route to manual review") — distinct from INTERRUPTED (policy
    // ambiguity, resumable), tested separately below.
    const activities = makeMockActivities({
      evaluateConditions: jest.fn().mockResolvedValue({
        outcome: 'REVIEW_REQUIRED',
        reviewReason: 'consentStatus is "REVOKED", not VALID',
      }),
    });
    const taskQueue = `test-${uuidv4()}`;

    const result = await runWorker(activities, taskQueue, () =>
      env.client.workflow.execute(caseConditionsWorkflow, {
        taskQueue,
        workflowId: `test-${uuidv4()}`,
        args: [
          { tenantId: 'tenant-1', caseId: 'case-1', borrowerId: 'borrower-1' },
        ],
      }),
    );

    expect(result).toEqual({ finalStatus: CaseStatus.MANUAL_REVIEW });
    expect(activities.markManualReview).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      reason: 'consentStatus is "REVOKED", not VALID',
    });
    // A runtime failure is not a specific business condition — the
    // durable-wait/resolveCondition flow must not run.
    expect(activities.resolveCondition).not.toHaveBeenCalled();
  });

  it('routes to MANUAL_REVIEW when evaluateConditions itself fails (e.g. a stale-case-version failure that outlasted its retries)', async () => {
    // Section 10.5: create_condition/finalizeReadyForUnderwriting throw
    // StaleCaseVersionError, which case-conditions.activities.ts lets
    // propagate rather than catching, so Temporal's own retry re-runs
    // evaluateConditions against the case's current state. Marked
    // non-retryable here purely to keep this test fast — it's testing the
    // workflow's catch, not Temporal's retry mechanics (already covered
    // by the transient/terminal fetch-activity tests above).
    const evaluateConditions = jest
      .fn()
      .mockRejectedValue(
        ApplicationFailure.nonRetryable(
          'case case-1 version changed during the write (expected 3); re-evaluation required',
          'StaleCaseVersionError',
        ),
      );
    const activities = makeMockActivities({ evaluateConditions });
    const taskQueue = `test-${uuidv4()}`;

    const result = await runWorker(activities, taskQueue, () =>
      env.client.workflow.execute(caseConditionsWorkflow, {
        taskQueue,
        workflowId: `test-${uuidv4()}`,
        args: [
          { tenantId: 'tenant-1', caseId: 'case-1', borrowerId: 'borrower-1' },
        ],
      }),
    );

    expect(result).toEqual({ finalStatus: CaseStatus.MANUAL_REVIEW });
    expect(evaluateConditions).toHaveBeenCalledTimes(1);
    expect(activities.markManualReview).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', caseId: 'case-1' }),
    );
    expect(activities.resolveCondition).not.toHaveBeenCalled();
  });

  it('durably waits when evaluation is interrupted, then re-evaluates and completes once resumed', async () => {
    const evaluateConditions = jest
      .fn()
      .mockResolvedValueOnce({
        outcome: 'INTERRUPTED',
        reviewReason:
          'jurisdiction "US-ZZ" has no reviewed, covered policy source',
      })
      .mockResolvedValueOnce({ outcome: 'READY' });
    const activities = makeMockActivities({ evaluateConditions });
    const taskQueue = `test-${uuidv4()}`;

    const result = await runWorker(activities, taskQueue, async () => {
      const handle = await env.client.workflow.start(caseConditionsWorkflow, {
        taskQueue,
        workflowId: `test-${uuidv4()}`,
        args: [
          { tenantId: 'tenant-1', caseId: 'case-1', borrowerId: 'borrower-1' },
        ],
      });

      // Give the workflow time to reach the interrupt's durable wait
      // before signaling — signaling too early would race the first
      // evaluateConditions call.
      await new Promise((resolve) => setTimeout(resolve, 500));

      await handle.signal(resumeInterruptedEvaluationSignal, {
        actorId: 'reviewer-4',
        note: 'coverage activated for US-ZZ',
      });

      return handle.result();
    });

    expect(result).toEqual({ finalStatus: CaseStatus.READY_FOR_UNDERWRITING });
    expect(evaluateConditions).toHaveBeenCalledTimes(2);
    expect(activities.markWaitingForReview).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      reason: 'jurisdiction "US-ZZ" has no reviewed, covered policy source',
    });
    // A resumed-and-cleared evaluation completes straight through, same
    // as the non-interrupted READY path — no condition-resolution flow.
    expect(activities.resolveCondition).not.toHaveBeenCalled();
    expect(activities.markManualReview).not.toHaveBeenCalled();
  });

  it('supports multiple interrupt cycles before the evaluation finally resolves', async () => {
    const evaluateConditions = jest
      .fn()
      .mockResolvedValueOnce({
        outcome: 'INTERRUPTED',
        reviewReason: 'first ambiguity',
      })
      .mockResolvedValueOnce({
        outcome: 'INTERRUPTED',
        reviewReason: 'second ambiguity',
      })
      .mockResolvedValueOnce({ outcome: 'READY' });
    const activities = makeMockActivities({ evaluateConditions });
    const taskQueue = `test-${uuidv4()}`;

    const result = await runWorker(activities, taskQueue, async () => {
      const handle = await env.client.workflow.start(caseConditionsWorkflow, {
        taskQueue,
        workflowId: `test-${uuidv4()}`,
        args: [
          { tenantId: 'tenant-1', caseId: 'case-1', borrowerId: 'borrower-1' },
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 500));
      await handle.signal(resumeInterruptedEvaluationSignal, {
        actorId: 'reviewer-5',
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
      await handle.signal(resumeInterruptedEvaluationSignal, {
        actorId: 'reviewer-5',
      });

      return handle.result();
    });

    expect(result).toEqual({ finalStatus: CaseStatus.READY_FOR_UNDERWRITING });
    expect(evaluateConditions).toHaveBeenCalledTimes(3);
    expect(activities.markWaitingForReview).toHaveBeenCalledTimes(2);
  });

  it('retries a transient (retryable) activity failure up to the configured policy, then routes to MANUAL_REVIEW', async () => {
    const fetchIncomeEvidence = jest
      .fn()
      .mockRejectedValue(
        ApplicationFailure.retryable(
          'synthetic transient failure',
          'TransientProviderFailure',
        ),
      );
    const activities = makeMockActivities({ fetchIncomeEvidence });
    const taskQueue = `test-${uuidv4()}`;

    const result = await runWorker(activities, taskQueue, () =>
      env.client.workflow.execute(caseConditionsWorkflow, {
        taskQueue,
        workflowId: `test-${uuidv4()}`,
        args: [
          { tenantId: 'tenant-1', caseId: 'case-1', borrowerId: 'borrower-1' },
        ],
      }),
    );

    expect(result).toEqual({ finalStatus: CaseStatus.MANUAL_REVIEW });
    // maximumAttempts: 3 in case-conditions.workflow.ts's proxyActivities
    // retry policy — proves a retryable classification is actually retried
    // up to the configured limit, not just once.
    expect(fetchIncomeEvidence).toHaveBeenCalledTimes(3);
    expect(activities.markManualReview).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', caseId: 'case-1' }),
    );
  });

  it('does not retry a terminal (non-retryable) activity failure', async () => {
    const fetchCreditEvidence = jest
      .fn()
      .mockRejectedValue(
        ApplicationFailure.nonRetryable(
          'synthetic terminal failure',
          'TerminalProviderFailure',
        ),
      );
    const activities = makeMockActivities({ fetchCreditEvidence });
    const taskQueue = `test-${uuidv4()}`;

    const result = await runWorker(activities, taskQueue, () =>
      env.client.workflow.execute(caseConditionsWorkflow, {
        taskQueue,
        workflowId: `test-${uuidv4()}`,
        args: [
          { tenantId: 'tenant-1', caseId: 'case-1', borrowerId: 'borrower-1' },
        ],
      }),
    );

    expect(result).toEqual({ finalStatus: CaseStatus.MANUAL_REVIEW });
    // A non-retryable classification must not waste any of the configured
    // retry attempts — exactly one call, not three.
    expect(fetchCreditEvidence).toHaveBeenCalledTimes(1);
  });
});
