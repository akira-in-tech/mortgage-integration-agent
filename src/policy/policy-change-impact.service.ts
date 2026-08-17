import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PolicyApplicability } from '../database/entities/policy-applicability.entity';
import { CasePolicyBinding } from '../database/entities/case-policy-binding.entity';
import { CasePolicySnapshot } from '../database/entities/case-policy-snapshot.entity';
import { LoanCase } from '../database/entities/loan-case.entity';
import { PolicyChangeImpactAssessment } from '../database/entities/policy-change-impact-assessment.entity';
import { PolicyChangeImpactKind } from '../database/enums/policy-change-impact.enum';
import { PolicyApplicabilityResolverService } from './policy-applicability-resolver.service';
import { loanTypeToProductCode } from './product-code';
import { PolicyResolutionResult } from './policy-resolution.types';

function classifyImpact(
  priorSnapshot: CasePolicySnapshot,
  dryRun: PolicyResolutionResult,
): { impact: PolicyChangeImpactKind; details: string } {
  if (dryRun.status === 'REVIEW_REQUIRED') {
    return {
      impact: PolicyChangeImpactKind.AMBIGUOUS,
      details:
        dryRun.unresolvedReasons.join('; ') || 'policy resolution unresolved',
    };
  }
  const priorIds = new Set(
    priorSnapshot.versions.map((v) => v.policyVersionId),
  );
  const newIds = new Set(dryRun.versions.map((v) => v.policyVersionId));
  const unchanged =
    priorIds.size === newIds.size &&
    [...priorIds].every((id) => newIds.has(id));
  if (unchanged) {
    return {
      impact: PolicyChangeImpactKind.NO_IMPACT,
      details: 'resolved policy version set is unchanged for this case',
    };
  }
  return {
    impact: PolicyChangeImpactKind.REQUIRES_REEVALUATION,
    details: `resolved policy version set changed from [${[...priorIds].join(', ')}] to [${[...newIds].join(', ')}]`,
  };
}

/**
 * Section 10.6: "applicability index finds potentially affected open
 * cases -> dry-run compares old and proposed snapshots." Triggered by
 * `PolicyActivationService` after an activation or withdrawal actually
 * commits — advisory only (Section 10.6: "Impact assessment is advisory
 * until an authorized reviewer approves the transition configuration"):
 * this never mutates a case's binding or snapshot itself, it only
 * records what the dry run found. A case's *next* real evaluation (via
 * `PolicyEvaluationService`, already forced onto the slow path by the
 * generation bump this triggered from) is what actually applies any
 * change.
 *
 * Known gap: no transition-rule/grandfathering evaluation (Section 10.6's
 * "future-effective" and "approved grandfathering" outcomes) — only
 * NO_IMPACT / REQUIRES_REEVALUATION / AMBIGUOUS are distinguished.
 */
@Injectable()
export class PolicyChangeImpactService {
  constructor(
    @InjectRepository(PolicyApplicability)
    private readonly applicabilityRepository: Repository<PolicyApplicability>,
    @InjectRepository(CasePolicyBinding)
    private readonly bindingRepository: Repository<CasePolicyBinding>,
    @InjectRepository(CasePolicySnapshot)
    private readonly snapshotRepository: Repository<CasePolicySnapshot>,
    @InjectRepository(LoanCase)
    private readonly caseRepository: Repository<LoanCase>,
    @InjectRepository(PolicyChangeImpactAssessment)
    private readonly assessmentRepository: Repository<PolicyChangeImpactAssessment>,
    private readonly resolver: PolicyApplicabilityResolverService,
  ) {}

  async assessImpact(
    policyVersionId: string,
  ): Promise<PolicyChangeImpactAssessment[]> {
    const applicabilityRows = await this.applicabilityRepository.find({
      where: { policyVersionId },
    });

    const seenTriples = new Set<string>();
    const assessments: PolicyChangeImpactAssessment[] = [];

    for (const applicability of applicabilityRows) {
      const tripleKey = `${applicability.jurisdictionCode}|${applicability.productCode}|${applicability.lifecycleEvent}`;
      if (seenTriples.has(tripleKey)) {
        continue;
      }
      seenTriples.add(tripleKey);

      const candidateCases = await this.caseRepository.find({
        where: { jurisdictionCode: applicability.jurisdictionCode },
      });
      const affectedCases = candidateCases.filter(
        (c) => loanTypeToProductCode(c.loanType) === applicability.productCode,
      );

      for (const loanCase of affectedCases) {
        const activeBinding = await this.bindingRepository.findOne({
          where: {
            tenantId: loanCase.tenantId,
            caseId: loanCase.id,
            invalidatedAt: IsNull(),
          },
          order: { boundAt: 'DESC' },
        });
        if (!activeBinding) {
          // No live binding to impact — this case has never been
          // evaluated, or its last evaluation was already REVIEW_REQUIRED
          // (which invalidates any binding rather than creating one).
          continue;
        }

        const priorSnapshot = await this.snapshotRepository.findOneByOrFail({
          id: activeBinding.policySnapshotId,
        });
        const dryRun = await this.resolver.resolve({
          jurisdictionCode: applicability.jurisdictionCode,
          productCode: applicability.productCode,
          lifecycleEvent: applicability.lifecycleEvent,
          asOf: new Date(),
        });
        const { impact, details } = classifyImpact(priorSnapshot, dryRun);

        const assessment = await this.assessmentRepository.save(
          this.assessmentRepository.create({
            policyVersionId,
            tenantId: loanCase.tenantId,
            caseId: loanCase.id,
            priorPolicyBindingId: activeBinding.id,
            impact,
            details,
          }),
        );
        assessments.push(assessment);
      }
    }

    return assessments;
  }
}
