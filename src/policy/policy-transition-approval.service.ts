import { Injectable, BadRequestException } from '@nestjs/common';
import { IsNull, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PolicyTransitionApproval } from '../database/entities/policy-transition-approval.entity';
import { PolicyVersion } from '../database/entities/policy-version.entity';
import { PolicyReleaseStatus } from '../database/enums/policy-version.enum';

/**
 * Section 16.1: "separate policy-author and policy-approver roles, with
 * independent approval for releases and transition logic." The gate
 * `PolicyActivationService.activate()` now checks before it will move a
 * version to `RELEASED` — closing the gap that service's own comment has
 * named since M3-011 ("no separate policy-author/policy-approver role
 * distinction yet, so this service itself is the whole activation
 * authority").
 */
@Injectable()
export class PolicyTransitionApprovalService {
  constructor(
    @InjectRepository(PolicyTransitionApproval)
    private readonly approvalRepository: Repository<PolicyTransitionApproval>,
    @InjectRepository(PolicyVersion)
    private readonly versionRepository: Repository<PolicyVersion>,
  ) {}

  async propose(
    policyVersionId: string,
    proposedBy: string,
    notes?: string,
  ): Promise<PolicyTransitionApproval> {
    const version = await this.versionRepository.findOneByOrFail({
      id: policyVersionId,
    });
    if (version.releaseStatus !== PolicyReleaseStatus.DRAFT) {
      throw new BadRequestException(
        `policy version ${policyVersionId} cannot be proposed for release from status ${version.releaseStatus}`,
      );
    }

    await this.versionRepository.update(
      { id: policyVersionId },
      { releaseStatus: PolicyReleaseStatus.PROPOSED },
    );

    return this.approvalRepository.save(
      this.approvalRepository.create({
        policyVersionId,
        proposedBy,
        approvedBy: null,
        approvedAt: null,
        notes: notes ?? null,
      }),
    );
  }

  async approve(
    policyVersionId: string,
    approvedBy: string,
  ): Promise<PolicyTransitionApproval> {
    const pending = await this.approvalRepository.findOne({
      where: { policyVersionId, approvedAt: IsNull() },
      order: { proposedAt: 'DESC' },
    });
    if (!pending) {
      throw new BadRequestException(
        `policy version ${policyVersionId} has no pending transition proposal to approve`,
      );
    }
    if (pending.proposedBy === approvedBy) {
      throw new BadRequestException(
        'self-approval is not permitted: the approver must differ from the proposer',
      );
    }

    await this.approvalRepository.update(
      { id: pending.id },
      { approvedBy, approvedAt: new Date() },
    );
    return this.approvalRepository.findOneByOrFail({ id: pending.id });
  }

  /** The gate `PolicyActivationService.activate()` checks — an approved proposal for this exact version, by an actor other than who proposed it. */
  async hasApprovedTransition(policyVersionId: string): Promise<boolean> {
    const approved = await this.approvalRepository.findOne({
      where: { policyVersionId },
      order: { proposedAt: 'DESC' },
    });
    return (
      approved !== null &&
      approved.approvedAt !== null &&
      approved.approvedBy !== null
    );
  }
}
