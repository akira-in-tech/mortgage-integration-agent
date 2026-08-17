import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EvaluationInputManifest,
  EvaluationManifestEvidenceRef,
} from '../database/entities/evaluation-input-manifest.entity';
import { EvidenceFact } from '../database/entities/evidence-fact.entity';
import { computeDigest } from './policy-digest';

export interface AssembleManifestInput {
  tenantId: string;
  caseId: string;
  caseVersion: number;
  policyBindingId: string;
  observedPolicyDependencyDigest: string;
  evaluatorVersion: string;
  /** Exactly the evidence facts this evaluation actually read — not every fact on the case (see the entity's own comment). */
  evidence: EvidenceFact[];
}

/**
 * Assembles and persists one immutable `EvaluationInputManifest` row per
 * evaluation that goes on to justify a condition write (Section 10.5).
 * Called from `resolveOutcomeNode` (lending-operations-agent-runtime.ts)
 * right before `create_condition`, the same pairing the charter text
 * itself uses ("condition writes use compare-and-swap... requires a new
 * evaluation manifest").
 */
@Injectable()
export class EvaluationManifestService {
  constructor(
    @InjectRepository(EvaluationInputManifest)
    private readonly manifestRepository: Repository<EvaluationInputManifest>,
  ) {}

  async assemble(
    input: AssembleManifestInput,
  ): Promise<EvaluationInputManifest> {
    const evidenceRefs: EvaluationManifestEvidenceRef[] = input.evidence.map(
      (fact) => ({
        evidenceId: fact.id,
        version: fact.version,
        contentHash: computeDigest(fact.value),
        validThrough: fact.validThrough?.toISOString() ?? null,
      }),
    );

    const contentToHash = {
      tenantId: input.tenantId,
      caseId: input.caseId,
      caseVersion: input.caseVersion,
      authorizationDecisionId: null,
      consentVersionRefs: [] as string[],
      evidenceRefs,
      calculationRefs: [] as Array<{ calculationId: string; version: string }>,
      policyBindingId: input.policyBindingId,
      observedPolicyDependencyDigest: input.observedPolicyDependencyDigest,
      evaluatorVersion: input.evaluatorVersion,
      modelAndPromptManifestId: null,
    };
    const manifestHash = computeDigest(contentToHash);

    return this.manifestRepository.save(
      this.manifestRepository.create({
        ...contentToHash,
        manifestHash,
      }),
    );
  }
}
