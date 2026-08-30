import 'reflect-metadata';
import { evaluatePolicyTool } from './evaluate-policy.tool';

// Unlike check-case-completeness/create-condition (which own real
// database writes), this tool has no I/O of its own — it only shapes
// PolicyEvaluationService's result into the tool contract, so a mocked
// service is the right, honest unit under test here (the service's own
// correctness is already covered by policy-evaluation.service.spec.ts's
// real-database suite).
describe('evaluatePolicyTool', () => {
  const context = { tenantId: 'tenant-1', caseId: 'case-1' };
  const args = {
    jurisdictionCode: 'US-CA',
    productCode: 'CONVENTIONAL_MORTGAGE',
    lifecycleEvent: 'UNDERWRITING_REVIEW',
    applicationReceivedAt: '2026-01-15T00:00:00.000Z',
  };

  it('declares the Section 9.4 registered-tool metadata', () => {
    const tool = evaluatePolicyTool({ policyEvaluationService: {} as any });
    expect(tool.name).toBe('evaluate_policy');
    expect(tool.sideEffect).toBe('CREATES_ASSESSMENT');
    expect(tool.approvalBoundary).toBe('Mandatory policy-binding validation');
  });

  it('shapes a RESOLVED/REFRESHED evaluation into the tool result', async () => {
    const evaluate = jest.fn().mockResolvedValue({
      outcome: 'REFRESHED',
      resolution: {
        status: 'RESOLVED',
        versions: [
          {
            policyVersionId: 'pv-1',
            ruleId: 'rule-1',
            version: '1.0.0',
            rule: {},
            effectiveFrom: new Date(),
            effectiveTo: null,
          },
        ],
        unresolvedReasons: [],
      },
      snapshot: { id: 'snapshot-1' },
      binding: { id: 'binding-1', dependencyDigest: 'digest-1' },
    });
    const tool = evaluatePolicyTool({
      policyEvaluationService: { evaluate } as any,
    });

    const result = await tool.execute(context, args);

    expect(evaluate).toHaveBeenCalledWith(
      'tenant-1',
      'case-1',
      expect.objectContaining(args),
    );
    expect(result).toEqual({
      outcome: 'REFRESHED',
      status: 'RESOLVED',
      policySnapshotId: 'snapshot-1',
      policyBindingId: 'binding-1',
      observedPolicyDependencyDigest: 'digest-1',
      matchedVersions: [
        {
          policyVersionId: 'pv-1',
          ruleId: 'rule-1',
          version: '1.0.0',
          rule: {},
        },
      ],
      unresolvedReasons: [],
    });
  });

  it('shapes a REVIEW_REQUIRED evaluation, with no policyBindingId', async () => {
    const evaluate = jest.fn().mockResolvedValue({
      outcome: 'REVIEW_REQUIRED',
      resolution: {
        status: 'REVIEW_REQUIRED',
        versions: [],
        unresolvedReasons: [
          'jurisdiction "US-ZZ" has no covered policy source',
        ],
      },
      snapshot: { id: 'snapshot-2' },
      binding: undefined,
    });
    const tool = evaluatePolicyTool({
      policyEvaluationService: { evaluate } as any,
    });

    const result = await tool.execute(context, args);

    expect(result.outcome).toBe('REVIEW_REQUIRED');
    expect(result.policyBindingId).toBeUndefined();
    expect(result.unresolvedReasons).toEqual([
      'jurisdiction "US-ZZ" has no covered policy source',
    ]);
  });
});
