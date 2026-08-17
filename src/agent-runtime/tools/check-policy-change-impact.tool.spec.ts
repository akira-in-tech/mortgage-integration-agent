import 'reflect-metadata';
import { checkPolicyChangeImpactTool } from './check-policy-change-impact.tool';
import { PolicyChangeImpactKind } from '../../database/enums/policy-change-impact.enum';

// The service's own correctness (assessImpactForCase) is covered by
// policy-activation.service.spec.ts's real-database suite — this tool
// has no I/O of its own, only shapes the service's result, so a mocked
// service is the right, honest unit under test here.
describe('checkPolicyChangeImpactTool', () => {
  const context = { tenantId: 'tenant-1', caseId: 'case-1' };
  const args = { policyVersionId: 'version-1' };

  it('declares the Section 9.4 registered-tool metadata', () => {
    const tool = checkPolicyChangeImpactTool({
      policyChangeImpactService: {} as any,
    });
    expect(tool.name).toBe('check_policy_change_impact');
    expect(tool.sideEffect).toBe('CREATES_ASSESSMENT');
    expect(tool.approvalBoundary).toBe('No; cannot change case applicability');
  });

  it('shapes a real assessment into the tool result', async () => {
    const assessImpactForCase = jest.fn().mockResolvedValue({
      id: 'assessment-1',
      impact: PolicyChangeImpactKind.REQUIRES_REEVALUATION,
      details: 'resolved policy version set changed',
    });
    const tool = checkPolicyChangeImpactTool({
      policyChangeImpactService: { assessImpactForCase } as any,
    });

    const result = await tool.execute(context, args);

    expect(assessImpactForCase).toHaveBeenCalledWith(
      'tenant-1',
      'case-1',
      'version-1',
    );
    expect(result).toEqual({
      assessed: true,
      impact: PolicyChangeImpactKind.REQUIRES_REEVALUATION,
      details: 'resolved policy version set changed',
      assessmentId: 'assessment-1',
    });
  });

  it('reports assessed: false when the case has no live binding to compare against', async () => {
    const assessImpactForCase = jest.fn().mockResolvedValue(null);
    const tool = checkPolicyChangeImpactTool({
      policyChangeImpactService: { assessImpactForCase } as any,
    });

    const result = await tool.execute(context, args);

    expect(result).toEqual({
      assessed: false,
      reason: 'case has no live policy binding to compare against',
    });
  });
});
