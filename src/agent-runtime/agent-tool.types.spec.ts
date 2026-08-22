import 'reflect-metadata';
import {
  buildToolRegistry,
  invokeTool,
  AnyAgentTool,
} from './agent-tool.types';

function makeTool(
  name: string,
  execute: AnyAgentTool['execute'],
): AnyAgentTool {
  return {
    name,
    purpose: 'test tool',
    sideEffect: 'NONE',
    budget: { tokenUnits: 0, providerCallUnits: 0, costMinorUnits: 0 },
    approvalBoundary: 'No',
    execute,
  };
}

describe('buildToolRegistry', () => {
  it('indexes tools by name', () => {
    const tool = makeTool('a', async () => 'result');
    const registry = buildToolRegistry([tool]);
    expect(registry.get('a')).toBe(tool);
  });

  it('throws on a duplicate tool name — an ambiguous registry is a bug, not a runtime concern', () => {
    expect(() =>
      buildToolRegistry([
        makeTool('a', async () => 1),
        makeTool('a', async () => 2),
      ]),
    ).toThrow(/duplicate tool registration/);
  });

  it("throws on a tool declaring a Section 16.4 structurally excluded command class — this codebase's permanent capability denylist, not just a naming convention", () => {
    const excludedTool: AnyAgentTool = {
      ...makeTool('synthetic_move_funds_tool', async () => 'result'),
      structurallyExcludedCommandClass: 'FUNDS_MOVEMENT',
    };
    expect(() => buildToolRegistry([excludedTool])).toThrow(
      /structurally excluded/,
    );
  });

  it('rejects an invalid conservative usage declaration at registration', () => {
    const invalid = {
      ...makeTool('invalid-budget', async () => 'result'),
      budget: { tokenUnits: -1, providerCallUnits: 0, costMinorUnits: 0 },
    };
    expect(() => buildToolRegistry([invalid])).toThrow(/invalid tokenUnits/);
  });
});

describe('invokeTool', () => {
  const context = { tenantId: 'tenant-1', caseId: 'case-1' };

  it('returns SUCCESS with the tool result', async () => {
    const registry = buildToolRegistry([
      makeTool('echo', async (_ctx, args) => args),
    ]);

    const result = await invokeTool(registry, 'echo', context, { x: 1 });

    expect(result).toEqual({
      toolName: 'echo',
      outcome: 'SUCCESS',
      result: { x: 1 },
    });
  });

  it('returns FAILURE for an unregistered tool name without throwing — unauthorized tools stay unreachable', async () => {
    const registry = buildToolRegistry([]);

    const result = await invokeTool(registry, 'nonexistent', context, {});

    expect(result).toEqual({
      toolName: 'nonexistent',
      outcome: 'FAILURE',
      error: 'unregistered tool "nonexistent"',
    });
  });

  it('returns FAILURE with the error message when a tool throws, without propagating the throw', async () => {
    const registry = buildToolRegistry([
      makeTool('boom', async () => {
        throw new Error('synthetic tool failure');
      }),
    ]);

    const result = await invokeTool(registry, 'boom', context, {});

    expect(result).toEqual({
      toolName: 'boom',
      outcome: 'FAILURE',
      error: 'synthetic tool failure',
    });
  });
});
