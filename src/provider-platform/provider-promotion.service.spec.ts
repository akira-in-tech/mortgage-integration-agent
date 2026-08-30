import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ProviderPromotionManifest } from '../database/entities/provider-promotion-manifest.entity';
import { ProviderCertificationRecord } from '../database/entities/provider-certification-record.entity';
import { ProviderApprovalRecord } from '../database/entities/provider-approval-record.entity';
import { ProviderActivation } from '../database/entities/provider-activation.entity';
import {
  ProviderCertificationDecision,
  ProviderApprovalDecision,
} from '../database/enums/provider-promotion.enum';
import { ProviderPromotionService } from './provider-promotion.service';
import { ProviderCapability } from './types';
import { AuditEvent } from '../database/entities/audit-event.entity';
import { AuditEventService } from '../audit/audit-event.service';
import { PLATFORM_AUDIT_TENANT_ID } from '../audit/platform-audit-tenant';
import { runInTenantContext } from '../database/tenant-context';

// Requires a reachable Postgres (same convention as the other real-DB
// specs): skip instead of failing when no DATABASE_URL is configured.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

describeOrSkip('ProviderPromotionService (Section 11.4, M4-007)', () => {
  let dataSource: DataSource;
  let service: ProviderPromotionService;
  const providerIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [
        ProviderPromotionManifest,
        ProviderCertificationRecord,
        ProviderApprovalRecord,
        ProviderActivation,
        AuditEvent,
      ],
    });
    await dataSource.initialize();
    service = new ProviderPromotionService(
      dataSource.getRepository(ProviderPromotionManifest),
      dataSource.getRepository(ProviderCertificationRecord),
      dataSource.getRepository(ProviderApprovalRecord),
      dataSource.getRepository(ProviderActivation),
      new AuditEventService(dataSource),
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (providerIds.length > 0) {
        const manifests = await dataSource
          .getRepository(ProviderPromotionManifest)
          .createQueryBuilder()
          .where('"providerId" IN (:...ids)', { ids: providerIds })
          .getMany();
        const manifestIds = manifests.map((m) => m.id);
        if (manifestIds.length > 0) {
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
        }
        await dataSource
          .getRepository(ProviderActivation)
          .createQueryBuilder()
          .delete()
          .where('"providerId" IN (:...ids)', { ids: providerIds })
          .execute();
        await dataSource
          .getRepository(ProviderPromotionManifest)
          .createQueryBuilder()
          .delete()
          .where('"providerId" IN (:...ids)', { ids: providerIds })
          .execute();
      }
      // audit_events is append-only by design (its own migration's
      // trigger rejects UPDATE/DELETE unconditionally) — this spec's own
      // PROVIDER_* rows under PLATFORM_AUDIT_TENANT_ID are left in
      // place, same convention as audit-event.service.spec.ts's own
      // afterAll.
      await dataSource.destroy();
    }
  });

  function uniqueProviderId(): string {
    const id = `promotion-spec-provider-${Date.now()}-${Math.random()}`;
    providerIds.push(id);
    return id;
  }

  async function proposeManifest(
    providerId: string,
    proposedBy = 'proposer-1',
  ) {
    return service.propose({
      providerId,
      capability: ProviderCapability.INCOME,
      mode: 'AUTHORIZED_SANDBOX',
      adapterVersion: '1.0.0',
      endpointAllowlist: ['https://sandbox.example.invalid'],
      dataClassifications: ['INCOME'],
      proposedBy,
    });
  }

  // M7-028: Section 7.5 names the promotion-manifest validator as its own
  // independent checkpoint ("even when... an adapter is technically
  // certified") — this proves propose() actually enforces it, not just
  // that the shared assertNotStructurallyExcluded() helper works in
  // isolation (structural-exclusions.spec.ts already covers that).
  it('propose() rejects a manifest declaring a structurally excluded command class', async () => {
    const providerId = uniqueProviderId();
    await expect(
      service.propose({
        providerId,
        capability: ProviderCapability.INCOME,
        mode: 'AUTHORIZED_SANDBOX',
        adapterVersion: '1.0.0',
        endpointAllowlist: ['https://sandbox.example.invalid'],
        dataClassifications: ['INCOME'],
        proposedBy: 'proposer-1',
        declaredCommandClass: 'FUNDS_MOVEMENT',
      }),
    ).rejects.toThrow(/structurally excluded/);

    // Rejected before any row was ever written — not proposed-then-flagged.
    const manifests = await dataSource
      .getRepository(ProviderPromotionManifest)
      .find({ where: { providerId } });
    expect(manifests).toEqual([]);
  });

  it('propose() persists a real (non-excluded) declaredCommandClass unchanged, and leaves it null when unset', async () => {
    const providerId = uniqueProviderId();
    const manifest = await proposeManifest(providerId);
    expect(manifest.declaredCommandClass).toBeNull();

    const providerId2 = uniqueProviderId();
    const withClass = await service.propose({
      providerId: providerId2,
      capability: ProviderCapability.INCOME,
      mode: 'AUTHORIZED_SANDBOX',
      adapterVersion: '1.0.0',
      endpointAllowlist: ['https://sandbox.example.invalid'],
      dataClassifications: ['INCOME'],
      proposedBy: 'proposer-1',
      declaredCommandClass: 'READ_ONLY_LOOKUP',
    });
    expect(withClass.declaredCommandClass).toBe('READ_ONLY_LOOKUP');
  });

  it('propose() increments version per {providerId, capability, mode} tuple and computes a real content hash', async () => {
    const providerId = uniqueProviderId();
    const first = await proposeManifest(providerId);
    expect(first.version).toBe(1);
    expect(first.contentHash).toMatch(/^[0-9a-f]{64}$/);

    const second = await proposeManifest(providerId);
    expect(second.version).toBe(2);
    expect(second.contentHash).toBe(first.contentHash);
  });

  it('approve() rejects self-approval and accepts approval from a different actor', async () => {
    const providerId = uniqueProviderId();
    const manifest = await proposeManifest(providerId, 'same-actor');

    await expect(
      service.approve(
        manifest.id,
        'compliance',
        'same-actor',
        ProviderApprovalDecision.APPROVED,
      ),
    ).rejects.toThrow('self-approval is not permitted');

    const approval = await service.approve(
      manifest.id,
      'compliance',
      'different-actor',
      ProviderApprovalDecision.APPROVED,
    );
    expect(approval.decision).toBe(ProviderApprovalDecision.APPROVED);
  });

  it('activate() fails closed with neither certification nor approval, then with only one of the two', async () => {
    const providerId = uniqueProviderId();
    const manifest = await proposeManifest(providerId);

    await expect(
      service.activate(manifest.id, 'sandbox', 'activator', null),
    ).rejects.toThrow(/no current PASSED, unexpired certification/);

    await service.certify(
      manifest.id,
      'sandbox',
      'certifier-1',
      ProviderCertificationDecision.PASSED,
      'evidence://spec-run-1',
    );
    await expect(
      service.activate(manifest.id, 'sandbox', 'activator', null),
    ).rejects.toThrow(/no current APPROVED, unexpired approval/);

    await service.approve(
      manifest.id,
      'compliance',
      'approver-1',
      ProviderApprovalDecision.APPROVED,
    );
    const activation = await service.activate(
      manifest.id,
      'sandbox',
      'activator',
      null,
    );
    expect(activation.state).toBe('ACTIVE');
    expect(
      await service.isActivated(
        providerId,
        ProviderCapability.INCOME,
        'AUTHORIZED_SANDBOX',
      ),
    ).toBe(true);
  });

  it('activate() ignores an expired certification and an expired approval', async () => {
    const providerId = uniqueProviderId();
    const manifest = await proposeManifest(providerId);
    const past = new Date(Date.now() - 1000);

    await service.certify(
      manifest.id,
      'sandbox',
      'certifier-1',
      ProviderCertificationDecision.PASSED,
      'evidence://spec-run-expired',
      past,
    );
    await service.approve(
      manifest.id,
      'compliance',
      'approver-1',
      ProviderApprovalDecision.APPROVED,
    );

    await expect(
      service.activate(manifest.id, 'sandbox', 'activator', null),
    ).rejects.toThrow(/no current PASSED, unexpired certification/);
  });

  it('activate() rejects a stale expected-version and succeeds once the caller reloads the current version', async () => {
    const providerId = uniqueProviderId();
    const manifest = await proposeManifest(providerId);
    await service.certify(
      manifest.id,
      'sandbox',
      'certifier-1',
      ProviderCertificationDecision.PASSED,
      'evidence://spec-run-1',
    );
    await service.approve(
      manifest.id,
      'compliance',
      'approver-1',
      ProviderApprovalDecision.APPROVED,
    );
    await service.activate(manifest.id, 'sandbox', 'activator', null);

    // A second manifest for the same tuple, also certified+approved.
    const manifest2 = await proposeManifest(providerId);
    await service.certify(
      manifest2.id,
      'sandbox',
      'certifier-1',
      ProviderCertificationDecision.PASSED,
      'evidence://spec-run-2',
    );
    await service.approve(
      manifest2.id,
      'compliance',
      'approver-1',
      ProviderApprovalDecision.APPROVED,
    );

    // Stale caller still thinks nothing is active yet.
    await expect(
      service.activate(manifest2.id, 'sandbox', 'activator', null),
    ).rejects.toThrow(/has moved/);

    const activation = await service.activate(
      manifest2.id,
      'sandbox',
      'activator',
      manifest.version,
    );
    expect(activation.manifestId).toBe(manifest2.id);
    expect(activation.manifestVersion).toBe(manifest2.version);
  });

  it('deactivate() turns isActivated() false again', async () => {
    const providerId = uniqueProviderId();
    const manifest = await proposeManifest(providerId);
    await service.certify(
      manifest.id,
      'sandbox',
      'certifier-1',
      ProviderCertificationDecision.PASSED,
      'evidence://spec-run-1',
    );
    await service.approve(
      manifest.id,
      'compliance',
      'approver-1',
      ProviderApprovalDecision.APPROVED,
    );
    await service.activate(manifest.id, 'sandbox', 'activator', null);
    expect(
      await service.isActivated(
        providerId,
        ProviderCapability.INCOME,
        'AUTHORIZED_SANDBOX',
      ),
    ).toBe(true);

    await service.deactivate(
      providerId,
      ProviderCapability.INCOME,
      'AUTHORIZED_SANDBOX',
      'emergency-operator',
    );
    expect(
      await service.isActivated(
        providerId,
        ProviderCapability.INCOME,
        'AUTHORIZED_SANDBOX',
      ),
    ).toBe(false);
  });

  it('re-activating a deactivated tuple with a NEW manifest still requires its own fresh certification and approval — deactivate() has no "quick re-enable" bypass of the dual-control gate', async () => {
    const providerId = uniqueProviderId();
    const firstManifest = await proposeManifest(providerId);
    await service.certify(
      firstManifest.id,
      'sandbox',
      'certifier-1',
      ProviderCertificationDecision.PASSED,
      'evidence://spec-run-1',
    );
    await service.approve(
      firstManifest.id,
      'compliance',
      'approver-1',
      ProviderApprovalDecision.APPROVED,
    );
    await service.activate(firstManifest.id, 'sandbox', 'activator', null);
    await service.deactivate(
      providerId,
      ProviderCapability.INCOME,
      'AUTHORIZED_SANDBOX',
      'emergency-operator',
    );

    // A second, real-world "we fixed the incident, bring it back with a
    // corrected build" manifest — re-enabling is not exempt from the
    // exact same propose -> certify -> approve chain the original
    // activation needed. Section 11.4's own "governed re-enable"
    // requirement is this: activate() never succeeds without a CURRENT
    // valid certification and approval, whether it's the first
    // activation of a tuple or a re-activation after an emergency stop.
    const secondManifest = await proposeManifest(providerId);
    await expect(
      service.activate(
        secondManifest.id,
        'sandbox',
        'activator',
        firstManifest.version,
      ),
    ).rejects.toThrow(/no current PASSED, unexpired certification/);

    await service.certify(
      secondManifest.id,
      'sandbox',
      'certifier-2',
      ProviderCertificationDecision.PASSED,
      'evidence://spec-run-2-post-incident',
    );
    await expect(
      service.activate(
        secondManifest.id,
        'sandbox',
        'activator',
        firstManifest.version,
      ),
    ).rejects.toThrow(/no current APPROVED, unexpired approval/);

    await service.approve(
      secondManifest.id,
      'compliance',
      'approver-2',
      ProviderApprovalDecision.APPROVED,
    );
    const reactivated = await service.activate(
      secondManifest.id,
      'sandbox',
      'activator',
      firstManifest.version,
    );
    expect(reactivated.state).toBe('ACTIVE');
    expect(
      await service.isActivated(
        providerId,
        ProviderCapability.INCOME,
        'AUTHORIZED_SANDBOX',
      ),
    ).toBe(true);
  });

  it('isActivated() is false (fail closed) for a tuple that has never been activated', async () => {
    const providerId = uniqueProviderId();
    expect(
      await service.isActivated(
        providerId,
        ProviderCapability.INCOME,
        'AUTHORIZED_SANDBOX',
      ),
    ).toBe(false);
  });

  it('listManifests() returns manifests most-recently-proposed first, and getManifest() fetches one by id', async () => {
    const providerId = uniqueProviderId();
    const first = await proposeManifest(providerId);
    const second = await proposeManifest(providerId);

    const listed = await service.listManifests(100);
    const ids = listed.map((m) => m.id);
    // second was proposed after first, so it must sort earlier.
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));

    const fetched = await service.getManifest(first.id);
    expect(fetched.id).toBe(first.id);
    expect(fetched.providerId).toBe(providerId);
  });

  it('listCertifications() and listApprovals() return the full append-only history for one manifest, newest first', async () => {
    const providerId = uniqueProviderId();
    const manifest = await proposeManifest(providerId);

    await service.certify(
      manifest.id,
      'sandbox',
      'certifier-1',
      ProviderCertificationDecision.FAILED,
      'evidence://spec-run-1',
    );
    await service.certify(
      manifest.id,
      'sandbox',
      'certifier-1',
      ProviderCertificationDecision.PASSED,
      'evidence://spec-run-2',
    );
    await service.approve(
      manifest.id,
      'compliance',
      'approver-1',
      ProviderApprovalDecision.APPROVED,
    );

    const certifications = await service.listCertifications(manifest.id);
    expect(certifications).toHaveLength(2);
    // Newest (the PASSED re-run) first — the append-only history is not
    // just "the latest decision," a reviewer can see the FAILED run too.
    expect(certifications[0].decision).toBe(
      ProviderCertificationDecision.PASSED,
    );
    expect(certifications[1].decision).toBe(
      ProviderCertificationDecision.FAILED,
    );

    const approvals = await service.listApprovals(manifest.id);
    expect(approvals).toHaveLength(1);
    expect(approvals[0].decision).toBe(ProviderApprovalDecision.APPROVED);
  });

  it('getActivation() and listActivations() reflect the real current state, including after deactivate()', async () => {
    const providerId = uniqueProviderId();
    const manifest = await proposeManifest(providerId);

    expect(
      await service.getActivation(
        providerId,
        ProviderCapability.INCOME,
        'AUTHORIZED_SANDBOX',
      ),
    ).toBeNull();

    await service.certify(
      manifest.id,
      'sandbox',
      'certifier-1',
      ProviderCertificationDecision.PASSED,
      'evidence://spec-run-1',
    );
    await service.approve(
      manifest.id,
      'compliance',
      'approver-1',
      ProviderApprovalDecision.APPROVED,
    );
    await service.activate(manifest.id, 'sandbox', 'activator', null);

    const active = await service.getActivation(
      providerId,
      ProviderCapability.INCOME,
      'AUTHORIZED_SANDBOX',
    );
    expect(active?.state).toBe('ACTIVE');

    const allActivations = await service.listActivations();
    expect(allActivations.some((a) => a.id === active?.id)).toBe(true);

    const deactivated = await service.deactivate(
      providerId,
      ProviderCapability.INCOME,
      'AUTHORIZED_SANDBOX',
      'emergency-operator',
    );
    // deactivate() now returns the real updated row instead of void, so a
    // caller can show the actual result rather than assuming it worked.
    expect(deactivated.state).toBe('DEACTIVATED');
    expect(deactivated.id).toBe(active?.id);

    const afterDeactivate = await service.getActivation(
      providerId,
      ProviderCapability.INCOME,
      'AUTHORIZED_SANDBOX',
    );
    expect(afterDeactivate?.state).toBe('DEACTIVATED');
  });

  // M7-028: the M5 audit found ProviderPromotionController never wrote
  // an audit_events row at all — provenance for the whole chain lived
  // only in this table's own proposedBy/certifiedBy/etc columns. The
  // fix moved the write into the service itself so every real caller
  // (console, manage-provider-promotion script, kill-switch-drill
  // script) gets it, not just a REST controller that happened to add
  // one. This test drives the whole chain and checks the real
  // audit_events rows it leaves behind.
  it('propose/certify/approve/activate/deactivate each record a real audit event under the platform-wide tenant', async () => {
    const providerId = uniqueProviderId();
    const manifest = await proposeManifest(providerId, 'audit-spec-proposer');
    await service.certify(
      manifest.id,
      'sandbox',
      'audit-spec-certifier',
      ProviderCertificationDecision.PASSED,
      'evidence://audit-spec',
    );
    await service.approve(
      manifest.id,
      'compliance',
      'audit-spec-approver',
      ProviderApprovalDecision.APPROVED,
    );
    const activation = await service.activate(
      manifest.id,
      'sandbox',
      'audit-spec-activator',
      null,
    );
    await service.deactivate(
      providerId,
      ProviderCapability.INCOME,
      'AUTHORIZED_SANDBOX',
      'audit-spec-deactivator',
    );

    const events = await runInTenantContext(
      dataSource,
      PLATFORM_AUDIT_TENANT_ID,
      (manager) =>
        manager.getRepository(AuditEvent).find({
          where: {
            tenantId: PLATFORM_AUDIT_TENANT_ID,
            resourceId: manifest.id,
          },
        }),
    );
    expect(events.map((e) => e.action).sort()).toEqual(
      [
        'PROVIDER_MANIFEST_PROPOSED',
        'PROVIDER_MANIFEST_CERTIFIED',
        'PROVIDER_MANIFEST_APPROVAL_RECORDED',
      ].sort(),
    );
    expect(
      events.find((e) => e.action === 'PROVIDER_MANIFEST_PROPOSED'),
    ).toMatchObject({ actorId: 'audit-spec-proposer' });

    const activationEvents = await runInTenantContext(
      dataSource,
      PLATFORM_AUDIT_TENANT_ID,
      (manager) =>
        manager.getRepository(AuditEvent).find({
          where: {
            tenantId: PLATFORM_AUDIT_TENANT_ID,
            resourceId: activation.id,
          },
          order: { createdAt: 'ASC' },
        }),
    );
    expect(activationEvents.map((e) => e.action)).toEqual([
      'PROVIDER_ACTIVATED',
      'PROVIDER_DEACTIVATED',
    ]);
    expect(activationEvents[0]).toMatchObject({
      actorId: 'audit-spec-activator',
    });
    expect(activationEvents[1]).toMatchObject({
      actorId: 'audit-spec-deactivator',
    });
  });
});
