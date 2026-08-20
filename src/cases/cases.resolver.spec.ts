import 'reflect-metadata';
import { CasesResolver } from './cases.resolver';
import { LoanCase, CaseStatus } from '../database/entities/loan-case.entity';
import { LoanType } from '../database/enums/loan-type.enum';

describe('CasesResolver (Section 15.2, M6)', () => {
  let casesService: { getCase: jest.Mock; getTimeline: jest.Mock };
  let caseQueryService: {
    listEvidenceFacts: jest.Mock;
    listConditions: jest.Mock;
  };
  let resolver: CasesResolver;

  const TENANT_ID = '11111111-1111-1111-1111-111111111111';
  const CASE_ID = '22222222-2222-2222-2222-222222222222';
  const CASE: LoanCase = {
    id: CASE_ID,
    tenantId: TENANT_ID,
    idempotencyKey: 'key-1',
    borrowerId: 'borrower-1',
    requestedAmount: 300_000,
    loanType: LoanType.CONVENTIONAL,
    statedMonthlyIncome: 9000,
    jurisdictionCode: 'US-CA',
    status: CaseStatus.DRAFT,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    casesService = {
      getCase: jest.fn().mockResolvedValue(CASE),
      getTimeline: jest.fn().mockResolvedValue([]),
    };
    caseQueryService = {
      listEvidenceFacts: jest.fn().mockResolvedValue([]),
      listConditions: jest.fn().mockResolvedValue([]),
    };
    resolver = new CasesResolver(
      casesService as never,
      caseQueryService as never,
    );
  });

  it('case() resolves via CasesService.getCase() using the authenticated tenantId, never a caller-suppliable one', async () => {
    const result = await resolver.case(TENANT_ID, CASE_ID);
    expect(result).toBe(CASE);
    expect(casesService.getCase).toHaveBeenCalledWith(TENANT_ID, CASE_ID);
  });

  it('evidenceFacts() field resolver scopes by the parent case’s own tenantId/id, not any argument a client could supply', async () => {
    await resolver.evidenceFacts(CASE);
    expect(caseQueryService.listEvidenceFacts).toHaveBeenCalledWith(
      TENANT_ID,
      CASE_ID,
    );
  });

  it('conditions() field resolver scopes by the parent case’s own tenantId/id', async () => {
    await resolver.conditions(CASE);
    expect(caseQueryService.listConditions).toHaveBeenCalledWith(
      TENANT_ID,
      CASE_ID,
    );
  });

  it('timeline() field resolver delegates to the same CaseTimelineService the REST route already uses', async () => {
    await resolver.timeline(CASE);
    expect(casesService.getTimeline).toHaveBeenCalledWith(TENANT_ID, CASE_ID);
  });
});
