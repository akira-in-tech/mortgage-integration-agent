import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Connection } from '@temporalio/client';
import { caseConditionsWorkflow } from './case-conditions.workflow';
import {
  CASE_CONDITIONS_TASK_QUEUE,
  resolveConditionSignal,
  ResolveConditionSignalPayload,
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
   * from `caseId` so starting it twice for the same case is idempotent at
   * the Temporal level (a duplicate start reuses the running/completed
   * execution rather than creating a second one).
   */
  async startCaseConditionsWorkflow(
    input: CaseConditionsWorkflowInput,
  ): Promise<{ workflowId: string; runId: string }> {
    const client = await this.getClient();
    const handle = await client.workflow.start(caseConditionsWorkflow, {
      taskQueue: CASE_CONDITIONS_TASK_QUEUE,
      workflowId: `case-conditions-${input.caseId}`,
      args: [input],
    });
    return { workflowId: handle.workflowId, runId: handle.firstExecutionRunId };
  }

  async resolveCondition(
    caseId: string,
    payload: ResolveConditionSignalPayload,
  ): Promise<void> {
    const client = await this.getClient();
    const handle = client.workflow.getHandle(`case-conditions-${caseId}`);
    await handle.signal(resolveConditionSignal, payload);
  }

  async getWorkflowStatus(caseId: string): Promise<string> {
    const client = await this.getClient();
    const handle = client.workflow.getHandle(`case-conditions-${caseId}`);
    const description = await handle.describe();
    return description.status.name;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connectionPromise) {
      const connection = await this.connectionPromise;
      await connection.close();
    }
  }
}
