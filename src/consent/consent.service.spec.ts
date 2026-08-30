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
import { ConsentRecord } from '../database/entities/consent-record.entity';
import {
  EvidenceFact,
  EvidenceType,
  EvidenceSourceKind,
} from '../database/entities/evidence-fact.entity';
import { DataDispositionTask } from '../database/entities/data-disposition-task.entity';
import { AuditEvent } from '../database/entities/audit-event.entity';
import { ConsentService } from './consent.service';
import { DataDispositionService } from '../data-disposition/data-disposition.service';
import { LegalHoldService } from '../data-disposition/legal-hold.service';
import { AuditEventService } from '../audit/audit-event.service';

// Requires a reachable Postgres (same convention as this codebase's other
// real-DB specs): skip instead of failing when no DATABASE_URL is
// configured.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

describeOrSkip('ConsentService', () => {
  let dataSource: DataSource;
  let service: ConsentService;
  let tenantId: string;
  let caseId: string;
  const jurisdictionCode = 'US-CONSENT-SPEC';

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [
        Tenant,
        LoanCase,
        Jurisdiction,
        ConsentRecord,
        EvidenceFact,
        DataDispositionTask,
        AuditEvent,
      ],
    });
    await dataSource.initialize();
    const auditEventService = new AuditEventService(dataSource);
    service = new ConsentService(
      dataSource,
      new DataDispositionService(
        dataSource,
        new LegalHoldService(dataSource, auditEventService),
        auditEventService,
      ),
    );

    const tenantRepo = dataSource.getRepository(Tenant);
    const tenant = await tenantRepo.save(
      tenantRepo.create({ name: 'Consent Spec Tenant' }),
    );
    tenantId = tenant.id;

    await dataSource.getRepository(Jurisdiction).save(
      dataSource.getRepository(Jurisdiction).create({
        code: jurisdictionCode,
        level: JurisdictionLevel.STATE,
        name: 'Consent Spec Jurisdiction',
        coverageStatus: JurisdictionCoverageStatus.COVERED,
      }),
    );

    const caseRepo = dataSource.getRepository(LoanCase);
    const loanCase = await caseRepo.save(
      caseRepo.create({
        tenantId,
        idempotencyKey: 'consent-spec-case',
        borrowerId: 'consent-spec-borrower',
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
      await dataSource.getRepository(ConsentRecord).delete({ tenantId });
      await dataSource.getRepository(LoanCase).delete({ tenantId });
      await dataSource
        .getRepository(Jurisdiction)
        .delete({ code: jurisdictionCode });
      await dataSource.getRepository(Tenant).delete({ id: tenantId });
      await dataSource.destroy();
    }
  });

  it('getStatus() is MISSING for a case with no consent record at all', async () => {
    const status = await service.getStatus(tenantId, randomUUID());
    expect(status).toBe('MISSING');
  });

  it('grantForCase() creates a record and getStatus() reports VALID', async () => {
    const record = await service.grantForCase(tenantId, caseId);

    expect(record).toMatchObject({
      tenantId,
      caseId,
      purpose: 'CASE_PROCESSING',
      scope: 'CASE_PROCESSING',
      revokedAt: null,
    });
    expect(await service.getStatus(tenantId, caseId)).toBe('VALID');
    expect(await service.activeRecordId(tenantId, caseId)).toBe(record.id);
  });

  it("revoke() marks the active record revoked, getStatus() reports REVOKED, and it opens a real data-disposition retention review referencing the case's evidence (Section 14.2, M5-015)", async () => {
    const evidenceRepo = dataSource.getRepository(EvidenceFact);
    const evidence = await evidenceRepo.save(
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

    const revoked = await service.revoke(
      tenantId,
      caseId,
      'consent spec revocation',
    );

    expect(revoked.revokedAt).not.toBeNull();
    expect(revoked.revocationReason).toBe('consent spec revocation');
    expect(await service.getStatus(tenantId, caseId)).toBe('REVOKED');

    const tasks = await dataSource
      .getRepository(DataDispositionTask)
      .find({ where: { tenantId, caseId } });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      taskType: 'RETENTION_REVIEW',
      status: 'PENDING',
      triggeringConsentRecordId: revoked.id,
      affectedEvidenceFactIds: [evidence.id],
      resolvedAt: null,
    });
    expect(tasks[0].reason).toContain(revoked.id);
  });

  it('revoke() throws NotFoundException when there is no active record to revoke', async () => {
    // The only record for this case was just revoked above — nothing
    // active left.
    await expect(service.revoke(tenantId, caseId)).rejects.toThrow(
      'No active consent record',
    );
  });

  it('grantForCase() after a revoke creates a fresh active record, and getStatus() reads the most recent one', async () => {
    const fresh = await service.grantForCase(tenantId, caseId);

    expect(fresh.revokedAt).toBeNull();
    expect(await service.getStatus(tenantId, caseId)).toBe('VALID');
    expect(await service.activeRecordId(tenantId, caseId)).toBe(fresh.id);
  });

  it('isRecordValid() is true for a granted, unrevoked record and false once revoked', async () => {
    const record = await service.grantForCase(
      tenantId,
      caseId,
      'PROVIDER_DISPATCH',
      'PROVIDER_DISPATCH',
    );

    expect(await service.isRecordValid(record.id)).toBe(true);

    await dataSource
      .getRepository(ConsentRecord)
      .update({ id: record.id }, { revokedAt: new Date() });

    expect(await service.isRecordValid(record.id)).toBe(false);
  });

  it('isRecordValid() is false for an unknown record id', async () => {
    expect(
      await service.isRecordValid('99999999-9999-9999-9999-999999999999'),
    ).toBe(false);
  });

  it('getStatus() reports EXPIRED for a record whose expiresAt has passed', async () => {
    const expiredCaseId = randomUUID();
    const record = await service.grantForCase(tenantId, expiredCaseId);
    await dataSource
      .getRepository(ConsentRecord)
      .update({ id: record.id }, { expiresAt: new Date(Date.now() - 1000) });

    expect(await service.getStatus(tenantId, expiredCaseId)).toBe('EXPIRED');
  });
});
