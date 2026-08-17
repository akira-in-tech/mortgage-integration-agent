import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export interface EvaluationManifestEvidenceRef {
  evidenceId: string;
  version: number;
  contentHash: string;
  validThrough: string | null;
}

/**
 * Section 10.5's `EvaluationInputManifest`, honestly scoped: fields with a
 * real backing subsystem today are populated from that subsystem;
 * `authorizationDecisionId`, `consentVersionRefs`, and
 * `modelAndPromptManifestId` stay null/empty because no authorization-grant,
 * consent-versioning, or Agent model-call subsystem exists yet (the M3
 * Agent's own `consentStatus` is itself a hardcoded 'VALID' placeholder —
 * see `lending-operations-agent-runtime.ts` — so there is no real consent
 * *version* to reference). `calculationRefs` stays empty for the same
 * reason: no calculation subsystem exists. Persisted once per evaluation
 * that goes on to justify a condition write — `create-condition.tool.ts`'s
 * own compare-and-swap on `LoanCase.version` remains the actual
 * enforcement; this table is the durable, evidence-backed audit record of
 * exactly what that evaluation read, not a new gate.
 */
@Entity('evaluation_input_manifests')
@Index('IDX_evaluation_input_manifests_case', ['tenantId', 'caseId'])
export class EvaluationInputManifest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  caseId!: string;

  @Column({ type: 'integer' })
  caseVersion!: number;

  /** No authorization-grant subsystem exists yet (Section 11) — always null until one does. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  authorizationDecisionId!: string | null;

  /** No consent-versioning subsystem exists yet — always empty until one does. */
  @Column({ type: 'jsonb' })
  consentVersionRefs!: string[];

  @Column({ type: 'jsonb' })
  evidenceRefs!: EvaluationManifestEvidenceRef[];

  /** No calculation subsystem exists yet — always empty until one does. */
  @Column({ type: 'jsonb' })
  calculationRefs!: Array<{ calculationId: string; version: string }>;

  @Column({ type: 'uuid' })
  policyBindingId!: string;

  @Column({ type: 'varchar', length: 64 })
  observedPolicyDependencyDigest!: string;

  @Column({ type: 'varchar', length: 20 })
  evaluatorVersion!: string;

  /** The M3 Agent graph makes no model calls — always null until one does. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  modelAndPromptManifestId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'varchar', length: 64 })
  manifestHash!: string;
}
