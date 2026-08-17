import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CommunicationMessage } from '../database/entities/communication-message.entity';
import {
  CommunicationClassification,
  CommunicationMessageStatus,
} from '../database/enums/communication.enum';
import { writeOutboxEvent } from '../database/outbox/outbox-writer';
import { OutboxEventType } from '../database/outbox/outbox-event-types';
import { CommunicationDeliverySimulator } from './communication-delivery-simulator';

export type DeliverCommunicationResult =
  | { outcome: 'DELIVERED'; deliveryReference: string; sentAt: string }
  | { outcome: 'NOT_READY'; reason: string };

/**
 * Section 9.4's `send_information_request` approval boundary, made real:
 * "Configured policy only for a version-pinned routine operational
 * template" (a `ROUTINE` message needs nothing further once
 * `CommunicationMessageService.draft()` already classified it that way —
 * `DRAFTED` is itself the ready-to-send state) — "exact human approval is
 * mandatory for protected... content" (a `PROTECTED` message must be
 * `APPROVED`, which only `CommunicationApprovalService.approve()` can set,
 * bound to this exact `renderedContentHash`, M3-012). Any other
 * combination — `PROTECTED` and not yet `APPROVED`, or already `SENT` —
 * is rejected as `NOT_READY`, never delivered.
 */
@Injectable()
export class CommunicationDeliveryService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly simulator: CommunicationDeliverySimulator,
    private readonly configService: ConfigService,
  ) {}

  async deliver(
    communicationMessageId: string,
  ): Promise<DeliverCommunicationResult> {
    const message = await this.dataSource
      .getRepository(CommunicationMessage)
      .findOneByOrFail({ id: communicationMessageId });

    const ready =
      (message.classification === CommunicationClassification.ROUTINE &&
        message.status === CommunicationMessageStatus.DRAFTED) ||
      (message.classification === CommunicationClassification.PROTECTED &&
        message.status === CommunicationMessageStatus.APPROVED);
    if (!ready) {
      return {
        outcome: 'NOT_READY',
        reason: `communication message ${communicationMessageId} is ${message.classification}/${message.status}, not ready to send`,
      };
    }

    const { deliveryReference } = await this.simulator.send(
      message.id,
      message.renderedContentHash,
      message.channel,
    );
    const sentAt = new Date();
    const outboxSigningSecret = this.configService.get<string>(
      'OUTBOX_SIGNING_SECRET',
      'dev-outbox-signing-secret-change-me',
    );

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(CommunicationMessage).update(
        { id: communicationMessageId },
        {
          status: CommunicationMessageStatus.SENT,
          deliveryReference,
          sentAt,
        },
      );
      await writeOutboxEvent(manager, outboxSigningSecret, {
        tenantId: message.tenantId,
        caseId: message.caseId,
        eventType: OutboxEventType.CommunicationDelivered,
        payload: {
          caseId: message.caseId,
          communicationMessageId,
          classification: message.classification,
          channel: message.channel,
          deliveryReference,
        },
      });
    });

    return {
      outcome: 'DELIVERED',
      deliveryReference,
      sentAt: sentAt.toISOString(),
    };
  }
}
