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
  dispatchProviderRequest as dispatchProviderRequestRaw,
  filterToPermittedFields,
  ProviderDisabledError,
  ProviderNotActivatedError,
  ProviderConsentScopeError,
} from './dispatch-provider-request';
import {
  AnyProviderAdapter,
  completeProviderReceipt,
  ProviderCapability,
} from './types';
import { AssetService } from '../integrations/asset/asset.service';
import { AssetVerificationAdapter } from '../integrations/asset/asset-verification.adapter';
import { IdentityService } from '../integrations/identity/identity.service';
import { IdentityVerificationAdapter } from '../integrations/identity/identity-verification.adapter';
import { AuditEvent } from '../database/entities/audit-event.entity';
import { AuditEventService } from '../audit/audit-event.service';
import { ProviderFindingContractError } from './provider-finding-contract';
import { PermissiblePurposeDecision } from '../database/entities/permissible-purpose-decision.entity';
import { PermissiblePurposeService } from './permissible-purpose.service';

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
  let permissiblePurposeService: PermissiblePurposeService;
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
        PermissiblePurposeDecision,
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
    permissiblePurposeService = new PermissiblePurposeService(dataSource);
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
        await dataSource
          .getRepository(PermissiblePurposeDecision)
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
    permissiblePurposeService,
  });

  // These integration tests construct provider requests directly rather than
  // through CasesService, whose normal create path grants consent. Seed the
  // exact scope here so every dispatch still exercises the production gate.
  async function dispatchProviderRequest<TFinding>(
    dependencies: Parameters<typeof dispatchProviderRequestRaw>[0],
    params: Parameters<typeof dispatchProviderRequestRaw>[1],
  ): Promise<TFinding> {
    const consent = await consentService.activeRecordForPurpose(
      params.tenantId,
      params.caseId,
      params.purposeCode,
      params.permittedDataClasses,
    );
    if (!consent) {
      await consentService.grantForCase(
        params.tenantId,
        params.caseId,
        params.purposeCode,
        params.permittedDataClasses.join(','),
      );
    }
    return dispatchProviderRequestRaw<TFinding>(dependencies, params);
  }

  function newTenantId(): string {
    const id = randomUUID();
    testTenantIds.push(id);
    return id;
  }

  async function intentFor(tenantId: string) {
    const entity = await dataSource
      .getRepository(ProviderOperationIntent)
      .findOneByOrFail({ tenantId });
    return (await intentService.get(tenantId, entity.id))!;
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

  it('replays a completed logical operation from its persisted normalized finding without a second provider submission', async () => {
    const tenantId = newTenantId();
    const caseId = randomUUID();
    const params = {
      tenantId,
      caseId,
      borrowerSubjectId: 'dispatch-spec-replay-borrower',
      capability: ProviderCapability.ASSET,
      request: { borrowerId: 'dispatch-spec-replay-borrower' },
      purposeCode: 'UNDERWRITING_EVIDENCE',
      permittedDataClasses: ['ASSET'],
      logicalOperationKey: 'dispatch-spec-stable-logical-effect',
    };

    const first = await dispatchProviderRequest(deps(), params);
    const replay = await dispatchProviderRequest(deps(), params);

    expect(replay).toEqual(first);
    const intents = await dataSource
      .getRepository(ProviderOperationIntent)
      .find({ where: { tenantId } });
    expect(intents).toHaveLength(1);
    expect(intents[0].providerReceipt).toMatchObject({
      v: 1,
      alg: 'A256GCM',
      ciphertext: expect.any(String),
    });
    expect(intents[0].normalizedFinding).toMatchObject({
      v: 1,
      alg: 'A256GCM',
      ciphertext: expect.any(String),
    });
    expect(
      (await intentService.get(tenantId, intents[0].id))?.normalizedFinding,
    ).toEqual(first);
  });

  it('rejects changed payload reuse under the same logical operation key', async () => {
    const tenantId = newTenantId();
    const caseId = randomUUID();
    const base = {
      tenantId,
      caseId,
      borrowerSubjectId: 'dispatch-spec-conflict-borrower',
      capability: ProviderCapability.ASSET,
      purposeCode: 'UNDERWRITING_EVIDENCE',
      permittedDataClasses: ['ASSET'],
      logicalOperationKey: 'dispatch-spec-conflicting-logical-effect',
    };
    await dispatchProviderRequest(deps(), {
      ...base,
      request: { borrowerId: 'dispatch-spec-conflict-borrower' },
    });

    await expect(
      dispatchProviderRequest(deps(), {
        ...base,
        request: { borrowerId: 'changed-borrower' },
      }),
    ).rejects.toThrow(/reused with a changed/);
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

  it('fails before grant issuance when consent does not cover the exact purpose and data class', async () => {
    const tenantId = newTenantId();
    const caseId = randomUUID();
    await consentService.grantForCase(
      tenantId,
      caseId,
      'ANALYTICS_ONLY',
      'INCOME',
    );

    await expect(
      dispatchProviderRequestRaw(deps(), {
        tenantId,
        caseId,
        borrowerSubjectId: 'wrong-scope-borrower',
        capability: ProviderCapability.ASSET,
        request: { borrowerId: 'wrong-scope-borrower' },
        purposeCode: 'UNDERWRITING_EVIDENCE',
        permittedDataClasses: ['ASSET'],
      }),
    ).rejects.toBeInstanceOf(ProviderConsentScopeError);

    expect(
      await dataSource
        .getRepository(ProviderAuthorizationGrant)
        .find({ where: { tenantId, caseId } }),
    ).toHaveLength(0);
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

  describe('canonical finding boundary', () => {
    const invalidReceipts: Array<{
      name: string;
      capability: ProviderCapability;
      payload: Record<string, unknown>;
      observedAt?: Date;
    }> = [
      {
        name: 'partial asset payload',
        capability: ProviderCapability.ASSET,
        payload: { liquidAssets: 5000 },
      },
      {
        name: 'stale asset payload',
        capability: ProviderCapability.ASSET,
        payload: {
          liquidAssets: 5000,
          investmentAssets: 1000,
          accountCount: 2,
          reserveMonths: 4,
        },
        observedAt: new Date('2020-01-01T00:00:00.000Z'),
      },
      {
        name: 'contradictory identity payload',
        capability: ProviderCapability.IDENTITY,
        payload: {
          nameMatch: false,
          dateOfBirthMatch: true,
          ssnValid: true,
          addressMatch: true,
          fraudAlertPresent: false,
          identityVerified: true,
        },
      },
    ];

    it.each(invalidReceipts)(
      'fails closed for a $name and retains the rejected receipt',
      async ({ capability, payload, observedAt }) => {
        const tenantId = newTenantId();
        const invalidAdapter: AnyProviderAdapter = {
          providerId: `invalid-finding-${capability.toLowerCase()}-spec`,
          capability,
          mode: 'SIMULATOR',
          operation: {
            effectClass: 'REUSABLE_LOOKUP',
            supportsStatusLookup: false,
            supportsCancellation: false,
            fallbackPolicy: 'PROHIBITED',
          },
          submit: async () =>
            completeProviderReceipt(payload, observedAt ?? new Date()),
          normalize: (providerPayload) => providerPayload,
          healthCheck: async () => ({
            healthy: true,
            checkedAt: new Date().toISOString(),
          }),
        };
        // Bypass normal registration only to avoid capability collisions with
        // the real adapters already under test. The production dispatch path,
        // authorization, persistence, and contract gate remain unchanged.
        const fakeRegistry = {
          resolve: () => invalidAdapter,
        } as unknown as ProviderRegistryService;

        await expect(
          dispatchProviderRequest(
            { ...deps(), registry: fakeRegistry },
            {
              tenantId,
              caseId: randomUUID(),
              borrowerSubjectId: 'invalid-finding-borrower',
              capability,
              request: { borrowerId: 'invalid-finding-borrower' },
              purposeCode: 'UNDERWRITING_EVIDENCE',
              permittedDataClasses: [capability],
            },
          ),
        ).rejects.toBeInstanceOf(ProviderFindingContractError);

        const intent = await intentFor(tenantId);
        expect(intent.state).toBe('FAILED_FINAL');
        expect(intent.providerReceipt).toMatchObject({
          status: 'COMPLETE',
          payload,
        });
        expect(intent.normalizedFinding).toBeUndefined();
      },
    );
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
          permissiblePurposeService,
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

  // M7-028: Section 7.5 names "the production router" as its own
  // independent checkpoint against the structural exclusion list — "even
  // when... an adapter is technically certified." ProviderRegistryService
  // .register() already blocks an excluded adapter from ever being
  // registered normally (structural-exclusions.spec.ts covers that), so
  // this test uses a fake registry standing in for however an excluded
  // adapter might otherwise reach deps.registry, proving
  // dispatchProviderRequest() checks again independently right before
  // routing to it, rather than only trusting whatever called resolve().
  it('rejects dispatch for an adapter carrying an excluded declaredCommandClass, independent of the registry-time check', async () => {
    const excludedAdapter: AnyProviderAdapter = {
      providerId: 'structural-exclusion-spec-provider',
      capability: ProviderCapability.ASSET,
      mode: 'SIMULATOR',
      structurallyExcludedCommandClass: 'FUNDS_MOVEMENT',
      operation: {
        effectClass: 'REUSABLE_LOOKUP',
        supportsStatusLookup: false,
        supportsCancellation: false,
        fallbackPolicy: 'PROHIBITED',
      },
      submit: async () => {
        throw new Error(
          'must never be reached — the structural check must reject before dispatch',
        );
      },
      normalize: (payload) => payload,
      healthCheck: async () => ({
        healthy: true,
        checkedAt: new Date().toISOString(),
      }),
    };
    const fakeRegistry = {
      resolve: () => excludedAdapter,
    } as unknown as ProviderRegistryService;

    await expect(
      dispatchProviderRequest(
        { ...deps(), registry: fakeRegistry },
        {
          tenantId: newTenantId(),
          caseId: randomUUID(),
          borrowerSubjectId: 'structural-exclusion-borrower',
          capability: ProviderCapability.ASSET,
          mode: 'SIMULATOR',
          request: {},
          purposeCode: 'UNDERWRITING_EVIDENCE',
          permittedDataClasses: ['ASSET'],
        },
      ),
    ).rejects.toThrow(/structurally excluded/);
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
      submit: async () =>
        completeProviderReceipt({
          liquidAssets: 1,
          investmentAssets: 1,
          accountCount: 1,
          reserveMonths: 1,
        }),
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
      expect(finding).toEqual({
        liquidAssets: 1,
        investmentAssets: 1,
        accountCount: 1,
        reserveMonths: 1,
      });

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
