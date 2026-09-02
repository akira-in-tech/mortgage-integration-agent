import { createHash } from 'node:crypto';
import { z } from 'zod';

export const AGENT_PLANNER_PROMPT_VERSION =
  'lending-operations-planner-v1' as const;

export type AgentPlannerAction = 'EVALUATE_POLICY' | 'REQUEST_HUMAN_REVIEW';

export interface AgentPlannerInput {
  consentValid: true;
  evidenceComplete: true;
  availableActions: AgentPlannerAction[];
}

export interface AgentPlannerResult {
  nextAction: AgentPlannerAction;
  reasonCode: 'POLICY_EVALUATION_REQUIRED' | 'HUMAN_REVIEW_REQUIRED';
  confidence: number;
  modelVersion: string;
  promptVersion: typeof AGENT_PLANNER_PROMPT_VERSION;
  requestDigest: string;
  responseDigest: string;
  accountedTokenUnits: number;
}

export interface AgentPlannerPort {
  /** Conservative reservation charged before the model call. */
  readonly tokenBudgetUnits: number;
  /** Output below this confidence is reviewed even when its route is valid. */
  readonly minimumConfidenceBasisPoints: number;
  readonly modelVersion: string;
  readonly promptVersion: typeof AGENT_PLANNER_PROMPT_VERSION;
  plan(input: AgentPlannerInput): Promise<AgentPlannerResult>;
}

export class AgentPlannerError extends Error {
  constructor(
    readonly code:
      'UNAVAILABLE' | 'TIMEOUT' | 'PROVIDER_ERROR' | 'MALFORMED_OUTPUT',
    message: string,
  ) {
    super(message);
    this.name = 'AgentPlannerError';
  }
}

interface OllamaAgentPlannerOptions {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
  tokenBudgetUnits: number;
  minimumConfidenceBasisPoints: number;
  httpClient?: typeof fetch;
}

interface OllamaChatResponse {
  message?: { content?: unknown };
  error?: unknown;
}

const plannerResponseSchema = z
  .object({
    nextAction: z.enum(['EVALUATE_POLICY', 'REQUEST_HUMAN_REVIEW']),
    reasonCode: z.enum(['POLICY_EVALUATION_REQUIRED', 'HUMAN_REVIEW_REQUIRED']),
    confidence: z.number().min(0).max(1),
  })
  .strict()
  .superRefine((value, context) => {
    const expected =
      value.nextAction === 'EVALUATE_POLICY'
        ? 'POLICY_EVALUATION_REQUIRED'
        : 'HUMAN_REVIEW_REQUIRED';
    if (value.reasonCode !== expected) {
      context.addIssue({
        code: 'custom',
        message: 'reasonCode does not match nextAction',
      });
    }
  });

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

/**
 * Local open-weight routing planner. Inputs are server-owned booleans/enums,
 * never borrower values or free text. The model may choose only one of two
 * graph edges; policy evaluation and every side effect remain deterministic
 * registered tools behind their normal authorization boundaries.
 */
export class OllamaAgentPlanner implements AgentPlannerPort {
  readonly tokenBudgetUnits: number;
  readonly minimumConfidenceBasisPoints: number;
  readonly modelVersion: string;
  readonly promptVersion = AGENT_PLANNER_PROMPT_VERSION;
  private readonly httpClient: typeof fetch;

  constructor(private readonly options: OllamaAgentPlannerOptions) {
    this.tokenBudgetUnits = options.tokenBudgetUnits;
    this.minimumConfidenceBasisPoints = options.minimumConfidenceBasisPoints;
    this.modelVersion = options.model;
    this.httpClient = options.httpClient ?? fetch;
  }

  async plan(input: AgentPlannerInput): Promise<AgentPlannerResult> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs,
    );
    const systemPrompt = [
      'You route a synthetic lending-operations workflow.',
      'You never make or recommend a credit decision, interpret policy, or invent a tool.',
      'Choose EVALUATE_POLICY when deterministic policy evaluation can continue.',
      'Choose REQUEST_HUMAN_REVIEW only when the supplied control state is insufficient or unsafe.',
      'Return only the required JSON object.',
    ].join(' ');
    const request = {
      promptVersion: AGENT_PLANNER_PROMPT_VERSION,
      controlState: input,
    };

    let response: Response;
    try {
      response = await this.httpClient(`${this.options.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.options.model,
          stream: false,
          // Hidden reasoning is disabled: it adds unaccounted tokens without
          // improving this two-edge, schema-constrained routing decision.
          think: false,
          format: {
            type: 'object',
            properties: {
              nextAction: {
                type: 'string',
                enum: ['EVALUATE_POLICY', 'REQUEST_HUMAN_REVIEW'],
              },
              reasonCode: {
                type: 'string',
                enum: ['POLICY_EVALUATION_REQUIRED', 'HUMAN_REVIEW_REQUIRED'],
              },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
            },
            required: ['nextAction', 'reasonCode', 'confidence'],
            additionalProperties: false,
          },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(request) },
          ],
          options: {
            temperature: 0,
            num_predict: this.options.maxOutputTokens,
          },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AgentPlannerError('TIMEOUT', 'local Agent planner timed out');
      }
      throw new AgentPlannerError(
        'UNAVAILABLE',
        'local Agent planner is unavailable',
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new AgentPlannerError(
        'PROVIDER_ERROR',
        `local Agent planner returned HTTP ${response.status}`,
      );
    }

    let payload: OllamaChatResponse;
    try {
      payload = (await response.json()) as OllamaChatResponse;
    } catch {
      throw new AgentPlannerError(
        'MALFORMED_OUTPUT',
        'local Agent planner response was not JSON',
      );
    }
    if (typeof payload.message?.content !== 'string') {
      throw new AgentPlannerError(
        'MALFORMED_OUTPUT',
        'local Agent planner returned no message content',
      );
    }

    let candidate: unknown;
    try {
      candidate = JSON.parse(payload.message.content);
    } catch {
      throw new AgentPlannerError(
        'MALFORMED_OUTPUT',
        'local Agent planner content was not valid JSON',
      );
    }
    const parsed = plannerResponseSchema.safeParse(candidate);
    if (
      !parsed.success ||
      !input.availableActions.includes(parsed.data.nextAction)
    ) {
      throw new AgentPlannerError(
        'MALFORMED_OUTPUT',
        'local Agent planner returned an invalid or unavailable action',
      );
    }

    return {
      ...parsed.data,
      modelVersion: this.modelVersion,
      promptVersion: this.promptVersion,
      requestDigest: digest(request),
      responseDigest: digest(parsed.data),
      accountedTokenUnits: this.tokenBudgetUnits,
    };
  }
}
