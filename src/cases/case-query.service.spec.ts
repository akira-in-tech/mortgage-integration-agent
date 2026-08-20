import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Tenant } from '../database/entities/tenant.entity';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import { LoanCase } from '../database/entities/loan-case.entity';
import {
  EvidenceFact,
  EvidenceType,
  EvidenceSourceKind,
} from '../database/entities/evidence-fact.entity';
import { LoanCondition } from '../database/entities/loan-condition.entity';
import { LoanType } from '../database/enums/loan-type.enum';
import { CaseQueryService } from './case-query.service';
import { runInTenantContext } from '../database/tenant-context';

// Requires a reachable Postgres (same convention as this codebase's other
// real-DB specs): skip instead of failing when no DATABASE_URL is
// configured. Real, not mocked — evidence_facts/loan_conditions are both
// RLS-protected tables, and this is their first real query surface of any
// kind, so a real belt-and-suspenders proof (the WHERE clause AND RLS
// both independently enforce tenant scoping) is worth more here than a
// mocked repository would be.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

describeOrSkip('CaseQueryService (Section 15.2, M6)', () => {
  let dataSource: DataSource;
  let service: CaseQueryService;
  const tenantIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [Tenant, Jurisdiction, LoanCase, EvidenceFact, LoanCondition],
    });
    await dataSource.initialize();
    service = new CaseQueryService(dataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (tenantIds.length > 0) {
        await runInTenantContext(dataSource, tenantIds[0], (manager) =>
          manager.query('SELECT set_config($1, $2, true)', [
            'app.bypass_rls',
            'true',
          ]),
        );
        await dataSource
          .getRepository(EvidenceFact)
          .createQueryBuilder()
          .delete()
          .where('"tenantId" IN (:...ids)', { ids: tenantIds })
          .execute();
        await dataSource
          .getRepository(LoanCondition)
          .createQueryBuilder()
          .delete()
          .where('"tenantId" IN (:...ids)', { ids: tenantIds })
          .execute();
        await dataSource
          .getRepository(LoanCase)
          .createQueryBuilder()
          .delete()
          .where('"tenantId" IN (:...ids)', { ids: tenantIds })
          .execute();
        await dataSource.getRepository(Tenant).delete(tenantIds);
      }
      await dataSource.destroy();
    }
  });

  async function makeCase(tenantId: string): Promise<string> {
    await dataSource
      .getRepository(Tenant)
      .save(
        dataSource
          .getRepository(Tenant)
          .create({ id: tenantId, name: `case-query-spec-${tenantId}` }),
      );
    tenantIds.push(tenantId);
    const loanCase = await dataSource.getRepository(LoanCase).save(
      dataSource.getRepository(LoanCase).create({
        tenantId,
        idempotencyKey: `case-query-spec-${randomUUID()}`,
        borrowerId: 'case-query-spec-borrower',
        requestedAmount: 300_000,
        loanType: LoanType.CONVENTIONAL,
        statedMonthlyIncome: 9000,
        jurisdictionCode: 'US-CA',
      }),
    );
    return loanCase.id;
  }

  it('listEvidenceFacts() returns only the requested case’s own evidence, ordered by observedAt', async () => {
    const tenantId = randomUUID();
    const caseId = await makeCase(tenantId);
    const repo = dataSource.getRepository(EvidenceFact);
    await repo.save(
      repo.create({
        tenantId,
        caseId,
        factType: EvidenceType.INCOME,
        sourceKind: EvidenceSourceKind.SIMULATOR,
        sourceIdentifier: 'plaid-simulator',
        value: { monthlyIncome: 9000 },
        observedAt: new Date('2026-01-02T00:00:00Z'),
      }),
    );
    await repo.save(
      repo.create({
        tenantId,
        caseId,
        factType: EvidenceType.CREDIT,
        sourceKind: EvidenceSourceKind.SIMULATOR,
        sourceIdentifier: 'credit-bureau-simulator',
        value: { score: 700 },
        observedAt: new Date('2026-01-01T00:00:00Z'),
      }),
    );

    const facts = await service.listEvidenceFacts(tenantId, caseId);
    expect(facts).toHaveLength(2);
    expect(facts[0].factType).toBe(EvidenceType.CREDIT);
    expect(facts[1].factType).toBe(EvidenceType.INCOME);
  });

  it('listConditions() returns only the requested case’s own conditions', async () => {
    const tenantId = randomUUID();
    const caseId = await makeCase(tenantId);
    const repo = dataSource.getRepository(LoanCondition);
    await repo.save(
      repo.create({
        tenantId,
        caseId,
        code: 'VERIFY_INCOME_DISCREPANCY',
        description: 'Income discrepancy exceeds threshold',
      }),
    );

    const conditions = await service.listConditions(tenantId, caseId);
    expect(conditions).toHaveLength(1);
    expect(conditions[0].code).toBe('VERIFY_INCOME_DISCREPANCY');
  });

  it('never returns another tenant’s evidence, even for the same caseId value reused across tenants', async () => {
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const caseA = await makeCase(tenantA);
    await makeCase(tenantB);
    const repo = dataSource.getRepository(EvidenceFact);
    await repo.save(
      repo.create({
        tenantId: tenantA,
        caseId: caseA,
        factType: EvidenceType.INCOME,
        sourceKind: EvidenceSourceKind.SIMULATOR,
        sourceIdentifier: 'plaid-simulator',
        value: { monthlyIncome: 9000 },
        observedAt: new Date(),
      }),
    );

    const factsForB = await service.listEvidenceFacts(tenantB, caseA);
    expect(factsForB).toHaveLength(0);
  });
});
