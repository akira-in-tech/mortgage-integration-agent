import { Attributes, metrics, SpanStatusCode, trace } from '@opentelemetry/api';
import type {
  ProviderEffectClass,
  ProviderMode,
} from '../provider-platform/types';
import type { ProviderCapability } from '../provider-platform/types';
import type { PolicyEvaluationOutcome } from '../policy/policy-evaluation.service';
import type { AgentRunResult } from '../agent-runtime/agent-runtime.types';
import type {
  AgentBudgetFailureCode,
  AgentBudgetReservationReceipt,
} from '../agent-runtime/agent-budget-ledger.service';
import type { DispatchPendingEventsResult } from '../webhooks/webhook-dispatch.service';

const meter = metrics.getMeter('mortgage-integration-agent', '1.0.0');
const tracer = trace.getTracer('mortgage-integration-agent', '1.0.0');

const providerOperations = meter.createCounter('lending.provider.operations', {
  description: 'Provider dispatch attempts by bounded operational outcome',
});
const providerDuration = meter.createHistogram('lending.provider.duration', {
  description: 'Provider dispatch duration',
  unit: 's',
});
const policyEvaluations = meter.createCounter('lending.policy.evaluations', {
  description: 'Policy evaluations by binding outcome',
});
const policyDuration = meter.createHistogram('lending.policy.duration', {
  description: 'Policy evaluation duration',
  unit: 's',
});
const agentRuns = meter.createCounter('lending.agent.runs', {
  description: 'Bounded Agent runs by terminal route',
});
const agentDuration = meter.createHistogram('lending.agent.duration', {
  description: 'Bounded Agent run duration',
  unit: 's',
});
const agentTools = meter.createCounter('lending.agent.tool.attempts', {
  description: 'Agent tool attempts by registered tool and outcome',
});
const agentBudgetReservations = meter.createCounter(
  'lending.agent.budget.reservations',
  { description: 'Authoritative budget reservation transitions' },
);
const agentBudgetUnits = meter.createCounter('lending.agent.budget.units', {
  description: 'Budget units reserved or resolved by bounded unit type',
});
const workflowOperations = meter.createCounter(
  'lending.workflow.client.operations',
  { description: 'Temporal client operations by type and outcome' },
);
const workflowDuration = meter.createHistogram(
  'lending.workflow.client.duration',
  { description: 'Temporal client operation duration', unit: 's' },
);
const webhookBatches = meter.createCounter('lending.webhook.batches', {
  description: 'Webhook dispatch sweeps by outcome',
});
const webhookEvents = meter.createCounter('lending.webhook.events', {
  description: 'Outbox events and delivery attempts processed',
});
const webhookDeliveries = meter.createCounter('lending.webhook.deliveries', {
  description: 'Webhook delivery attempts by receiver outcome',
});
const webhookDuration = meter.createHistogram('lending.webhook.duration', {
  description: 'Webhook dispatch sweep duration',
  unit: 's',
});

type ProviderOutcome =
  | 'succeeded'
  | 'disabled'
  | 'not_activated'
  | 'authorization_rejected'
  | 'provider_rejected'
  | 'outcome_unknown'
  | 'failed';
type AgentToolOutcome = 'success' | 'failure' | 'blocked';
type WorkflowOperation = 'start' | 'signal' | 'describe';
type BudgetAction = 'reserve' | 'commit' | 'release' | 'mark_unknown';

const REGISTERED_AGENT_TOOLS = new Set([
  'check_case_completeness',
  'evaluate_policy',
  'create_condition',
  'draft_information_request',
]);

function elapsedSeconds(startedAt: number): number {
  return Math.max(0, performance.now() - startedAt) / 1_000;
}

export function safeTelemetryErrorType(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown';
  // Error names are bounded by implementation classes; messages may contain
  // borrower, provider, network, or credential details and are never copied.
  return /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(error.name) ? error.name : 'Error';
}

export function safeAgentToolLabel(toolName: string): string {
  return REGISTERED_AGENT_TOOLS.has(toolName) ? toolName : 'unknown';
}

/**
 * Domain telemetry uses only enums and registered operation names as labels.
 * Tenant, case, borrower, workflow, intent, and reservation IDs stay out of
 * metrics, preventing both cardinality explosions and sensitive-data spread.
 */
