import {
  Column,
  Check,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Immutable, content-free evidence for one bounded model routing call. Prompt
 * and response bodies are represented only by SHA-256 digests; the persisted
 * action is a two-value control route, never a credit or policy decision.
 */
@Entity('agent_model_invocations')
@Check(
  'CHK_agent_model_invocation_action',
  `"nextAction" IN ('EVALUATE_POLICY','REQUEST_HUMAN_REVIEW')`,
)
@Check(
  'CHK_agent_model_invocation_reason',
  `"reasonCode" IN ('POLICY_EVALUATION_REQUIRED','HUMAN_REVIEW_REQUIRED')`,
)
@Check(
  'CHK_agent_model_invocation_route_reason',
  `("nextAction" = 'EVALUATE_POLICY' AND "reasonCode" = 'POLICY_EVALUATION_REQUIRED') OR ("nextAction" = 'REQUEST_HUMAN_REVIEW' AND "reasonCode" = 'HUMAN_REVIEW_REQUIRED')`,
)
@Check(
  'CHK_agent_model_invocation_confidence',
  `"confidenceBasisPoints" BETWEEN 0 AND 10000`,
)
@Check('CHK_agent_model_invocation_tokens', `"accountedTokenUnits" > 0`)
@Index(
  'UQ_agent_model_invocations_replay',
  ['tenantId', 'workflowRunId', 'caseVersion', 'modelVersion', 'promptVersion'],
  { unique: true },
)
@Index('IDX_agent_model_invocations_case', ['tenantId', 'caseId'])
export class AgentModelInvocation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  caseId!: string;

  @Column({ type: 'integer' })
  caseVersion!: number;

  @Column({ type: 'varchar', length: 200 })
  workflowRunId!: string;

  @Column({ type: 'varchar', length: 200 })
  modelVersion!: string;

  @Column({ type: 'varchar', length: 100 })
  promptVersion!: string;

  @Column({ type: 'varchar', length: 30 })
  nextAction!: 'EVALUATE_POLICY' | 'REQUEST_HUMAN_REVIEW';

  @Column({ type: 'varchar', length: 40 })
  reasonCode!: 'POLICY_EVALUATION_REQUIRED' | 'HUMAN_REVIEW_REQUIRED';

  @Column({ type: 'integer' })
  confidenceBasisPoints!: number;

  @Column({ type: 'integer' })
  accountedTokenUnits!: number;

  @Column({ type: 'varchar', length: 64 })
  requestDigest!: string;

  @Column({ type: 'varchar', length: 64 })
  responseDigest!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
