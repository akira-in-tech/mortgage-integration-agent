import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { createCaseConditionsActivities } from './case-conditions.activities';
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
import { LoanType } from '../database/enums/loan-type.enum';
import { CaseStatus } from '../database/enums/case-status.enum';
import { PlaidIncomeData } from '../integrations/plaid/plaid.types';
import { CreditBureauData } from '../integrations/credit/credit.types';
import { DocumentVerificationResult } from '../integrations/document/document.types';

// Requires a reachable Postgres (same convention as test/loan.e2e-spec.ts):
// skip instead of failing when no DATABASE_URL is configured. Writes
// synthetic rows directly to the configured database, same as the e2e
// suite, and cleans them up in afterAll.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

const GOOD_INCOME: PlaidIncomeData = {
  monthlyIncome: 9000,
  employmentStatus: 'FULL_TIME',
  bankAccountAge: 48,
  incomeStability: 88,
};
const CLEAN_CREDIT: CreditBureauData = {
  creditScore: 760,
  debtToIncomeRatio: 0.3,
  paymentHistory: 'EXCELLENT',
  openAccounts: 4,
  derogatoryMarks: 0,
};
const DISCREPANT_CREDIT: CreditBureauData = {
  ...CLEAN_CREDIT,
  derogatoryMarks: 2,
};
const VALID_DOCS: DocumentVerificationResult = {
  w2Valid: true,
  payStubValid: true,
  bankStatementValid: true,
  taxReturnValid: true,
  allDocumentsValid: true,
  failedDocuments: [],
};

describeOrSkip('createCaseConditionsActivities', () => {
  let dataSource: DataSource;
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
      ],
    });
    await dataSource.initialize();

    const plaidService = { getIncomeData: jest.fn() } as any;
    const creditService = { getCreditData: jest.fn() } as any;
    const documentService = { verifyDocuments: jest.fn() } as any;
    activities = createCaseConditionsActivities({
      dataSource,
      plaidService,
      creditService,
      documentService,
    });

    const tenant = await dataSource
      .getRepository(Tenant)
      .save(
        dataSource
          .getRepository(Tenant)
          .create({ name: 'Activities Spec Tenant' }),
      );
    tenantId = tenant.id;
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const caseRepo = dataSource.getRepository(LoanCase);
      const evidenceRepo = dataSource.getRepository(EvidenceFact);
      const conditionRepo = dataSource.getRepository(LoanCondition);
      if (caseIds.length > 0) {
        await evidenceRepo.delete({ tenantId });
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
      await dataSource.destroy();
    }
  }, 30_000);

  async function makeCase(): Promise<string> {
    const caseRepo = dataSource.getRepository(LoanCase);
    const loanCase = await caseRepo.save(
      caseRepo.create({
        tenantId,
        idempotencyKey: `activities-spec-${Date.now()}-${Math.random()}`,
        borrowerId: 'activities-spec-borrower',
        requestedAmount: 300_000,
        loanType: LoanType.CONVENTIONAL,
        status: CaseStatus.DRAFT,
      }),
    );
    caseIds.push(loanCase.id);
    return loanCase.id;
  }

  it('markCollectingEvidence sets the case status', async () => {
    const caseId = await makeCase();
    await activities.markCollectingEvidence({ tenantId, caseId });

    const updated = await dataSource
      .getRepository(LoanCase)
      .findOneByOrFail({ id: caseId });
    expect(updated.status).toBe(CaseStatus.COLLECTING_EVIDENCE);
  });

  it('fetchIncomeEvidence persists an INCOME evidence fact and returns the simulator data', async () => {
    const caseId = await makeCase();
    const plaidService = {
      getIncomeData: jest.fn().mockResolvedValue(GOOD_INCOME),
    } as any;
    const scoped = createCaseConditionsActivities({
      dataSource,
      plaidService,
      creditService: { getCreditData: jest.fn() } as any,
      documentService: { verifyDocuments: jest.fn() } as any,
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
  });

  it('evaluateConditions with clean data marks the case ready and opens no condition', async () => {
    const caseId = await makeCase();

    const result = await activities.evaluateConditions({
      tenantId,
      caseId,
      income: GOOD_INCOME,
      credit: CLEAN_CREDIT,
      documents: VALID_DOCS,
    });

    expect(result).toEqual({ hasOpenCondition: false });
    const updated = await dataSource
      .getRepository(LoanCase)
      .findOneByOrFail({ id: caseId });
    expect(updated.status).toBe(CaseStatus.READY_FOR_UNDERWRITING);
    const conditions = await dataSource
      .getRepository(LoanCondition)
      .find({ where: { caseId } });
    expect(conditions).toHaveLength(0);
  });

  it('evaluateConditions with a discrepancy opens a condition and sets CONDITIONS_OPEN', async () => {
    const caseId = await makeCase();

    const result = await activities.evaluateConditions({
      tenantId,
      caseId,
      income: GOOD_INCOME,
      credit: DISCREPANT_CREDIT,
      documents: VALID_DOCS,
    });

    expect(result.hasOpenCondition).toBe(true);
    expect(result.conditionId).toBeDefined();

    const updated = await dataSource
      .getRepository(LoanCase)
      .findOneByOrFail({ id: caseId });
    expect(updated.status).toBe(CaseStatus.CONDITIONS_OPEN);

    const condition = await dataSource
      .getRepository(LoanCondition)
      .findOneByOrFail({ id: result.conditionId });
    expect(condition.status).toBe(ConditionStatus.OPEN);
    expect(condition.code).toBe('SYNTHETIC_DISCREPANCY_REVIEW');
    expect(condition.description).toContain('derogatory mark');
  });

  it('resolveCondition updates the condition and records an attributed transition', async () => {
    const caseId = await makeCase();
    const { conditionId } = await activities.evaluateConditions({
      tenantId,
      caseId,
      income: GOOD_INCOME,
      credit: DISCREPANT_CREDIT,
      documents: VALID_DOCS,
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
  });

  it('markReadyForUnderwriting sets the case status', async () => {
    const caseId = await makeCase();
    await activities.markReadyForUnderwriting({ tenantId, caseId });

    const updated = await dataSource
      .getRepository(LoanCase)
      .findOneByOrFail({ id: caseId });
    expect(updated.status).toBe(CaseStatus.READY_FOR_UNDERWRITING);
  });
});
