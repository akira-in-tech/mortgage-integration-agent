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
 * record a human will approve if `PROTECTED`, or that a future real
 * channel would deliver as-is if `ROUTINE`. No delivery happens here or
 * anywhere in this codebase yet (Known gap — no real communication
 * channel exists, same status as real provider integrations generally,
 * Section 11). `communication_messages`/`communication_templates` carry
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
}
