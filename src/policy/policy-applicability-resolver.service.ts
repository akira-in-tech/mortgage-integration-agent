import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import { PolicyApplicability } from '../database/entities/policy-applicability.entity';
import { PolicySource } from '../database/entities/policy-source.entity';
import { PolicySourceRevision } from '../database/entities/policy-source-revision.entity';
import { PolicyVersion } from '../database/entities/policy-version.entity';
import { JurisdictionCoverageStatus } from '../database/enums/jurisdiction.enum';
import { PolicyReleaseStatus } from '../database/enums/policy-version.enum';
import { parsePolicyRule } from './dsl/policy-rule-parser';
import {
  PolicyResolutionContext,
  PolicyResolutionResult,
  ResolvedPolicyVersionRef,
} from './policy-resolution.types';
import { PolicyResearchService } from './policy-research.service';

/**
 * Section 10.3's fail-closed applicability resolver. It walks the complete
 * jurisdiction ancestry, verifies every declared source against its own
 * freshness objective, and applies an allowlisted transition-rule strategy
 * before selecting released versions. Unknown hierarchy, stale coverage,
 * unsupported transition semantics, or overlapping versions are review
 * conditions; the resolver never guesses a precedence rule.
 */
@Injectable()
export class PolicyApplicabilityResolverService {
  constructor(
    @InjectRepository(Jurisdiction)
    private readonly jurisdictionRepository: Repository<Jurisdiction>,
    @InjectRepository(PolicyApplicability)
    private readonly applicabilityRepository: Repository<PolicyApplicability>,
    @InjectRepository(PolicyVersion)
    private readonly policyVersionRepository: Repository<PolicyVersion>,
    @InjectRepository(PolicySource)
    private readonly policySourceRepository: Repository<PolicySource>,
    @InjectRepository(PolicySourceRevision)
    private readonly sourceRevisionRepository: Repository<PolicySourceRevision>,
    @Optional()
    private readonly policyResearchService?: PolicyResearchService,
  ) {}

  async resolve(
    context: PolicyResolutionContext,
  ): Promise<PolicyResolutionResult> {
    const unresolvedReasons: string[] = [];

    const ancestry = await this.loadCoveredAncestry(
      context.jurisdictionCode,
      unresolvedReasons,
    );
    if (!ancestry) {
      await this.policyResearchService?.requestForUnresolvedResolution(
        context,
        unresolvedReasons,
      );
      return { status: 'REVIEW_REQUIRED', versions: [], unresolvedReasons };
    }

    const knowledgeAsOf = new Date();
    const sourceFreshnessDeadline = await this.validateSourceFreshness(
      ancestry.map((jurisdiction) => jurisdiction.code),
      knowledgeAsOf,
      unresolvedReasons,
    );
    if (unresolvedReasons.length > 0) {
      await this.policyResearchService?.requestForUnresolvedResolution(
        context,
        unresolvedReasons,
      );
      return { status: 'REVIEW_REQUIRED', versions: [], unresolvedReasons };
    }

    const applicabilityRows = await this.applicabilityRepository.find({
      where: {
        jurisdictionCode: In(ancestry.map((jurisdiction) => jurisdiction.code)),
        productCode: context.productCode,
        lifecycleEvent: context.lifecycleEvent,
      },
    });

    const candidatesByRuleId = new Map<
      string,
      Array<{ applicability: PolicyApplicability; version: PolicyVersion }>
    >();
    const scheduledBoundaries: Date[] = [];
    const policyVersions = applicabilityRows.length
      ? await this.policyVersionRepository.find({
          where: {
            id: In(applicabilityRows.map((row) => row.policyVersionId)),
          },
        })
      : [];
    const policyVersionById = new Map(
      policyVersions.map((version) => [version.id, version]),
    );

    for (const applicability of applicabilityRows) {
      const version = policyVersionById.get(applicability.policyVersionId);
      if (!version || version.releaseStatus !== PolicyReleaseStatus.RELEASED) {
        continue;
      }
      const applicabilityInstant = this.resolveApplicabilityInstant(
        applicability,
        context,
        unresolvedReasons,
      );
      if (!applicabilityInstant) {
        continue;
      }
      if (version.effectiveFrom.getTime() > applicabilityInstant.getTime()) {
        if (
          applicability.transitionRule !==
          'application_received_on_or_after_effective_date'
        ) {
          scheduledBoundaries.push(version.effectiveFrom);
        }
        continue;
      }
      if (
        version.effectiveTo &&
        version.effectiveTo.getTime() <= applicabilityInstant.getTime()
      ) {
        continue;
      }
      if (
        version.effectiveTo &&
        applicability.transitionRule !==
          'application_received_on_or_after_effective_date'
      ) {
        scheduledBoundaries.push(version.effectiveTo);
      }
      const bucket = candidatesByRuleId.get(version.ruleId) ?? [];
      bucket.push({ applicability, version });
      candidatesByRuleId.set(version.ruleId, bucket);
    }

    const versions: ResolvedPolicyVersionRef[] = [];
    for (const [ruleId, candidates] of candidatesByRuleId) {
      if (candidates.length > 1) {
        // Two released, simultaneously-effective versions of the same
        // rule — an unresolved precedence conflict (Section 10.3:
        // "overlapping versions ... produces REVIEW_REQUIRED"), not
        // something to guess at by picking the newest.
        unresolvedReasons.push(
          `rule "${ruleId}" has ${candidates.length} overlapping released versions effective as of ${context.asOf.toISOString()}`,
        );
        continue;
      }
      const { version } = candidates[0];
      versions.push({
        policyVersionId: version.id,
        ruleId: version.ruleId,
        version: version.version,
        rule: parsePolicyRule(version.dsl),
        effectiveFrom: version.effectiveFrom,
        effectiveTo: version.effectiveTo,
      });
    }

    if (unresolvedReasons.length > 0) {
      await this.policyResearchService?.requestForUnresolvedResolution(
        context,
        unresolvedReasons,
      );
      return { status: 'REVIEW_REQUIRED', versions: [], unresolvedReasons };
    }
    // Source deadlines are authoritative even when no rule applies. The
    // evaluation service combines this with its maximum validation interval.
    const revalidateAfter = [sourceFreshnessDeadline, ...scheduledBoundaries]
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    return {
      status: 'RESOLVED',
      versions,
      unresolvedReasons: [],
      revalidateAfter,
    };
  }

