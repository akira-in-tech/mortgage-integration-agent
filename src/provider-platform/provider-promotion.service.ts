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

    return this.manifestRepository.save(
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

    return this.certificationRepository.save(
      this.certificationRepository.create({
        manifestId,
        environment,
        certifiedBy,
        decision,
        evidenceRef,
        expiresAt,
      }),
    );
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

    return this.approvalRepository.save(
      this.approvalRepository.create({
        manifestId,
        approvalRole,
        approvedBy,
        decision,
        expiresAt,
      }),
    );
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

    return this.activationRepository.save(
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
  }

  /** Section 11.4's own single-actor "emergency disable" — no dual control, matching `ProviderKillSwitchService.disable()`'s own precedent. */
  async deactivate(
    providerId: string,
    capability: ProviderCapability,
    mode: ProviderMode,
    actorId: string,
  ): Promise<void> {
    const existing = await this.activationRepository.findOneByOrFail({
      providerId,
      capability: capability as unknown as ProviderActivation['capability'],
      mode,
    });
    await this.activationRepository.update(
      { id: existing.id },
      { state: ProviderActivationState.DEACTIVATED, activatedBy: actorId },
    );
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
