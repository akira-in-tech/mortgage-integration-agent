import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AgentRunRouteStatus } from '../enums/agent-run.enum';

/**
 * Section 14.1's `agent_runs`: "Runtime, model, prompt, budgets, tools,
 * and final route." Before this entity, `LendingOperationsAgentState`
 * (the Agent run's own state — `attemptedTools`, `route`,
 * `proposedAction`, `reviewState`) existed only in memory for the
 * duration of one `AgentRuntimePort.run()` call and was discarded the
 * moment `case-conditions.activities.ts` finished mapping it to an
 * `EvaluateConditionsResult` — no record of what the Agent actually did
 * survived. One row per bounded run, written by
 * `createLendingOperationsAgentRuntime` itself right after
 * `graph.invoke()` completes, so every real run through the live system
 * leaves a durable, queryable record — the basis for the "Agent run
 * timeline" M3's scope names.
 */
@Entity('agent_runs')
@Index('IDX_agent_runs_case', ['tenantId', 'caseId'])
export class AgentRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  caseId!: string;

  @Column({ type: 'varchar', length: 200 })
  workflowRunId!: string;

  @Column({ type: 'enum', enum: AgentRunRouteStatus })
  route!: AgentRunRouteStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  proposedActionTool!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  proposedActionArguments!: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false })
  reviewRequested!: boolean;

  @Column({ type: 'text', nullable: true })
  reviewReason!: string | null;

  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  completedAt!: Date;
}
