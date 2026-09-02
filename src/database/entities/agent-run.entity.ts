import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import {
  AgentRunRouteStatus,
  ReviewCategoryStatus,
} from '../enums/agent-run.enum';
import { AgentModelInvocation } from './agent-model-invocation.entity';

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

  /** Section 9.6's mandatory-review category this run's review request belongs to (M3-021) — null for a run that never requested review. */
  @Column({ type: 'enum', enum: ReviewCategoryStatus, nullable: true })
  reviewCategory!: ReviewCategoryStatus | null;

  /** Null for deterministic runs; otherwise references the bounded routing call. */
  @Column({ type: 'uuid', nullable: true })
  modelInvocationId!: string | null;

  @ManyToOne(() => AgentModelInvocation, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'modelInvocationId',
    foreignKeyConstraintName: 'FK_agent_runs_model_invocation',
  })
  modelInvocation?: AgentModelInvocation | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  modelVersion!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  promptVersion!: string | null;

  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  completedAt!: Date;
}
