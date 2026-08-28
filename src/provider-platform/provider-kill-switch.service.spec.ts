import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ProviderAdapterStatus } from '../database/entities/provider-adapter-status.entity';
import { ProviderKillSwitchService } from './provider-kill-switch.service';
import { ProviderCapability } from './types';

// Requires a reachable Postgres (same convention as the other real-DB
// specs): skip instead of failing when no DATABASE_URL is configured.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

describeOrSkip('ProviderKillSwitchService (Section 11.4, M4-006)', () => {
  let dataSource: DataSource;
  let service: ProviderKillSwitchService;
  const providerIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [ProviderAdapterStatus],
    });
    await dataSource.initialize();
    service = new ProviderKillSwitchService(dataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (providerIds.length > 0) {
        await dataSource
          .getRepository(ProviderAdapterStatus)
          .createQueryBuilder()
          .delete()
          .where('"providerId" IN (:...ids)', { ids: providerIds })
          .execute();
      }
      await dataSource.destroy();
    }
  });

  function uniqueProviderId(): string {
    const id = `kill-switch-spec-provider-${Date.now()}-${Math.random()}`;
    providerIds.push(id);
    return id;
  }

  it('is ACTIVE by default when no row has ever been written for a tuple', async () => {
    const providerId = uniqueProviderId();
    const active = await service.isActive(
      providerId,
      ProviderCapability.INCOME,
      'SIMULATOR',
    );
    expect(active).toBe(true);
  });

  it('disable() makes the tuple inactive and records the reason/actor', async () => {
    const providerId = uniqueProviderId();
    await service.disable(
      providerId,
      ProviderCapability.CREDIT,
      'SIMULATOR',
      'spec: simulating an incident',
      'spec-operator-1',
    );

    const active = await service.isActive(
      providerId,
      ProviderCapability.CREDIT,
      'SIMULATOR',
    );
    expect(active).toBe(false);

    const row = await dataSource
      .getRepository(ProviderAdapterStatus)
      .findOneByOrFail({
        providerId,
        capability: 'CREDIT' as never,
        mode: 'SIMULATOR',
      });
    expect(row.state).toBe('DISABLED');
    expect(row.reason).toBe('spec: simulating an incident');
    expect(row.updatedBy).toBe('spec-operator-1');
  });

  it('enable() re-activates a previously disabled tuple and clears the reason', async () => {
    const providerId = uniqueProviderId();
    await service.disable(
      providerId,
      ProviderCapability.DOCUMENT,
      'SIMULATOR',
      'spec: temporary disable',
      'spec-operator-1',
    );
    await service.enable(
      providerId,
      ProviderCapability.DOCUMENT,
      'SIMULATOR',
      'spec-operator-2',
    );

    const active = await service.isActive(
      providerId,
      ProviderCapability.DOCUMENT,
      'SIMULATOR',
    );
    expect(active).toBe(true);

    const row = await dataSource
      .getRepository(ProviderAdapterStatus)
      .findOneByOrFail({
        providerId,
        capability: 'DOCUMENT' as never,
        mode: 'SIMULATOR',
      });
    expect(row.state).toBe('ACTIVE');
    expect(row.reason).toBeNull();
    expect(row.updatedBy).toBe('spec-operator-2');
  });

  it('disabling twice updates the same row rather than creating a duplicate (upsert on the unique tuple)', async () => {
    const providerId = uniqueProviderId();
    await service.disable(
      providerId,
      ProviderCapability.ASSET,
      'SIMULATOR',
      'first reason',
      'spec-operator-1',
    );
    await service.disable(
      providerId,
      ProviderCapability.ASSET,
      'SIMULATOR',
      'second reason',
      'spec-operator-2',
    );

    const rows = await dataSource.getRepository(ProviderAdapterStatus).find({
      where: { providerId, capability: 'ASSET' as never, mode: 'SIMULATOR' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].reason).toBe('second reason');
    expect(rows[0].updatedBy).toBe('spec-operator-2');
  });

  it('disabling one capability leaves a different capability for the same provider untouched', async () => {
    const providerId = uniqueProviderId();
    await service.disable(
      providerId,
      ProviderCapability.INCOME,
      'SIMULATOR',
      'income-only incident',
      'spec-operator-1',
    );

    expect(
      await service.isActive(
        providerId,
        ProviderCapability.INCOME,
        'SIMULATOR',
      ),
    ).toBe(false);
    expect(
      await service.isActive(
        providerId,
        ProviderCapability.CREDIT,
        'SIMULATOR',
      ),
    ).toBe(true);
  });
});
