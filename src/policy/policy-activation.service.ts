import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PolicyVersion } from '../database/entities/policy-version.entity';
import { PolicyCatalogGeneration } from '../database/entities/policy-catalog-generation.entity';
import { PolicyChangeImpactAssessment } from '../database/entities/policy-change-impact-assessment.entity';
import { PolicyReleaseStatus } from '../database/enums/policy-version.enum';
import { PolicyChangeImpactService } from './policy-change-impact.service';
import { PolicyTransitionApprovalService } from './policy-transition-approval.service';
import { AuditEventService } from '../audit/audit-event.service';
import { PLATFORM_AUDIT_TENANT_ID } from '../audit/platform-audit-tenant';

export interface PolicyActivationResult {
  policyVersionId: string;
  generation: number;
  assessments: PolicyChangeImpactAssessment[];
}

async function bumpCatalogGeneration(manager: EntityManager): Promise<number> {
  await manager.increment(PolicyCatalogGeneration, { id: 1 }, 'generation', 1);
  const row = await manager.findOneByOrFail(PolicyCatalogGeneration, {
    id: 1,
  });
  return row.generation;
}

/**
 * Section 10.2's lifecycle verbs — "activate without mutating prior
 * versions," "supersede, correct, withdraw, or retire while retaining
 * history." `activate()` now requires a real, independently-approved
 * `PolicyTransitionApproval` (Section 16.1: "separate policy-author and
 * policy-approver roles, with independent approval for releases and
 * transition logic") — closing the gap this service's own comment
 * documented since M3-011. `withdraw()` has no such gate yet — Section
 * 16.1's language and M3-011's original gap were both specifically about
 * *activation*; extending the same gate to withdrawal is a deliberately
 * separate, not-yet-built extension (Known gap). Every activation or
 * withdrawal bumps `PolicyCatalogGeneration` (Section 10.4's fast-path
 * key) and triggers `PolicyChangeImpactService` so the dry-run
 * assessment Section 10.6 requires actually happens, not just the
 * invalidation.
 *
 * Section 10.4 also says activation "emits invalidation events" — the M3
 * audit found that neither `activate()` nor `withdraw()` ever recorded
 * one anywhere (the generation bump itself is silent; nothing observes
 * it happening). `OutboxEvent` can't carry this: it requires a `caseId`
 * (Section 12.2's per-case transactional outbox), and a catalog
 * activation isn't scoped to any one case. `AuditEventService` is this
 * codebase's other real event-recording mechanism and has no such
 * constraint, so that's what records it here (M7-028) — under
 * `PLATFORM_AUDIT_TENANT_ID` because the policy catalog is shared across
 * every tenant, not owned by one (`Jurisdiction`'s own "policy catalog is
 * deliberately global" note).
 */
@Injectable()
export class PolicyActivationService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(PolicyVersion)
    private readonly versionRepository: Repository<PolicyVersion>,
    private readonly impactService: PolicyChangeImpactService,
    private readonly transitionApprovalService: PolicyTransitionApprovalService,
    private readonly auditEventService: AuditEventService,
  ) {}

  async activate(
    policyVersionId: string,
    actorId: string,
  ): Promise<PolicyActivationResult> {
    const version = await this.versionRepository.findOneByOrFail({
      id: policyVersionId,
    });
    if (
      version.releaseStatus !== PolicyReleaseStatus.DRAFT &&
      version.releaseStatus !== PolicyReleaseStatus.PROPOSED
    ) {
      throw new BadRequestException(
        `policy version ${policyVersionId} cannot be activated from status ${version.releaseStatus}`,
      );
    }
    const approved =
      await this.transitionApprovalService.hasApprovedTransition(
        policyVersionId,
      );
    if (!approved) {
      throw new BadRequestException(
        `policy version ${policyVersionId} has no independently-approved transition proposal — call PolicyTransitionApprovalService.propose()/approve() first`,
      );
    }

    const generation = await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(PolicyVersion)
        .update(
          { id: policyVersionId },
          { releaseStatus: PolicyReleaseStatus.RELEASED },
        );
      return bumpCatalogGeneration(manager);
    });

    const assessments = await this.impactService.assessImpact(policyVersionId);

    await this.auditEventService.record({
      tenantId: PLATFORM_AUDIT_TENANT_ID,
      actorId,
      action: 'POLICY_VERSION_ACTIVATED',
      resourceType: 'policy_version',
      resourceId: policyVersionId,
      metadata: { generation, assessmentCount: assessments.length },
    });
    return { policyVersionId, generation, assessments };
  }

  async withdraw(
    policyVersionId: string,
    actorId: string,
  ): Promise<PolicyActivationResult> {
    const version = await this.versionRepository.findOneByOrFail({
      id: policyVersionId,
    });
    if (version.releaseStatus !== PolicyReleaseStatus.RELEASED) {
      throw new BadRequestException(
        `policy version ${policyVersionId} cannot be withdrawn from status ${version.releaseStatus}`,
      );
    }

    const generation = await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(PolicyVersion)
        .update(
          { id: policyVersionId },
          { releaseStatus: PolicyReleaseStatus.WITHDRAWN },
        );
      return bumpCatalogGeneration(manager);
    });

    const assessments = await this.impactService.assessImpact(policyVersionId);

    await this.auditEventService.record({
      tenantId: PLATFORM_AUDIT_TENANT_ID,
      actorId,
      action: 'POLICY_VERSION_WITHDRAWN',
      resourceType: 'policy_version',
      resourceId: policyVersionId,
      metadata: { generation, assessmentCount: assessments.length },
    });
    return { policyVersionId, generation, assessments };
  }
}
