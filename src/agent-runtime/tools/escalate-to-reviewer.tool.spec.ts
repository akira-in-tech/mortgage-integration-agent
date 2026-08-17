import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Tenant } from '../../database/entities/tenant.entity';
import { LoanCase, CaseStatus } from '../../database/entities/loan-case.entity';
import { Jurisdiction } from '../../database/entities/jurisdiction.entity';
import { OutboxEvent } from '../../database/entities/outbox-event.entity';
import { LoanApplication } from '../../database/entities/loan-application.entity';
import {
  JurisdictionLevel,
  JurisdictionCoverageStatus,
} from '../../database/enums/jurisdiction.enum';
import { LoanType } from '../../database/enums/loan-type.enum';
import { OutboxEventType } from '../../database/outbox/outbox-event-types';
import { verifyOutboxSignature } from '../../database/outbox/outbox-signer';
import { escalateToReviewerTool } from './escalate-to-reviewer.tool';

const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

const JURISDICTION_CODE = 'US-ETR-TEST';
const OUTBOX_SIGNING_SECRET = 'escalate-to-reviewer-tool-spec-secret-3';

describeOrSkip('escalateToReviewerTool', () => {
  let dataSource: DataSource;
  let tool: ReturnType<typeof escalateToReviewerTool>;
  let tenantId: string;
  const caseIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [Tenant, LoanCase, Jurisdiction, OutboxEvent, LoanApplication],
    });
    await dataSource.initialize();
    tool = escalateToReviewerTool({
      dataSource,
      outboxSigningSecret: OUTBOX_SIGNING_SECRET,
    });

    const tenant = await dataSource
      .getRepository(Tenant)
      .save(
        dataSource
          .getRepository(Tenant)
          .create({ name: 'ETR Tool Spec Tenant' }),
      );
    tenantId = tenant.id;

    await dataSource.getRepository(Jurisdiction).save(
      dataSource.getRepository(Jurisdiction).create({
        code: JURISDICTION_CODE,
        level: JurisdictionLevel.STATE,
        name: 'escalateToReviewerTool test',
        coverageStatus: JurisdictionCoverageStatus.COVERED,
      }),
    );
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.getRepository(OutboxEvent).delete({ tenantId });
      if (caseIds.length) {
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
        idempotencyKey: `etr-tool-spec-${Date.now()}-${Math.random()}`,
        borrowerId: 'etr-tool-spec-borrower',
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

  it('declares the Section 9.4 registered-tool metadata', () => {
    expect(tool.name).toBe('escalate_to_reviewer');
    expect(tool.sideEffect).toBe('WORKFLOW_TRANSITION');
    expect(tool.approvalBoundary).toBe('No');
  });

  it('moves the case to WAITING_FOR_REVIEW and writes a signed case.escalated event', async () => {
    const caseId = await makeCase();

    const result = await tool.execute(
      { tenantId, caseId },
      { reason: 'contradictory income evidence', expectedCaseVersion: 1 },
    );

    expect(result).toEqual({ outcome: 'ESCALATED' });

    const updatedCase = await dataSource
      .getRepository(LoanCase)
      .findOneByOrFail({ id: caseId });
    expect(updatedCase.status).toBe(CaseStatus.WAITING_FOR_REVIEW);
    expect(updatedCase.version).toBe(2);

    const events = await dataSource
      .getRepository(OutboxEvent)
      .find({ where: { caseId } });
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(OutboxEventType.CaseEscalated);
    expect(events[0].payload).toEqual({
      caseId,
      reason: 'contradictory income evidence',
    });
    expect(
      verifyOutboxSignature(
        events[0].payload,
        events[0].signature,
        OUTBOX_SIGNING_SECRET,
      ),
    ).toBe(true);
  });

  it('returns STALE_CASE_VERSION and writes nothing when the case has changed since the expected version', async () => {
    const caseId = await makeCase();
    await dataSource
      .getRepository(LoanCase)
      .update({ id: caseId }, { borrowerId: 'etr-tool-spec-borrower-2' });

    const result = await tool.execute(
      { tenantId, caseId },
      { reason: 'irrelevant', expectedCaseVersion: 1 },
    );

    expect(result).toEqual({ outcome: 'STALE_CASE_VERSION' });
    const events = await dataSource
      .getRepository(OutboxEvent)
      .find({ where: { caseId } });
    expect(events).toHaveLength(0);
    const updatedCase = await dataSource
      .getRepository(LoanCase)
      .findOneByOrFail({ id: caseId });
    expect(updatedCase.status).toBe(CaseStatus.DRAFT);
  });
});
