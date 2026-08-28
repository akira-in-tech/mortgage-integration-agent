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
});
