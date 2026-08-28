import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { CommunicationMessage } from '../database/entities/communication-message.entity';
import { CommunicationTemplate } from '../database/entities/communication-template.entity';
import {
  CommunicationClassification,
  CommunicationMessageStatus,
  CommunicationTemplateStatus,
} from '../database/enums/communication.enum';
import {
  runInTenantContext,
  runWithRlsBypass,
} from '../database/tenant-context';

// Requires a reachable Postgres with the CommunicationTenantIsolation and
// AppRuntimeRole migrations applied: skip instead of failing when no
// DATABASE_URL is configured — same convention as every other real-DB
// spec in this codebase.
//
// M5-009's proof, same pattern as evaluation-manifest-tenant-isolation
// .spec.ts (M5-007) and policy-change-impact-assessment-tenant-isolation
// .spec.ts (M5-008): connects as the real `mortgage_app` role (M5-003),
// not DATABASE_URL's own, since a superuser connection would pass every
// one of these assertions trivially by bypassing RLS entirely. Both
// tables have their own direct `tenantId` column — no join needed.
// `communication_approvals` is deliberately not covered here — see the
// CommunicationTenantIsolation migration's own comment for why.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

const APP_ROLE = 'mortgage_app';
const APP_ROLE_PASSWORD =
  process.env.APP_DATABASE_ROLE_PASSWORD ?? 'mortgage_app_demo';

function withCredentials(url: string, user: string, password: string): string {
  const parsed = new URL(url);
  parsed.username = user;
  parsed.password = password;
  return parsed.toString();
}

describeOrSkip(
  'communication_messages/communication_templates row-level security',
  () => {
    let restrictedDataSource: DataSource;
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    let templateA: CommunicationTemplate;
    let templateB: CommunicationTemplate;
    let messageA: CommunicationMessage;
    let messageB: CommunicationMessage;

    beforeAll(async () => {
      restrictedDataSource = new DataSource({
        type: 'postgres',
        url: withCredentials(
          DATABASE_URL as string,
          APP_ROLE,
          APP_ROLE_PASSWORD,
        ),
        entities: [CommunicationMessage, CommunicationTemplate],
      });
      await restrictedDataSource.initialize();

      function makeTemplate(tenantId: string) {
        const repo = restrictedDataSource.getRepository(CommunicationTemplate);
        return repo.create({
          tenantId,
          templateKey: 'RLS_SPEC_TEMPLATE',
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
        });
      }
      function makeMessage(tenantId: string, templateId: string) {
        const repo = restrictedDataSource.getRepository(CommunicationMessage);
        return repo.create({
          tenantId,
          caseId: randomUUID(),
          classification: CommunicationClassification.ROUTINE,
          classificationReasons: [],
          templateId,
          recipientRelationship: 'BORROWER',
          channel: 'EMAIL',
          locale: 'en-US',
          variables: { evidenceType: 'pay stub' },
          renderedContent: 'Please provide pay stub.',
          renderedContentHash: 'a'.repeat(64),
          status: CommunicationMessageStatus.DRAFTED,
        });
      }

      templateA = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) =>
          manager
            .getRepository(CommunicationTemplate)
            .save(makeTemplate(tenantA)),
      );
      templateB = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager
            .getRepository(CommunicationTemplate)
            .save(makeTemplate(tenantB)),
      );
      messageA = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) =>
          manager
            .getRepository(CommunicationMessage)
            .save(makeMessage(tenantA, templateA.id)),
      );
      messageB = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager
            .getRepository(CommunicationMessage)
            .save(makeMessage(tenantB, templateB.id)),
      );
    });

    afterAll(async () => {
      if (restrictedDataSource?.isInitialized) {
        await runWithRlsBypass(restrictedDataSource, async (manager) => {
          await manager
            .getRepository(CommunicationMessage)
            .delete([messageA.id, messageB.id]);
          await manager
            .getRepository(CommunicationTemplate)
            .delete([templateA.id, templateB.id]);
        });
        await restrictedDataSource.destroy();
      }
    });

    it('a query with no tenant context and no bypass sees zero rows on both tables, even though real rows exist', async () => {
      const messages = await restrictedDataSource
        .getRepository(CommunicationMessage)
        .find();
      const templates = await restrictedDataSource
        .getRepository(CommunicationTemplate)
        .find();
      expect(messages).toHaveLength(0);
      expect(templates).toHaveLength(0);
    });

    it("tenant A's context sees only tenant A's rows on both tables", async () => {
      const result = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        async (manager) => ({
          messages: await manager.getRepository(CommunicationMessage).find(),
          templates: await manager.getRepository(CommunicationTemplate).find(),
        }),
      );
      expect(result.messages.map((m) => m.id)).toEqual([messageA.id]);
      expect(result.templates.map((t) => t.id)).toEqual([templateA.id]);
    });

    it("tenant B's context sees only tenant B's rows, never tenant A's", async () => {
      const result = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        async (manager) => ({
          messages: await manager.getRepository(CommunicationMessage).find(),
          templates: await manager.getRepository(CommunicationTemplate).find(),
        }),
      );
      expect(result.messages.map((m) => m.id)).toEqual([messageB.id]);
      expect(result.templates.map((t) => t.id)).toEqual([templateB.id]);
    });

    it("a direct lookup by id for a different tenant's message or template returns nothing, even though the row exists", async () => {
      const foundMessage = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager
            .getRepository(CommunicationMessage)
            .findOneBy({ id: messageA.id }),
      );
      const foundTemplate = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager
            .getRepository(CommunicationTemplate)
            .findOneBy({ id: templateA.id }),
      );
      expect(foundMessage).toBeNull();
      expect(foundTemplate).toBeNull();
    });

    it('an INSERT whose row tenantId does not match the session tenant context is rejected by PostgreSQL itself', async () => {
      await expect(
        runInTenantContext(restrictedDataSource, tenantB, (manager) => {
          const repo = manager.getRepository(CommunicationMessage);
          return repo.save(
            repo.create({
              // Row claims tenant A while the session context says tenant B.
              tenantId: tenantA,
              caseId: randomUUID(),
              classification: CommunicationClassification.ROUTINE,
              classificationReasons: [],
              templateId: null,
              recipientRelationship: 'BORROWER',
              channel: 'EMAIL',
              locale: 'en-US',
              variables: {},
              renderedContent: 'spoofed insert',
              renderedContentHash: 'b'.repeat(64),
              status: CommunicationMessageStatus.DRAFTED,
            }),
          );
        }),
      ).rejects.toThrow();
    });

    it("bypass mode sees every tenant's rows on both tables at once — the one explicit, audited exception", async () => {
      const result = await runWithRlsBypass(
        restrictedDataSource,
        async (manager) => ({
          messages: await manager.getRepository(CommunicationMessage).find(),
          templates: await manager.getRepository(CommunicationTemplate).find(),
        }),
      );
      expect(result.messages.map((m) => m.id)).toEqual(
        expect.arrayContaining([messageA.id, messageB.id]),
      );
      expect(result.templates.map((t) => t.id)).toEqual(
        expect.arrayContaining([templateA.id, templateB.id]),
      );
    });
  },
);