  private async loadCoveredAncestry(
    leafCode: string,
    unresolvedReasons: string[],
  ): Promise<Jurisdiction[] | null> {
    const ancestry: Jurisdiction[] = [];
    const visited = new Set<string>();
    let nextCode: string | null = leafCode;

    while (nextCode) {
      if (visited.has(nextCode)) {
        unresolvedReasons.push(
          `jurisdiction ancestry contains a cycle at "${nextCode}"`,
        );
        return null;
      }
      visited.add(nextCode);

      const jurisdiction = await this.jurisdictionRepository.findOneBy({
        code: nextCode,
      });
      if (!jurisdiction) {
        unresolvedReasons.push(
          `jurisdiction ancestry references unknown code "${nextCode}"`,
        );
        return null;
      }
      if (jurisdiction.coverageStatus !== JurisdictionCoverageStatus.COVERED) {
        unresolvedReasons.push(
          `jurisdiction "${nextCode}" does not have reviewed COVERED status`,
        );
        return null;
      }
      ancestry.push(jurisdiction);
      nextCode = jurisdiction.parentCode;
    }

    return ancestry;
  }

  private async validateSourceFreshness(
    jurisdictionCodes: string[],
    knowledgeAsOf: Date,
    unresolvedReasons: string[],
  ): Promise<Date | undefined> {
    const sources = await this.policySourceRepository.find({
      where: { jurisdictionCode: In(jurisdictionCodes) },
    });
    const sourcesByJurisdiction = new Map<string, PolicySource[]>();
    for (const source of sources) {
      const bucket = sourcesByJurisdiction.get(source.jurisdictionCode) ?? [];
      bucket.push(source);
      sourcesByJurisdiction.set(source.jurisdictionCode, bucket);
    }

    for (const jurisdictionCode of jurisdictionCodes) {
      if (!(sourcesByJurisdiction.get(jurisdictionCode)?.length ?? 0)) {
        unresolvedReasons.push(
          `jurisdiction "${jurisdictionCode}" has no registered policy source`,
        );
      }
    }
    if (sources.length === 0) return undefined;

    const revisions = await this.sourceRevisionRepository.find({
      where: { policySourceId: In(sources.map((source) => source.id)) },
      order: { recordedAt: 'DESC' },
    });
    const latestRevisionBySource = new Map<string, PolicySourceRevision>();
    for (const revision of revisions) {
      if (!latestRevisionBySource.has(revision.policySourceId)) {
        latestRevisionBySource.set(revision.policySourceId, revision);
      }
    }

    let earliestDeadline: Date | undefined;
    for (const source of sources) {
      const revision = latestRevisionBySource.get(source.id);
      if (!revision) {
        unresolvedReasons.push(
          `policy source "${source.name}" has no recorded revision`,
        );
        continue;
      }
      if (source.freshnessObjectiveHours <= 0) {
        unresolvedReasons.push(
          `policy source "${source.name}" has an invalid freshness objective`,
        );
        continue;
      }
      const deadline = new Date(
        revision.recordedAt.getTime() +
          source.freshnessObjectiveHours * 60 * 60 * 1000,
      );
      if (deadline.getTime() <= knowledgeAsOf.getTime()) {
        unresolvedReasons.push(
          `policy source "${source.name}" exceeded its freshness objective at ${deadline.toISOString()}`,
        );
        continue;
      }
      if (!earliestDeadline || deadline < earliestDeadline) {
        earliestDeadline = deadline;
      }
    }
    return earliestDeadline;
  }

  private resolveApplicabilityInstant(
    applicability: PolicyApplicability,
    context: PolicyResolutionContext,
    unresolvedReasons: string[],
  ): Date | null {
    if (!applicability.transitionRule) return context.asOf;

    if (
      applicability.transitionRule ===
      'application_received_on_or_after_effective_date'
    ) {
      if (!context.applicationReceivedAt) {
        unresolvedReasons.push(
          `policy applicability "${applicability.id}" requires the original application receipt time`,
        );
        return null;
      }
      return context.applicationReceivedAt;
    }

    if (applicability.transitionRule === 'evaluation_as_of_effective_date') {
      return context.asOf;
    }

    unresolvedReasons.push(
      `policy applicability "${applicability.id}" uses unsupported transition rule "${applicability.transitionRule}"`,
    );
    return null;
  }
}
