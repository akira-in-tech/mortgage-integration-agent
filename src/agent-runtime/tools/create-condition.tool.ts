import { DataSource } from 'typeorm';
import { LoanCase, CaseStatus } from '../../database/entities/loan-case.entity';
import {
  LoanCondition,
  ConditionStatus,
} from '../../database/entities/loan-condition.entity';
import { writeOutboxEvent } from '../../database/outbox/outbox-writer';
import { OutboxEventType } from '../../database/outbox/outbox-event-types';
import { AgentTool } from '../agent-tool.types';
import { runInTenantContext } from '../../database/tenant-context';

export interface CreateConditionArgs {
  code: string;
  description: string;
  policyVersionId: string;
  ruleId: string;
  policySnapshotId: string;
  /**
   * `LoanCase.version` as observed when the evaluation that justified
   * this condition began (Section 10.5: "a concurrent... case mutation
   * cannot alter a running evaluation; it creates a new case version and
   * requires a new evaluation manifest"). Checked, not trusted — see
   * `StaleCaseVersionError`.
   */
  expectedCaseVersion: number;
  /** The `EvaluationInputManifest` (M3-014) assembled for this evaluation, if the caller built one — not every caller does yet. */
  evaluationManifestId?: string;
}

export type CreateConditionResult =
  | { outcome: 'CREATED'; conditionId: string }
  | { outcome: 'STALE_CASE_VERSION' };

export interface CreateConditionToolDeps {
  dataSource: DataSource;
  outboxSigningSecret: string;
}

/**
 * Raised only for the residual race between this tool's own version check
 * and its write within the same transaction (the ordinary case — the case
 * having moved on since the evaluation that's calling this tool began
 * well before this call — is reported as `{ outcome: 'STALE_CASE_VERSION'
 * }` instead, not an exception). Callers let this propagate rather than
 * catching it: Temporal's own activity retry naturally re-runs
 * `evaluateConditions` from scratch against the case's current state,
 * which is exactly what a stale evaluation needs (Section 10.5).
 */
export class StaleCaseVersionError extends Error {
  constructor(caseId: string, expectedVersion: number) {
    super(
      `case ${caseId} version changed during the write (expected ${expectedVersion}); re-evaluation required`,
    );
    this.name = 'StaleCaseVersionError';
  }
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
 *
 * `expectedCaseVersion` implements the compare-and-swap property Section
 * 10.5's `EvaluationInputManifest` exists to guarantee for condition
 * writes — `LoanCase.version`'s own comment has said "Optimistic
 * concurrency for compare-and-swap writes (Section 10.5, 17.1)" since it
 * was added, but nothing actually checked it until now (every write used
 * `Repository.update()`, which TypeORM does not version-guard the way
 * `.save()` on a loaded entity would). `evaluationManifestId` (M3-014)
 * references the actual immutable manifest a caller assembled
 * (`EvaluationManifestService`) — this tool still only checks
 * `expectedCaseVersion` itself, not the manifest's own contents; the
 * manifest is the durable audit record of what justified the write, the
 * version check is what enforces it.
 */
export function createConditionTool(
  deps: CreateConditionToolDeps,
): AgentTool<CreateConditionArgs, CreateConditionResult> {
  return {
    name: 'create_condition',
    purpose: 'Materialize a policy-supported operational condition',
    sideEffect: 'CASE_MUTATION',
    budget: { tokenUnits: 0, providerCallUnits: 0, costMinorUnits: 0 },
    approvalBoundary: 'Validated binding and evaluation required',
    async execute({ tenantId, caseId }, args) {
      return runInTenantContext(deps.dataSource, tenantId, async (manager) => {
        const caseRepo = manager.getRepository(LoanCase);
        const currentCase = await caseRepo.findOneByOrFail({
          id: caseId,
          tenantId,
        });
        if (currentCase.version !== args.expectedCaseVersion) {
          return { outcome: 'STALE_CASE_VERSION' as const };
        }

        const conditionRepo = manager.getRepository(LoanCondition);
        const condition = await conditionRepo.save(
          conditionRepo.create({
            tenantId,
            caseId,
            code: args.code,
            description: args.description,
            status: ConditionStatus.OPEN,
            policySnapshotId: args.policySnapshotId,
            evaluationManifestId: args.evaluationManifestId ?? null,
          }),
        );
        const updateResult = await caseRepo.update(
          { id: caseId, tenantId, version: args.expectedCaseVersion },
          { status: CaseStatus.CONDITIONS_OPEN },
        );
        if (updateResult.affected === 0) {
          // The version check above passed, but the case changed again
          // before this same transaction's write — genuinely exceptional
          // (not the routine "evaluation is old" case above), so this
          // throws rather than returning a typed result, which also
          // rolls back the condition insert.
          throw new StaleCaseVersionError(caseId, args.expectedCaseVersion);
        }
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
        return { outcome: 'CREATED' as const, conditionId: condition.id };
      });
    },
  };
}
