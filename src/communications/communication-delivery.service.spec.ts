import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { CommunicationTemplate } from '../database/entities/communication-template.entity';
import { CommunicationMessage } from '../database/entities/communication-message.entity';
import { CommunicationApproval } from '../database/entities/communication-approval.entity';
import { OutboxEvent } from '../database/entities/outbox-event.entity';
import {
  CommunicationClassification,
  CommunicationMessageStatus,
  CommunicationTemplateStatus,
} from '../database/enums/communication.enum';
import { OutboxEventType } from '../database/outbox/outbox-event-types';
import { verifyOutboxSignature } from '../database/outbox/outbox-signer';
import { AuditEvent } from '../database/entities/audit-event.entity';
import { CommunicationMessageService } from './communication-message.service';
import { CommunicationApprovalService } from './communication-approval.service';
import { AuditEventService } from '../audit/audit-event.service';
import { CommunicationDeliverySimulator } from './communication-delivery-simulator';
import { CommunicationDeliveryService } from './communication-delivery.service';

const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

const TENANT_ID = '66666666-6666-6666-6666-666666666666';
const CASE_ID = '77777777-7777-7777-7777-777777777777';
const OUTBOX_SIGNING_SECRET = 'communication-delivery-spec-secret-32ch';

describeOrSkip('CommunicationDeliveryService', () => {
  let dataSource: DataSource;
  let messageService: CommunicationMessageService;
  let approvalService: CommunicationApprovalService;
  let deliveryService: CommunicationDeliveryService;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [
        CommunicationTemplate,
        CommunicationMessage,
        CommunicationApproval,
        OutboxEvent,
        AuditEvent,
      ],
    });
    await dataSource.initialize();

    messageService = new CommunicationMessageService(dataSource);
    approvalService = new CommunicationApprovalService(
      dataSource,
      new AuditEventService(dataSource),
    );
    const configService = {
      get: jest.fn().mockReturnValue(OUTBOX_SIGNING_SECRET),
    };
    deliveryService = new CommunicationDeliveryService(
      dataSource,
      new CommunicationDeliverySimulator(),
      configService as never,
    );

    const templateRepo = dataSource.getRepository(CommunicationTemplate);
    await templateRepo.save(
      templateRepo.create({
        tenantId: TENANT_ID,
        templateKey: 'CDS-SPEC-REQUEST-EVIDENCE',
        version: '1.0.0',
        channel: 'EMAIL',
        locale: 'en-US',
        recipientRelationship: 'BORROWER',
        bodyTemplate: 'Please provide {{evidenceType}}.',
        allowedVariables: ['evidenceType'],
        attachmentsAllowed: false,
        status: CommunicationTemplateStatus.APPROVED,
        approvedBy: 'policy-team',
        approvedAt: new Date(),
      }),
    );
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource
        .getRepository(OutboxEvent)
        .delete({ tenantId: TENANT_ID });
      const messages = await dataSource
        .getRepository(CommunicationMessage)
        .find({ where: { tenantId: TENANT_ID } });
      if (messages.length) {
        await dataSource
          .getRepository(CommunicationApproval)
          .delete(messages.map((m) => ({ communicationMessageId: m.id })));
        await dataSource
          .getRepository(CommunicationMessage)
          .delete(messages.map((m) => ({ id: m.id })));
      }
      await dataSource
        .getRepository(CommunicationTemplate)
        .delete({ tenantId: TENANT_ID });
      await dataSource.destroy();
    }
  }, 30_000);

  it('delivers a ROUTINE/DRAFTED message, marks it SENT, and writes a signed communication.delivered event', async () => {
    const message = await messageService.draft(TENANT_ID, CASE_ID, {
      recipientRelationship: 'BORROWER',
      channel: 'EMAIL',
      locale: 'en-US',
      templateKey: 'CDS-SPEC-REQUEST-EVIDENCE',
      templateVersion: '1.0.0',
      variables: { evidenceType: 'pay stub' },
      hasAttachments: false,
    });
    expect(message.classification).toBe(CommunicationClassification.ROUTINE);

    const result = await deliveryService.deliver(TENANT_ID, message.id);

    if (result.outcome !== 'DELIVERED') {
      throw new Error(`expected DELIVERED, got ${result.outcome}`);
    }
    expect(result.deliveryReference).toMatch(/^sim-[0-9a-f]{24}$/);

    const updated = await dataSource
      .getRepository(CommunicationMessage)
      .findOneByOrFail({ id: message.id });
    expect(updated.status).toBe(CommunicationMessageStatus.SENT);
    expect(updated.deliveryReference).toBe(result.deliveryReference);
    expect(updated.sentAt).not.toBeNull();

    const events = await dataSource.getRepository(OutboxEvent).find({
      where: {
        caseId: CASE_ID,
        eventType: OutboxEventType.CommunicationDelivered,
      },
    });
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({
      communicationMessageId: message.id,
      classification: CommunicationClassification.ROUTINE,
      deliveryReference: result.deliveryReference,
    });
    expect(events[0].payload.renderedContent).toBeUndefined();
    expect(
      verifyOutboxSignature(
        events[0].payload,
        events[0].signature,
        OUTBOX_SIGNING_SECRET,
      ),
    ).toBe(true);
  });

  it('delivers a PROTECTED/APPROVED message once approved', async () => {
    const message = await messageService.draft(TENANT_ID, CASE_ID, {
      recipientRelationship: 'BORROWER',
      channel: 'EMAIL',
      locale: 'en-US',
      variables: {},
      freeformContent: 'Please call our office to discuss your file.',
      hasAttachments: false,
    });
    await approvalService.approve(TENANT_ID, message.id, 'reviewer-1');

    const result = await deliveryService.deliver(TENANT_ID, message.id);

    expect(result.outcome).toBe('DELIVERED');
    const updated = await dataSource
      .getRepository(CommunicationMessage)
      .findOneByOrFail({ id: message.id });
    expect(updated.status).toBe(CommunicationMessageStatus.SENT);
  });

  it('reports NOT_READY for a PROTECTED message awaiting approval, without delivering it', async () => {
    const message = await messageService.draft(TENANT_ID, CASE_ID, {
      recipientRelationship: 'BORROWER',
      channel: 'EMAIL',
      locale: 'en-US',
      variables: {},
      freeformContent: 'Your file needs additional review.',
      hasAttachments: false,
    });

    const result = await deliveryService.deliver(TENANT_ID, message.id);

    expect(result).toEqual({
      outcome: 'NOT_READY',
      reason: `communication message ${message.id} is PROTECTED/AWAITING_APPROVAL, not ready to send`,
    });
    const updated = await dataSource
      .getRepository(CommunicationMessage)
      .findOneByOrFail({ id: message.id });
    expect(updated.status).toBe(CommunicationMessageStatus.AWAITING_APPROVAL);
    expect(updated.deliveryReference).toBeNull();
  });

  it('reports NOT_READY for a message that was already sent, without delivering it twice', async () => {
    const message = await messageService.draft(TENANT_ID, CASE_ID, {
      recipientRelationship: 'BORROWER',
      channel: 'EMAIL',
      locale: 'en-US',
      templateKey: 'CDS-SPEC-REQUEST-EVIDENCE',
      templateVersion: '1.0.0',
      variables: { evidenceType: 'bank statement' },
      hasAttachments: false,
    });
    const first = await deliveryService.deliver(TENANT_ID, message.id);
    expect(first.outcome).toBe('DELIVERED');

    const second = await deliveryService.deliver(TENANT_ID, message.id);
    expect(second.outcome).toBe('NOT_READY');

    const events = await dataSource.getRepository(OutboxEvent).find({
      where: {
        caseId: CASE_ID,
        eventType: OutboxEventType.CommunicationDelivered,
      },
    });
    expect(
      events.filter((e) => e.payload.communicationMessageId === message.id),
    ).toHaveLength(1);
  });
});
