import { PolicyChangeImpactService } from '../../policy/policy-change-impact.service';
import { PolicyChangeImpactKind } from '../../database/enums/policy-change-impact.enum';
import { AgentTool } from '../agent-tool.types';

export interface CheckPolicyChangeImpactArgs {
  policyVersionId: string;
}

export type CheckPolicyChangeImpactResult =
  | {
      assessed: true;
      impact: PolicyChangeImpactKind;
      details: string;
      assessmentId: string;
    }
  | { assessed: false; reason: string };

export interface CheckPolicyChangeImpactToolDeps {
  policyChangeImpactService: PolicyChangeImpactService;
}

/**
 * Section 9.4's `check_policy_change_impact`: "Compare an approved policy
 * change with open cases" — "No; cannot change case applicability" as its
 * approval boundary, satisfied structurally: this tool only ever persists
 * an advisory `PolicyChangeImpactAssessment` row (Section 10.6: "advisory
 * until an authorized reviewer approves the transition configuration"), it
 * never touches the case's own binding or snapshot.
 *
 * A thin wrapper over `PolicyChangeImpactService.assessImpactForCase` —
 * the per-case counterpart added alongside this tool (M3-016) to
 * `assessImpact`'s existing catalog-wide scan (`PolicyActivationService`'s
 * own post-activation trigger, M3-011), since an `AgentTool` is always
 * scoped to one `{tenantId, caseId}` context, not "every case a change
 * might affect."
 */
export function checkPolicyChangeImpactTool(
  deps: CheckPolicyChangeImpactToolDeps,
): AgentTool<CheckPolicyChangeImpactArgs, CheckPolicyChangeImpactResult> {
  return {
    name: 'check_policy_change_impact',
    purpose: 'Compare an approved policy change with open cases',
    sideEffect: 'CREATES_ASSESSMENT',
    approvalBoundary: 'No; cannot change case applicability',
    async execute({ tenantId, caseId }, args) {
      const assessment =
        await deps.policyChangeImpactService.assessImpactForCase(
          tenantId,
          caseId,
          args.policyVersionId,
        );
      if (!assessment) {
        return {
          assessed: false,
          reason: 'case has no live policy binding to compare against',
        };
      }
      return {
        assessed: true,
        impact: assessment.impact,
        details: assessment.details,
        assessmentId: assessment.id,
      };
    },
  };
}
