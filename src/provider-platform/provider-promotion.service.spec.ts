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
      ],
    });
    await dataSource.initialize();
    service = new ProviderPromotionService(
      dataSource.getRepository(ProviderPromotionManifest),
      dataSource.getRepository(ProviderCertificationRecord),
      dataSource.getRepository(ProviderApprovalRecord),
      dataSource.getRepository(ProviderActivation),
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
});
