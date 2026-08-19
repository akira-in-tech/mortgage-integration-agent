import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { CommunicationMessage } from '../database/entities/communication-message.entity';
import { CommunicationTemplate } from '../database/entities/communication-template.entity';
import { CommunicationApproval } from '../database/entities/communication-approval.entity';
import {
  CommunicationClassification,
  CommunicationMessageStatus,
} from '../database/enums/communication.enum';
import {
  runInTenantContext,
  runWithRlsBypass,
} from '../database/tenant-context';

// Requires a reachable Postgres with the CommunicationApprovalTenant
// Isolation and AppRuntimeRole migrations applied: skip instead of
// failing when no DATABASE_URL is configured — same convention as every
// other real-DB spec in this codebase.
//
// M5-018's proof. Unlike most specs in this series, `communication_
// approvals` has no `tenantId` column of its own — its policy is a
// join through `communication_messages` (the same join-based shape
// `condition_transitions`/`tool_attempts` already established,
// case-core-tenant-isolation.spec.ts), so every fixture row here needs a
// real parent message to reference.
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

describeOrSkip('communication_approvals row-level security', () => {
  let restrictedDataSource: DataSource;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  let messageA: CommunicationMessage;
  let messageB: CommunicationMessage;
  let approvalA: CommunicationApproval;
  let approvalB: CommunicationApproval;

  beforeAll(async () => {
    restrictedDataSource = new DataSource({
      type: 'postgres',
      url: withCredentials(DATABASE_URL as string, APP_ROLE, APP_ROLE_PASSWORD),
      entities: [
        CommunicationMessage,
        CommunicationTemplate,
        CommunicationApproval,
      ],
    });
    await restrictedDataSource.initialize();

    function makeMessage(tenantId: string) {
      const repo = restrictedDataSource.getRepository(CommunicationMessage);
      return repo.create({
        tenantId,
        caseId: randomUUID(),
        classification: CommunicationClassification.PROTECTED,
        classificationReasons: ['freeform content'],
        templateId: null,
        recipientRelationship: 'BORROWER',
        channel: 'EMAIL',
        locale: 'en-US',
        variables: {},
        renderedContent: 'tenant-isolation-spec content',
        renderedContentHash: 'a'.repeat(64),
        status: CommunicationMessageStatus.DRAFTED,
        deliveryReference: null,
        sentAt: null,
      });
    }

    messageA = await runInTenantContext(
      restrictedDataSource,
      tenantA,
      (manager) =>
        manager.getRepository(CommunicationMessage).save(makeMessage(tenantA)),
    );
    messageB = await runInTenantContext(
      restrictedDataSource,
      tenantB,
      (manager) =>
        manager.getRepository(CommunicationMessage).save(makeMessage(tenantB)),
    );

    function makeApproval(communicationMessageId: string) {
      const repo = restrictedDataSource.getRepository(CommunicationApproval);
      return repo.create({
        communicationMessageId,
        actorId: 'tenant-isolation-spec-reviewer',
        approvedRenderedContentHash: 'a'.repeat(64),
        reason: null,
      });
    }

    approvalA = await runInTenantContext(
      restrictedDataSource,
      tenantA,
      (manager) =>
        manager
          .getRepository(CommunicationApproval)
          .save(makeApproval(messageA.id)),
    );
    approvalB = await runInTenantContext(
      restrictedDataSource,
      tenantB,
      (manager) =>
        manager
          .getRepository(CommunicationApproval)
          .save(makeApproval(messageB.id)),
    );
  });

  afterAll(async () => {
    if (restrictedDataSource?.isInitialized) {
      await runWithRlsBypass(restrictedDataSource, async (manager) => {
        await manager
          .getRepository(CommunicationApproval)
          .delete([approvalA.id, approvalB.id]);
        await manager
          .getRepository(CommunicationMessage)
          .delete([messageA.id, messageB.id]);
      });
      await restrictedDataSource.destroy();
    }
  });

  it('a query with no tenant context and no bypass sees zero rows, even though real rows exist', async () => {
    const approvals = await restrictedDataSource
      .getRepository(CommunicationApproval)
      .find();
    expect(approvals).toHaveLength(0);
  });

  it("tenant A's context sees only tenant A's approval, via the join to its own message", async () => {
    const approvals = await runInTenantContext(
      restrictedDataSource,
      tenantA,
      (manager) => manager.getRepository(CommunicationApproval).find(),
    );
    expect(approvals.map((a) => a.id)).toEqual([approvalA.id]);
  });

  it("tenant B's context sees only tenant B's approval, never tenant A's", async () => {
    const approvals = await runInTenantContext(
      restrictedDataSource,
      tenantB,
      (manager) => manager.getRepository(CommunicationApproval).find(),
    );
    expect(approvals.map((a) => a.id)).toEqual([approvalB.id]);
  });

  it("a direct lookup by id for a different tenant's approval returns nothing, even though the row exists", async () => {
    const found = await runInTenantContext(
      restrictedDataSource,
      tenantB,
      (manager) =>
        manager
          .getRepository(CommunicationApproval)
          .findOneBy({ id: approvalA.id }),
    );
    expect(found).toBeNull();
  });

  it("an UPDATE against a different tenant's approval affects zero rows rather than erroring or succeeding silently", async () => {
    const result = await runInTenantContext(
      restrictedDataSource,
      tenantB,
      (manager) =>
        manager
          .getRepository(CommunicationApproval)
          .update(
            { id: approvalA.id },
            { reason: 'attempted cross-tenant edit' },
          ),
    );
    expect(result.affected).toBe(0);

    const stillIntact = await runInTenantContext(
      restrictedDataSource,
      tenantA,
      (manager) =>
        manager
          .getRepository(CommunicationApproval)
          .findOneByOrFail({ id: approvalA.id }),
    );
    expect(stillIntact.reason).toBeNull();
  });

  it('an INSERT referencing a message owned by a different tenant than the session context is rejected — the join-based policy blocks it, not just a direct tenantId mismatch', async () => {
    await expect(
      runInTenantContext(restrictedDataSource, tenantB, (manager) => {
        const repo = manager.getRepository(CommunicationApproval);
        return repo.save(
          repo.create({
            // messageA belongs to tenant A; the session context says
            // tenant B.
            communicationMessageId: messageA.id,
            actorId: 'tenant-isolation-spec-attacker',
            approvedRenderedContentHash: 'a'.repeat(64),
            reason: null,
          }),
        );
      }),
    ).rejects.toThrow();
  });

  it("bypass mode sees every tenant's approvals at once — the one explicit, audited exception", async () => {
    const approvals = await runWithRlsBypass(restrictedDataSource, (manager) =>
      manager.getRepository(CommunicationApproval).find(),
    );
    const ids = approvals.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining([approvalA.id, approvalB.id]));
  });
});
