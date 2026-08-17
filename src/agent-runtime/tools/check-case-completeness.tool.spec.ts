import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Tenant } from '../../database/entities/tenant.entity';
import { LoanCase } from '../../database/entities/loan-case.entity';
import { Jurisdiction } from '../../database/entities/jurisdiction.entity';
import {
  EvidenceFact,
  EvidenceType,
  EvidenceSourceKind,
} from '../../database/entities/evidence-fact.entity';
import { LoanApplication } from '../../database/entities/loan-application.entity';
import {
  JurisdictionLevel,
  JurisdictionCoverageStatus,
} from '../../database/enums/jurisdiction.enum';
import { LoanType } from '../../database/enums/loan-type.enum';
import { CaseStatus } from '../../database/enums/case-status.enum';
import { checkCaseCompletenessTool } from './check-case-completeness.tool';

const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

const JURISDICTION_CODE = 'US-CCT-TEST';

describeOrSkip('checkCaseCompletenessTool', () => {
  let dataSource: DataSource;
  let tool: ReturnType<typeof checkCaseCompletenessTool>;
  let tenantId: string;
  const caseIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [Tenant, LoanCase, Jurisdiction, EvidenceFact, LoanApplication],
    });
    await dataSource.initialize();
    tool = checkCaseCompletenessTool({ dataSource });

    const tenant = await dataSource
      .getRepository(Tenant)
      .save(
        dataSource
          .getRepository(Tenant)
          .create({ name: 'CCT Tool Spec Tenant' }),
      );
    tenantId = tenant.id;

    await dataSource.getRepository(Jurisdiction).save(
      dataSource.getRepository(Jurisdiction).create({
        code: JURISDICTION_CODE,
        level: JurisdictionLevel.STATE,
        name: 'checkCaseCompletenessTool test',
        coverageStatus: JurisdictionCoverageStatus.COVERED,
      }),
    );
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.getRepository(EvidenceFact).delete({ tenantId });
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
        idempotencyKey: `cct-tool-spec-${Date.now()}-${Math.random()}`,
        borrowerId: 'cct-tool-spec-borrower',
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

  it('reports incomplete with every missing fact type when no evidence exists', async () => {
    const caseId = await makeCase();

    const result = await tool.execute({ tenantId, caseId }, {});

    expect(result.complete).toBe(false);
    expect(result.missingFactTypes.sort()).toEqual(
      [EvidenceType.INCOME, EvidenceType.CREDIT, EvidenceType.DOCUMENT].sort(),
    );
  });

  it('reports the specific fact types still missing when some evidence exists', async () => {
    const caseId = await makeCase();
    const evidenceRepo = dataSource.getRepository(EvidenceFact);
    await evidenceRepo.save(
      evidenceRepo.create({
        tenantId,
        caseId,
        factType: EvidenceType.INCOME,
        sourceKind: EvidenceSourceKind.SIMULATOR,
        sourceIdentifier: 'plaid-simulator',
        value: { monthlyIncome: 9000 },
        observedAt: new Date(),
      }),
    );

    const result = await tool.execute({ tenantId, caseId }, {});

    expect(result.complete).toBe(false);
    expect(result.missingFactTypes).toEqual([
      EvidenceType.CREDIT,
      EvidenceType.DOCUMENT,
    ]);
  });

  it('reports complete once income, credit, and document evidence all exist', async () => {
    const caseId = await makeCase();
    const evidenceRepo = dataSource.getRepository(EvidenceFact);
    for (const factType of [
      EvidenceType.INCOME,
      EvidenceType.CREDIT,
      EvidenceType.DOCUMENT,
    ]) {
      await evidenceRepo.save(
        evidenceRepo.create({
          tenantId,
          caseId,
          factType,
          sourceKind: EvidenceSourceKind.SIMULATOR,
          sourceIdentifier: 'test-simulator',
          value: {},
          observedAt: new Date(),
        }),
      );
    }

    const result = await tool.execute({ tenantId, caseId }, {});

    expect(result).toEqual({ complete: true, missingFactTypes: [] });
  });
});
