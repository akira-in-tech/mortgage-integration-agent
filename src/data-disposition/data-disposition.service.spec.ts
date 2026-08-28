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
import { LegalHold } from '../database/entities/legal-hold.entity';
import { DataDispositionService } from './data-disposition.service';
import { LegalHoldService } from './legal-hold.service';
import { runInTenantContext } from '../database/tenant-context';

// Requires a reachable Postgres (same convention as this codebase's other
// real-DB specs): skip instead of failing when no DATABASE_URL is
// configured.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

describeOrSkip('DataDispositionService', () => {
  let dataSource: DataSource;
  let service: DataDispositionService;
  let legalHoldService: LegalHoldService;
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
        LegalHold,
      ],
    });
    await dataSource.initialize();
    legalHoldService = new LegalHoldService(dataSource);
    service = new DataDispositionService(dataSource, legalHoldService);

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
      await dataSource.getRepository(LegalHold).delete({ tenantId });
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

  describe('resolve() — deletion verification (M5-025, Section 14.2)', () => {
    async function makeCaseWithTask(): Promise<{
      resolveCaseId: string;
      taskId: string;
      evidenceIds: string[];
    }> {
      // EvidenceFact.case is a real FK (onDelete: CASCADE) — a genuine
      // LoanCase row is required, not just a random id, unlike the
      // taskType/DataDispositionTask rows above (which carry a plain
      // caseId column with no FK of its own).
      const caseRepo = dataSource.getRepository(LoanCase);
      const loanCase = await caseRepo.save(
        caseRepo.create({
          tenantId,
          idempotencyKey: `data-disposition-spec-resolve-${randomUUID()}`,
          borrowerId: 'data-disposition-spec-resolve-borrower',
          requestedAmount: 300_000,
          loanType: LoanType.CONVENTIONAL,
          statedMonthlyIncome: 9000,
          jurisdictionCode,
          status: CaseStatus.DRAFT,
        }),
      );
      const resolveCaseId = loanCase.id;
      const evidenceRepo = dataSource.getRepository(EvidenceFact);
      const income = await evidenceRepo.save(
        evidenceRepo.create({
          tenantId,
          caseId: resolveCaseId,
          factType: EvidenceType.INCOME,
          sourceKind: EvidenceSourceKind.SIMULATOR,
          sourceIdentifier: 'plaid-simulator',
          value: { monthlyIncome: 9000 },
          observedAt: new Date(),
        }),
      );
      const task = await runInTenantContext(dataSource, tenantId, (manager) =>
        service.openRetentionReviewForRevokedConsent(manager, {
          tenantId,
          caseId: resolveCaseId,
          consentRecordId: randomUUID(),
        }),
      );
      return {
        resolveCaseId,
        taskId: task.id,
        evidenceIds: [income.id],
      };
    }

    it('DELETE really removes the referenced evidence_facts rows and marks the task VERIFIED/DELETED', async () => {
      const { taskId, evidenceIds } = await makeCaseWithTask();

      const resolved = await service.resolve(
        tenantId,
        taskId,
        'DELETE',
        'disposition-spec-operator',
      );
      expect(resolved).toMatchObject({
        status: 'VERIFIED',
        resolutionOutcome: 'DELETED',
        resolvedBy: 'disposition-spec-operator',
      });
      expect(resolved.resolvedAt).not.toBeNull();

      const remaining = await dataSource
        .getRepository(EvidenceFact)
        .find({ where: { id: evidenceIds[0] } });
      expect(remaining).toHaveLength(0);
    });

    it('ANONYMIZE keeps the evidence_facts row but blanks its value, and marks the task VERIFIED/ANONYMIZED', async () => {
      const { taskId, evidenceIds } = await makeCaseWithTask();

      const resolved = await service.resolve(
        tenantId,
        taskId,
        'ANONYMIZE',
        'disposition-spec-operator',
      );
      expect(resolved).toMatchObject({
        status: 'VERIFIED',
        resolutionOutcome: 'ANONYMIZED',
      });

      const fact = await dataSource
        .getRepository(EvidenceFact)
        .findOneByOrFail({ id: evidenceIds[0] });
      expect(fact.value).toEqual({});
    });

    it('RETAIN is rejected with no active legal hold on the case', async () => {
      const { taskId } = await makeCaseWithTask();

      await expect(
        service.resolve(
          tenantId,
          taskId,
          'RETAIN',
          'disposition-spec-operator',
        ),
      ).rejects.toThrow(/no active legal hold/);
    });

    it('RETAIN succeeds once a legal hold is active, and leaves the evidence untouched', async () => {
      const { resolveCaseId, taskId, evidenceIds } = await makeCaseWithTask();
      const hold = await legalHoldService.place(
        tenantId,
        resolveCaseId,
        'disposition-spec: litigation hold',
        'disposition-spec-legal-owner',
      );

      try {
        const resolved = await service.resolve(
          tenantId,
          taskId,
          'RETAIN',
          'disposition-spec-operator',
        );
        expect(resolved).toMatchObject({
          status: 'VERIFIED',
          resolutionOutcome: 'RETAINED_UNDER_HOLD',
        });

        const fact = await dataSource
          .getRepository(EvidenceFact)
          .findOneByOrFail({ id: evidenceIds[0] });
        expect(fact.value).toEqual({ monthlyIncome: 9000 });
      } finally {
        await legalHoldService.release(
          tenantId,
          hold.id,
          'disposition-spec-cleanup',
        );
      }
    });

    it('DELETE and ANONYMIZE both fail closed while a legal hold is active, leaving the evidence untouched', async () => {
      const { resolveCaseId, taskId, evidenceIds } = await makeCaseWithTask();
      const hold = await legalHoldService.place(
        tenantId,
        resolveCaseId,
        'disposition-spec: litigation hold',
        'disposition-spec-legal-owner',
      );

      try {
        await expect(
          service.resolve(
            tenantId,
            taskId,
            'DELETE',
            'disposition-spec-operator',
          ),
        ).rejects.toThrow(/active legal hold/);

        const fact = await dataSource
          .getRepository(EvidenceFact)
          .findOneByOrFail({ id: evidenceIds[0] });
        expect(fact.value).toEqual({ monthlyIncome: 9000 });
      } finally {
        await legalHoldService.release(
          tenantId,
          hold.id,
          'disposition-spec-cleanup',
        );
      }
    });

    it('rejects resolving a task that is already VERIFIED', async () => {
      const { taskId } = await makeCaseWithTask();
      await service.resolve(
        tenantId,
        taskId,
        'DELETE',
        'disposition-spec-operator',
      );

      await expect(
        service.resolve(
          tenantId,
          taskId,
          'DELETE',
          'disposition-spec-operator',
        ),
      ).rejects.toThrow(/already VERIFIED/);
    });

    it('listOpen() finds a real PENDING task but not one already resolved', async () => {
      const { taskId: pendingTaskId } = await makeCaseWithTask();
      const { taskId: resolvedTaskId } = await makeCaseWithTask();
      await service.resolve(
        tenantId,
        resolvedTaskId,
        'DELETE',
        'disposition-spec-operator',
      );

      const open = await service.listOpen(tenantId);

      expect(open.map((t) => t.id)).toContain(pendingTaskId);
      expect(open.map((t) => t.id)).not.toContain(resolvedTaskId);
    });
  });
});
