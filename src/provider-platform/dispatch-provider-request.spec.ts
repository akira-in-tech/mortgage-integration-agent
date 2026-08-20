import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { ProviderAuthorizationGrant } from '../database/entities/provider-authorization-grant.entity';
import { ProviderOperationIntent } from '../database/entities/provider-operation-intent.entity';
import { ProviderAdapterStatus } from '../database/entities/provider-adapter-status.entity';
import { ConsentRecord } from '../database/entities/consent-record.entity';
import { ProviderRegistryService } from './provider-registry.service';
import { ProviderAuthorizationService } from './provider-authorization.service';
import { ProviderOperationIntentService } from './provider-operation-intent.service';
import { ProviderKillSwitchService } from './provider-kill-switch.service';
import { ConsentService } from '../consent/consent.service';
import { DataDispositionService } from '../data-disposition/data-disposition.service';
import {
  dispatchProviderRequest,
  ProviderDisabledError,
} from './dispatch-provider-request';
import { ProviderCapability } from './types';
import { AssetService } from '../integrations/asset/asset.service';
import { AssetVerificationAdapter } from '../integrations/asset/asset-verification.adapter';
import { IdentityService } from '../integrations/identity/identity.service';
import { IdentityVerificationAdapter } from '../integrations/identity/identity-verification.adapter';

// Requires a reachable Postgres (same convention as the other real-DB
// specs): skip instead of failing when no DATABASE_URL is configured.
// dispatch-provider-request.ts itself has had no dedicated test since
// M4-001 — its orchestration was only ever exercised indirectly, through
// case-conditions.activities.spec.ts's income/credit/document coverage.
// This is the first test of the helper's own grant/intent orchestration
// in isolation, using the two capabilities (asset, identity) that have
// no workflow integration to piggyback on.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

