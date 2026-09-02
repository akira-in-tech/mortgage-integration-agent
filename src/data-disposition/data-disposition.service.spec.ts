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
import { AuditEvent } from '../database/entities/audit-event.entity';
import { DataDispositionService } from './data-disposition.service';
import { LegalHoldService } from './legal-hold.service';
import { AuditEventService } from '../audit/audit-event.service';
import { runInTenantContext } from '../database/tenant-context';
import { ProviderOperationIntent } from '../database/entities/provider-operation-intent.entity';
import {
  ProviderCapabilityStatus,
  ProviderOperationIntentStatus,
} from '../database/enums/provider-platform.enum';

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
        AuditEvent,
        ProviderOperationIntent,
      ],
    });
    await dataSource.initialize();
    const auditEventService = new AuditEventService(dataSource);
    legalHoldService = new LegalHoldService(dataSource, auditEventService);
    service = new DataDispositionService(
      dataSource,
      legalHoldService,
      auditEventService,
    );

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
      await dataSource
        .getRepository(ProviderOperationIntent)
        .delete({ tenantId });
      await dataSource.getRepository(EvidenceFact).delete({ tenantId });
      await dataSource.getRepository(LoanCase).delete({ tenantId });
      await dataSource
        .getRepository(Jurisdiction)
        .delete({ code: jurisdictionCode });
      await dataSource.getRepository(Tenant).delete({ id: tenantId });
      // audit_events is append-only by design (its own migration's
      // trigger rejects UPDATE/DELETE unconditionally) — this spec's own
      // DATA_DISPOSITION_TASK_RESOLVED/LEGAL_HOLD_* rows are left in
      // place, same convention as audit-event.service.spec.ts's own
      // afterAll.
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

    const [storedIncome] = (await dataSource.query(
      `SELECT "value" FROM "evidence_facts" WHERE "id" = $1`,
      [income.id],
    )) as Array<{ value: Record<string, unknown> }>;
    expect(JSON.stringify(storedIncome.value)).not.toContain('9000');
    expect(storedIncome.value).toMatchObject({
      v: 1,
      alg: 'A256GCM',
      kid: 'local-v1',
    });
    expect(
      (await evidenceRepo.findOneByOrFail({ id: income.id })).value,
    ).toEqual({ monthlyIncome: 9000 });

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
    async function makeCaseWithTask(
      providerState = ProviderOperationIntentStatus.SUCCEEDED,
    ): Promise<{
      resolveCaseId: string;
      taskId: string;
      evidenceIds: string[];
      providerIntentId: string;
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
      const providerIntent = await dataSource
        .getRepository(ProviderOperationIntent)
        .save({
          tenantId,
          caseId: resolveCaseId,
          providerId: 'lineage-spec-provider',
          capability: ProviderCapabilityStatus.INCOME,
          effectClass: 'REUSABLE_LOOKUP',
          requestFingerprint: 'a'.repeat(64),
          idempotencyKey: randomUUID(),
          logicalOperationKey: randomUUID(),
          authorizationGrantId: randomUUID(),
          providerReceipt: { sensitive: 'receipt' },
          normalizedFinding: { sensitive: 'finding' },
          state: providerState,
          resolvedBy: null,
          resolutionNote: null,
        });
      // Re-open after the provider result exists so the task snapshots the
      // complete derived lineage rather than only the evidence row.
      await dataSource
        .getRepository(DataDispositionTask)
        .delete({ id: task.id });
      const completeTask = await runInTenantContext(
        dataSource,
        tenantId,
        (manager) =>
          service.openRetentionReviewForRevokedConsent(manager, {
            tenantId,
            caseId: resolveCaseId,
            consentRecordId: randomUUID(),
          }),
      );
      return {
        resolveCaseId,
        taskId: completeTask.id,
        evidenceIds: [income.id],
        providerIntentId: providerIntent.id,
      };
    }

    it('DELETE really removes the referenced evidence_facts rows and marks the task VERIFIED/DELETED', async () => {
      const { taskId, evidenceIds, providerIntentId } =
        await makeCaseWithTask();

      const resolved = await service.resolve(
        tenantId,
        taskId,
        'DELETE',
        'disposition-spec-operator',
      );
      expect(resolved).toMatchObject({
        status: 'COMPLETED',
        resolutionOutcome: 'DELETED',
        resolvedBy: 'disposition-spec-operator',
      });
      expect(resolved.resolvedAt).not.toBeNull();
      expect(resolved.backupExpiryDueAt).not.toBeNull();

      const remaining = await dataSource
        .getRepository(EvidenceFact)
        .find({ where: { id: evidenceIds[0] } });
      expect(remaining).toHaveLength(0);
      const scrubbedIntent = await dataSource
        .getRepository(ProviderOperationIntent)
        .findOneByOrFail({ id: providerIntentId });
      expect(scrubbedIntent.providerReceipt).toBeNull();
      expect(scrubbedIntent.normalizedFinding).toBeNull();

      await expect(
        service.verifyBackupExpiry(
          tenantId,
          taskId,
          'disposition-spec-operator',
          'backup-evidence://too-early',
        ),
      ).rejects.toThrow(/has not expired/);
      await dataSource
        .getRepository(DataDispositionTask)
        .update(
          { id: taskId },
          { backupExpiryDueAt: new Date(Date.now() - 1000) },
        );
      const verified = await service.verifyBackupExpiry(
        tenantId,
        taskId,
        'disposition-spec-operator',
        'backup-evidence://retention-window-expired',
      );
      expect(verified).toMatchObject({
        status: 'VERIFIED',
        backupVerificationReference:
          'backup-evidence://retention-window-expired',
      });
      expect(verified.backupExpiryVerifiedAt).not.toBeNull();
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
        status: 'COMPLETED',
        resolutionOutcome: 'ANONYMIZED',
      });

      const fact = await dataSource
        .getRepository(EvidenceFact)
        .findOneByOrFail({ id: evidenceIds[0] });
      expect(fact.value).toEqual({});
    });

    it('cancels PREPARED provider work before deletion so a later dispatch cannot restore deleted data', async () => {
      const { taskId, providerIntentId } = await makeCaseWithTask(
        ProviderOperationIntentStatus.PREPARED,
      );

      await service.resolve(
        tenantId,
        taskId,
        'DELETE',
        'disposition-spec-operator',
      );

      const intent = await dataSource
        .getRepository(ProviderOperationIntent)
        .findOneByOrFail({ id: providerIntentId });
      expect(intent).toMatchObject({
        state: ProviderOperationIntentStatus.CANCELLED,
        resolvedBy: 'disposition-spec-operator',
        providerReceipt: null,
        normalizedFinding: null,
      });
    });

    it.each([
      ProviderOperationIntentStatus.DISPATCHED,
      ProviderOperationIntentStatus.OUTCOME_UNKNOWN,
      ProviderOperationIntentStatus.RECONCILING,
    ])(
      'blocks deletion while provider state %s can still produce or hide an outcome',
      async (providerState) => {
        const { taskId, evidenceIds, providerIntentId } =
          await makeCaseWithTask(providerState);

        await expect(
          service.resolve(
            tenantId,
            taskId,
            'DELETE',
            'disposition-spec-operator',
          ),
        ).rejects.toThrow(/require outcome reconciliation/);

        expect(
          await dataSource
            .getRepository(EvidenceFact)
            .findOneBy({ id: evidenceIds[0] }),
        ).not.toBeNull();
        expect(
          (
            await dataSource
              .getRepository(ProviderOperationIntent)
              .findOneByOrFail({ id: providerIntentId })
          ).providerReceipt,
        ).not.toBeNull();
      },
    );

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

    it('rejects resolving a task that is already awaiting backup expiry', async () => {
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
      ).rejects.toThrow(/already COMPLETED/);
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

    // M7-028: the M5 audit found the audit-event write lived only in
    // DataDispositionController, so resolve-data-disposition-task.ts (a
    // real caller that calls service.resolve() directly, the same way
    // this spec does) produced no audit_events row at all — a
    // script-driven resolution and a REST-driven one left different
    // provenance behind for the identical mutation. Calling resolve()
    // straight from the spec, exactly as that script does, is the real
    // regression test for that gap.
    it('resolve() records a real DATA_DISPOSITION_TASK_RESOLVED audit event, even called directly (not through a controller)', async () => {
      const { taskId } = await makeCaseWithTask();

      await service.resolve(tenantId, taskId, 'DELETE', 'audit-spec-operator');

      const events = await runInTenantContext(dataSource, tenantId, (manager) =>
        manager.getRepository(AuditEvent).find({
          where: {
            tenantId,
            action: 'DATA_DISPOSITION_TASK_RESOLVED',
            resourceId: taskId,
          },
        }),
      );
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        tenantId,
        actorId: 'audit-spec-operator',
        action: 'DATA_DISPOSITION_TASK_RESOLVED',
        resourceType: 'data_disposition_task',
        resourceId: taskId,
        reason: 'Resolved as DELETE',
        metadata: { action: 'DELETE' },
      });
    });
  });
});
