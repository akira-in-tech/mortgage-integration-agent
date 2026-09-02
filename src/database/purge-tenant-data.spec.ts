import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { LoanCase, CaseStatus } from './entities/loan-case.entity';
import { Jurisdiction } from './entities/jurisdiction.entity';
import {
  JurisdictionLevel,
  JurisdictionCoverageStatus,
} from './enums/jurisdiction.enum';
import { LoanType } from './enums/loan-type.enum';
import { EvidenceFact } from './entities/evidence-fact.entity';
import { ConsentRecord } from './entities/consent-record.entity';
import { AgentBudgetLedger } from './entities/agent-budget-ledger.entity';
import {
  AgentBudgetReservation,
  AgentBudgetReservationStatus,
} from './entities/agent-budget-reservation.entity';
import { TenantAgentBudgetUsage } from './entities/tenant-agent-budget-usage.entity';
import { ProviderOperationIntent } from './entities/provider-operation-intent.entity';
import { ProviderAuthorizationGrant } from './entities/provider-authorization-grant.entity';
import {
  PermissiblePurposeDecision,
  PermissiblePurposeDecisionStatus,
} from './entities/permissible-purpose-decision.entity';
import { ProviderCapabilityStatus } from './enums/provider-platform.enum';
import { purgeTenantData } from './purge-tenant-data';

// Requires a reachable Postgres (same convention as this codebase's other
// real-DB specs): skip instead of failing when no DATABASE_URL is
// configured.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

