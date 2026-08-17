import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { CommunicationTemplate } from '../database/entities/communication-template.entity';
import { CommunicationMessage } from '../database/entities/communication-message.entity';
import { CommunicationApproval } from '../database/entities/communication-approval.entity';
import {
  CommunicationClassification,
  CommunicationMessageStatus,
  CommunicationTemplateStatus,
} from '../database/enums/communication.enum';
import { CommunicationMessageService } from './communication-message.service';
import { CommunicationApprovalService } from './communication-approval.service';

const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

const TENANT_ID = '44444444-4444-4444-4444-444444444444';
const CASE_ID = '55555555-5555-5555-5555-555555555555';

describeOrSkip(
  'CommunicationMessageService + CommunicationApprovalService',
  () => {
    let dataSource: DataSource;
    let messageService: CommunicationMessageService;
    let approvalService: CommunicationApprovalService;
    let templateId: string;

    beforeAll(async () => {
      dataSource = new DataSource({
        type: 'postgres',
        url: DATABASE_URL,
        entities: [
          CommunicationTemplate,
          CommunicationMessage,
          CommunicationApproval,
        ],
      });
      await dataSource.initialize();

      messageService = new CommunicationMessageService(
        dataSource.getRepository(CommunicationTemplate),
        dataSource.getRepository(CommunicationMessage),
      );
      approvalService = new CommunicationApprovalService(
        dataSource.getRepository(CommunicationMessage),
        dataSource.getRepository(CommunicationApproval),
      );

      const templateRepo = dataSource.getRepository(CommunicationTemplate);
      const template = await templateRepo.save(
        templateRepo.create({
          tenantId: TENANT_ID,
          templateKey: 'CMS-SPEC-REQUEST-EVIDENCE',
          version: '1.0.0',
          channel: 'EMAIL',
          locale: 'en-US',
          recipientRelationship: 'BORROWER',
          bodyTemplate: 'Please provide {{evidenceType}} by {{dueDate}}.',
          allowedVariables: ['evidenceType', 'dueDate'],
          attachmentsAllowed: false,
          status: CommunicationTemplateStatus.APPROVED,
          approvedBy: 'policy-team',
          approvedAt: new Date(),
        }),
      );
      templateId = template.id;
    }, 30_000);

    afterAll(async () => {
      if (dataSource?.isInitialized) {
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

    it('drafts a ROUTINE message and persists the exact rendered content and its hash', async () => {
      const message = await messageService.draft(TENANT_ID, CASE_ID, {
        recipientRelationship: 'BORROWER',
        channel: 'EMAIL',
        locale: 'en-US',
        templateKey: 'CMS-SPEC-REQUEST-EVIDENCE',
        templateVersion: '1.0.0',
        variables: { evidenceType: 'pay stub', dueDate: '2026-09-01' },
        hasAttachments: false,
      });

      expect(message.classification).toBe(CommunicationClassification.ROUTINE);
      expect(message.classificationReasons).toEqual([]);
      expect(message.status).toBe(CommunicationMessageStatus.DRAFTED);
      expect(message.renderedContent).toBe(
        'Please provide pay stub by 2026-09-01.',
      );
      expect(message.renderedContentHash).toHaveLength(64);
      expect(message.templateId).toBe(templateId);

      const persisted = await dataSource
        .getRepository(CommunicationMessage)
        .findOneByOrFail({ id: message.id });
      expect(persisted.renderedContent).toBe(message.renderedContent);
    });

    it('drafts a PROTECTED message for free-form content and leaves it AWAITING_APPROVAL', async () => {
      const message = await messageService.draft(TENANT_ID, CASE_ID, {
        recipientRelationship: 'BORROWER',
        channel: 'EMAIL',
        locale: 'en-US',
        variables: {},
        freeformContent: 'Your loan was denied due to insufficient income.',
        hasAttachments: false,
      });

      expect(message.classification).toBe(
        CommunicationClassification.PROTECTED,
      );
      expect(message.status).toBe(CommunicationMessageStatus.AWAITING_APPROVAL);
      expect(message.classificationReasons).toEqual([
        'free-form material text',
      ]);
    });

    it('approves a PROTECTED message, binding the approval to its exact rendered-content hash', async () => {
      const message = await messageService.draft(TENANT_ID, CASE_ID, {
        recipientRelationship: 'BORROWER',
        channel: 'EMAIL',
        locale: 'en-US',
        variables: {},
        freeformContent: 'Please call our office to discuss your file.',
        hasAttachments: false,
      });

      const approval = await approvalService.approve(
        message.id,
        'reviewer-1',
        'Reviewed and cleared for sending.',
      );

      expect(approval.approvedRenderedContentHash).toBe(
        message.renderedContentHash,
      );
      expect(approval.actorId).toBe('reviewer-1');

      const updated = await dataSource
        .getRepository(CommunicationMessage)
        .findOneByOrFail({ id: message.id });
      expect(updated.status).toBe(CommunicationMessageStatus.APPROVED);
    });

    it('rejects approving a ROUTINE message', async () => {
      const message = await messageService.draft(TENANT_ID, CASE_ID, {
        recipientRelationship: 'BORROWER',
        channel: 'EMAIL',
        locale: 'en-US',
        templateKey: 'CMS-SPEC-REQUEST-EVIDENCE',
        templateVersion: '1.0.0',
        variables: { evidenceType: 'pay stub', dueDate: '2026-09-01' },
        hasAttachments: false,
      });

      await expect(
        approvalService.approve(message.id, 'reviewer-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects approving an already-approved message a second time', async () => {
      const message = await messageService.draft(TENANT_ID, CASE_ID, {
        recipientRelationship: 'BORROWER',
        channel: 'EMAIL',
        locale: 'en-US',
        variables: {},
        freeformContent: 'A second protected message.',
        hasAttachments: false,
      });
      await approvalService.approve(message.id, 'reviewer-1');

      await expect(
        approvalService.approve(message.id, 'reviewer-2'),
      ).rejects.toThrow(BadRequestException);
    });
  },
);
