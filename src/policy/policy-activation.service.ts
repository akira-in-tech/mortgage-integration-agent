import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PolicyVersion } from '../database/entities/policy-version.entity';
import { PolicyCatalogGeneration } from '../database/entities/policy-catalog-generation.entity';
import { PolicyChangeImpactAssessment } from '../database/entities/policy-change-impact-assessment.entity';
import { PolicyReleaseStatus } from '../database/enums/policy-version.enum';
import { PolicyChangeImpactService } from './policy-change-impact.service';

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
 * history" — made real for the two verbs this codebase can support
 * without a proposal-approval workflow (Known gap; there is no
 * separate policy-author/policy-approver role distinction yet, so this
 * service itself is the whole activation authority for now). Every
 * activation or withdrawal bumps `PolicyCatalogGeneration` (Section
 * 10.4's fast-path key) and triggers `PolicyChangeImpactService` so the
 * dry-run assessment Section 10.6 requires actually happens, not just
 * the invalidation.
 */
@Injectable()
export class PolicyActivationService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(PolicyVersion)
    private readonly versionRepository: Repository<PolicyVersion>,
    private readonly impactService: PolicyChangeImpactService,
  ) {}

  async activate(policyVersionId: string): Promise<PolicyActivationResult> {
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
    return { policyVersionId, generation, assessments };
  }

  async withdraw(policyVersionId: string): Promise<PolicyActivationResult> {
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
    return { policyVersionId, generation, assessments };
  }
}
