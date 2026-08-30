import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ProviderAuthorizationGrant } from '../database/entities/provider-authorization-grant.entity';
import { ConsentRecord } from '../database/entities/consent-record.entity';
import { EvidenceFact } from '../database/entities/evidence-fact.entity';
import { LoanCase } from '../database/entities/loan-case.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import { DataDispositionTask } from '../database/entities/data-disposition-task.entity';
import { AuditEvent } from '../database/entities/audit-event.entity';
import { ProviderAuthorizationService } from './provider-authorization.service';
import { ConsentService } from '../consent/consent.service';
import { DataDispositionService } from '../data-disposition/data-disposition.service';
import { LegalHoldService } from '../data-disposition/legal-hold.service';
import { AuditEventService } from '../audit/audit-event.service';
import { ProviderCapability } from './types';

// Requires a reachable Postgres (same convention as the other real-DB
// specs): skip instead of failing when no DATABASE_URL is configured.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

describeOrSkip('ProviderAuthorizationService', () => {
  let dataSource: DataSource;
  let service: ProviderAuthorizationService;
  let consentService: ConsentService;
  const grantIds: string[] = [];
  const consentRecordIds: string[] = [];

  const baseInput = {
    tenantId: '11111111-1111-1111-1111-111111111111',
    caseId: '22222222-2222-2222-2222-222222222222',
    borrowerSubjectId: 'borrower-auth-spec',
    providerId: 'plaid-simulator',
    capability: ProviderCapability.INCOME,
    purposeCode: 'INCOME_VERIFICATION',
    permittedDataClasses: ['INCOME'],
  };

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [
        ProviderAuthorizationGrant,
        ConsentRecord,
        EvidenceFact,
        LoanCase,
        Tenant,
        Jurisdiction,
        DataDispositionTask,
        AuditEvent,
      ],
    });
    await dataSource.initialize();
    const auditEventService = new AuditEventService(dataSource);
    consentService = new ConsentService(
      dataSource,
      new DataDispositionService(
        dataSource,
        new LegalHoldService(dataSource, auditEventService),
        auditEventService,
      ),
    );
    service = new ProviderAuthorizationService(dataSource, consentService);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (grantIds.length > 0) {
        await dataSource
          .getRepository(ProviderAuthorizationGrant)
          .delete(grantIds);
      }
      if (consentRecordIds.length > 0) {
        await dataSource.getRepository(ConsentRecord).delete(consentRecordIds);
      }
      await dataSource
        .getRepository(DataDispositionTask)
        .delete({ tenantId: baseInput.tenantId });
      await dataSource.destroy();
    }
  });

  it('issues a grant with the honest-null fields this codebase has no backing subsystem for, and permittedFields unset when the caller does not request field-scoping', async () => {
    const grant = await service.issue(baseInput);
    grantIds.push(grant.id);

    expect(grant).toMatchObject({
      tenantId: baseInput.tenantId,
      caseId: baseInput.caseId,
      borrowerSubjectId: baseInput.borrowerSubjectId,
      providerId: baseInput.providerId,
      capability: ProviderCapability.INCOME,
      purposeCode: baseInput.purposeCode,
      permittedDataClasses: ['INCOME'],
      consentRecordIds: [],
    });
    expect(grant.permittedFields).toBeUndefined();
    expect(grant.permissiblePurposeDecisionId).toBeUndefined();
    expect(grant.revokedAt).toBeUndefined();
    expect(new Date(grant.expiresAt).getTime()).toBeGreaterThan(
      new Date(grant.issuedAt).getTime(),
    );
  });

  it('issues and revalidates a grant with real permittedFields (Section 11.5, M5-028) when the caller requests field-scoping', async () => {
    const grant = await service.issue({
      ...baseInput,
      permittedFields: ['monthlyIncome'],
    });
    grantIds.push(grant.id);
    expect(grant.permittedFields).toEqual(['monthlyIncome']);

    const result = await service.revalidate(grant.id, {
      tenantId: baseInput.tenantId,
      caseId: baseInput.caseId,
      providerId: baseInput.providerId,
      capability: ProviderCapability.INCOME,
    });
    expect(result.valid).toBe(true);
    expect(result.valid && result.grant.permittedFields).toEqual([
      'monthlyIncome',
    ]);
  });

  it('revalidate() succeeds for a fresh grant whose expected fields all match', async () => {
    const grant = await service.issue(baseInput);
    grantIds.push(grant.id);

    const result = await service.revalidate(grant.id, {
      tenantId: baseInput.tenantId,
      caseId: baseInput.caseId,
      providerId: baseInput.providerId,
      capability: baseInput.capability,
    });

    expect(result).toEqual({
      valid: true,
      grant: expect.objectContaining({ id: grant.id }),
    });
  });

  it('revalidate() fails closed when the grant id does not exist', async () => {
    const result = await service.revalidate(
      '99999999-9999-9999-9999-999999999999',
      {
        tenantId: baseInput.tenantId,
        caseId: baseInput.caseId,
        providerId: baseInput.providerId,
        capability: baseInput.capability,
      },
    );

    expect(result).toEqual({
      valid: false,
      reason: expect.stringContaining('not found'),
    });
  });

  it('revalidate() fails closed when the caller-supplied caseId does not match the grant', async () => {
    const grant = await service.issue(baseInput);
    grantIds.push(grant.id);

    const result = await service.revalidate(grant.id, {
      tenantId: baseInput.tenantId,
      caseId: '33333333-3333-3333-3333-333333333333',
      providerId: baseInput.providerId,
      capability: baseInput.capability,
    });

    expect(result).toEqual({
      valid: false,
      reason: expect.stringContaining('does not match'),
    });
  });

  it('revalidate() fails closed when the caller-supplied capability does not match the grant', async () => {
    const grant = await service.issue(baseInput);
    grantIds.push(grant.id);

    const result = await service.revalidate(grant.id, {
      tenantId: baseInput.tenantId,
      caseId: baseInput.caseId,
      providerId: baseInput.providerId,
      capability: ProviderCapability.CREDIT,
    });

    expect(result).toEqual({
      valid: false,
      reason: expect.stringContaining('does not match'),
    });
  });

  it('revalidate() fails closed on an expired grant', async () => {
    const grant = await service.issue({ ...baseInput, ttlMs: -1000 });
    grantIds.push(grant.id);

    const result = await service.revalidate(grant.id, {
      tenantId: baseInput.tenantId,
      caseId: baseInput.caseId,
      providerId: baseInput.providerId,
      capability: baseInput.capability,
    });

    expect(result).toEqual({
      valid: false,
      reason: expect.stringContaining('expired'),
    });
  });

  it('revoke() causes a subsequent revalidate() to fail closed', async () => {
    const grant = await service.issue(baseInput);
    grantIds.push(grant.id);

    await service.revoke(baseInput.tenantId, grant.id);

    const result = await service.revalidate(grant.id, {
      tenantId: baseInput.tenantId,
      caseId: baseInput.caseId,
      providerId: baseInput.providerId,
      capability: baseInput.capability,
    });

    expect(result).toEqual({
      valid: false,
      reason: expect.stringContaining('revoked'),
    });
  });

  it('revalidate() fails closed when a referenced consent record has been revoked (M5-005, Section 11.5)', async () => {
    const consentRecord = await consentService.grantForCase(
      baseInput.tenantId,
      baseInput.caseId,
    );
    consentRecordIds.push(consentRecord.id);

    const grant = await service.issue({
      ...baseInput,
      consentRecordIds: [consentRecord.id],
    });
    grantIds.push(grant.id);

    const beforeRevoke = await service.revalidate(grant.id, {
      tenantId: baseInput.tenantId,
      caseId: baseInput.caseId,
      providerId: baseInput.providerId,
      capability: baseInput.capability,
    });
    expect(beforeRevoke.valid).toBe(true);

    await consentService.revoke(baseInput.tenantId, baseInput.caseId);

    const afterRevoke = await service.revalidate(grant.id, {
      tenantId: baseInput.tenantId,
      caseId: baseInput.caseId,
      providerId: baseInput.providerId,
      capability: baseInput.capability,
    });
    expect(afterRevoke).toEqual({
      valid: false,
      reason: expect.stringContaining('no longer granted and unrevoked'),
    });
  });
});
