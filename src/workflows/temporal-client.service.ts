import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  Connection,
  WorkflowExecutionAlreadyStartedError,
} from '@temporalio/client';
import { caseConditionsWorkflow } from './case-conditions.workflow';
import {
  CASE_CONDITIONS_TASK_QUEUE,
  resolveConditionSignal,
  ResolveConditionSignalPayload,
  resumeInterruptedEvaluationSignal,
  ResumeInterruptedEvaluationSignalPayload,
} from './case-conditions.signals';
import { CaseConditionsWorkflowInput } from './case-conditions.types';

/**
 * Thin wrapper around the Temporal `Client` for starting and signaling the
 * case-conditions workflow. Kept separate from the worker (src/worker.ts):
 * the API process only ever talks to Temporal as a client — it never runs
 * workflow or activity code itself (Section 12.1's API/worker boundary).
 */
@Injectable()
export class TemporalClientService implements OnModuleDestroy {
  private connectionPromise?: Promise<Connection>;

  constructor(private readonly configService: ConfigService) {}

  private async getConnection(): Promise<Connection> {
    if (!this.connectionPromise) {
      this.connectionPromise = Connection.connect({
        address: this.configService.get<string>(
          'TEMPORAL_ADDRESS',
          'localhost:7233',
        ),
      });
    }
    return this.connectionPromise;
  }

  private async getClient(): Promise<Client> {
    const connection = await this.getConnection();
    return new Client({
      connection,
      namespace: this.configService.get<string>(
        'TEMPORAL_NAMESPACE',
        'default',
      ),
    });
  }

  /**
   * Starts the durable case-conditions workflow. `workflowId` is derived
   * from `caseId` so starting it twice for the same case is idempotent: a
   * second start while the first is still running raises
   * `WorkflowExecutionAlreadyStartedError`, which is caught here and
   * translated into the existing execution's identity instead of a second
   * execution or an error — the REST layer (`CasesService.startWorkflow`)
   * relies on this to make POST .../workflow-runs safely retriable.
   */
  async startCaseConditionsWorkflow(
    input: CaseConditionsWorkflowInput,
  ): Promise<{ workflowId: string; runId: string }> {
    const client = await this.getClient();
    const workflowId = `case-conditions-${input.caseId}`;
    try {
      const handle = await client.workflow.start(caseConditionsWorkflow, {
        taskQueue: CASE_CONDITIONS_TASK_QUEUE,
        workflowId,
        args: [input],
      });
      return {
        workflowId: handle.workflowId,
        runId: handle.firstExecutionRunId,
      };
    } catch (error) {
      if (error instanceof WorkflowExecutionAlreadyStartedError) {
        const existing = await client.workflow.getHandle(workflowId).describe();
        return { workflowId, runId: existing.runId };
      }
      throw error;
    }
  }

  /**
   * Delivers the resolveCondition signal. Throws the Temporal SDK's own
   * `WorkflowNotFoundError` (re-exported from `@temporalio/client`) if no
   * workflow execution exists for this case — callers map that to a
   * domain-appropriate response rather than this service papering over it.
   */
  async resolveCondition(
    caseId: string,
    payload: ResolveConditionSignalPayload,
  ): Promise<void> {
    const client = await this.getClient();
    const handle = client.workflow.getHandle(`case-conditions-${caseId}`);
    await handle.signal(resolveConditionSignal, payload);
  }

  /**
   * Delivers the resumeInterruptedEvaluation signal — tells the workflow
   * a reviewer has addressed whatever made policy applicability ambiguous
   * and it should re-run the evaluation. Same `WorkflowNotFoundError`
   * contract as `resolveCondition`.
   */
  async resumeInterruptedEvaluation(
    caseId: string,
    payload: ResumeInterruptedEvaluationSignalPayload,
  ): Promise<void> {
    const client = await this.getClient();
    const handle = client.workflow.getHandle(`case-conditions-${caseId}`);
    await handle.signal(resumeInterruptedEvaluationSignal, payload);
  }

  /**
   * Describes the workflow run for a case. `runId` pins the lookup to a
   * specific execution (matching the REST status endpoint's path shape,
   * `.../workflow-runs/{runId}`); omitted, it resolves to the latest run.
   * Throws `WorkflowNotFoundError` if the case/run does not exist.
   */
  async getWorkflowStatus(
    caseId: string,
    runId?: string,
  ): Promise<{ workflowId: string; runId: string; status: string }> {
    const client = await this.getClient();
    const workflowId = `case-conditions-${caseId}`;
    const handle = client.workflow.getHandle(workflowId, runId);
    const description = await handle.describe();
    return {
      workflowId,
      runId: description.runId,
      status: description.status.name,
    };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connectionPromise) {
      const connection = await this.connectionPromise;
      await connection.close();
    }
  }
}
