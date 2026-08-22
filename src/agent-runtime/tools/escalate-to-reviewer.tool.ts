import { DataSource, In } from 'typeorm';
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

/**
 * A case already at a terminal or already-under-review status cannot be
 * escalated (M5-023) — `WAITING_FOR_REVIEW` is already this tool's own
 * target state, and `READY_FOR_UNDERWRITING`/`MANUAL_REVIEW`/`CLOSED`
 * would silently regress a case that has already moved past this point.
 * Checked atomically in the same compare-and-swap UPDATE as the version
 * check below, not as a separate read-then-write race.
 */
const ESCALATABLE_STATUSES: CaseStatus[] = [
  CaseStatus.DRAFT,
  CaseStatus.COLLECTING_EVIDENCE,
  CaseStatus.CONDITIONS_OPEN,
  CaseStatus.WAITING_FOR_INFORMATION,
];

export type EscalateToReviewerResult =
  | { outcome: 'ESCALATED' }
  | { outcome: 'STALE_CASE_VERSION' }
  | { outcome: 'INVALID_STATUS'; currentStatus: CaseStatus };

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
 * Not wired into the LangGraph graph's own automatic routing (M5-023):
 * no current run scenario decides to escalate rather than following its
 * existing deterministic routing, and this codebase's own honest
 * self-count (`mandatory-review-triggers.ts`) already detects 4 of
 * Section 9.6's 12 named triggers — inventing a 5th detector with no
 * real backing signal would be exactly the fabricated-coverage trap this
 * codebase's own conventions warn against. Instead given a real REST
 * caller (`POST /v1/loan-cases/{caseId}/escalate`, M5-023): a human
 * reviewer's own judgment call to pause a case the Agent's automatic
 * routing hasn't (yet) caught, the same "give the tool to a human
 * instead of a fabricated Agent decision" shape M5-022 already used for
 * `send_information_request`.
 */
export function escalateToReviewerTool(
  deps: EscalateToReviewerToolDeps,
): AgentTool<EscalateToReviewerArgs, EscalateToReviewerResult> {
  return {
    name: 'escalate_to_reviewer',
    purpose: 'Pause and create review task',
    sideEffect: 'WORKFLOW_TRANSITION',
    budget: { tokenUnits: 0, providerCallUnits: 0, costMinorUnits: 0 },
    approvalBoundary: 'No',
    async execute({ tenantId, caseId }, args) {
      return runInTenantContext(deps.dataSource, tenantId, async (manager) => {
        const caseRepo = manager.getRepository(LoanCase);
        const updateResult = await caseRepo.update(
          {
            id: caseId,
            tenantId,
            version: args.expectedCaseVersion,
            status: In(ESCALATABLE_STATUSES),
          },
          { status: CaseStatus.WAITING_FOR_REVIEW },
        );
        if (updateResult.affected === 0) {
          const current = await caseRepo.findOneBy({
            id: caseId,
            tenantId,
          });
          if (!current) {
            throw new Error(`case ${caseId} not found`);
          }
          if (current.version !== args.expectedCaseVersion) {
            return { outcome: 'STALE_CASE_VERSION' as const };
          }
          return {
            outcome: 'INVALID_STATUS' as const,
            currentStatus: current.status,
          };
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
