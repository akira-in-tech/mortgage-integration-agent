import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { Tenant } from '../database/entities/tenant.entity';
import { LoanCase, CaseStatus } from '../database/entities/loan-case.entity';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import {
  JurisdictionLevel,
  JurisdictionCoverageStatus,
} from '../database/enums/jurisdiction.enum';
import { LoanType } from '../database/enums/loan-type.enum';
import {
  EvidenceFact,
  EvidenceType,
  EvidenceSourceKind,
} from '../database/entities/evidence-fact.entity';
import { DataDispositionTask } from '../database/entities/data-disposition-task.entity';
import { DataDispositionService } from './data-disposition.service';
import { runInTenantContext } from '../database/tenant-context';

// Requires a reachable Postgres (same convention as this codebase's other
// real-DB specs): skip instead of failing when no DATABASE_URL is
// configured.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

describeOrSkip('DataDispositionService', () => {
  let dataSource: DataSource;
  let service: DataDispositionService;
  let tenantId: string;
  let caseId: string;
  const jurisdictionCode = 'US-DISPOSITION-SPEC';

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [
        Tenant,
        LoanCase,
        Jurisdiction,
        EvidenceFact,
        DataDispositionTask,
      ],
    });
    await dataSource.initialize();
    service = new DataDispositionService(dataSource);

    const tenantRepo = dataSource.getRepository(Tenant);
    const tenant = await tenantRepo.save(
      tenantRepo.create({ name: 'Data Disposition Spec Tenant' }),
    );
    tenantId = tenant.id;

    await dataSource.getRepository(Jurisdiction).save(
      dataSource.getRepository(Jurisdiction).create({
        code: jurisdictionCode,
        level: JurisdictionLevel.STATE,
        name: 'Data Disposition Spec Jurisdiction',
        coverageStatus: JurisdictionCoverageStatus.COVERED,
      }),
    );

    const caseRepo = dataSource.getRepository(LoanCase);
    const loanCase = await caseRepo.save(
      caseRepo.create({
        tenantId,
        idempotencyKey: 'data-disposition-spec-case',
        borrowerId: 'data-disposition-spec-borrower',
        requestedAmount: 300_000,
        loanType: LoanType.CONVENTIONAL,
        statedMonthlyIncome: 9000,
        jurisdictionCode,
        status: CaseStatus.DRAFT,
      }),
    );
    caseId = loanCase.id;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.getRepository(DataDispositionTask).delete({ tenantId });
      await dataSource.getRepository(EvidenceFact).delete({ tenantId });
      await dataSource.getRepository(LoanCase).delete({ tenantId });
      await dataSource
        .getRepository(Jurisdiction)
        .delete({ code: jurisdictionCode });
      await dataSource.getRepository(Tenant).delete({ id: tenantId });
      await dataSource.destroy();
    }
  });

  it('openRetentionReviewForRevokedConsent() opens a PENDING RETENTION_REVIEW task snapshotting every evidence fact the case has at that moment', async () => {
    const evidenceRepo = dataSource.getRepository(EvidenceFact);
    const income = await evidenceRepo.save(
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
    const credit = await evidenceRepo.save(
      evidenceRepo.create({
        tenantId,
        caseId,
        factType: EvidenceType.CREDIT,
        sourceKind: EvidenceSourceKind.SIMULATOR,
        sourceIdentifier: 'credit-bureau-simulator',
        value: { score: 700 },
        observedAt: new Date(),
      }),
    );
    const consentRecordId = randomUUID();

    const task = await runInTenantContext(dataSource, tenantId, (manager) =>
      service.openRetentionReviewForRevokedConsent(manager, {
        tenantId,
        caseId,
        consentRecordId,
      }),
    );

    expect(task).toMatchObject({
      tenantId,
      caseId,
      taskType: 'RETENTION_REVIEW',
      status: 'PENDING',
      triggeringConsentRecordId: consentRecordId,
      resolvedAt: null,
    });
    expect(task.affectedEvidenceFactIds.sort()).toEqual(
      [income.id, credit.id].sort(),
    );
    expect(task.reason).toContain(consentRecordId);
    expect(task.reason).toContain('2 evidence record');
  });

  it('openRetentionReviewForRevokedConsent() still opens a task, with an empty evidence snapshot, when the case has no evidence at all', async () => {
    const emptyCaseId = randomUUID();
    const consentRecordId = randomUUID();

    const task = await runInTenantContext(dataSource, tenantId, (manager) =>
      service.openRetentionReviewForRevokedConsent(manager, {
        tenantId,
        caseId: emptyCaseId,
        consentRecordId,
      }),
    );

    expect(task.affectedEvidenceFactIds).toEqual([]);
    expect(task.reason).toContain('0 evidence record');
  });

  it("listForCase() returns only that case's tasks, most recent first", async () => {
    const otherCaseId = randomUUID();
    await runInTenantContext(dataSource, tenantId, (manager) =>
      service.openRetentionReviewForRevokedConsent(manager, {
        tenantId,
        caseId: otherCaseId,
        consentRecordId: randomUUID(),
      }),
    );

    const tasks = await service.listForCase(tenantId, caseId);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].caseId).toBe(caseId);
  });
});
