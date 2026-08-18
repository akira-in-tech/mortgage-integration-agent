import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { OutboxEvent } from '../database/entities/outbox-event.entity';
import { AgentRun } from '../database/entities/agent-run.entity';
import { ToolAttempt } from '../database/entities/tool-attempt.entity';
import { LoanCondition } from '../database/entities/loan-condition.entity';
import { OutboxEventType } from '../database/outbox/outbox-event-types';

/** A class, not an interface — `CasesController.getTimeline()` returns this directly, and `@nestjs/swagger` needs a real runtime class to introspect into an OpenAPI schema. Object literals still satisfy it structurally. */
export class TimelineEntry {
  @ApiProperty()
  timestamp!: string;

  @ApiProperty({ enum: ['DOMAIN_EVENT', 'AGENT_RUN'] })
  kind!: 'DOMAIN_EVENT' | 'AGENT_RUN';

  /** Evidence-backed: built from real, already-persisted data (a condition's own DSL-evaluator reason, a run's actual tool outcomes) — never a generated or inferred narrative. */
  @ApiProperty()
  summary!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  detail!: Record<string, unknown>;
}

/**
 * Section 7.1's launch scenario (step 17: "display the full timeline...")
 * and Section 15.2 ("GraphQL serves... timelines"): assembles one
 * chronological, human-readable account of a case from data this
 * codebase already persists — `outbox_events` (every domain state
 * change) and `agent_runs`/`tool_attempts` (M3-013's own new
 * persistence) — rather than a new parallel event-log table duplicating
 * what `outbox_events` already captures. `loan_conditions` is joined in
 * only to enrich a `condition.opened` entry with the condition's own
 * `description` (the DSL evaluator's real reason string, e.g.
 * `difference_percent(...) = 19.91% > 10%`) — the "evidence-backed
 * explanation" M3's scope names, not a fresh narrative generated for
 * this purpose.
 */
@Injectable()
export class CaseTimelineService {
  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepository: Repository<OutboxEvent>,
    @InjectRepository(AgentRun)
    private readonly agentRunRepository: Repository<AgentRun>,
    @InjectRepository(ToolAttempt)
    private readonly toolAttemptRepository: Repository<ToolAttempt>,
    @InjectRepository(LoanCondition)
    private readonly conditionRepository: Repository<LoanCondition>,
  ) {}

  async getTimeline(
    tenantId: string,
    caseId: string,
  ): Promise<TimelineEntry[]> {
    const [events, agentRuns, conditions] = await Promise.all([
      this.outboxRepository.find({
        where: { tenantId, caseId },
        order: { createdAt: 'ASC' },
      }),
      this.agentRunRepository.find({
        where: { tenantId, caseId },
        order: { startedAt: 'ASC' },
      }),
      this.conditionRepository.find({ where: { tenantId, caseId } }),
    ]);
    const conditionById = new Map(conditions.map((c) => [c.id, c]));

    const toolAttempts = agentRuns.length
      ? await this.toolAttemptRepository.find({
          where: agentRuns.map((run) => ({ agentRunId: run.id })),
          order: { attemptedAt: 'ASC' },
        })
      : [];
    const attemptsByRunId = new Map<string, ToolAttempt[]>();
    for (const attempt of toolAttempts) {
      const list = attemptsByRunId.get(attempt.agentRunId) ?? [];
      list.push(attempt);
      attemptsByRunId.set(attempt.agentRunId, list);
    }

    const entries: TimelineEntry[] = events.map((event) =>
      this.describeEvent(event, conditionById),
    );

    for (const run of agentRuns) {
      const attempts = attemptsByRunId.get(run.id) ?? [];
      entries.push({
        timestamp: run.completedAt.toISOString(),
        kind: 'AGENT_RUN',
        summary: this.describeAgentRun(run, attempts),
        detail: {
          route: run.route,
          proposedActionTool: run.proposedActionTool,
          reviewRequested: run.reviewRequested,
          reviewReason: run.reviewReason,
          reviewCategory: run.reviewCategory,
          tools: attempts.map((a) => ({
            name: a.toolName,
            outcome: a.outcome,
            detail: a.detail,
          })),
        },
      });
    }

    entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return entries;
  }

  private describeEvent(
    event: OutboxEvent,
    conditionById: Map<string, LoanCondition>,
  ): TimelineEntry {
    let summary: string = event.eventType;
    if (
      event.eventType === OutboxEventType.ConditionOpened &&
      typeof event.payload.conditionId === 'string'
    ) {
      const condition = conditionById.get(event.payload.conditionId);
      if (condition) {
        summary = `Condition ${condition.code} opened: ${condition.description}`;
      }
    }
    return {
      timestamp: event.createdAt.toISOString(),
      kind: 'DOMAIN_EVENT',
      summary,
      detail: event.payload,
    };
  }

  private describeAgentRun(run: AgentRun, attempts: ToolAttempt[]): string {
    const toolsSummary = attempts.length
      ? attempts.map((a) => `${a.toolName}:${a.outcome}`).join(', ')
      : 'no tools attempted';
    const reasonSuffix = run.reviewReason ? ` (${run.reviewReason})` : '';
    return `Agent run reached ${run.route}${reasonSuffix} — ${toolsSummary}`;
  }
}
