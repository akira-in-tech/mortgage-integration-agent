import { Injectable, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ProviderPromotionManifest } from '../database/entities/provider-promotion-manifest.entity';
import { ProviderCertificationRecord } from '../database/entities/provider-certification-record.entity';
import { ProviderApprovalRecord } from '../database/entities/provider-approval-record.entity';
import { ProviderActivation } from '../database/entities/provider-activation.entity';
import {
  ProviderCertificationDecision,
  ProviderApprovalDecision,
  ProviderActivationState,
} from '../database/enums/provider-promotion.enum';
import { computeDigest } from '../policy/policy-digest';
import { ProviderCapability, ProviderMode } from './types';
import { AuditEventService } from '../audit/audit-event.service';
import { PLATFORM_AUDIT_TENANT_ID } from '../audit/platform-audit-tenant';

export interface ProposeManifestInput {
  providerId: string;
  capability: ProviderCapability;
  mode: ProviderMode;
  adapterVersion: string;
  endpointAllowlist: string[];
  dataClassifications: string[];
  proposedBy: string;
  validFrom?: Date;
  validUntil?: Date | null;
}

/**
 * Section 11.4's governed promotion chain: propose -> certify -> approve
 * -> activate, mirroring `PolicyTransitionApprovalService`'s exact
 * dual-control shape (Section 16.1) extended to the fuller sequence.
 * `dispatchProviderRequest` is the real enforcement point (Section 11.4's
 * kill switch's own precedent, M4-006) — every non-`SIMULATOR` dispatch
 * fails closed unless `isActivated()` is true.
 *
 * Every state-changing method here also writes an `AuditEventService`
 * record (M7-028) — the M5 trust-boundary audit found that
 * `ProviderPromotionController` never wrote one, leaving provenance for
 * a manifest's whole propose/certify/approve/activate/deactivate history
 * living only in this table's own `proposedBy`/`certifiedBy`/etc.
 * columns. The audit call lives here rather than in the controller so
 * every real caller — the console, and the `manage-provider-promotion`/
 * `provider-kill-switch-drill` scripts, neither of which goes through
 * the controller — gets the same provenance, not just the REST path.
 * Under `PLATFORM_AUDIT_TENANT_ID` because this catalog is shared across
 * every tenant, not owned by one (see that constant's own comment).
 */
@Injectable()
export class ProviderPromotionService {
  constructor(
    @InjectRepository(ProviderPromotionManifest)
    private readonly manifestRepository: Repository<ProviderPromotionManifest>,
    @InjectRepository(ProviderCertificationRecord)
    private readonly certificationRepository: Repository<ProviderCertificationRecord>,
    @InjectRepository(ProviderApprovalRecord)
    private readonly approvalRepository: Repository<ProviderApprovalRecord>,
    @InjectRepository(ProviderActivation)
    private readonly activationRepository: Repository<ProviderActivation>,
    private readonly auditEventService: AuditEventService,
  ) {}

  /** Each proposal is a new, immutable row — `version` increments per `{providerId, capability, mode}` tuple. */
  async propose(
    input: ProposeManifestInput,
  ): Promise<ProviderPromotionManifest> {
    const latest = await this.manifestRepository.findOne({
      where: {
        providerId: input.providerId,
        capability:
          input.capability as unknown as ProviderPromotionManifest['capability'],
        mode: input.mode,
      },
      order: { version: 'DESC' },
    });
    const version = (latest?.version ?? 0) + 1;
    const contentHash = computeDigest({
      providerId: input.providerId,
      capability: input.capability,
      mode: input.mode,
      adapterVersion: input.adapterVersion,
      endpointAllowlist: input.endpointAllowlist,
      dataClassifications: input.dataClassifications,
    });

    const manifest = await this.manifestRepository.save(
      this.manifestRepository.create({
        providerId: input.providerId,
        capability:
          input.capability as unknown as ProviderPromotionManifest['capability'],
        mode: input.mode,
        version,
        adapterVersion: input.adapterVersion,
        endpointAllowlist: input.endpointAllowlist,
        dataClassifications: input.dataClassifications,
        contentHash,
        proposedBy: input.proposedBy,
        validFrom: input.validFrom ?? new Date(),
        validUntil: input.validUntil ?? null,
      }),
    );

    await this.auditEventService.record({
      tenantId: PLATFORM_AUDIT_TENANT_ID,
      actorId: input.proposedBy,
      action: 'PROVIDER_MANIFEST_PROPOSED',
      resourceType: 'provider_promotion_manifest',
      resourceId: manifest.id,
      metadata: {
        providerId: input.providerId,
        capability: input.capability,
        mode: input.mode,
        version,
        adapterVersion: input.adapterVersion,
      },
    });
    return manifest;
  }

