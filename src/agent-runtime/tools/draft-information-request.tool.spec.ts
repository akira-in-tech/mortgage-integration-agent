import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { CommunicationTemplate } from '../../database/entities/communication-template.entity';
import { CommunicationMessage } from '../../database/entities/communication-message.entity';
import { CommunicationApproval } from '../../database/entities/communication-approval.entity';
import { CommunicationTemplateStatus } from '../../database/enums/communication.enum';
import { CommunicationMessageService } from '../../communications/communication-message.service';
import { draftInformationRequestTool } from './draft-information-request.tool';

const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

const TENANT_ID = '66666666-6666-6666-6666-666666666666';
const CASE_ID = '77777777-7777-7777-7777-777777777777';

describeOrSkip('draftInformationRequestTool', () => {
  let dataSource: DataSource;
  let tool: ReturnType<typeof draftInformationRequestTool>;

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

    const messageService = new CommunicationMessageService(dataSource);
    tool = draftInformationRequestTool({ messageService });

    const templateRepo = dataSource.getRepository(CommunicationTemplate);
    await templateRepo.save(
      templateRepo.create({
        tenantId: TENANT_ID,
        templateKey: 'DIR-TOOL-SPEC-REQUEST',
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
      const messages = await dataSource
        .getRepository(CommunicationMessage)
        .find({ where: { tenantId: TENANT_ID } });
      if (messages.length) {
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

  it('declares the Section 9.4 registered-tool metadata', () => {
    expect(tool.name).toBe('draft_information_request');
    expect(tool.sideEffect).toBe('CASE_MUTATION');
    expect(tool.approvalBoundary).toBe('No');
  });

  it('drafts a ROUTINE message and returns its classification', async () => {
    const result = await tool.execute(
      { tenantId: TENANT_ID, caseId: CASE_ID },
      {
        recipientRelationship: 'BORROWER',
        channel: 'EMAIL',
        locale: 'en-US',
        templateKey: 'DIR-TOOL-SPEC-REQUEST',
        templateVersion: '1.0.0',
        variables: { evidenceType: 'bank statement' },
      },
    );

    expect(result.classification).toBe('ROUTINE');
    expect(result.classificationReasons).toEqual([]);
    expect(result.communicationMessageId).toBeDefined();

    const persisted = await dataSource
      .getRepository(CommunicationMessage)
      .findOneByOrFail({ id: result.communicationMessageId });
    expect(persisted.renderedContent).toBe('Please provide bank statement.');
  });

  it('drafts a PROTECTED message when free-form content is supplied, with reasons returned', async () => {
    const result = await tool.execute(
      { tenantId: TENANT_ID, caseId: CASE_ID },
      {
        recipientRelationship: 'BORROWER',
        channel: 'EMAIL',
        locale: 'en-US',
        freeformContent: 'We need additional information about your file.',
      },
    );

    expect(result.classification).toBe('PROTECTED');
    expect(result.classificationReasons).toEqual(['free-form material text']);
  });
});
