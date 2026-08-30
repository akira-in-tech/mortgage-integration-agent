import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { ProviderAuthorizationGrant } from '../database/entities/provider-authorization-grant.entity';
import { ProviderOperationIntent } from '../database/entities/provider-operation-intent.entity';
import { ProviderAdapterStatus } from '../database/entities/provider-adapter-status.entity';
import { ProviderPromotionManifest } from '../database/entities/provider-promotion-manifest.entity';
import { ProviderCertificationRecord } from '../database/entities/provider-certification-record.entity';
import { ProviderApprovalRecord } from '../database/entities/provider-approval-record.entity';
import { ProviderActivation } from '../database/entities/provider-activation.entity';
import { ConsentRecord } from '../database/entities/consent-record.entity';
import { ProviderRegistryService } from './provider-registry.service';
import { ProviderAuthorizationService } from './provider-authorization.service';
import { ProviderOperationIntentService } from './provider-operation-intent.service';
import { ProviderKillSwitchService } from './provider-kill-switch.service';
import { ProviderPromotionService } from './provider-promotion.service';
import {
  ProviderCertificationDecision,
  ProviderApprovalDecision,
} from '../database/enums/provider-promotion.enum';
import { ConsentService } from '../consent/consent.service';
import { DataDispositionService } from '../data-disposition/data-disposition.service';
import { LegalHoldService } from '../data-disposition/legal-hold.service';
import {
  dispatchProviderRequest,
  filterToPermittedFields,
  ProviderDisabledError,
  ProviderNotActivatedError,
} from './dispatch-provider-request';
import { AnyProviderAdapter, ProviderCapability } from './types';
import { AssetService } from '../integrations/asset/asset.service';
import { AssetVerificationAdapter } from '../integrations/asset/asset-verification.adapter';
import { IdentityService } from '../integrations/identity/identity.service';
import { IdentityVerificationAdapter } from '../integrations/identity/identity-verification.adapter';
import { AuditEvent } from '../database/entities/audit-event.entity';
import { AuditEventService } from '../audit/audit-event.service';

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

describe('filterToPermittedFields (Section 11.5, M5-028)', () => {
  it('returns the finding unchanged when permittedFields is unset — every pre-M5-028 caller keeps its exact existing behavior', () => {
    const finding = { monthlyIncome: 9000, employmentStatus: 'FULL_TIME' };
    expect(filterToPermittedFields(finding, undefined)).toBe(finding);
  });

  it('restricts a plain-object finding to exactly the permitted top-level keys', () => {
    const finding = {
      monthlyIncome: 9000,
      employmentStatus: 'FULL_TIME',
      bankAccountAge: 24,
    };
    expect(filterToPermittedFields(finding, ['monthlyIncome'])).toEqual({
      monthlyIncome: 9000,
    });
  });

  it('produces an empty object when none of the permitted fields exist on the finding', () => {
    const finding = { monthlyIncome: 9000 };
    expect(filterToPermittedFields(finding, ['notARealField'])).toEqual({});
  });

  it('leaves a non-object finding (or null) unchanged regardless of permittedFields — nothing to key-filter', () => {
    expect(filterToPermittedFields(42, ['x'])).toBe(42);
    expect(filterToPermittedFields(null, ['x'])).toBeNull();
  });
});

