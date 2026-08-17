import { DataSource } from 'typeorm';
import { LoanCase, CaseStatus } from '../../database/entities/loan-case.entity';
import {
  LoanCondition,
  ConditionStatus,
} from '../../database/entities/loan-condition.entity';
import { writeOutboxEvent } from '../../database/outbox/outbox-writer';
import { OutboxEventType } from '../../database/outbox/outbox-event-types';
import { AgentTool } from '../agent-tool.types';

export interface CreateConditionArgs {
  code: string;
  description: string;
  policyVersionId: string;
  ruleId: string;
  policySnapshotId: string;
}

export interface CreateConditionResult {
  conditionId: string;
}

export interface CreateConditionToolDeps {
  dataSource: DataSource;
  outboxSigningSecret: string;
}

/**
 * Section 9.4's `create_condition`: "Materialize a policy-supported
 * operational condition" — "Validated binding and evaluation required" is
 * its approval boundary, expressed here by requiring the caller to supply
 * the `policySnapshotId`/`policyVersionId`/`ruleId` a completed
 * `PolicyEvaluationService.evaluate()` call already produced, rather than
 * resolving policy itself. This tool does not call the policy engine —
 * that's `evaluate_policy`'s job (evaluate-policy.tool.ts); this one only
 * ever materializes a condition a caller has already justified.
 *
 * Extracted from case-conditions.activities.ts's inline condition-opening
 * logic (M2/M3), which now calls this tool instead of duplicating it —
 * and, in the process, finally populates `LoanCondition.policySnapshotId`
 * (a column that has existed since M2-001 specifically for this, per its
 * own comment: "M3 will make it required... Section 6.2").
 */
export function createConditionTool(
  deps: CreateConditionToolDeps,
): AgentTool<CreateConditionArgs, CreateConditionResult> {
  return {
    name: 'create_condition',
    purpose: 'Materialize a policy-supported operational condition',
    sideEffect: 'CASE_MUTATION',
    approvalBoundary: 'Validated binding and evaluation required',
    async execute({ tenantId, caseId }, args) {
      return deps.dataSource.transaction(async (manager) => {
        const conditionRepo = manager.getRepository(LoanCondition);
        const condition = await conditionRepo.save(
          conditionRepo.create({
            tenantId,
            caseId,
            code: args.code,
            description: args.description,
            status: ConditionStatus.OPEN,
            policySnapshotId: args.policySnapshotId,
          }),
        );
        await manager
          .getRepository(LoanCase)
          .update(
            { id: caseId, tenantId },
            { status: CaseStatus.CONDITIONS_OPEN },
          );
        await writeOutboxEvent(manager, deps.outboxSigningSecret, {
          tenantId,
          caseId,
          eventType: OutboxEventType.ConditionOpened,
          payload: {
            caseId,
            conditionId: condition.id,
            code: condition.code,
            policyVersionId: args.policyVersionId,
            ruleId: args.ruleId,
            policySnapshotId: args.policySnapshotId,
          },
        });
        await writeOutboxEvent(manager, deps.outboxSigningSecret, {
          tenantId,
          caseId,
          eventType: OutboxEventType.WorkflowRunWaitingForReview,
          payload: { caseId, conditionId: condition.id },
        });
        return { conditionId: condition.id };
      });
    },
  };
}
