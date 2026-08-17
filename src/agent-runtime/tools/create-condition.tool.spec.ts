import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Tenant } from '../../database/entities/tenant.entity';
import { LoanCase, CaseStatus } from '../../database/entities/loan-case.entity';
import { Jurisdiction } from '../../database/entities/jurisdiction.entity';
import {
  LoanCondition,
  ConditionStatus,
} from '../../database/entities/loan-condition.entity';
import { OutboxEvent } from '../../database/entities/outbox-event.entity';
import { LoanApplication } from '../../database/entities/loan-application.entity';
import {
  JurisdictionLevel,
  JurisdictionCoverageStatus,
} from '../../database/enums/jurisdiction.enum';
import { LoanType } from '../../database/enums/loan-type.enum';
import { OutboxEventType } from '../../database/outbox/outbox-event-types';
import { createConditionTool } from './create-condition.tool';

const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

const JURISDICTION_CODE = 'US-CCR-TEST';
const OUTBOX_SIGNING_SECRET = 'create-condition-tool-spec-secret-32c';

describeOrSkip('createConditionTool', () => {
  let dataSource: DataSource;
  let tool: ReturnType<typeof createConditionTool>;
  let tenantId: string;
  const caseIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [
        Tenant,
        LoanCase,
        Jurisdiction,
        LoanCondition,
        OutboxEvent,
        LoanApplication,
      ],
    });
    await dataSource.initialize();
    tool = createConditionTool({
      dataSource,
      outboxSigningSecret: OUTBOX_SIGNING_SECRET,
    });

    const tenant = await dataSource
      .getRepository(Tenant)
      .save(
        dataSource
          .getRepository(Tenant)
          .create({ name: 'CCR Tool Spec Tenant' }),
      );
    tenantId = tenant.id;

    await dataSource.getRepository(Jurisdiction).save(
      dataSource.getRepository(Jurisdiction).create({
        code: JURISDICTION_CODE,
        level: JurisdictionLevel.STATE,
        name: 'createConditionTool test',
        coverageStatus: JurisdictionCoverageStatus.COVERED,
      }),
    );
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.getRepository(OutboxEvent).delete({ tenantId });
      if (caseIds.length) {
        const conditions = await dataSource
          .getRepository(LoanCondition)
          .find({ where: caseIds.map((caseId) => ({ caseId })) });
        if (conditions.length) {
          await dataSource
            .getRepository(LoanCondition)
            .delete(conditions.map((c) => ({ id: c.id })));
        }
        await dataSource.getRepository(LoanCase).delete(caseIds);
      }
      await dataSource.getRepository(Tenant).delete({ id: tenantId });
      await dataSource
        .getRepository(Jurisdiction)
        .delete({ code: JURISDICTION_CODE });
      await dataSource.destroy();
    }
  }, 30_000);

  async function makeCase(): Promise<string> {
    const caseRepo = dataSource.getRepository(LoanCase);
    const loanCase = await caseRepo.save(
      caseRepo.create({
        tenantId,
        idempotencyKey: `ccr-tool-spec-${Date.now()}-${Math.random()}`,
        borrowerId: 'ccr-tool-spec-borrower',
        requestedAmount: 300_000,
        loanType: LoanType.CONVENTIONAL,
        statedMonthlyIncome: 9000,
        jurisdictionCode: JURISDICTION_CODE,
        status: CaseStatus.DRAFT,
      }),
    );
    caseIds.push(loanCase.id);
    return loanCase.id;
  }

  it('creates an OPEN condition with the given policy references, moves the case to CONDITIONS_OPEN, and writes both outbox events atomically', async () => {
    const caseId = await makeCase();
    const policySnapshotId = '11111111-1111-1111-1111-111111111111';

    const { conditionId } = await tool.execute(
      { tenantId, caseId },
      {
        code: 'VERIFY_INCOME_DISCREPANCY',
        description: 'test description',
        policyVersionId: '22222222-2222-2222-2222-222222222222',
        ruleId: 'test-rule',
        policySnapshotId,
      },
    );

    const condition = await dataSource
      .getRepository(LoanCondition)
      .findOneByOrFail({ id: conditionId });
    expect(condition.status).toBe(ConditionStatus.OPEN);
    expect(condition.code).toBe('VERIFY_INCOME_DISCREPANCY');
    expect(condition.policySnapshotId).toBe(policySnapshotId);

    const updatedCase = await dataSource
      .getRepository(LoanCase)
      .findOneByOrFail({ id: caseId });
    expect(updatedCase.status).toBe(CaseStatus.CONDITIONS_OPEN);

    const events = await dataSource
      .getRepository(OutboxEvent)
      .find({ where: { caseId }, order: { createdAt: 'ASC' } });
    expect(events.map((e) => e.eventType)).toEqual([
      OutboxEventType.ConditionOpened,
      OutboxEventType.WorkflowRunWaitingForReview,
    ]);
    expect(events[0].payload).toMatchObject({
      conditionId,
      policySnapshotId,
      ruleId: 'test-rule',
    });
  });
});