  /** Append-only — a re-certification (renewal, or reversing an earlier FAILED) is a new row, never a mutation. */
  async certify(
    manifestId: string,
    environment: string,
    certifiedBy: string,
    decision: ProviderCertificationDecision,
    evidenceRef: string,
    expiresAt: Date | null = null,
  ): Promise<ProviderCertificationRecord> {
    await this.manifestRepository.findOneByOrFail({ id: manifestId });

    const record = await this.certificationRepository.save(
      this.certificationRepository.create({
        manifestId,
        environment,
        certifiedBy,
        decision,
        evidenceRef,
        expiresAt,
      }),
    );

    await this.auditEventService.record({
      tenantId: PLATFORM_AUDIT_TENANT_ID,
      actorId: certifiedBy,
      action: 'PROVIDER_MANIFEST_CERTIFIED',
      resourceType: 'provider_promotion_manifest',
      resourceId: manifestId,
      metadata: { environment, decision, evidenceRef },
    });
    return record;
  }

  /**
   * Append-only, same self-approval rejection
   * `PolicyTransitionApprovalService.approve()` already enforces: an
   * `APPROVED` decision is rejected when the approver is the manifest's
   * own proposer. Rejecting or revoking one's own proposal carries no such
   * risk, so only `APPROVED` is checked.
   */
  async approve(
    manifestId: string,
    approvalRole: string,
    approvedBy: string,
    decision: ProviderApprovalDecision,
    expiresAt: Date | null = null,
  ): Promise<ProviderApprovalRecord> {
    const manifest = await this.manifestRepository.findOneByOrFail({
      id: manifestId,
    });
    if (
      decision === ProviderApprovalDecision.APPROVED &&
      manifest.proposedBy === approvedBy
    ) {
      throw new BadRequestException(
        'self-approval is not permitted: the approver must differ from the proposer',
      );
    }

    const record = await this.approvalRepository.save(
      this.approvalRepository.create({
        manifestId,
        approvalRole,
        approvedBy,
        decision,
        expiresAt,
      }),
    );

    await this.auditEventService.record({
      tenantId: PLATFORM_AUDIT_TENANT_ID,
      actorId: approvedBy,
      action: 'PROVIDER_MANIFEST_APPROVAL_RECORDED',
      resourceType: 'provider_promotion_manifest',
      resourceId: manifestId,
      metadata: { approvalRole, decision },
    });
    return record;
  }

  /**
   * Requires the manifest's latest certification (for `environment`) to be
   * `PASSED` and unexpired, AND its latest approval to be `APPROVED` and
   * unexpired — both gates, not either. `expectedCurrentManifestVersion`
   * is an optimistic lock: pass the `manifestVersion` last read from
   * `ProviderActivation` (or `null` if none exists yet) to guard against
   * two operators racing to activate two different manifests for the same
   * tuple; a stale value throws rather than silently overwriting.
   */
  async activate(
    manifestId: string,
    environment: string,
    activatedBy: string,
    expectedCurrentManifestVersion: number | null,
  ): Promise<ProviderActivation> {
    const manifest = await this.manifestRepository.findOneByOrFail({
      id: manifestId,
    });

    const certified = await this.latestDecision(this.certificationRepository, {
      manifestId,
      environment,
    });
    if (
      !certified ||
      certified.decision !== ProviderCertificationDecision.PASSED ||
      this.isExpired(certified.expiresAt)
    ) {
      throw new BadRequestException(
        `manifest ${manifestId} has no current PASSED, unexpired certification for environment "${environment}"`,
      );
    }

    const approved = await this.latestDecision(this.approvalRepository, {
      manifestId,
    });
    if (
      !approved ||
      approved.decision !== ProviderApprovalDecision.APPROVED ||
      this.isExpired(approved.expiresAt)
    ) {
      throw new BadRequestException(
        `manifest ${manifestId} has no current APPROVED, unexpired approval`,
      );
    }

    const existing = await this.activationRepository.findOneBy({
      providerId: manifest.providerId,
      capability: manifest.capability,
      mode: manifest.mode,
    });
    const currentVersion = existing?.manifestVersion ?? null;
    if (expectedCurrentManifestVersion !== currentVersion) {
      throw new BadRequestException(
        `activation for ${manifest.providerId}/${manifest.capability}/${manifest.mode} has moved ` +
          `(expected current manifest version ${expectedCurrentManifestVersion}, actual ${currentVersion}) — reload and retry`,
      );
    }

    const activation = await this.activationRepository.save(
      this.activationRepository.create({
        ...existing,
        providerId: manifest.providerId,
        capability: manifest.capability,
        mode: manifest.mode,
        manifestId: manifest.id,
        manifestVersion: manifest.version,
        state: ProviderActivationState.ACTIVE,
        activatedBy,
      }),
    );

    await this.auditEventService.record({
      tenantId: PLATFORM_AUDIT_TENANT_ID,
      actorId: activatedBy,
      action: 'PROVIDER_ACTIVATED',
      resourceType: 'provider_activation',
      resourceId: activation.id,
      metadata: {
        providerId: manifest.providerId,
        capability: manifest.capability,
        mode: manifest.mode,
        environment,
        manifestId: manifest.id,
        manifestVersion: manifest.version,
      },
    });
    return activation;
  }