class OperationalTelemetry {
  async withSpan<T>(
    name: string,
    attributes: Attributes,
    operation: () => Promise<T>,
  ): Promise<T> {
    return tracer.startActiveSpan(name, { attributes }, async (span) => {
      try {
        const value = await operation();
        span.setStatus({ code: SpanStatusCode.OK });
        return value;
      } catch (error) {
        span.setAttribute('error.type', safeTelemetryErrorType(error));
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  recordProvider(
    input: {
      capability: ProviderCapability;
      mode: ProviderMode;
      effectClass: ProviderEffectClass;
      outcome: ProviderOutcome;
    },
    startedAt: number,
  ): void {
    const labels = {
      capability: input.capability,
      mode: input.mode,
      effect_class: input.effectClass,
      outcome: input.outcome,
    };
    providerOperations.add(1, labels);
    providerDuration.record(elapsedSeconds(startedAt), labels);
  }

  recordPolicy(
    outcome: PolicyEvaluationOutcome | 'ERROR',
    startedAt: number,
  ): void {
    const labels = { outcome: outcome.toLowerCase() };
    policyEvaluations.add(1, labels);
    policyDuration.record(elapsedSeconds(startedAt), labels);
  }

  async observeAgentRun(
    operation: () => Promise<AgentRunResult>,
  ): Promise<AgentRunResult> {
    const startedAt = performance.now();
    try {
      const result = await this.withSpan('agent.run', {}, operation);
      const labels = { route: result.route.toLowerCase() };
      agentRuns.add(1, labels);
      agentDuration.record(elapsedSeconds(startedAt), labels);
      return result;
    } catch (error) {
      const labels = { route: 'error' };
      agentRuns.add(1, labels);
      agentDuration.record(elapsedSeconds(startedAt), labels);
      throw error;
    }
  }

  recordAgentTool(toolName: string, outcome: AgentToolOutcome): void {
    agentTools.add(1, {
      tool: safeAgentToolLabel(toolName),
      outcome,
    });
  }

  recordBudgetReservation(
    action: BudgetAction,
    receipt: AgentBudgetReservationReceipt,
  ): void {
    agentBudgetReservations.add(1, {
      action,
      status: receipt.status.toLowerCase(),
      replayed: String(receipt.replayed),
    });
    for (const [unit, value] of [
      ['step', receipt.units.stepUnits],
      ['token', receipt.units.tokenUnits],
      ['provider_call', receipt.units.providerCallUnits],
      [
        'cost_minor',
        receipt.actualCostMinorUnits ?? receipt.units.costMinorUnits,
      ],
    ] as const) {
      agentBudgetUnits.add(value, { action, unit });
    }
  }

  recordBudgetFailure(
    action: BudgetAction,
    code: AgentBudgetFailureCode | 'ERROR',
  ): void {
    agentBudgetReservations.add(1, {
      action,
      status: 'rejected',
      failure_code: code.toLowerCase(),
    });
  }

  async observeWorkflow<T>(
    operationName: WorkflowOperation,
    operation: () => Promise<T>,
  ): Promise<T> {
    const startedAt = performance.now();
    try {
      const result = await this.withSpan(
        `workflow.client.${operationName}`,
        { operation: operationName },
        operation,
      );
      const labels = { operation: operationName, outcome: 'succeeded' };
      workflowOperations.add(1, labels);
      workflowDuration.record(elapsedSeconds(startedAt), labels);
      return result;
    } catch (error) {
      const labels = { operation: operationName, outcome: 'failed' };
      workflowOperations.add(1, labels);
      workflowDuration.record(elapsedSeconds(startedAt), labels);
      throw error;
    }
  }

  async observeWebhookBatch(
    operation: () => Promise<DispatchPendingEventsResult>,
  ): Promise<DispatchPendingEventsResult> {
    const startedAt = performance.now();
    try {
      const result = await this.withSpan(
        'webhook.dispatch_batch',
        {},
        operation,
      );
      webhookBatches.add(1, { outcome: 'succeeded' });
      webhookEvents.add(result.eventsProcessed, { kind: 'outbox_event' });
      webhookEvents.add(result.attemptsMade, { kind: 'delivery_attempt' });
      webhookDuration.record(elapsedSeconds(startedAt), {
        outcome: 'succeeded',
      });
      return result;
    } catch (error) {
      webhookBatches.add(1, { outcome: 'failed' });
      webhookDuration.record(elapsedSeconds(startedAt), { outcome: 'failed' });
      throw error;
    }
  }

  recordWebhookDelivery(
    outcome: 'SUCCEEDED' | 'FAILED',
    terminal: boolean,
  ): void {
    webhookDeliveries.add(1, {
      outcome: outcome.toLowerCase(),
      terminal: String(terminal),
    });
  }
}

export const operationalTelemetry = new OperationalTelemetry();

export type { AgentToolOutcome, ProviderOutcome, WorkflowOperation };
