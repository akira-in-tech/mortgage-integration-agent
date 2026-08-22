import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { CasePolicySnapshot } from '../database/entities/case-policy-snapshot.entity';
import { CasePolicyBinding } from '../database/entities/case-policy-binding.entity';
import { PolicyCatalogGeneration } from '../database/entities/policy-catalog-generation.entity';
import { PolicyResolutionStatus } from '../database/enums/policy-resolution-status.enum';
import { PolicyApplicabilityResolverService } from './policy-applicability-resolver.service';
import { computeDigest } from './policy-digest';
import { isUniqueViolation } from '../database/postgres-errors';
import {
  PolicyResolutionContext,
  PolicyResolutionResult,
} from './policy-resolution.types';
import { runInTenantContext } from '../database/tenant-context';
import { operationalTelemetry } from '../observability/operational-telemetry';

export const RESOLVER_VERSION = '2.0.0';
// Section 10.4: "configured maximum validation interval" — the ceiling on
// how long a binding can go without at least confirming the catalog
// generation still matches, regardless of whether anything ever changes.
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
      rule: v.rule,
      effectiveFrom: v.effectiveFrom.toISOString(),
      effectiveTo: v.effectiveTo?.toISOString() ?? null,
    }))
    .sort((a, b) => a.policyVersionId.localeCompare(b.policyVersionId));
}

function contextKey(context: PolicyResolutionContext): string {
  return `${context.jurisdictionCode}|${context.productCode}|${context.lifecycleEvent}|${context.applicationReceivedAt?.toISOString() ?? 'UNSPECIFIED'}`;
}

function nextRevalidationDeadline(
  validatedAt: Date,
  resolution: PolicyResolutionResult,
): Date {
  const maximumInterval = new Date(
    validatedAt.getTime() + MAX_VALIDATION_INTERVAL_MS,
  );
  if (
    resolution.revalidateAfter &&
    resolution.revalidateAfter.getTime() < maximumInterval.getTime()
  ) {
    return resolution.revalidateAfter;
  }
  return maximumInterval;
}

/** Rebuilds a `PolicyResolutionResult` from a persisted snapshot alone — no `PolicyVersion` lookups — for the fast path below. */
function reconstructResolution(
  snapshot: CasePolicySnapshot,
): PolicyResolutionResult {
  return {
    status:
      snapshot.resolutionStatus === PolicyResolutionStatus.RESOLVED
        ? 'RESOLVED'
        : 'REVIEW_REQUIRED',
    versions: snapshot.versions.map((v) => ({
      policyVersionId: v.policyVersionId,
      ruleId: v.ruleId,
      version: v.version,
      rule: v.rule,
      effectiveFrom: new Date(v.effectiveFrom),
      effectiveTo: v.effectiveTo ? new Date(v.effectiveTo) : null,
    })),
    unresolvedReasons: snapshot.unresolvedReasons,
  };
}

/**
 * The "unavoidable `PolicyEvaluationService` binding-validation guard"
 * named directly in M3's scope (Section 20). Section 10.4's dependency-
 * generation fast path is now real (M3-011), coarsened to a single global
 * `PolicyCatalogGeneration` counter rather than the target 8-key vector —
 * see that entity's own comment for why that's a safe (over-, never
 * under-invalidating) simplification, not a correctness gap.
 *
 * `evaluateConditions` (case-conditions.activities.ts, via the Agent
 * runtime's `evaluate_policy` tool) calls this, never the raw resolver
 * directly — mirroring Section 9.4's "the Agent cannot omit it, supply
 * its result, or choose an older snapshot."
 *
 * Section 20's exit evidence H ("a catalog activation racing with
 * evaluation produces one internally consistent, auditable result"):
 * `CasePolicyBinding` is documented as one active row per case, but
 * nothing enforced that until a real partial unique index
 * (`IDX_case_policy_bindings_one_active`) was added alongside the
 * catch-and-recover logic in the final branch below — see
 * `policy-evaluation.service.spec.ts`'s concurrency tests.
 *
 * `case_policy_snapshots`/`case_policy_bindings` carry a real RLS policy
 * (M5-010) — deliberately wrapped as many small `runInTenantContext`
 * calls, one per logical step, rather than one transaction spanning the
 * whole method: the concurrency-recovery `catch` block below reads back
 * a winning row after a real unique-constraint violation, and doing that
 * read inside the SAME transaction as the failed INSERT would hit
 * Postgres's "current transaction is aborted" state (M5-002/M5-003's own
 * `DROP ROLE` savepoint lesson — a JS `try/catch` cannot rescue an
 * aborted Postgres transaction, only ending it can). This preserves the
 * exact transactional granularity the original bare-repository-call code
 * already had.
 */
