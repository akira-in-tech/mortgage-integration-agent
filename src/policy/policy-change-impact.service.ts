import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { PolicyApplicability } from '../database/entities/policy-applicability.entity';
import { CasePolicyBinding } from '../database/entities/case-policy-binding.entity';
import { CasePolicySnapshot } from '../database/entities/case-policy-snapshot.entity';
import { LoanCase } from '../database/entities/loan-case.entity';
import { PolicyChangeImpactAssessment } from '../database/entities/policy-change-impact-assessment.entity';
import { PolicyChangeImpactKind } from '../database/enums/policy-change-impact.enum';
import { PolicyApplicabilityResolverService } from './policy-applicability-resolver.service';
import { loanTypeToProductCode } from './product-code';
import { UNDERWRITING_REVIEW_LIFECYCLE_EVENT } from './lifecycle-events';
import { PolicyResolutionResult } from './policy-resolution.types';
import {
  runInTenantContext,
  runWithRlsBypass,
} from '../database/tenant-context';

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
 *
 * `policy_change_impact_assessments` carries a real RLS policy (M5-008);
 * `assessOneCase` below takes an `EntityManager` rather than owning its
 * own repositories, since its two callers need different tenant
 * contexts — `assessImpact`'s cross-tenant candidate scan (genuinely
 * cross-tenant by design, `runWithRlsBypass`) vs. `assessImpactForCase`'s
 * single, already-known tenant (`runInTenantContext`) — the same
 * bypass-for-discovery-then-per-item-context split
 * `WebhookDispatchService`'s due-delivery scan already uses.
 * `case_policy_bindings`/`case_policy_snapshots` themselves still have no
 * RLS policy of their own (separately deferred); running their reads
 * through the same manager is harmless today and becomes protective
 * automatically once that table group gets its own migration.
 */
@Injectable()
export class PolicyChangeImpactService {
  constructor(
    @InjectRepository(PolicyApplicability)
    private readonly applicabilityRepository: Repository<PolicyApplicability>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
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

      // Genuinely cross-tenant by design (Section 10.6: "applicability
      // index finds potentially affected open cases" across the whole
      // catalog, not one tenant's own) — the same explicit, audited
      // bypass WebhookDispatchService's due-delivery scan uses.
      const candidateCases = await runWithRlsBypass(
        this.dataSource,
        (manager) =>
          manager.getRepository(LoanCase).find({
            where: { jurisdictionCode: applicability.jurisdictionCode },
          }),
      );
      const affectedCases = candidateCases.filter(
        (c) => loanTypeToProductCode(c.loanType) === applicability.productCode,
      );

      for (const loanCase of affectedCases) {
        // Each case's own binding/snapshot read and assessment write runs
        // under that case's own tenant context, not the bypass above —
        // the bypass is scoped as narrowly as possible, to the candidate
        // discovery scan alone.
        const assessment = await runInTenantContext(
          this.dataSource,
          loanCase.tenantId,
          (manager) =>
            this.assessOneCase(manager, loanCase, {
              policyVersionId,
              jurisdictionCode: applicability.jurisdictionCode,
              productCode: applicability.productCode,
              lifecycleEvent: applicability.lifecycleEvent,
            }),
        );
        if (assessment) {
          assessments.push(assessment);
        }
      }
    }

    return assessments;
  }

  /**
   * The per-case counterpart to `assessImpact`, for Section 9.4's
   * `check_policy_change_impact` tool: one specific case asking "does this
   * policy change affect me?" rather than the catalog-wide "which open
   * cases does this change affect?" scan `assessImpact` runs after an
   * activation/withdrawal. Derives the case's own applicability triple
   * directly from its own jurisdiction/product/lifecycle-event (the same
   * ones `evaluatePolicyNode` uses) rather than requiring the caller to
   * already know it.
   *
   * Returns `null` when the case has no live binding to compare against —
   * the same "nothing to assess" case `assessImpact`'s loop silently skips.
   */
  async assessImpactForCase(
    tenantId: string,
    caseId: string,
    policyVersionId: string,
  ): Promise<PolicyChangeImpactAssessment | null> {
    return runInTenantContext(this.dataSource, tenantId, async (manager) => {
      const loanCase = await manager.getRepository(LoanCase).findOneByOrFail({
        id: caseId,
        tenantId,
      });
      return this.assessOneCase(manager, loanCase, {
        policyVersionId,
        jurisdictionCode: loanCase.jurisdictionCode,
        productCode: loanTypeToProductCode(loanCase.loanType),
        lifecycleEvent: UNDERWRITING_REVIEW_LIFECYCLE_EVENT,
      });
    });
  }

  private async assessOneCase(
    manager: EntityManager,
    loanCase: LoanCase,
    context: {
      policyVersionId: string;
      jurisdictionCode: string;
      productCode: string;
      lifecycleEvent: string;
    },
  ): Promise<PolicyChangeImpactAssessment | null> {
    const activeBinding = await manager
      .getRepository(CasePolicyBinding)
      .findOne({
        where: {
          tenantId: loanCase.tenantId,
          caseId: loanCase.id,
          invalidatedAt: IsNull(),
        },
        order: { boundAt: 'DESC' },
      });
    if (!activeBinding) {
      // No live binding to impact — this case has never been evaluated,
      // or its last evaluation was already REVIEW_REQUIRED (which
      // invalidates any binding rather than creating one).
      return null;
    }

    const priorSnapshot = await manager
      .getRepository(CasePolicySnapshot)
      .findOneByOrFail({ id: activeBinding.policySnapshotId });
    const dryRun = await this.resolver.resolve({
      jurisdictionCode: context.jurisdictionCode,
      productCode: context.productCode,
      lifecycleEvent: context.lifecycleEvent,
      asOf: new Date(),
    });
    const { impact, details } = classifyImpact(priorSnapshot, dryRun);

    const assessmentRepo = manager.getRepository(PolicyChangeImpactAssessment);
    return assessmentRepo.save(
      assessmentRepo.create({
        policyVersionId: context.policyVersionId,
        tenantId: loanCase.tenantId,
        caseId: loanCase.id,
        priorPolicyBindingId: activeBinding.id,
        impact,
        details,
      }),
    );
  }
}