describeOrSkip('dispatchProviderRequest', () => {
  let dataSource: DataSource;
  let registry: ProviderRegistryService;
  let authorizationService: ProviderAuthorizationService;
  let intentService: ProviderOperationIntentService;
  let killSwitchService: ProviderKillSwitchService;
  let promotionService: ProviderPromotionService;
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
        ProviderPromotionManifest,
        ProviderCertificationRecord,
        ProviderApprovalRecord,
        ProviderActivation,
        ConsentRecord,
        AuditEvent,
      ],
    });
    await dataSource.initialize();
    registry = new ProviderRegistryService();
    registry.register(new AssetVerificationAdapter(new AssetService()));
    registry.register(new IdentityVerificationAdapter(new IdentityService()));
    const auditEventService = new AuditEventService(dataSource);
    consentService = new ConsentService(
      dataSource,
      new DataDispositionService(
        dataSource,
        new LegalHoldService(dataSource, auditEventService),
        auditEventService,
      ),
    );
    authorizationService = new ProviderAuthorizationService(
      dataSource,
      consentService,
    );
    intentService = new ProviderOperationIntentService(dataSource);
    killSwitchService = new ProviderKillSwitchService(dataSource);
    promotionService = new ProviderPromotionService(
      dataSource.getRepository(ProviderPromotionManifest),
      dataSource.getRepository(ProviderCertificationRecord),
      dataSource.getRepository(ProviderApprovalRecord),
      dataSource.getRepository(ProviderActivation),
      auditEventService,
    );
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
      await dataSource.getRepository(ProviderActivation).delete({
        providerId: 'promotion-gate-spec-provider',
      });
      const manifests = await dataSource
        .getRepository(ProviderPromotionManifest)
        .find({ where: { providerId: 'promotion-gate-spec-provider' } });
      if (manifests.length > 0) {
        const manifestIds = manifests.map((m) => m.id);
        await dataSource
          .getRepository(ProviderCertificationRecord)
          .createQueryBuilder()
          .delete()
          .where('"manifestId" IN (:...ids)', { ids: manifestIds })
          .execute();
        await dataSource
          .getRepository(ProviderApprovalRecord)
          .createQueryBuilder()
          .delete()
          .where('"manifestId" IN (:...ids)', { ids: manifestIds })
          .execute();
        await dataSource.getRepository(ProviderPromotionManifest).delete({
          providerId: 'promotion-gate-spec-provider',
        });
      }
      await dataSource.destroy();
    }
  });

  const deps = () => ({
    registry,
    authorizationService,
    intentService,
    killSwitchService,
    promotionService,
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

  it('restricts a real dispatch to only the granted permittedFields end to end (Section 11.5, M5-028)', async () => {
    const tenantId = newTenantId();
    const caseId = randomUUID();

    const finding = await dispatchProviderRequest(deps(), {
      tenantId,
      caseId,
      borrowerSubjectId: 'dispatch-spec-field-scoped-borrower',
      capability: ProviderCapability.ASSET,
      request: { borrowerId: 'dispatch-spec-field-scoped-borrower' },
      purposeCode: 'UNDERWRITING_EVIDENCE',
      permittedDataClasses: ['ASSET'],
      permittedFields: ['liquidAssets'],
    });

    expect(finding).toEqual({ liquidAssets: expect.any(Number) });

    const grants = await dataSource
      .getRepository(ProviderAuthorizationGrant)
      .find({ where: { tenantId, caseId } });
    expect(grants[0].permittedFields).toEqual(['liquidAssets']);
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
          promotionService,
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

  describe('promotion gate (Section 11.4, M4-007)', () => {
    // A minimal synthetic adapter, not a real provider integration — this
    // block tests dispatchProviderRequest's own AUTHORIZED_SANDBOX gate,
    // not any specific adapter's behavior (plaid-income-sandbox.adapter.spec.ts
    // already covers the real Plaid adapter end to end).
    const gateTestAdapter: AnyProviderAdapter = {
      providerId: 'promotion-gate-spec-provider',
      capability: ProviderCapability.ASSET,
      mode: 'AUTHORIZED_SANDBOX',
      operation: {
        effectClass: 'REUSABLE_LOOKUP',
        supportsStatusLookup: false,
        supportsCancellation: false,
        fallbackPolicy: 'PROHIBITED',
      },
      submit: async () => ({ status: 'COMPLETE', payload: { ok: true } }),
      normalize: (payload) => payload,
      healthCheck: async () => ({
        healthy: true,
        checkedAt: new Date().toISOString(),
      }),
    };

    beforeAll(() => {
      registry.register(gateTestAdapter);
    });

    it('fails closed with ProviderNotActivatedError before promotion, dispatches for real once activated, and fails closed again the instant the kill switch deactivates it', async () => {
      const tenantId = newTenantId();

      await expect(
        dispatchProviderRequest(deps(), {
          tenantId,
          caseId: randomUUID(),
          borrowerSubjectId: 'promotion-gate-borrower',
          capability: ProviderCapability.ASSET,
          mode: 'AUTHORIZED_SANDBOX',
          request: {},
          purposeCode: 'UNDERWRITING_EVIDENCE',
          permittedDataClasses: ['ASSET'],
        }),
      ).rejects.toThrow(ProviderNotActivatedError);

      const manifest = await promotionService.propose({
        providerId: 'promotion-gate-spec-provider',
        capability: ProviderCapability.ASSET,
        mode: 'AUTHORIZED_SANDBOX',
        adapterVersion: '1.0.0-spec',
        endpointAllowlist: ['https://example.invalid/spec'],
        dataClassifications: ['ASSET'],
        proposedBy: 'dispatch-spec-proposer',
      });

      // Certified but not yet approved: still blocked.
      await promotionService.certify(
        manifest.id,
        'sandbox',
        'dispatch-spec-proposer',
        ProviderCertificationDecision.PASSED,
        'evidence://dispatch-spec-run',
      );
      await expect(
        dispatchProviderRequest(deps(), {
          tenantId,
          caseId: randomUUID(),
          borrowerSubjectId: 'promotion-gate-borrower',
          capability: ProviderCapability.ASSET,
          mode: 'AUTHORIZED_SANDBOX',
          request: {},
          purposeCode: 'UNDERWRITING_EVIDENCE',
          permittedDataClasses: ['ASSET'],
        }),
      ).rejects.toThrow(ProviderNotActivatedError);

      await promotionService.approve(
        manifest.id,
        'compliance',
        'dispatch-spec-approver',
        ProviderApprovalDecision.APPROVED,
      );
      await promotionService.activate(
        manifest.id,
        'sandbox',
        'dispatch-spec-activator',
        null,
      );

      const finding = await dispatchProviderRequest(deps(), {
        tenantId,
        caseId: randomUUID(),
        borrowerSubjectId: 'promotion-gate-borrower',
        capability: ProviderCapability.ASSET,
        mode: 'AUTHORIZED_SANDBOX',
        request: {},
        purposeCode: 'UNDERWRITING_EVIDENCE',
        permittedDataClasses: ['ASSET'],
      });
      expect(finding).toEqual({ ok: true });

      // The kill-switch exercise (Section 29 item 6): this specific
      // round trip — active, dispatch really succeeds, deactivate, the
      // very next dispatch really fails closed — had never been tested
      // through dispatchProviderRequest itself before. Every existing
      // deactivate() test stopped at isActivated() returning false; none
      // proved a real dispatch attempt was actually rejected afterward.
      const deactivated = await promotionService.deactivate(
        'promotion-gate-spec-provider',
        ProviderCapability.ASSET,
        'AUTHORIZED_SANDBOX',
        'dispatch-spec-killswitch-operator',
      );
      expect(deactivated.state).toBe('DEACTIVATED');

      await expect(
        dispatchProviderRequest(deps(), {
          tenantId,
          caseId: randomUUID(),
          borrowerSubjectId: 'promotion-gate-borrower',
          capability: ProviderCapability.ASSET,
          mode: 'AUTHORIZED_SANDBOX',
          request: {},
          purposeCode: 'UNDERWRITING_EVIDENCE',
          permittedDataClasses: ['ASSET'],
        }),
      ).rejects.toThrow(ProviderNotActivatedError);
    });
  });

  describe('real (non-synthetic) failure classification (Section 11.5, M5-027)', () => {
    // A real adapter failure — a network error, a real provider's own
    // non-2xx response, anything this codebase's own synthetic-fault
    // injection never anticipated (M4-007's real AUTHORIZED_SANDBOX
    // Plaid adapter can throw exactly this kind of error). Before M5-027
    // this fell through dispatchProviderRequest's catch block
    // unclassified, leaving the intent silently stuck at DISPATCHED.
    const realFailureAdapter: AnyProviderAdapter = {
      providerId: 'real-failure-spec-provider',
      capability: ProviderCapability.CREDIT,
      mode: 'SIMULATOR',
      operation: {
        effectClass: 'REUSABLE_LOOKUP',
        supportsStatusLookup: false,
        supportsCancellation: false,
        fallbackPolicy: 'PROHIBITED',
      },
      submit: async () => {
        throw new Error('real-failure-spec: simulated network error');
      },
      normalize: (payload) => payload,
      healthCheck: async () => ({
        healthy: true,
        checkedAt: new Date().toISOString(),
      }),
    };

    beforeAll(() => {
      registry.register(realFailureAdapter);
    });

    it('classifies an unrecognized real thrown error as OUTCOME_UNKNOWN, not silence', async () => {
      const tenantId = newTenantId();

      await expect(
        dispatchProviderRequest(deps(), {
          tenantId,
          caseId: randomUUID(),
          borrowerSubjectId: 'real-failure-borrower',
          capability: ProviderCapability.CREDIT,
          request: {},
          purposeCode: 'UNDERWRITING_EVIDENCE',
          permittedDataClasses: ['CREDIT'],
        }),
      ).rejects.toThrow('real-failure-spec: simulated network error');

      const intent = await intentFor(tenantId);
      expect(intent.state).toBe('OUTCOME_UNKNOWN');
    });
  });
});
