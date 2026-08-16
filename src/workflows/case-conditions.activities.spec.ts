import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { createCaseConditionsActivities } from './case-conditions.activities';
import { PlaidService } from '../integrations/plaid/plaid.service';
import { CreditService } from '../integrations/credit/credit.service';
import { DocumentService } from '../integrations/document/document.service';
import { Tenant } from '../database/entities/tenant.entity';
import { LoanCase } from '../database/entities/loan-case.entity';
import {
  LoanCondition,
  ConditionStatus,
} from '../database/entities/loan-condition.entity';
import { ConditionTransition } from '../database/entities/condition-transition.entity';
import {
  EvidenceFact,
  EvidenceType,
} from '../database/entities/evidence-fact.entity';
import { LoanApplication } from '../database/entities/loan-application.entity';
import { OutboxEvent } from '../database/entities/outbox-event.entity';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import { PolicySource } from '../database/entities/policy-source.entity';
import { PolicySourceRevision } from '../database/entities/policy-source-revision.entity';
import { PolicyVersion } from '../database/entities/policy-version.entity';
import { PolicyApplicability } from '../database/entities/policy-applicability.entity';
import { LoanType } from '../database/enums/loan-type.enum';
import { CaseStatus } from '../database/enums/case-status.enum';
import {
  JurisdictionLevel,
  JurisdictionCoverageStatus,
} from '../database/enums/jurisdiction.enum';
import { PlaidIncomeData } from '../integrations/plaid/plaid.types';
import { OutboxEventType } from '../database/outbox/outbox-event-types';
import { verifyOutboxSignature } from '../database/outbox/outbox-signer';
import { PolicyApplicabilityResolverService } from '../policy/policy-applicability-resolver.service';

// Requires a reachable Postgres (same convention as test/loan.e2e-spec.ts):
// skip instead of failing when no DATABASE_URL is configured. Writes
// synthetic rows directly to the configured database, same as the e2e
// suite, and cleans them up in afterAll.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

const OUTBOX_SIGNING_SECRET = 'activities-spec-signing-secret-32-chars';

// Matches the SeedIncomeDiscrepancyPolicy migration's seeded rule exactly
// (jurisdiction, product, lifecycle event) — this suite relies on that
// migration having run against DATABASE_URL, the same way it already
// relies on the schema migrations having run.
const SEEDED_JURISDICTION_CODE = 'US-CA';
const NOT_COVERED_JURISDICTION_CODE = 'US-ZZ-ACTSPEC';

const GOOD_INCOME: PlaidIncomeData = {
  monthlyIncome: 9000,
  employmentStatus: 'FULL_TIME',
  bankAccountAge: 48,
  incomeStability: 88,
};

