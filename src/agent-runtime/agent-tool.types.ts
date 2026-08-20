import {
  assertNotStructurallyExcluded,
  StructurallyExcludedCommandClass,
} from '../common/structural-exclusions';

/**
 * Section 9.4's registered-tools table columns, typed. Only a small,
 * genuinely-implemented subset of that table exists yet (see
 * src/agent-runtime/tools/ and docs/DEVELOPMENT_LOG.md's Known gaps) —
 * this type describes the contract every tool (implemented or not) must
 * satisfy, not a claim that all sixteen exist.
 */
export type ToolSideEffect =
  | 'NONE'
  | 'DOCUMENT_PROCESSING'
  | 'PROVIDER_SUBMISSION'
  | 'VERSIONED_CALCULATION'
  | 'CASE_MUTATION'
  | 'CREATES_ASSESSMENT'
  | 'WORKFLOW_TRANSITION'
  | 'EXTERNAL_COMMUNICATION';

export interface AgentToolContext {
  tenantId: string;
  caseId: string;
}

/**
 * A registered tool (Section 9.4). `execute` never mutates
 * `LendingOperationsAgentState` directly or returns budget deltas —
 * `AgentRuntimePort` implementations own applying a tool's real cost
 * against the state after it returns (Section 9.3: "a model cannot
 * increase, reset, or supply any budget value" — the same applies to a
 * tool implementation, which is untrusted code from the runtime's point
 * of view even though it lives in this codebase).
 */
export interface AgentTool<TArgs, TResult> {
  name: string;
  purpose: string;
  sideEffect: ToolSideEffect;
  /** Section 9.4's "Approval boundary" column, free text for now — no formal approval-policy engine exists yet. */
  approvalBoundary: string;
  /** Section 16.4's permanent capability denylist (`structural-exclusions.ts`) — absent on every real tool today; exists only so a future tool declaring one gets rejected at `buildToolRegistry()` time, not discovered in production. */
  structurallyExcludedCommandClass?: StructurallyExcludedCommandClass;
  execute(context: AgentToolContext, args: TArgs): Promise<TResult>;
}

/** Type-erased view used by a registry/runtime that doesn't know each tool's concrete arg/result types. */
export type AnyAgentTool = AgentTool<unknown, unknown>;

export interface ToolInvocationResult {
  toolName: string;
  outcome: 'SUCCESS' | 'FAILURE';
  result?: unknown;
  error?: string;
}

/** Invokes a named tool from a registry and produces an audit-safe summary — never throws. */
export async function invokeTool(
  tools: ReadonlyMap<string, AnyAgentTool>,
  toolName: string,
  context: AgentToolContext,
  args: unknown,
): Promise<ToolInvocationResult> {
  const tool = tools.get(toolName);
  if (!tool) {
    return {
      toolName,
      outcome: 'FAILURE',
      error: `unregistered tool "${toolName}"`,
    };
  }
  try {
    const result = await tool.execute(context, args);
    return { toolName, outcome: 'SUCCESS', result };
  } catch (error) {
    return {
      toolName,
      outcome: 'FAILURE',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export type AgentToolRegistry = ReadonlyMap<string, AnyAgentTool>;

export function buildToolRegistry(tools: AnyAgentTool[]): AgentToolRegistry {
  const registry = new Map<string, AnyAgentTool>();
  for (const tool of tools) {
    if (registry.has(tool.name)) {
      throw new Error(`duplicate tool registration: "${tool.name}"`);
    }
    assertNotStructurallyExcluded({
      kind: 'agent_tool',
      identifier: tool.name,
      declaredCommandClass: tool.structurallyExcludedCommandClass,
    });
    registry.set(tool.name, tool);
  }
  return registry;
}
