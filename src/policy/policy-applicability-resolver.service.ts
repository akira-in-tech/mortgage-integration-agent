import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import { PolicyApplicability } from '../database/entities/policy-applicability.entity';
import { PolicyVersion } from '../database/entities/policy-version.entity';
import { JurisdictionCoverageStatus } from '../database/enums/jurisdiction.enum';
import { PolicyReleaseStatus } from '../database/enums/policy-version.enum';
import { parsePolicyRule } from './dsl/policy-rule-parser';
import {
  PolicyResolutionContext,
  PolicyResolutionResult,
  ResolvedPolicyVersionRef,
} from './policy-resolution.types';

/**
 * A real, but deliberately simplified, implementation of Section 10.3's
 * applicability resolver. What it does: given a jurisdiction, product,
 * lifecycle event, and a point in time, selects every RELEASED
 * `PolicyVersion` whose `PolicyApplicability` matches and whose effective
 * window covers that time, and fails closed to `REVIEW_REQUIRED` on
 * unresolved coverage or overlapping versions of the same rule.
 *
 * What it does not do yet (Known gaps, docs/DEVELOPMENT_LOG.md): walk
 * jurisdiction ancestry (a US-CA case should also match a US-level
 * federal rule — this only matches the exact jurisdiction code given),
 * grandfathering/transition-rule evaluation, dependency-generation-based
 * fast-path validation (Section 10.4), or persisting an immutable
 * `CasePolicySnapshot` — this returns its result in-memory only.
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
  ) {}

  async resolve(
    context: PolicyResolutionContext,
  ): Promise<PolicyResolutionResult> {
    const unresolvedReasons: string[] = [];

    const jurisdiction = await this.jurisdictionRepository.findOneBy({
      code: context.jurisdictionCode,
    });
    if (
      !jurisdiction ||
      jurisdiction.coverageStatus !== JurisdictionCoverageStatus.COVERED
    ) {
      // Section 10.6: "If declared jurisdiction coverage is incomplete...
      // validation stops and routes to review" — never an implicit "no
      // rules apply" default.
      unresolvedReasons.push(
        `jurisdiction "${context.jurisdictionCode}" has no reviewed, covered policy source`,
      );
      return { status: 'REVIEW_REQUIRED', versions: [], unresolvedReasons };
    }

    const applicabilityRows = await this.applicabilityRepository.find({
      where: {
        jurisdictionCode: context.jurisdictionCode,
        productCode: context.productCode,
        lifecycleEvent: context.lifecycleEvent,
      },
    });

    const candidatesByRuleId = new Map<
      string,
      Array<{ applicability: PolicyApplicability; version: PolicyVersion }>
    >();

    for (const applicability of applicabilityRows) {
      const version = await this.policyVersionRepository.findOneBy({
        id: applicability.policyVersionId,
      });
      if (!version || version.releaseStatus !== PolicyReleaseStatus.RELEASED) {
        continue;
      }
      if (version.effectiveFrom.getTime() > context.asOf.getTime()) {
        continue;
      }
      if (
        version.effectiveTo &&
        version.effectiveTo.getTime() <= context.asOf.getTime()
      ) {
        continue;
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
      return { status: 'REVIEW_REQUIRED', versions: [], unresolvedReasons };
    }
    return { status: 'RESOLVED', versions, unresolvedReasons: [] };
  }
}
