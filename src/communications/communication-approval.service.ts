import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunicationMessage } from '../database/entities/communication-message.entity';
import { CommunicationApproval } from '../database/entities/communication-approval.entity';
import {
  CommunicationClassification,
  CommunicationMessageStatus,
} from '../database/enums/communication.enum';

/**
 * Section 6.4: "a human reviewer must approve the exact rendered
 * content... before platform delivery." The Agent cannot call this
 * itself (Section 6.4: "The Agent cannot label its own message routine,
 * supply an approval result, or downgrade a protected classification") —
 * it is not a registered Agent tool (see src/agent-runtime/tools/),
 * deliberately, for that reason. Rejects approving a message that isn't
 * `PROTECTED` (a `ROUTINE` message was never awaiting this kind of
 * approval in the first place) or is already approved.
 */
@Injectable()
export class CommunicationApprovalService {
  constructor(
    @InjectRepository(CommunicationMessage)
    private readonly messageRepository: Repository<CommunicationMessage>,
    @InjectRepository(CommunicationApproval)
    private readonly approvalRepository: Repository<CommunicationApproval>,
  ) {}

  async approve(
    communicationMessageId: string,
    actorId: string,
    reason?: string,
  ): Promise<CommunicationApproval> {
    const message = await this.messageRepository.findOneByOrFail({
      id: communicationMessageId,
    });
    if (message.classification !== CommunicationClassification.PROTECTED) {
      throw new BadRequestException(
        `communication message ${communicationMessageId} is not PROTECTED — routine messages do not require this approval`,
      );
    }
    if (message.status === CommunicationMessageStatus.APPROVED) {
      throw new BadRequestException(
        `communication message ${communicationMessageId} is already approved`,
      );
    }

    const approval = await this.approvalRepository.save(
      this.approvalRepository.create({
        communicationMessageId,
        actorId,
        approvedRenderedContentHash: message.renderedContentHash,
        reason: reason ?? null,
      }),
    );
    await this.messageRepository.update(
      { id: communicationMessageId },
      { status: CommunicationMessageStatus.APPROVED },
    );
    return approval;
  }
}
