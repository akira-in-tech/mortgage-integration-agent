import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AuditEvent } from '../database/entities/audit-event.entity';
import { AuditEventService } from './audit-event.service';
import { runInTenantContext } from '../database/tenant-context';

// Requires a reachable Postgres (same convention as this codebase's other
// real-DB specs): skip instead of failing when no DATABASE_URL is
// configured.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

describeOrSkip('AuditEventService', () => {
  let dataSource: DataSource;
  let service: AuditEventService;
  const tenantId = randomUUID();

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [AuditEvent],
    });
    await dataSource.initialize();
    service = new AuditEventService(dataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      // audit_events is append-only by design (its own migration's
      // trigger rejects UPDATE/DELETE unconditionally, even under
      // app.bypass_rls) — there is no cleanup query that could remove
      // this spec's own fixture rows even if one were written here. A
      // fresh scratch database per verification run is how this
      // codebase's own convention already handles that, not a gap this
      // spec needs to work around.
      await dataSource.destroy();
    }
  });

  it('record() persists a real, queryable audit event with every provided field', async () => {
    const correlationId = randomUUID();
    await service.record({
      tenantId,
      actorId: 'spec-actor',
      action: 'SPEC_ACTION',
      resourceType: 'spec_resource',
      resourceId: 'resource-1',
      correlationId,
      reason: 'because this is a test',
      metadata: { foo: 'bar' },
    });

    const events = await runInTenantContext(dataSource, tenantId, (manager) =>
      manager.getRepository(AuditEvent).find({ where: { tenantId } }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      tenantId,
      actorId: 'spec-actor',
      action: 'SPEC_ACTION',
      resourceType: 'spec_resource',
      resourceId: 'resource-1',
      correlationId,
      reason: 'because this is a test',
      metadata: { foo: 'bar' },
    });
  });

  it('record() honestly nulls out every optional field that was omitted, rather than guessing a value', async () => {
    await service.record({
      tenantId,
      actorId: 'spec-actor-minimal',
      action: 'SPEC_MINIMAL_ACTION',
      resourceType: 'spec_resource',
    });

    const event = await runInTenantContext(dataSource, tenantId, (manager) =>
      manager.getRepository(AuditEvent).findOneByOrFail({
        actorId: 'spec-actor-minimal',
      }),
    );
    expect(event.resourceId).toBeNull();
    expect(event.correlationId).toBeNull();
    expect(event.reason).toBeNull();
    expect(event.metadata).toBeNull();
  });

  it('a written audit event cannot be updated — the database itself rejects it', async () => {
    await service.record({
      tenantId,
      actorId: 'spec-actor-immutable',
      action: 'SPEC_IMMUTABLE_ACTION',
      resourceType: 'spec_resource',
    });
    const event = await runInTenantContext(dataSource, tenantId, (manager) =>
      manager.getRepository(AuditEvent).findOneByOrFail({
        actorId: 'spec-actor-immutable',
      }),
    );

    await expect(
      runInTenantContext(dataSource, tenantId, (manager) =>
        manager
          .getRepository(AuditEvent)
          .update({ id: event.id }, { reason: 'tampered' }),
      ),
    ).rejects.toThrow(/append-only/);
  });

  it('a written audit event cannot be deleted — the database itself rejects it', async () => {
    await service.record({
      tenantId,
      actorId: 'spec-actor-undeletable',
      action: 'SPEC_UNDELETABLE_ACTION',
      resourceType: 'spec_resource',
    });
    const event = await runInTenantContext(dataSource, tenantId, (manager) =>
      manager.getRepository(AuditEvent).findOneByOrFail({
        actorId: 'spec-actor-undeletable',
      }),
    );

    await expect(
      runInTenantContext(dataSource, tenantId, (manager) =>
        manager.getRepository(AuditEvent).delete({ id: event.id }),
      ),
    ).rejects.toThrow(/append-only/);
  });

  // M7-055: the real export route used to call list(), whose 1,000-row cap
  // silently truncated a tenant with more history than that — with no
  // signal anywhere in the downloaded file that anything was missing.
  // listAll() is the fix; these tests use a fresh, dedicated tenant so the
  // exact counts below aren't affected by this file's other, shared-tenant
  // tests. Note: listAll()'s internal page size is 1,000 — proving the
  // "the cap lands exactly on a full internal page" boundary specifically
  // would need 1,000+ seeded rows, too slow for a unit test; the
  // maxEvents-smaller-than-a-page path exercised below (the realistic
  // shape for any actual export, since the default cap is 50,000) covers
  // the same existence-check logic that boundary would.
  describe('listAll()', () => {
    const listAllTenantId = randomUUID();

    it('returns every real event for a tenant, newest first, when nothing near the cap', async () => {
      for (const action of ['FIRST', 'SECOND', 'THIRD']) {
        await service.record({
          tenantId: listAllTenantId,
          actorId: 'listall-spec-actor',
          action: `LISTALL_${action}`,
          resourceType: 'spec_resource',
        });
      }

      const { events, truncated } = await service.listAll(listAllTenantId);
      expect(truncated).toBe(false);
      expect(events.map((e) => e.action)).toEqual([
        'LISTALL_THIRD',
        'LISTALL_SECOND',
        'LISTALL_FIRST',
      ]);
    });

    it('reports truncated:true, backed by a real existence check, when a small maxEvents cap is actually exceeded', async () => {
      const cappedTenantId = randomUUID();
      for (let i = 0; i < 5; i++) {
        await service.record({
          tenantId: cappedTenantId,
          actorId: 'listall-capped-actor',
          action: `LISTALL_CAPPED_${i}`,
          resourceType: 'spec_resource',
        });
      }

      const { events, truncated } = await service.listAll(cappedTenantId, 2);
      expect(truncated).toBe(true);
      expect(events).toHaveLength(2);
      // Newest 2 of the 5 real rows — not an arbitrary 2.
      expect(events.map((e) => e.action)).toEqual([
        'LISTALL_CAPPED_4',
        'LISTALL_CAPPED_3',
      ]);
    });

    it('reports truncated:false when maxEvents exactly matches the real row count — the existence check must not false-positive', async () => {
      const exactTenantId = randomUUID();
      for (let i = 0; i < 3; i++) {
        await service.record({
          tenantId: exactTenantId,
          actorId: 'listall-exact-actor',
          action: `LISTALL_EXACT_${i}`,
          resourceType: 'spec_resource',
        });
      }

      const { events, truncated } = await service.listAll(exactTenantId, 3);
      expect(truncated).toBe(false);
      expect(events).toHaveLength(3);
    });
  });
});
