import { PolicyEvaluationService } from '../../policy/policy-evaluation.service';
import { AgentTool } from '../agent-tool.types';

export interface EvaluatePolicyArgs {
  jurisdictionCode: string;
  productCode: string;
  lifecycleEvent: string;
}

export interface EvaluatePolicyResult {
  outcome: 'REUSED' | 'REFRESHED' | 'REVIEW_REQUIRED';
  status: 'RESOLVED' | 'REVIEW_REQUIRED';
  policySnapshotId: string;
  policyBindingId?: string;
  matchedVersions: Array<{
    policyVersionId: string;
    ruleId: string;
    version: string;
  }>;
  unresolvedReasons: string[];
}

export interface EvaluatePolicyToolDeps {
  policyEvaluationService: PolicyEvaluationService;
}

/**
 * Section 9.4's `evaluate_policy`: "Request guarded evaluation of current
 * applicable policy" — "Mandatory policy-binding validation" as its
 * approval boundary, satisfied structurally: this tool has no path that
 * bypasses `PolicyEvaluationService`, the same unavoidable guard
 * `case-conditions.activities.ts` calls directly (M3-005). A thin wrapper
 * on purpose — the M2 workflow itself calls the service directly rather
 * than through this tool, since it isn't Agent-orchestrated; this
 * exists for a future LangGraph.js adapter to call the identical guard
 * through the tool-registry contract every other tool uses.
 */
export function evaluatePolicyTool(
  deps: EvaluatePolicyToolDeps,
): AgentTool<EvaluatePolicyArgs, EvaluatePolicyResult> {
  return {
    name: 'evaluate_policy',
    purpose: 'Request guarded evaluation of current applicable policy',
    sideEffect: 'CREATES_ASSESSMENT',
    approvalBoundary: 'Mandatory policy-binding validation',
    async execute({ tenantId, caseId }, args) {
      const evaluation = await deps.policyEvaluationService.evaluate(
        tenantId,
        caseId,
        { ...args, asOf: new Date() },
      );
      return {
        outcome: evaluation.outcome,
        status: evaluation.resolution.status,
        policySnapshotId: evaluation.snapshot.id,
        policyBindingId: evaluation.binding?.id,
        matchedVersions: evaluation.resolution.versions.map((v) => ({
          policyVersionId: v.policyVersionId,
          ruleId: v.ruleId,
          version: v.version,
        })),
        unresolvedReasons: evaluation.resolution.unresolvedReasons,
      };
    },
  };
}
