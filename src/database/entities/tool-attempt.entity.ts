import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AgentRun } from './agent-run.entity';
import { ToolAttemptOutcome } from '../enums/agent-run.enum';

/**
 * Section 14.1's `tool_attempts`: "Arguments hash, result hash, side
 * effect, and outcome." Simplified to `outcome` + a free-text `detail`
 * (the same summary `ToolAttemptSummary` already carried in memory) —
 * no argument/result hashing exists yet (Known gap; would need a
 * digest convention for arbitrary tool args/results, not yet needed by
 * anything real). One row per entry in a completed run's
 * `LendingOperationsAgentState.attemptedTools`.
 */
@Entity('tool_attempts')
@Index('IDX_tool_attempts_agent_run', ['agentRunId'])
export class ToolAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  agentRunId!: string;

  @ManyToOne(() => AgentRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agentRunId' })
  agentRun?: AgentRun;

  @Column({ type: 'varchar', length: 100 })
  toolName!: string;

  @Column({ type: 'enum', enum: ToolAttemptOutcome })
  outcome!: ToolAttemptOutcome;

  @Column({ type: 'text', nullable: true })
  detail!: string | null;

  @Column({ type: 'timestamptz' })
  attemptedAt!: Date;
}
