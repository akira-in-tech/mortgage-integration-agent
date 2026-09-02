import {
  AGENT_PLANNER_PROMPT_VERSION,
  AgentPlannerError,
  OllamaAgentPlanner,
} from './agent-planner';

function response(content: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => ({ message: { content } }),
  } as Response;
}

describe('OllamaAgentPlanner', () => {
  const httpClient = jest.fn<
    ReturnType<typeof fetch>,
    Parameters<typeof fetch>
  >();
  const planner = new OllamaAgentPlanner({
    baseUrl: 'http://ollama.test:11434',
    model: 'qwen3.5:9b',
    timeoutMs: 1000,
    maxOutputTokens: 128,
    tokenBudgetUnits: 1024,
    minimumConfidenceBasisPoints: 8000,
    httpClient,
  });
  const input = {
    consentValid: true as const,
    evidenceComplete: true as const,
    availableActions: ['EVALUATE_POLICY', 'REQUEST_HUMAN_REVIEW'] as const,
  };

  beforeEach(() => httpClient.mockReset());

  it('uses Qwen with thinking disabled and returns only a validated bounded route', async () => {
    httpClient.mockResolvedValueOnce(
      response(
        JSON.stringify({
          nextAction: 'EVALUATE_POLICY',
          reasonCode: 'POLICY_EVALUATION_REQUIRED',
          confidence: 0.98,
        }),
      ),
    );

    const result = await planner.plan({
      ...input,
      availableActions: [...input.availableActions],
    });

    expect(result).toMatchObject({
      nextAction: 'EVALUATE_POLICY',
      modelVersion: 'qwen3.5:9b',
      promptVersion: AGENT_PLANNER_PROMPT_VERSION,
      accountedTokenUnits: 1024,
    });
    expect(result.requestDigest).toMatch(/^[0-9a-f]{64}$/);
    const body = JSON.parse(
      (httpClient.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body).toMatchObject({
      model: 'qwen3.5:9b',
      stream: false,
      think: false,
      options: { temperature: 0, num_predict: 128 },
    });
    expect(JSON.stringify(body)).not.toMatch(
      /borrower|income|creditScore|requestedAmount/i,
    );
  });

  it.each([
    'not-json',
    JSON.stringify({
      nextAction: 'APPROVE_LOAN',
      reasonCode: 'POLICY_EVALUATION_REQUIRED',
      confidence: 1,
    }),
    JSON.stringify({
      nextAction: 'EVALUATE_POLICY',
      reasonCode: 'HUMAN_REVIEW_REQUIRED',
      confidence: 0.7,
    }),
    JSON.stringify({
      nextAction: 'EVALUATE_POLICY',
      reasonCode: 'POLICY_EVALUATION_REQUIRED',
      confidence: 0.7,
      tool: 'send_information_request',
    }),
  ])('rejects malformed or authority-expanding output: %s', async (content) => {
    httpClient.mockResolvedValueOnce(response(content));

    await expect(
      planner.plan({ ...input, availableActions: [...input.availableActions] }),
    ).rejects.toBeInstanceOf(AgentPlannerError);
  });

  it('classifies provider errors without exposing response content', async () => {
    httpClient.mockResolvedValueOnce(response('', false, 503));

    await expect(
      planner.plan({ ...input, availableActions: [...input.availableActions] }),
    ).rejects.toMatchObject({ code: 'PROVIDER_ERROR' });
  });
});
