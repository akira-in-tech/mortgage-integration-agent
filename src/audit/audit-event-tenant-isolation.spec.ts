import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AuditEvent } from '../database/entities/audit-event.entity';
import {
  runInTenantContext,
  runWithRlsBypass,
} from '../database/tenant-context';

// Requires a reachable Postgres with the AuditEvents and AppRuntimeRole
// migrations applied: skip instead of failing when no DATABASE_URL is
// configured — same convention as every other real-DB spec in this
// codebase.
//
// M5-019's proof, same pattern as consent-tenant-isolation.spec.ts
// (M5-005) — connects as the real `mortgage_app` role (M5-003), not
// DATABASE_URL's own, since a superuser connection would pass every one
// of these assertions trivially by bypassing RLS entirely.
//
// No `afterAll` deletion of this spec's own fixture rows: `audit_events`
// is append-only by design (its own migration's trigger rejects
// UPDATE/DELETE unconditionally, even under `app.bypass_rls`) — there is
// no query, privileged or not, that could clean these up. Harmless
// against the fresh, disposable scratch database every verification run
// in this codebase already uses.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

const APP_ROLE = 'mortgage_app';
const APP_ROLE_PASSWORD =
  process.env.APP_DATABASE_ROLE_PASSWORD ?? 'mortgage_app_demo';

function withCredentials(url: string, user: string, password: string): string {
  const parsed = new URL(url);
  parsed.username = user;
  parsed.password = password;
  return parsed.toString();
}

describeOrSkip('audit_events row-level security', () => {
  let restrictedDataSource: DataSource;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  let eventA: AuditEvent;
  let eventB: AuditEvent;

  beforeAll(async () => {
    restrictedDataSource = new DataSource({
      type: 'postgres',
      url: withCredentials(DATABASE_URL as string, APP_ROLE, APP_ROLE_PASSWORD),
      entities: [AuditEvent],
    });
    await restrictedDataSource.initialize();

    function makeEvent(tenantId: string) {
      const repo = restrictedDataSource.getRepository(AuditEvent);
      return repo.create({
        tenantId,
        actorId: 'tenant-isolation-spec-actor',
        action: 'TENANT_ISOLATION_SPEC_ACTION',
        resourceType: 'spec_resource',
        resourceId: null,
        correlationId: null,
        reason: null,
        metadata: null,
      });
    }

    eventA = await runInTenantContext(
      restrictedDataSource,
      tenantA,
      (manager) => manager.getRepository(AuditEvent).save(makeEvent(tenantA)),
    );
    eventB = await runInTenantContext(
      restrictedDataSource,
      tenantB,
      (manager) => manager.getRepository(AuditEvent).save(makeEvent(tenantB)),
    );
  });

  afterAll(async () => {
    if (restrictedDataSource?.isInitialized) {
      await restrictedDataSource.destroy();
    }
  });

  it('a query with no tenant context and no bypass sees zero rows, even though real rows exist', async () => {
    const events = await restrictedDataSource.getRepository(AuditEvent).find();
    expect(events).toHaveLength(0);
  });

  it("tenant A's context sees only tenant A's event", async () => {
    const events = await runInTenantContext(
      restrictedDataSource,
      tenantA,
      (manager) => manager.getRepository(AuditEvent).find(),
    );
    expect(events.map((e) => e.id)).toEqual([eventA.id]);
  });

  it("tenant B's context sees only tenant B's event, never tenant A's", async () => {
    const events = await runInTenantContext(
      restrictedDataSource,
      tenantB,
      (manager) => manager.getRepository(AuditEvent).find(),
    );
    expect(events.map((e) => e.id)).toEqual([eventB.id]);
  });

  it("a direct lookup by id for a different tenant's event returns nothing, even though the row exists", async () => {
    const found = await runInTenantContext(
      restrictedDataSource,
      tenantB,
      (manager) =>
        manager.getRepository(AuditEvent).findOneBy({ id: eventA.id }),
    );
    expect(found).toBeNull();
  });

  it('an INSERT whose row tenantId does not match the session tenant context is rejected by PostgreSQL itself', async () => {
    await expect(
      runInTenantContext(restrictedDataSource, tenantB, (manager) => {
        const repo = manager.getRepository(AuditEvent);
        return repo.save(
          repo.create({
            // Row claims tenant A while the session context says tenant B.
            tenantId: tenantA,
            actorId: 'tenant-isolation-spec-attacker',
            action: 'TENANT_ISOLATION_SPEC_ACTION',
            resourceType: 'spec_resource',
            resourceId: null,
            correlationId: null,
            reason: null,
            metadata: null,
          }),
        );
      }),
    ).rejects.toThrow();
  });

  it("bypass mode sees every tenant's events at once — the one explicit, audited exception", async () => {
    const events = await runWithRlsBypass(restrictedDataSource, (manager) =>
      manager.getRepository(AuditEvent).find(),
    );
    const ids = events.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining([eventA.id, eventB.id]));
  });

  it('even bypass mode cannot UPDATE or DELETE a written event — append-only is unconditional', async () => {
    await expect(
      runWithRlsBypass(restrictedDataSource, (manager) =>
        manager
          .getRepository(AuditEvent)
          .update({ id: eventA.id }, { reason: 'tampered' }),
      ),
    ).rejects.toThrow(/append-only/);

    await expect(
      runWithRlsBypass(restrictedDataSource, (manager) =>
        manager.getRepository(AuditEvent).delete({ id: eventA.id }),
      ),
    ).rejects.toThrow(/append-only/);
  });
});