describeOrSkip('purgeTenantData (M7-055)', () => {
  let dataSource: DataSource;
  const jurisdictionCode = 'US-PURGE-SPEC';

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [
        Tenant,
        LoanCase,
        Jurisdiction,
        EvidenceFact,
        ConsentRecord,
        AgentBudgetLedger,
        AgentBudgetReservation,
        TenantAgentBudgetUsage,
        ProviderOperationIntent,
        ProviderAuthorizationGrant,
        PermissiblePurposeDecision,
      ],
    });
    await dataSource.initialize();
    await dataSource.getRepository(Jurisdiction).save(
      dataSource.getRepository(Jurisdiction).create({
        code: jurisdictionCode,
        level: JurisdictionLevel.STATE,
        name: 'purge-tenant-data spec jurisdiction',
        coverageStatus: JurisdictionCoverageStatus.COVERED,
      }),
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource
        .getRepository(Jurisdiction)
        .delete({ code: jurisdictionCode });
      await dataSource.destroy();
    }
  });

  it('deletes every real row a tenant could have created, including the tenant row itself — not just the tables an earlier version of this cleanup already covered', async () => {
    const tenant = await dataSource
      .getRepository(Tenant)
      .save(
        dataSource
          .getRepository(Tenant)
          .create({ name: 'purge-tenant-data spec tenant' }),
      );
    const tenantId = tenant.id;

    const loanCase = await dataSource.getRepository(LoanCase).save(
      dataSource.getRepository(LoanCase).create({
        tenantId,
        idempotencyKey: `purge-spec-${randomUUID()}`,
        borrowerId: 'purge-spec-borrower',
        requestedAmount: 300_000,
        loanType: LoanType.CONVENTIONAL,
        statedMonthlyIncome: 9000,
        jurisdictionCode,
        status: CaseStatus.DRAFT,
      }),
    );
    const caseId = loanCase.id;

    await dataSource.getRepository(EvidenceFact).save(
      dataSource.getRepository(EvidenceFact).create({
        tenantId,
        caseId,
        factType: 'INCOME' as EvidenceFact['factType'],
        sourceKind: 'SIMULATOR' as EvidenceFact['sourceKind'],
        sourceIdentifier: 'purge-spec-simulator',
        value: { monthlyIncome: 9000 },
        observedAt: new Date(),
      }),
    );
    await dataSource.getRepository(ConsentRecord).save(
      dataSource.getRepository(ConsentRecord).create({
        tenantId,
        caseId,
        purpose: 'UNDERWRITING_EVIDENCE',
        scope: 'INCOME',
        permittedPurposes: ['UNDERWRITING_EVIDENCE'],
        permittedDataClasses: ['INCOME'],
        grantedAt: new Date(),
        expiresAt: null,
        revokedAt: null,
        revocationReason: null,
      }),
    );

    const ledger = await dataSource.getRepository(AgentBudgetLedger).save(
      dataSource.getRepository(AgentBudgetLedger).create({
        tenantId,
        caseId,
        workflowRunId: `purge-spec-${randomUUID()}`,
        stepLimit: 10,
        tokenLimit: 1000,
        providerCallLimit: 5,
        costLimitMinorUnits: 1000,
        currency: 'USD',
        startedAt: new Date(),
        deadlineAt: new Date(Date.now() + 3_600_000),
      }),
    );
    await dataSource.getRepository(AgentBudgetReservation).save(
      dataSource.getRepository(AgentBudgetReservation).create({
        tenantId,
        ledgerId: ledger.id,
        idempotencyKey: `purge-spec-${randomUUID()}`,
        // The real CK_agent_budget_reservations_nonzero constraint
        // requires stepUnits+tokenUnits+providerCallUnits+costMinorUnits
        // > 0 — CI's own genuinely fresh database caught this when this
        // test left every one at its default 0.
        stepUnits: 1,
        status: AgentBudgetReservationStatus.Reserved,
      }),
    );
    await dataSource.getRepository(TenantAgentBudgetUsage).save(
      dataSource.getRepository(TenantAgentBudgetUsage).create({
        tenantId,
        windowStart: new Date().toISOString().slice(0, 10),
        currency: 'USD',
      }),
    );

    const grant = await dataSource
      .getRepository(ProviderAuthorizationGrant)
      .save(
        dataSource.getRepository(ProviderAuthorizationGrant).create({
          tenantId,
          caseId,
          borrowerSubjectId: 'purge-spec-borrower',
          providerId: 'plaid-income-simulator',
          capability: ProviderCapabilityStatus.INCOME,
          purposeCode: 'UNDERWRITING_EVIDENCE',
          permittedDataClasses: ['INCOME'],
          permittedFields: null,
          consentRecordIds: [],
          permissiblePurposeDecisionId: null,
          expiresAt: new Date(Date.now() + 300_000),
          revokedAt: null,
        }),
      );
    await dataSource.getRepository(ProviderOperationIntent).save(
      dataSource.getRepository(ProviderOperationIntent).create({
        tenantId,
        caseId,
        providerId: 'plaid-income-simulator',
        capability: ProviderCapabilityStatus.INCOME,
        effectClass: 'REUSABLE_LOOKUP',
        requestFingerprint: 'purge-spec-fingerprint',
        idempotencyKey: `purge-spec-${randomUUID()}`,
        logicalOperationKey: `purge-spec-${randomUUID()}`,
        authorizationGrantId: grant.id,
      }),
    );
    await dataSource.getRepository(PermissiblePurposeDecision).save(
      dataSource.getRepository(PermissiblePurposeDecision).create({
        tenantId,
        caseId,
        borrowerSubjectId: 'purge-spec-borrower',
        capability: ProviderCapabilityStatus.CREDIT,
        purposeCode: 'ACCOUNT_REVIEW',
        permittedDataClasses: ['CREDIT'],
        decision: PermissiblePurposeDecisionStatus.AUTHORIZED,
        basisCode: 'purge-spec-basis',
        decidedBy: 'purge-spec-operator',
        syntheticOnly: true,
        expiresAt: new Date(Date.now() + 300_000),
        revokedAt: null,
      }),
    );

    // Real rows exist in every one of these tables before purging — not
    // asserting against an empty fixture that would pass trivially.
    await expect(
      dataSource.getRepository(LoanCase).findOneBy({ id: caseId }),
    ).resolves.not.toBeNull();
    await expect(
      dataSource.getRepository(AgentBudgetReservation).findOneBy({ tenantId }),
    ).resolves.not.toBeNull();
    await expect(
      dataSource.getRepository(ProviderOperationIntent).findOneBy({ tenantId }),
    ).resolves.not.toBeNull();

    await purgeTenantData(dataSource, tenantId);

    const [
      afterTenant,
      afterCase,
      afterEvidence,
      afterConsent,
      afterLedger,
      afterReservation,
      afterUsage,
      afterIntent,
      afterGrant,
      afterDecision,
    ] = await Promise.all([
      dataSource.getRepository(Tenant).findOneBy({ id: tenantId }),
      dataSource.getRepository(LoanCase).findOneBy({ tenantId }),
      dataSource.getRepository(EvidenceFact).findOneBy({ tenantId }),
      dataSource.getRepository(ConsentRecord).findOneBy({ tenantId }),
      dataSource.getRepository(AgentBudgetLedger).findOneBy({ tenantId }),
      dataSource.getRepository(AgentBudgetReservation).findOneBy({ tenantId }),
      dataSource.getRepository(TenantAgentBudgetUsage).findOneBy({ tenantId }),
      dataSource.getRepository(ProviderOperationIntent).findOneBy({ tenantId }),
      dataSource
        .getRepository(ProviderAuthorizationGrant)
        .findOneBy({ tenantId }),
      dataSource
        .getRepository(PermissiblePurposeDecision)
        .findOneBy({ tenantId }),
    ]);

    expect(afterTenant).toBeNull();
    expect(afterCase).toBeNull();
    expect(afterEvidence).toBeNull();
    expect(afterConsent).toBeNull();
    expect(afterLedger).toBeNull();
    expect(afterReservation).toBeNull();
    expect(afterUsage).toBeNull();
    expect(afterIntent).toBeNull();
    expect(afterGrant).toBeNull();
    expect(afterDecision).toBeNull();
  });

  it('is a safe no-op for a tenant id with no rows at all', async () => {
    await expect(
      purgeTenantData(dataSource, randomUUID()),
    ).resolves.toBeUndefined();
  });
});