@Injectable()
export class PolicyEvaluationService {
  constructor(
    private readonly resolver: PolicyApplicabilityResolverService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(PolicyCatalogGeneration)
    private readonly generationRepository: Repository<PolicyCatalogGeneration>,
  ) {}

  async evaluate(
    tenantId: string,
    caseId: string,
    context: PolicyResolutionContext,
  ): Promise<PolicyEvaluationResult> {
    const telemetryStartedAt = performance.now();
    try {
      const result = await operationalTelemetry.withSpan(
        'policy.evaluate',
        { resolver_version: RESOLVER_VERSION },
        () => this.evaluateInternal(tenantId, caseId, context),
      );
      operationalTelemetry.recordPolicy(result.outcome, telemetryStartedAt);
      return result;
    } catch (error) {
      operationalTelemetry.recordPolicy('ERROR', telemetryStartedAt);
      throw error;
    }
  }

  private async evaluateInternal(
    tenantId: string,
    caseId: string,
    context: PolicyResolutionContext,
  ): Promise<PolicyEvaluationResult> {
    const currentGeneration = await this.getCurrentGeneration();
    const currentContextKey = contextKey(context);
    const existingBinding = await runInTenantContext(
      this.dataSource,
      tenantId,
      (manager) =>
        manager.getRepository(CasePolicyBinding).findOne({
          where: { tenantId, caseId, invalidatedAt: IsNull() },
          order: { boundAt: 'DESC' },
        }),
    );
    const now = new Date();
    const existingSnapshot = existingBinding
      ? await runInTenantContext(this.dataSource, tenantId, (manager) =>
          manager
            .getRepository(CasePolicySnapshot)
            .findOneByOrFail({ id: existingBinding.policySnapshotId }),
        )
      : undefined;

    // Resolver releases are policy dependencies. A deployment may change
    // hierarchy, freshness, or transition semantics without changing a
    // catalog row, so older snapshots must bypass both reuse fast paths.
    if (
      existingBinding &&
      existingSnapshot?.resolverVersion === RESOLVER_VERSION &&
      existingBinding.contextKey === currentContextKey &&
      existingBinding.observedCatalogGeneration === currentGeneration &&
      existingBinding.revalidateAfter.getTime() > now.getTime()
    ) {
      // Fast path: no policy activation or withdrawal has bumped the
      // catalog generation since this binding was created, and the
      // periodic revalidation deadline hasn't passed — reuse without
      // calling the resolver at all.
      return {
        outcome: 'REUSED',
        resolution: reconstructResolution(existingSnapshot),
        snapshot: existingSnapshot,
        binding: existingBinding,
      };
    }

    // Slow path: the generation moved (or revalidateAfter passed) —
    // resolve for real to find out whether anything this case actually
    // depends on changed.
    const resolution = await this.resolver.resolve(context);
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

    if (
      existingBinding &&
      existingSnapshot?.resolverVersion === RESOLVER_VERSION &&
      existingBinding.contextKey === currentContextKey &&
      existingBinding.dependencyDigest === digest
    ) {
      // Same context, and the generation moved elsewhere in the catalog
      // but this case's own applicable content is unchanged — refresh
      // the binding's observed generation in place (no new snapshot) so
      // the next call can take the fast path again immediately.
      const revalidateAfter = nextRevalidationDeadline(now, resolution);
      await runInTenantContext(this.dataSource, tenantId, (manager) =>
        manager
          .getRepository(CasePolicyBinding)
          .update(
            { id: existingBinding.id },
            { observedCatalogGeneration: currentGeneration, revalidateAfter },
          ),
      );
      return {
        outcome: 'REUSED',
        resolution,
        snapshot: existingSnapshot,
        binding: {
          ...existingBinding,
          observedCatalogGeneration: currentGeneration,
          revalidateAfter,
        },
      };
    }

    const snapshot = await this.persistSnapshot(
      tenantId,
      caseId,
      resolution,
      digest,
    );
    if (existingBinding) {
      await runInTenantContext(this.dataSource, tenantId, (manager) =>
        manager
          .getRepository(CasePolicyBinding)
          .update({ id: existingBinding.id }, { invalidatedAt: now }),
      );
    }

    try {
      const binding = await runInTenantContext(
        this.dataSource,
        tenantId,
        (manager) => {
          const repo = manager.getRepository(CasePolicyBinding);
          return repo.save(
            repo.create({
              tenantId,
              caseId,
              dependencyDigest: digest,
              contextKey: currentContextKey,
              observedCatalogGeneration: currentGeneration,
              policySnapshotId: snapshot.id,
              revalidateAfter: nextRevalidationDeadline(now, resolution),
              invalidatedAt: null,
            }),
          );
        },
      );
      return { outcome: 'REFRESHED', resolution, snapshot, binding };
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      // Exit evidence H (Section 20): a concurrent evaluate() call for
      // this same case already won the race and committed the case's
      // one active binding first — `IDX_case_policy_bindings_one_active`
      // (the AgentRunTimeline-era migration's partial unique index) is
      // what makes that race detectable instead of silently producing
      // two simultaneously-active bindings. Read back the winner and
      // return a coherent result referencing it, rather than crash the
      // loser's caller — both callers converge on the same single
      // internally consistent outcome. Each read below is its own fresh
      // `runInTenantContext` call/transaction, not a continuation of the
      // one that just failed above — see this method's own class-level
      // comment for why that matters.
      const winningBinding = await runInTenantContext(
        this.dataSource,
        tenantId,
        (manager) =>
          manager.getRepository(CasePolicyBinding).findOneByOrFail({
            tenantId,
            caseId,
            invalidatedAt: IsNull(),
          }),
      );
      const winningSnapshot = await runInTenantContext(
        this.dataSource,
        tenantId,
        (manager) =>
          manager
            .getRepository(CasePolicySnapshot)
            .findOneByOrFail({ id: winningBinding.policySnapshotId }),
      );
      return {
        outcome: 'REUSED',
        resolution: reconstructResolution(winningSnapshot),
        snapshot: winningSnapshot,
        binding: winningBinding,
      };
    }
  }

  private async getCurrentGeneration(): Promise<number> {
    const row = await this.generationRepository.findOneByOrFail({ id: 1 });
    return row.generation;
  }

  private async persistSnapshot(
    tenantId: string,
    caseId: string,
    resolution: PolicyResolutionResult,
    digest: string,
  ): Promise<CasePolicySnapshot> {
    return runInTenantContext(this.dataSource, tenantId, (manager) => {
      const repo = manager.getRepository(CasePolicySnapshot);
      return repo.save(
        repo.create({
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
    });
  }

  private async invalidateActiveBinding(
    tenantId: string,
    caseId: string,
  ): Promise<void> {
    await runInTenantContext(this.dataSource, tenantId, (manager) =>
      manager
        .getRepository(CasePolicyBinding)
        .update(
          { tenantId, caseId, invalidatedAt: IsNull() },
          { invalidatedAt: new Date() },
        ),
    );
  }
}