describeOrSkip('dispatchProviderRequest', () => {
  let dataSource: DataSource;
  let registry: ProviderRegistryService;
  let authorizationService: ProviderAuthorizationService;
  let intentService: ProviderOperationIntentService;
  let killSwitchService: ProviderKillSwitchService;
  let consentService: ConsentService;
  // Every test uses a fresh randomUUID() tenantId and tracks it here so
  // afterAll can remove exactly what this file created — findOneByOrFail
  // on a shared/persistent scratch database has no defined row when more
  // than one matches, so leftover rows from a prior run could make a
  // later run's assertions silently read stale data instead of what the
  // test just created.
  const testTenantIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [
        ProviderAuthorizationGrant,
        ProviderOperationIntent,
        ProviderAdapterStatus,
        ConsentRecord,
      ],
    });
    await dataSource.initialize();
    registry = new ProviderRegistryService();
    registry.register(new AssetVerificationAdapter(new AssetService()));
    registry.register(new IdentityVerificationAdapter(new IdentityService()));
    consentService = new ConsentService(
      dataSource,
      new DataDispositionService(dataSource),
    );
    authorizationService = new ProviderAuthorizationService(
      dataSource,
      consentService,
    );
    intentService = new ProviderOperationIntentService(dataSource);
    killSwitchService = new ProviderKillSwitchService(dataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (testTenantIds.length > 0) {
        await dataSource
          .getRepository(ProviderOperationIntent)
          .createQueryBuilder()
          .delete()
          .where('"tenantId" IN (:...ids)', { ids: testTenantIds })
          .execute();
        await dataSource
          .getRepository(ProviderAuthorizationGrant)
          .createQueryBuilder()
          .delete()
          .where('"tenantId" IN (:...ids)', { ids: testTenantIds })
          .execute();
      }
      await dataSource.getRepository(ProviderAdapterStatus).delete({
        providerId: 'asset-verification-simulator',
      });
      await dataSource.destroy();
    }
  });

  const deps = () => ({
    registry,
    authorizationService,
    intentService,
    killSwitchService,
    consentService,
  });

  function newTenantId(): string {
    const id = randomUUID();
    testTenantIds.push(id);
    return id;
  }

  async function intentFor(tenantId: string) {
    return dataSource
      .getRepository(ProviderOperationIntent)
      .findOneByOrFail({ tenantId });
  }

  it('dispatches a real asset-verification request: issues a grant, persists a SUCCEEDED intent, and returns the normalized finding', async () => {
    const tenantId = newTenantId();
    const caseId = randomUUID();

    const finding = await dispatchProviderRequest(deps(), {
      tenantId,
      caseId,
      borrowerSubjectId: 'dispatch-spec-asset-borrower',
      capability: ProviderCapability.ASSET,
      request: { borrowerId: 'dispatch-spec-asset-borrower' },
      purposeCode: 'UNDERWRITING_EVIDENCE',
      permittedDataClasses: ['ASSET'],
    });

    expect(finding).toMatchObject({
      liquidAssets: expect.any(Number),
      investmentAssets: expect.any(Number),
      accountCount: expect.any(Number),
      reserveMonths: expect.any(Number),
    });

    const grants = await dataSource
      .getRepository(ProviderAuthorizationGrant)
      .find({ where: { tenantId, caseId } });
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({
      providerId: 'asset-verification-simulator',
      purposeCode: 'UNDERWRITING_EVIDENCE',
      permittedDataClasses: ['ASSET'],
    });

    const intent = await intentFor(tenantId);
    expect(intent.state).toBe('SUCCEEDED');
    expect(intent.providerId).toBe('asset-verification-simulator');
    expect(intent.authorizationGrantId).toBe(grants[0].id);
  });

  it('dispatches a real identity-verification request the same way', async () => {
    const tenantId = newTenantId();
    const caseId = randomUUID();

    const finding = await dispatchProviderRequest(deps(), {
      tenantId,
      caseId,
      borrowerSubjectId: 'dispatch-spec-identity-borrower',
      capability: ProviderCapability.IDENTITY,
      request: { borrowerId: 'dispatch-spec-identity-borrower' },
      purposeCode: 'UNDERWRITING_EVIDENCE',
      permittedDataClasses: ['IDENTITY'],
    });

    expect(finding).toMatchObject({
      nameMatch: expect.any(Boolean),
      identityVerified: expect.any(Boolean),
    });

    const intent = await intentFor(tenantId);
    expect(intent.state).toBe('SUCCEEDED');
    expect(intent.providerId).toBe('identity-verification-simulator');
  });

  it('classifies a synthetic transient failure as a rejected promise and marks the intent OUTCOME_UNKNOWN', async () => {
    const tenantId = newTenantId();
    const caseId = randomUUID();
    const borrowerId = 'SYNTHETIC-TRANSIENT-FAILURE-dispatch-spec';

    await expect(
      dispatchProviderRequest(deps(), {
        tenantId,
        caseId,
        borrowerSubjectId: borrowerId,
        capability: ProviderCapability.ASSET,
        request: { borrowerId },
        purposeCode: 'UNDERWRITING_EVIDENCE',
        permittedDataClasses: ['ASSET'],
      }),
    ).rejects.toThrow('synthetic timeout (transient)');

    const intent = await intentFor(tenantId);
    expect(intent.state).toBe('OUTCOME_UNKNOWN');
  });

  it('classifies a synthetic terminal failure as a rejected promise and marks the intent FAILED_FINAL', async () => {
    const tenantId = newTenantId();
    const caseId = randomUUID();
    const borrowerId = 'SYNTHETIC-TERMINAL-FAILURE-dispatch-spec';

    await expect(
      dispatchProviderRequest(deps(), {
        tenantId,
        caseId,
        borrowerSubjectId: borrowerId,
        capability: ProviderCapability.IDENTITY,
        request: { borrowerId },
        purposeCode: 'UNDERWRITING_EVIDENCE',
        permittedDataClasses: ['IDENTITY'],
      }),
    ).rejects.toThrow('synthetic rejection (terminal)');

    const intent = await intentFor(tenantId);
    expect(intent.state).toBe('FAILED_FINAL');
  });

  it('throws with no registered adapter for a capability/mode, without issuing a grant', async () => {
    const registryWithNoAdapters = new ProviderRegistryService();
    const tenantId = newTenantId();

    await expect(
      dispatchProviderRequest(
        {
          registry: registryWithNoAdapters,
          authorizationService,
          intentService,
          killSwitchService,
          consentService,
        },
        {
          tenantId,
          caseId: randomUUID(),
          borrowerSubjectId: 'no-adapter-borrower',
          capability: ProviderCapability.ASSET,
          request: {},
          purposeCode: 'UNDERWRITING_EVIDENCE',
          permittedDataClasses: ['ASSET'],
        },
      ),
    ).rejects.toThrow(/no provider adapter registered/);

    const grants = await dataSource
      .getRepository(ProviderAuthorizationGrant)
      .find({ where: { tenantId } });
    expect(grants).toHaveLength(0);
  });

  describe('kill switch (Section 11.4, M4-006)', () => {
    afterEach(async () => {
      // Every test in this block ends with the tuple re-enabled, so it
      // never leaks a disabled state into a sibling test file that also
      // registers 'asset-verification-simulator'.
      await killSwitchService.enable(
        'asset-verification-simulator',
        ProviderCapability.ASSET,
        'SIMULATOR',
        'dispatch-spec-cleanup',
      );
    });

    it('blocks dispatch and issues no grant once a capability is disabled, and real dispatch resumes once re-enabled', async () => {
      const tenantId = newTenantId();

      await killSwitchService.disable(
        'asset-verification-simulator',
        ProviderCapability.ASSET,
        'SIMULATOR',
        'dispatch-spec: simulating an operational incident',
        'dispatch-spec-operator',
      );

      await expect(
        dispatchProviderRequest(deps(), {
          tenantId,
          caseId: randomUUID(),
          borrowerSubjectId: 'kill-switch-borrower',
          capability: ProviderCapability.ASSET,
          request: { borrowerId: 'kill-switch-borrower' },
          purposeCode: 'UNDERWRITING_EVIDENCE',
          permittedDataClasses: ['ASSET'],
        }),
      ).rejects.toThrow(ProviderDisabledError);

      const grants = await dataSource
        .getRepository(ProviderAuthorizationGrant)
        .find({ where: { tenantId } });
      expect(grants).toHaveLength(0);

      await killSwitchService.enable(
        'asset-verification-simulator',
        ProviderCapability.ASSET,
        'SIMULATOR',
        'dispatch-spec-operator',
      );

      const finding = await dispatchProviderRequest(deps(), {
        tenantId,
        caseId: randomUUID(),
        borrowerSubjectId: 'kill-switch-borrower-2',
        capability: ProviderCapability.ASSET,
        request: { borrowerId: 'kill-switch-borrower-2' },
        purposeCode: 'UNDERWRITING_EVIDENCE',
        permittedDataClasses: ['ASSET'],
      });
      expect(finding).toMatchObject({ liquidAssets: expect.any(Number) });
    });
  });
});
