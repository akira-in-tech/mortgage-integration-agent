import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CasePolicySnapshot } from '../database/entities/case-policy-snapshot.entity';
import { CasePolicyBinding } from '../database/entities/case-policy-binding.entity';
import { PolicyResolutionStatus } from '../database/enums/policy-resolution-status.enum';
import { PolicyApplicabilityResolverService } from './policy-applicability-resolver.service';
import { computeDigest } from './policy-digest';
import {
  PolicyResolutionContext,
  PolicyResolutionResult,
} from './policy-resolution.types';

const RESOLVER_VERSION = '1.0.0';
// Section 10.4: "configured maximum validation interval" — the one piece
// of revalidateAfter's definition this simplified guard can honestly
// implement without scheduled-activation-boundary or source-freshness
// tracking (see this service's class comment).
const MAX_VALIDATION_INTERVAL_MS = 60 * 60 * 1000;

export type PolicyEvaluationOutcome =
  'REUSED' | 'REFRESHED' | 'REVIEW_REQUIRED';

export interface PolicyEvaluationResult {
  outcome: PolicyEvaluationOutcome;
  resolution: PolicyResolutionResult;
  snapshot: CasePolicySnapshot;
  binding?: CasePolicyBinding;
}

function snapshotVersions(resolution: PolicyResolutionResult) {
  return resolution.versions
    .map((v) => ({
      policyVersionId: v.policyVersionId,
      ruleId: v.ruleId,
      version: v.version,
      effectiveFrom: v.effectiveFrom.toISOString(),
      effectiveTo: v.effectiveTo?.toISOString() ?? null,
    }))
    .sort((a, b) => a.policyVersionId.localeCompare(b.policyVersionId));
}

/**
 * The "unavoidable `PolicyEvaluationService` binding-validation guard"
 * named directly in M3's scope (Section 20). A simplified version of
 * Section 10.4's design: the target algorithm reads an 8-key dependency-
 * generation vector (catalog/jurisdiction/product/program/tenant/
 * lifecycle/source-coverage/resolver) in one bounded indexed query, so a
 * policy activation can invalidate exactly the bindings it affects
 * without re-running resolution. No `policy_dependency_generations` table
 * exists yet (nothing in this codebase can activate/withdraw/supersede a
 * policy version after the fact either — see CasePolicyBinding's own
 * class comment), so this guard always re-runs the real resolver, then
 * decides reuse-vs-refresh from a content digest of what it found. That
 * means the correctness/audit contract (a case's evaluation is bound to
 * an immutable snapshot; validation coverage is real, not skipped) holds,
 * but the *performance* property (avoid full resolution on the fast
 * path) does not yet — see docs/DEVELOPMENT_LOG.md's Known gaps.
 *
 * `evaluateConditions` (case-conditions.activities.ts) calls this, never
 * the raw resolver directly — mirroring Section 9.4's "the Agent cannot
 * omit it, supply its result, or choose an older snapshot," applied here
 * to the one caller this codebase currently has.
 */
@Injectable()
export class PolicyEvaluationService {
  constructor(
    private readonly resolver: PolicyApplicabilityResolverService,
    @InjectRepository(CasePolicySnapshot)
    private readonly snapshotRepository: Repository<CasePolicySnapshot>,
    @InjectRepository(CasePolicyBinding)
    private readonly bindingRepository: Repository<CasePolicyBinding>,
  ) {}

  async evaluate(
    tenantId: string,
    caseId: string,
    context: PolicyResolutionContext,
  ): Promise<PolicyEvaluationResult> {
    const resolution = await this.resolver.resolve(context);
    // Sorted before hashing: array order from a Map/query isn't a
    // meaningful difference here, and an unstable digest would cause
    // spurious REFRESHED outcomes for a case whose policy genuinely
    // hasn't changed (see policy-digest.ts's own array-order caveat).
    const digest = computeDigest({
      status: resolution.status,
      unresolvedReasons: [...resolution.unresolvedReasons].sort(),
      versions: snapshotVersions(resolution),
    });

    if (resolution.status === 'REVIEW_REQUIRED') {
      const snapshot = await this.persistSnapshot(
        tenantId,
        caseId,
        resolution,
        digest,
      );
      await this.invalidateActiveBinding(tenantId, caseId);
      return { outcome: 'REVIEW_REQUIRED', resolution, snapshot };
    }

    const existingBinding = await this.bindingRepository.findOne({
      where: { tenantId, caseId, invalidatedAt: IsNull() },
      order: { boundAt: 'DESC' },
    });

    const now = new Date();
    if (
      existingBinding &&
      existingBinding.dependencyDigest === digest &&
      existingBinding.revalidateAfter.getTime() > now.getTime()
    ) {
      const snapshot = await this.snapshotRepository.findOneByOrFail({
        id: existingBinding.policySnapshotId,
      });
      return {
        outcome: 'REUSED',
        resolution,
        snapshot,
        binding: existingBinding,
      };
    }

    const snapshot = await this.persistSnapshot(
      tenantId,
      caseId,
      resolution,
      digest,
    );
    if (existingBinding) {
      await this.bindingRepository.update(
        { id: existingBinding.id },
        { invalidatedAt: now },
      );
    }
    const binding = await this.bindingRepository.save(
      this.bindingRepository.create({
        tenantId,
        caseId,
        dependencyDigest: digest,
        policySnapshotId: snapshot.id,
        revalidateAfter: new Date(now.getTime() + MAX_VALIDATION_INTERVAL_MS),
        invalidatedAt: null,
      }),
    );

    return { outcome: 'REFRESHED', resolution, snapshot, binding };
  }

  private async persistSnapshot(
    tenantId: string,
    caseId: string,
    resolution: PolicyResolutionResult,
    digest: string,
  ): Promise<CasePolicySnapshot> {
    return this.snapshotRepository.save(
      this.snapshotRepository.create({
        tenantId,
        caseId,
        contextHash: digest,
        resolverVersion: RESOLVER_VERSION,
        resolutionStatus:
          resolution.status === 'RESOLVED'
            ? PolicyResolutionStatus.RESOLVED
            : PolicyResolutionStatus.REVIEW_REQUIRED,
        versions: snapshotVersions(resolution),
        unresolvedReasons: resolution.unresolvedReasons,
      }),
    );
  }

  private async invalidateActiveBinding(
    tenantId: string,
    caseId: string,
  ): Promise<void> {
    await this.bindingRepository.update(
      { tenantId, caseId, invalidatedAt: IsNull() },
      { invalidatedAt: new Date() },
    );
  }
}
