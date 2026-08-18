import { DataSource } from 'typeorm';
import { LoanCase, CaseStatus } from '../../database/entities/loan-case.entity';
import { writeOutboxEvent } from '../../database/outbox/outbox-writer';
import { OutboxEventType } from '../../database/outbox/outbox-event-types';
import { AgentTool } from '../agent-tool.types';
import { runInTenantContext } from '../../database/tenant-context';

export interface EscalateToReviewerArgs {
  reason: string;
  /** Same compare-and-swap discipline as `create_condition` (Section 10.5) — checked, not trusted. */
  expectedCaseVersion: number;
}

export type EscalateToReviewerResult =
  { outcome: 'ESCALATED' } | { outcome: 'STALE_CASE_VERSION' };

export interface EscalateToReviewerToolDeps {
  dataSource: DataSource;
  outboxSigningSecret: string;
}

/**
 * Section 9.4's `escalate_to_reviewer`: "Pause and create review task" —
 * the Agent's own explicit choice to stop, distinct from the LangGraph
 * runtime's automatic `INTERRUPTED_FOR_REVIEW`/`ROUTED_TO_MANUAL_REVIEW`
 * routing (ambiguity or a tool/budget failure). Section 9.6 lists many
 * mandatory review triggers (contradictory evidence, prompt-injection
 * signal, tenant risk policy, ...) that have no automatic detector in this
 * codebase yet — this tool is the real, generic escape hatch a future
 * detector (or a human-configured policy) can call.
 *
 * Reuses `CaseStatus.WAITING_FOR_REVIEW` rather than `MANUAL_REVIEW`: per
 * `markWaitingForReview`'s own comment, that status means "paused, can
 * resume" (a reviewer resolves it and work continues), which is what an
 * Agent-initiated escalation is — not `MANUAL_REVIEW`'s "cannot proceed
 * safely within the configured automation boundary" terminal meaning.
 *
 * Not wired into the LangGraph graph today — no current run scenario
 * decides to escalate rather than following its existing deterministic
 * routing (same status `check_case_completeness` had before M3-006, and
 * `draft_information_request` still has, per M3-012).
 */
export function escalateToReviewerTool(
  deps: EscalateToReviewerToolDeps,
): AgentTool<EscalateToReviewerArgs, EscalateToReviewerResult> {
  return {
    name: 'escalate_to_reviewer',
    purpose: 'Pause and create review task',
    sideEffect: 'WORKFLOW_TRANSITION',
    approvalBoundary: 'No',
    async execute({ tenantId, caseId }, args) {
      return runInTenantContext(deps.dataSource, tenantId, async (manager) => {
        const caseRepo = manager.getRepository(LoanCase);
        const updateResult = await caseRepo.update(
          { id: caseId, tenantId, version: args.expectedCaseVersion },
          { status: CaseStatus.WAITING_FOR_REVIEW },
        );
        if (updateResult.affected === 0) {
          const stillExists = await caseRepo.findOneBy({
            id: caseId,
            tenantId,
          });
          if (!stillExists) {
            throw new Error(`case ${caseId} not found`);
          }
          return { outcome: 'STALE_CASE_VERSION' as const };
        }
        await writeOutboxEvent(manager, deps.outboxSigningSecret, {
          tenantId,
          caseId,
          eventType: OutboxEventType.CaseEscalated,
          payload: { caseId, reason: args.reason },
        });
        return { outcome: 'ESCALATED' as const };
      });
    },
  };
}
