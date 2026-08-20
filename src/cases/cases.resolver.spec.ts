import 'reflect-metadata';
import { CasesResolver, CasePolicyBindingResolver } from './cases.resolver';
import { LoanCase, CaseStatus } from '../database/entities/loan-case.entity';
import { LoanType } from '../database/enums/loan-type.enum';
import { CasePolicyBinding } from '../database/entities/case-policy-binding.entity';

describe('CasesResolver (Section 15.2, M6)', () => {
  let casesService: { getCase: jest.Mock; getTimeline: jest.Mock };
  let caseQueryService: {
    listEvidenceFacts: jest.Mock;
    listConditions: jest.Mock;
    getActivePolicyBinding: jest.Mock;
    listProviderOperationIntents: jest.Mock;
    listAuditEvents: jest.Mock;
    getPolicySnapshot: jest.Mock;
    listCases: jest.Mock;
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
      getActivePolicyBinding: jest.fn().mockResolvedValue(null),
      listProviderOperationIntents: jest.fn().mockResolvedValue([]),
      listAuditEvents: jest.fn().mockResolvedValue([]),
      getPolicySnapshot: jest.fn().mockResolvedValue(null),
      listCases: jest.fn().mockResolvedValue({
        edges: [],
        pageInfo: { hasNextPage: false, endCursor: null },
      }),
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

  it('cases() resolves via CaseQueryService.listCases() using the authenticated tenantId and passes filter/pagination args through unchanged', async () => {
    await resolver.cases(
      TENANT_ID,
      CaseStatus.DRAFT,
      'borrower-1',
      10,
      'some-cursor',
    );
    expect(caseQueryService.listCases).toHaveBeenCalledWith(TENANT_ID, {
      status: CaseStatus.DRAFT,
      borrowerId: 'borrower-1',
      first: 10,
      after: 'some-cursor',
    });
  });

  it('cases() works with no optional filter/pagination args at all', async () => {
    await resolver.cases(TENANT_ID);
    expect(caseQueryService.listCases).toHaveBeenCalledWith(TENANT_ID, {
      status: undefined,
      borrowerId: undefined,
      first: undefined,
      after: undefined,
    });
  });

  it('policyBinding() field resolver scopes by the parent case’s own tenantId/id', async () => {
    await resolver.policyBinding(CASE);
    expect(caseQueryService.getActivePolicyBinding).toHaveBeenCalledWith(
      TENANT_ID,
      CASE_ID,
    );
  });

  it('providerOperations() field resolver scopes by the parent case’s own tenantId/id', async () => {
    await resolver.providerOperations(CASE);
    expect(caseQueryService.listProviderOperationIntents).toHaveBeenCalledWith(
      TENANT_ID,
      CASE_ID,
    );
  });

  it('auditEvents() field resolver scopes by the parent case’s own tenantId/id', async () => {
    await resolver.auditEvents(CASE);
    expect(caseQueryService.listAuditEvents).toHaveBeenCalledWith(
      TENANT_ID,
      CASE_ID,
    );
  });
});

describe('CasePolicyBindingResolver (Section 15.2, M6)', () => {
  const TENANT_ID = '11111111-1111-1111-1111-111111111111';
  const BINDING: CasePolicyBinding = {
    id: '33333333-3333-3333-3333-333333333333',
    tenantId: TENANT_ID,
    caseId: '22222222-2222-2222-2222-222222222222',
    dependencyDigest: 'a'.repeat(64),
    observedCatalogGeneration: 1,
    contextKey: 'US-CA|CONVENTIONAL|CASE_CREATED',
    policySnapshotId: '44444444-4444-4444-4444-444444444444',
    boundAt: new Date(),
    revalidateAfter: new Date(),
    invalidatedAt: null,
  };

  it('policySnapshot() field resolver scopes by the parent binding’s own tenantId/policySnapshotId', async () => {
    const caseQueryService = {
      getPolicySnapshot: jest.fn().mockResolvedValue(null),
    };
    const resolver = new CasePolicyBindingResolver(caseQueryService as never);

    await resolver.policySnapshot(BINDING);

    expect(caseQueryService.getPolicySnapshot).toHaveBeenCalledWith(
      TENANT_ID,
      BINDING.policySnapshotId,
    );
  });
});
