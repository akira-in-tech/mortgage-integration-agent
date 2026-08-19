import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CommunicationMessage } from '../database/entities/communication-message.entity';
import { CommunicationApproval } from '../database/entities/communication-approval.entity';
import {
  CommunicationClassification,
  CommunicationMessageStatus,
} from '../database/enums/communication.enum';
import { runInTenantContext } from '../database/tenant-context';

/**
 * Section 6.4: "a human reviewer must approve the exact rendered
 * content... before platform delivery." The Agent cannot call this
 * itself (Section 6.4: "The Agent cannot label its own message routine,
 * supply an approval result, or downgrade a protected classification") —
 * it is not a registered Agent tool (see src/agent-runtime/tools/),
 * deliberately, for that reason. Rejects approving a message that isn't
 * `PROTECTED` (a `ROUTINE` message was never awaiting this kind of
 * approval in the first place) or is already approved.
 *
 * `@InjectDataSource()` + `runInTenantContext()` (M5-018) — `approve()`
 * gained an explicit `tenantId` parameter matching every other
 * RLS-protected service's convention. It had no real caller anywhere in
 * this codebase before this slice (M5-009's and M5-014's own migration
 * comments both name this), so there was no existing signature to
 * preserve or break — this is the first real design of it, not a
 * retrofit around a caller already depending on the old shape.
 */
@Injectable()
export class CommunicationApprovalService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async approve(
    tenantId: string,
    communicationMessageId: string,
    actorId: string,
    reason?: string,
  ): Promise<CommunicationApproval> {
    return runInTenantContext(this.dataSource, tenantId, async (manager) => {
      const messageRepository = manager.getRepository(CommunicationMessage);
      const message = await messageRepository.findOneByOrFail({
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

      const approvalRepository = manager.getRepository(CommunicationApproval);
      const approval = await approvalRepository.save(
        approvalRepository.create({
          communicationMessageId,
          actorId,
          approvedRenderedContentHash: message.renderedContentHash,
          reason: reason ?? null,
        }),
      );
      await messageRepository.update(
        { id: communicationMessageId },
        { status: CommunicationMessageStatus.APPROVED },
      );
      return approval;
    });
  }
}