  /**
   * Section 11.4's own single-actor "emergency disable" — no dual
   * control, matching `ProviderKillSwitchService.disable()`'s own
   * precedent. Returns the now-deactivated row (not void) so a caller —
   * the console included — can show the real result instead of assuming
   * it worked.
   */
  async deactivate(
    providerId: string,
    capability: ProviderCapability,
    mode: ProviderMode,
    actorId: string,
  ): Promise<ProviderActivation> {
    const existing = await this.activationRepository.findOneByOrFail({
      providerId,
      capability: capability as unknown as ProviderActivation['capability'],
      mode,
    });
    await this.activationRepository.update(
      { id: existing.id },
      { state: ProviderActivationState.DEACTIVATED, activatedBy: actorId },
    );
    const activation = await this.activationRepository.findOneByOrFail({
      id: existing.id,
    });

    await this.auditEventService.record({
      tenantId: PLATFORM_AUDIT_TENANT_ID,
      actorId,
      action: 'PROVIDER_DEACTIVATED',
      resourceType: 'provider_activation',
      resourceId: activation.id,
      metadata: { providerId, capability, mode },
    });
    return activation;
  }

  /** The real dispatch-time gate — `dispatchProviderRequest` calls this for every non-`SIMULATOR` mode. No row means never activated (fail closed, opposite of the kill switch's own "no row means ACTIVE" default — an unpromoted manifest must never be reachable). */
  async isActivated(
    providerId: string,
    capability: ProviderCapability,
    mode: ProviderMode,
  ): Promise<boolean> {
    const row = await this.activationRepository.findOneBy({
      providerId,
      capability: capability as unknown as ProviderActivation['capability'],
      mode,
    });
    return !!row && row.state === ProviderActivationState.ACTIVE;
  }

  /** Most recently proposed first — what a platform admin sees when opening the console screen. */
  async listManifests(limit = 50): Promise<ProviderPromotionManifest[]> {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    return this.manifestRepository.find({
      order: { proposedAt: 'DESC' },
      take: boundedLimit,
    });
  }

  async getManifest(manifestId: string): Promise<ProviderPromotionManifest> {
    return this.manifestRepository.findOneByOrFail({ id: manifestId });
  }

  /** Every certification this manifest has ever received, newest first — the full append-only history, not just the current decision. */
  async listCertifications(
    manifestId: string,
  ): Promise<ProviderCertificationRecord[]> {
    return this.certificationRepository.find({
      where: { manifestId },
      order: { decidedAt: 'DESC' },
    });
  }

  /** Every approval decision this manifest has ever received, newest first. */
  async listApprovals(manifestId: string): Promise<ProviderApprovalRecord[]> {
    return this.approvalRepository.find({
      where: { manifestId },
      order: { decidedAt: 'DESC' },
    });
  }

  /** The current activation row for one {providerId, capability, mode} tuple, or null if it has never been activated. */
  async getActivation(
    providerId: string,
    capability: ProviderCapability,
    mode: ProviderMode,
  ): Promise<ProviderActivation | null> {
    return this.activationRepository.findOneBy({
      providerId,
      capability: capability as unknown as ProviderActivation['capability'],
      mode,
    });
  }

  /** Every tuple that has ever been activated, current state included (ACTIVE or DEACTIVATED) — this table is current-state-only, so this is the whole activation picture, not a page of a longer history. */
  async listActivations(): Promise<ProviderActivation[]> {
    return this.activationRepository.find({
      order: { activatedAt: 'DESC' },
    });
  }

  private isExpired(expiresAt: Date | null): boolean {
    return expiresAt !== null && expiresAt.getTime() < Date.now();
  }

  private async latestDecision<
    T extends { decidedAt: Date; expiresAt: Date | null; decision: unknown },
  >(
    repository: Repository<T>,
    where: Record<string, unknown>,
  ): Promise<T | null> {
    return repository.findOne({
      where: where as never,
      order: { decidedAt: 'DESC' } as never,
    });
  }
}
