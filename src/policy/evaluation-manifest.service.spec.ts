import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Tenant } from '../database/entities/tenant.entity';
import { LoanCase, CaseStatus } from '../database/entities/loan-case.entity';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import {
  EvidenceFact,
  EvidenceType,
  EvidenceSourceKind,
} from '../database/entities/evidence-fact.entity';
import { EvaluationInputManifest } from '../database/entities/evaluation-input-manifest.entity';
import {
  JurisdictionLevel,
  JurisdictionCoverageStatus,
} from '../database/enums/jurisdiction.enum';
import { LoanType } from '../database/enums/loan-type.enum';
import { EvaluationManifestService } from './evaluation-manifest.service';
import { computeDigest } from './policy-digest';

const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

const JURISDICTION_CODE = 'US-EMS-TEST';

describeOrSkip('EvaluationManifestService', () => {
  let dataSource: DataSource;
  let service: EvaluationManifestService;
  let tenantId: string;
  const caseIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [
        Tenant,
        LoanCase,
        Jurisdiction,
        EvidenceFact,
        EvaluationInputManifest,
      ],
    });
    await dataSource.initialize();
    service = new EvaluationManifestService(
      dataSource.getRepository(EvaluationInputManifest),
    );

    const tenant = await dataSource
      .getRepository(Tenant)
      .save(
        dataSource
          .getRepository(Tenant)
          .create({ name: 'Evaluation Manifest Spec Tenant' }),
      );
    tenantId = tenant.id;

    await dataSource.getRepository(Jurisdiction).save(
      dataSource.getRepository(Jurisdiction).create({
        code: JURISDICTION_CODE,
        level: JurisdictionLevel.STATE,
        name: 'EvaluationManifestService spec',
        coverageStatus: JurisdictionCoverageStatus.COVERED,
      }),
    );
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.getRepository(EvaluationInputManifest).delete({
        tenantId,
      });
      if (caseIds.length > 0) {
        await dataSource.getRepository(EvidenceFact).delete({ tenantId });
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
        idempotencyKey: `ems-spec-${Date.now()}-${Math.random()}`,
        borrowerId: 'ems-spec-borrower',
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

  it('assembles a manifest referencing exactly the given evidence, with a real content hash per fact and a real manifest hash', async () => {
    const caseId = await makeCase();
    const evidenceRepo = dataSource.getRepository(EvidenceFact);
    const incomeFact = await evidenceRepo.save(
      evidenceRepo.create({
        tenantId,
        caseId,
        factType: EvidenceType.INCOME,
        sourceKind: EvidenceSourceKind.SIMULATOR,
        sourceIdentifier: 'ems-spec-simulator',
        value: { monthlyIncome: 12345 },
        observedAt: new Date(),
      }),
    );

    const manifest = await service.assemble({
      tenantId,
      caseId,
      caseVersion: 1,
      policyBindingId: '11111111-1111-1111-1111-111111111111',
      observedPolicyDependencyDigest: 'a'.repeat(64),
      evaluatorVersion: '1.0.0',
      evidence: [incomeFact],
    });

    expect(manifest.id).toBeDefined();
    expect(manifest.caseVersion).toBe(1);
    expect(manifest.policyBindingId).toBe(
      '11111111-1111-1111-1111-111111111111',
    );
    expect(manifest.observedPolicyDependencyDigest).toBe('a'.repeat(64));
    expect(manifest.evaluatorVersion).toBe('1.0.0');
    expect(manifest.evidenceRefs).toEqual([
      {
        evidenceId: incomeFact.id,
        version: incomeFact.version,
        contentHash: computeDigest({ monthlyIncome: 12345 }),
        validThrough: null,
      },
    ]);
    // No backing subsystem exists for these — honestly empty/null, not
    // fabricated (see the entity's own comment).
    expect(manifest.authorizationDecisionId).toBeNull();
    expect(manifest.consentVersionRefs).toEqual([]);
    expect(manifest.calculationRefs).toEqual([]);
    expect(manifest.modelAndPromptManifestId).toBeNull();
    expect(manifest.manifestHash).toHaveLength(64);

    const persisted = await dataSource
      .getRepository(EvaluationInputManifest)
      .findOneByOrFail({ id: manifest.id });
    expect(persisted.manifestHash).toBe(manifest.manifestHash);
  });

  it('produces the same manifest hash for identical inputs and a different hash when the evidence content differs', async () => {
    const caseId = await makeCase();
    const evidenceRepo = dataSource.getRepository(EvidenceFact);
    const factA = await evidenceRepo.save(
      evidenceRepo.create({
        tenantId,
        caseId,
        factType: EvidenceType.INCOME,
        sourceKind: EvidenceSourceKind.SIMULATOR,
        sourceIdentifier: 'ems-spec-simulator',
        value: { monthlyIncome: 5000 },
        observedAt: new Date(),
      }),
    );

    const baseInput = {
      tenantId,
      caseId,
      caseVersion: 1,
      policyBindingId: '22222222-2222-2222-2222-222222222222',
      observedPolicyDependencyDigest: 'b'.repeat(64),
      evaluatorVersion: '1.0.0',
    };

    const first = await service.assemble({ ...baseInput, evidence: [factA] });
    const second = await service.assemble({
      ...baseInput,
      evidence: [factA],
    });
    expect(second.manifestHash).toBe(first.manifestHash);
    expect(second.id).not.toBe(first.id);

    const factB = await evidenceRepo.save(
      evidenceRepo.create({
        tenantId,
        caseId,
        factType: EvidenceType.CREDIT,
        sourceKind: EvidenceSourceKind.SIMULATOR,
        sourceIdentifier: 'ems-spec-simulator',
        value: { creditScore: 700 },
        observedAt: new Date(),
      }),
    );
    const third = await service.assemble({
      ...baseInput,
      evidence: [factA, factB],
    });
    expect(third.manifestHash).not.toBe(first.manifestHash);
  });
});
