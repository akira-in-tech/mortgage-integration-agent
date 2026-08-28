import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { Tenant } from '../database/entities/tenant.entity';
import { LegalHold } from '../database/entities/legal-hold.entity';
import { LegalHoldService } from './legal-hold.service';

// Requires a reachable Postgres (same convention as this codebase's other
// real-DB specs): skip instead of failing when no DATABASE_URL is
// configured.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

describeOrSkip('LegalHoldService (Section 14.1, M5-025)', () => {
  let dataSource: DataSource;
  let service: LegalHoldService;
  let tenantId: string;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [Tenant, LegalHold],
    });
    await dataSource.initialize();
    service = new LegalHoldService(dataSource);

    const tenantRepo = dataSource.getRepository(Tenant);
    const tenant = await tenantRepo.save(
      tenantRepo.create({ name: 'Legal Hold Spec Tenant' }),
    );
    tenantId = tenant.id;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.getRepository(LegalHold).delete({ tenantId });
      await dataSource.getRepository(Tenant).delete({ id: tenantId });
      await dataSource.destroy();
    }
  });

  it('hasActiveHold() is false for a case with no hold ever placed', async () => {
    expect(await service.hasActiveHold(tenantId, randomUUID())).toBe(false);
  });

  it('place() creates a real ACTIVE hold, and hasActiveHold() reflects it', async () => {
    const caseId = randomUUID();
    const hold = await service.place(
      tenantId,
      caseId,
      'legal-hold-spec: litigation',
      'legal-hold-spec-owner',
    );
    expect(hold).toMatchObject({
      tenantId,
      caseId,
      reason: 'legal-hold-spec: litigation',
      ownerId: 'legal-hold-spec-owner',
      status: 'ACTIVE',
      releasedAt: null,
      releasedBy: null,
    });
    expect(await service.hasActiveHold(tenantId, caseId)).toBe(true);
  });

  it('place() rejects a second ACTIVE hold for the same case', async () => {
    const caseId = randomUUID();
    await service.place(tenantId, caseId, 'first hold', 'owner-1');

    await expect(
      service.place(tenantId, caseId, 'second hold', 'owner-2'),
    ).rejects.toThrow(/already has an active legal hold/);
  });

  it('release() marks a hold RELEASED, and a new hold can then be placed for the same case', async () => {
    const caseId = randomUUID();
    const hold = await service.place(tenantId, caseId, 'first hold', 'owner-1');

    const released = await service.release(tenantId, hold.id, 'releaser-1');
    expect(released).toMatchObject({
      id: hold.id,
      status: 'RELEASED',
      releasedBy: 'releaser-1',
    });
    expect(released.releasedAt).not.toBeNull();
    expect(await service.hasActiveHold(tenantId, caseId)).toBe(false);

    const secondHold = await service.place(
      tenantId,
      caseId,
      'second hold, after release',
      'owner-2',
    );
    expect(secondHold.id).not.toBe(hold.id);
    expect(await service.hasActiveHold(tenantId, caseId)).toBe(true);
  });

  it('release() rejects releasing an already-released hold', async () => {
    const caseId = randomUUID();
    const hold = await service.place(tenantId, caseId, 'reason', 'owner-1');
    await service.release(tenantId, hold.id, 'releaser-1');

    await expect(
      service.release(tenantId, hold.id, 'releaser-2'),
    ).rejects.toThrow(/already released/);
  });

  it('release() rejects a nonexistent hold id', async () => {
    await expect(
      service.release(tenantId, randomUUID(), 'releaser-1'),
    ).rejects.toThrow(/not found/);
  });
});
