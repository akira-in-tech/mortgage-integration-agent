import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CommunicationTemplate } from '../database/entities/communication-template.entity';
import { CommunicationMessage } from '../database/entities/communication-message.entity';
import { CommunicationMessageStatus } from '../database/enums/communication.enum';
import { CommunicationClassification } from '../database/enums/communication.enum';
import { computeDigest } from '../policy/policy-digest';
import {
  classifyCommunication,
  DraftCommunicationInput,
} from './communication-classifier';
import { runInTenantContext } from '../database/tenant-context';

/**
 * Section 9.4's `draft_information_request` backing service: renders,
 * classifies (via `classifyCommunication`, a deterministic guard outside
 * the model), and persists — one `CommunicationMessage` row is the exact
 * record a human will approve if `PROTECTED`, or that is already
 * ready-to-send if `ROUTINE`. Delivery itself is `CommunicationDelivery
 * Service.deliver()`'s own job, not this service's (M5-022 gave it a
 * real REST caller — `CommunicationMessagesController`). `communication_
 * messages`/`communication_templates` carry
 * a real RLS policy (M5-009) — both the template read and the message
 * write below run inside one `runInTenantContext` transaction, not bare
 * repository calls.
 */
@Injectable()
export class CommunicationMessageService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async draft(
    tenantId: string,
    caseId: string,
    input: DraftCommunicationInput,
  ): Promise<CommunicationMessage> {
    return runInTenantContext(this.dataSource, tenantId, async (manager) => {
      const template =
        input.templateKey && input.templateVersion
          ? await manager.getRepository(CommunicationTemplate).findOneBy({
              tenantId,
              templateKey: input.templateKey,
              version: input.templateVersion,
            })
          : null;

      const outcome = classifyCommunication(input, template);
      const renderedContentHash = computeDigest(outcome.renderedContent);

      const messageRepo = manager.getRepository(CommunicationMessage);
      return messageRepo.save(
        messageRepo.create({
          tenantId,
          caseId,
          classification: outcome.classification,
          classificationReasons: outcome.reasons,
          templateId: outcome.templateId,
          recipientRelationship: input.recipientRelationship,
          channel: input.channel,
          locale: input.locale,
          variables: input.variables,
          renderedContent: outcome.renderedContent,
          renderedContentHash,
          status:
            outcome.classification === CommunicationClassification.PROTECTED
              ? CommunicationMessageStatus.AWAITING_APPROVAL
              : CommunicationMessageStatus.DRAFTED,
        }),
      );
    });
  }

  // M5-022's own read side — lets a reviewer see what's awaiting their
  // approval, or confirm a message actually reached SENT, without a
  // direct database query. Newest-first: the most likely thing a
  // reviewer opening this list wants is whatever just landed.
  async listForCase(
    tenantId: string,
    caseId: string,
  ): Promise<CommunicationMessage[]> {
    return runInTenantContext(this.dataSource, tenantId, (manager) =>
      manager.getRepository(CommunicationMessage).find({
        where: { tenantId, caseId },
        order: { createdAt: 'DESC' },
      }),
    );
  }
}