describeOrSkip('createCaseConditionsActivities', () => {
  let dataSource: DataSource;
  let policyResolver: PolicyApplicabilityResolverService;
  let activities: ReturnType<typeof createCaseConditionsActivities>;
  let tenantId: string;
  let caseIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [
        Tenant,
        LoanCase,
        LoanCondition,
        ConditionTransition,
        EvidenceFact,
        LoanApplication,
        OutboxEvent,
        Jurisdiction,
        PolicySource,
        PolicySourceRevision,
        PolicyVersion,
        PolicyApplicability,
      ],
    });
    await dataSource.initialize();

    policyResolver = new PolicyApplicabilityResolverService(
      dataSource.getRepository(Jurisdiction),
      dataSource.getRepository(PolicyApplicability),
      dataSource.getRepository(PolicyVersion),
    );

    const plaidService = { getIncomeData: jest.fn() } as any;
    const creditService = { getCreditData: jest.fn() } as any;
    const documentService = { verifyDocuments: jest.fn() } as any;
    activities = createCaseConditionsActivities({
      dataSource,
      plaidService,
      creditService,
      documentService,
      policyResolver,
      outboxSigningSecret: OUTBOX_SIGNING_SECRET,
    });

    const tenant = await dataSource
      .getRepository(Tenant)
      .save(
        dataSource
          .getRepository(Tenant)
          .create({ name: 'Activities Spec Tenant' }),
      );
    tenantId = tenant.id;

    // A real, catalogued jurisdiction that simply hasn't been reviewed for
    // coverage yet — a case CAN legally reference it (the FK just requires
    // the jurisdiction to exist), but the resolver must still fail closed
    // rather than treat "exists but not COVERED" as good enough.
    await dataSource.getRepository(Jurisdiction).save(
      dataSource.getRepository(Jurisdiction).create({
        code: NOT_COVERED_JURISDICTION_CODE,
        level: JurisdictionLevel.STATE,
        name: 'Not-yet-covered (activities spec)',
        coverageStatus: JurisdictionCoverageStatus.NOT_COVERED,
      }),
    );
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const caseRepo = dataSource.getRepository(LoanCase);
      const evidenceRepo = dataSource.getRepository(EvidenceFact);
      const conditionRepo = dataSource.getRepository(LoanCondition);
      const outboxRepo = dataSource.getRepository(OutboxEvent);
      if (caseIds.length > 0) {
        await evidenceRepo.delete({ tenantId });
        await outboxRepo.delete({ tenantId });
        const conditions = await conditionRepo.find({
          where: caseIds.map((caseId) => ({ caseId })),
        });
        if (conditions.length > 0) {
          await dataSource
            .getRepository(ConditionTransition)
            .delete(conditions.map((c) => ({ conditionId: c.id })));
          await conditionRepo.delete(conditions.map((c) => ({ id: c.id })));
        }
        await caseRepo.delete(caseIds);
      }
      await dataSource.getRepository(Tenant).delete({ id: tenantId });
      // After every case referencing it is gone (RESTRICT FK).
      await dataSource
        .getRepository(Jurisdiction)
        .delete({ code: NOT_COVERED_JURISDICTION_CODE });
      await dataSource.destroy();
    }
  }, 30_000);

  async function makeCase(overrides: {
    statedMonthlyIncome: number;
    jurisdictionCode?: string;
  }): Promise<string> {
    const caseRepo = dataSource.getRepository(LoanCase);
    const loanCase = await caseRepo.save(
      caseRepo.create({
        tenantId,
        idempotencyKey: `activities-spec-${Date.now()}-${Math.random()}`,
        borrowerId: 'activities-spec-borrower',
        requestedAmount: 300_000,
        loanType: LoanType.CONVENTIONAL,
        statedMonthlyIncome: overrides.statedMonthlyIncome,
        jurisdictionCode:
          overrides.jurisdictionCode ?? SEEDED_JURISDICTION_CODE,
        status: CaseStatus.DRAFT,
      }),
    );
    caseIds.push(loanCase.id);
    return loanCase.id;
  }

  async function outboxEventsFor(caseId: string) {
    return dataSource
      .getRepository(OutboxEvent)
      .find({ where: { caseId }, order: { createdAt: 'ASC' } });
  }

  it('markCollectingEvidence sets the case status and writes a signed workflow_run.started event', async () => {
    const caseId = await makeCase({ statedMonthlyIncome: 9000 });
    await activities.markCollectingEvidence({ tenantId, caseId });

    const updated = await dataSource
      .getRepository(LoanCase)
      .findOneByOrFail({ id: caseId });
    expect(updated.status).toBe(CaseStatus.COLLECTING_EVIDENCE);

    const events = await outboxEventsFor(caseId);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(OutboxEventType.WorkflowRunStarted);
    expect(events[0].tenantId).toBe(tenantId);
    // Round-trips through the real jsonb column and a fresh read — proves
    // the signature verifies against what Postgres actually stored, not
    // just the in-memory object at write time (see outbox-signer.ts's
    // canonicalization comment on why this specifically needs a real DB).
    expect(
      verifyOutboxSignature(
        events[0].payload,
        events[0].signature,
        OUTBOX_SIGNING_SECRET,
      ),
    ).toBe(true);
    expect(
      verifyOutboxSignature(
        events[0].payload,
        events[0].signature,
        'wrong-secret-value-at-least-16-chars',
      ),
    ).toBe(false);
  });

  it('fetchIncomeEvidence persists an INCOME evidence fact, returns the simulator data, and writes an evidence.updated event', async () => {
    const caseId = await makeCase({ statedMonthlyIncome: 9000 });
    const plaidService = {
      getIncomeData: jest.fn().mockResolvedValue(GOOD_INCOME),
    } as any;
    const scoped = createCaseConditionsActivities({
      dataSource,
      plaidService,
      creditService: { getCreditData: jest.fn() } as any,
      documentService: { verifyDocuments: jest.fn() } as any,
      policyResolver,
      outboxSigningSecret: OUTBOX_SIGNING_SECRET,
    });

    const result = await scoped.fetchIncomeEvidence({
      tenantId,
      caseId,
      borrowerId: 'activities-spec-borrower',
    });

    expect(result).toEqual(GOOD_INCOME);
    const facts = await dataSource
      .getRepository(EvidenceFact)
      .find({ where: { caseId, factType: EvidenceType.INCOME } });
    expect(facts).toHaveLength(1);
    expect(facts[0].value).toEqual(GOOD_INCOME);
    expect(facts[0].sourceIdentifier).toBe('plaid-simulator');

    const events = await outboxEventsFor(caseId);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(OutboxEventType.EvidenceUpdated);
    expect(events[0].payload).toMatchObject({
      caseId,
      evidenceType: EvidenceType.INCOME,
      sourceIdentifier: 'plaid-simulator',
    });
  });

  it('evaluateConditions with no income discrepancy marks the case ready and writes workflow_run.completed', async () => {
    // statedMonthlyIncome === verified income -> 0% difference, well under
    // the seeded rule's 10% threshold.
    const caseId = await makeCase({ statedMonthlyIncome: 9000 });

    const result = await activities.evaluateConditions({
      tenantId,
      caseId,
      income: GOOD_INCOME,
    });

    expect(result).toEqual({ outcome: 'READY' });
    const updated = await dataSource
      .getRepository(LoanCase)
      .findOneByOrFail({ id: caseId });
    expect(updated.status).toBe(CaseStatus.READY_FOR_UNDERWRITING);
    const conditions = await dataSource
      .getRepository(LoanCondition)
      .find({ where: { caseId } });
    expect(conditions).toHaveLength(0);

    const events = await outboxEventsFor(caseId);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(OutboxEventType.WorkflowRunCompleted);
    expect(events[0].payload).toMatchObject({
      caseId,
      finalStatus: CaseStatus.READY_FOR_UNDERWRITING,
    });
  });

  it('evaluateConditions with an income discrepancy opens a condition from the resolved rule and writes condition.opened + workflow_run.waiting_for_review atomically', async () => {
    // statedMonthlyIncome=12000 vs verified 9000 -> 25% difference, over
    // the seeded rule's 10% threshold.
    const caseId = await makeCase({ statedMonthlyIncome: 12_000 });

    const result = await activities.evaluateConditions({
      tenantId,
      caseId,
      income: GOOD_INCOME,
    });

    expect(result.outcome).toBe('CONDITION_OPENED');
    expect(result.conditionId).toBeDefined();

    const updated = await dataSource
      .getRepository(LoanCase)
      .findOneByOrFail({ id: caseId });
    expect(updated.status).toBe(CaseStatus.CONDITIONS_OPEN);

    const condition = await dataSource
      .getRepository(LoanCondition)
      .findOneByOrFail({ id: result.conditionId });
    expect(condition.status).toBe(ConditionStatus.OPEN);
    // Code comes from the resolved policy rule's own outcome, not a
    // hardcoded string — this is the seeded Section 10.7 example rule.
    expect(condition.code).toBe('VERIFY_INCOME_DISCREPANCY');
    expect(condition.description).toContain('difference_percent');

    const events = await outboxEventsFor(caseId);
    expect(events.map((e) => e.eventType)).toEqual([
      OutboxEventType.ConditionOpened,
      OutboxEventType.WorkflowRunWaitingForReview,
    ]);
    expect(events[0].payload).toMatchObject({
      caseId,
      conditionId: result.conditionId,
      ruleId: 'synthetic-income-discrepancy-review',
    });
  });

  it('evaluateConditions routes to REVIEW_REQUIRED when the jurisdiction exists but is not COVERED', async () => {
    const caseId = await makeCase({
      statedMonthlyIncome: 9000,
      jurisdictionCode: NOT_COVERED_JURISDICTION_CODE,
    });

    const result = await activities.evaluateConditions({
      tenantId,
      caseId,
      income: GOOD_INCOME,
    });

    expect(result.outcome).toBe('REVIEW_REQUIRED');
    expect(result.reviewReason).toContain(NOT_COVERED_JURISDICTION_CODE);

    const updated = await dataSource
      .getRepository(LoanCase)
      .findOneByOrFail({ id: caseId });
    // evaluateConditions itself does not write case state for
    // REVIEW_REQUIRED — the workflow calls markManualReview separately
    // (case-conditions.workflow.ts), so status is still whatever it was
    // before this call.
    expect(updated.status).toBe(CaseStatus.DRAFT);
  });

  it('resolveCondition updates the condition, records an attributed transition, and writes condition.satisfied or condition.waived', async () => {
    const caseId = await makeCase({ statedMonthlyIncome: 12_000 });
    const { conditionId } = await activities.evaluateConditions({
      tenantId,
      caseId,
      income: GOOD_INCOME,
    });

    await activities.resolveCondition({
      tenantId,
      caseId,
      conditionId: conditionId!,
      actorId: 'reviewer-activities-spec',
      resolution: 'WAIVED',
      reason: 'Confirmed acceptable in this test.',
    });

    const condition = await dataSource
      .getRepository(LoanCondition)
      .findOneByOrFail({ id: conditionId });
    expect(condition.status).toBe(ConditionStatus.WAIVED);

    const transitions = await dataSource
      .getRepository(ConditionTransition)
      .find({ where: { conditionId } });
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toMatchObject({
      fromStatus: ConditionStatus.OPEN,
      toStatus: ConditionStatus.WAIVED,
      actorId: 'reviewer-activities-spec',
      reason: 'Confirmed acceptable in this test.',
    });

    const events = await outboxEventsFor(caseId);
    // condition.opened + workflow_run.waiting_for_review from
    // evaluateConditions above, then condition.waived from this call.
    expect(events).toHaveLength(3);
    expect(events[2].eventType).toBe(OutboxEventType.ConditionWaived);
    expect(events[2].payload).toMatchObject({
      caseId,
      conditionId,
      actorId: 'reviewer-activities-spec',
      resolution: 'WAIVED',
    });
  });

  it('markReadyForUnderwriting sets the case status and writes workflow_run.completed', async () => {
    const caseId = await makeCase({ statedMonthlyIncome: 9000 });
    await activities.markReadyForUnderwriting({ tenantId, caseId });

    const updated = await dataSource
      .getRepository(LoanCase)
      .findOneByOrFail({ id: caseId });
    expect(updated.status).toBe(CaseStatus.READY_FOR_UNDERWRITING);

    const events = await outboxEventsFor(caseId);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(OutboxEventType.WorkflowRunCompleted);
  });

  it('markManualReview sets the case status and writes a workflow_run.failed event with the given reason', async () => {
    const caseId = await makeCase({ statedMonthlyIncome: 9000 });
    await activities.markManualReview({
      tenantId,
      caseId,
      reason: 'synthetic failure for markManualReview test',
    });

    const updated = await dataSource
      .getRepository(LoanCase)
      .findOneByOrFail({ id: caseId });
    expect(updated.status).toBe(CaseStatus.MANUAL_REVIEW);

    const events = await outboxEventsFor(caseId);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(OutboxEventType.WorkflowRunFailed);
    expect(events[0].payload).toMatchObject({
      caseId,
      reason: 'synthetic failure for markManualReview test',
    });
  });

  describe('retry classification against real provider simulators', () => {
    // Real PlaidService/CreditService/DocumentService, not mocks — proves
    // the full chain (simulator throws a synthetic failure -> the
    // activity's callProviderWithRetryClassification reclassifies it as
    // an ApplicationFailure with the right retry decision), not just that
    // a mocked collaborator was called correctly.
    let realActivities: ReturnType<typeof createCaseConditionsActivities>;

    beforeAll(() => {
      realActivities = createCaseConditionsActivities({
        dataSource,
        plaidService: new PlaidService(),
        creditService: new CreditService(),
        documentService: new DocumentService(),
        policyResolver,
        outboxSigningSecret: OUTBOX_SIGNING_SECRET,
      });
    });

    it('classifies a synthetic transient provider failure as retryable', async () => {
      const caseId = await makeCase({ statedMonthlyIncome: 9000 });
      await expect(
        realActivities.fetchIncomeEvidence({
          tenantId,
          caseId,
          borrowerId: 'SYNTHETIC-TRANSIENT-FAILURE-x',
        }),
      ).rejects.toMatchObject({
        nonRetryable: false,
        type: 'TransientProviderFailure',
      });

      // The provider call failed before the transaction that would have
      // written an EvidenceFact/outbox row ever started.
      const facts = await dataSource
        .getRepository(EvidenceFact)
        .find({ where: { caseId } });
      expect(facts).toHaveLength(0);
      expect(await outboxEventsFor(caseId)).toHaveLength(0);
    });

    it('classifies a synthetic terminal provider failure as non-retryable', async () => {
      const caseId = await makeCase({ statedMonthlyIncome: 9000 });
      await expect(
        realActivities.fetchCreditEvidence({
          tenantId,
          caseId,
          borrowerId: 'SYNTHETIC-TERMINAL-FAILURE-x',
        }),
      ).rejects.toMatchObject({
        nonRetryable: true,
        type: 'TerminalProviderFailure',
      });
    });

    it('leaves an unrecognized error unclassified (propagated as-is)', async () => {
      const caseId = await makeCase({ statedMonthlyIncome: 9000 });
      const brokenPlaid = {
        getIncomeData: jest.fn().mockRejectedValue(new Error('unrelated bug')),
      } as any;
      const scoped = createCaseConditionsActivities({
        dataSource,
        plaidService: brokenPlaid,
        creditService: new CreditService(),
        documentService: new DocumentService(),
        policyResolver,
        outboxSigningSecret: OUTBOX_SIGNING_SECRET,
      });

      await expect(
        scoped.fetchIncomeEvidence({
          tenantId,
          caseId,
          borrowerId: 'irrelevant',
        }),
      ).rejects.toThrow('unrelated bug');
    });
  });
});
