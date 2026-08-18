import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { WebhookEndpoint } from '../database/entities/webhook-endpoint.entity';
import { WebhookDelivery } from '../database/entities/webhook-delivery.entity';
import { OutboxEvent } from '../database/entities/outbox-event.entity';
import {
  WebhookDeliveryStatus,
  WebhookEndpointStatus,
} from '../database/enums/webhook.enum';
import {
  runInTenantContext,
  runWithRlsBypass,
} from '../database/tenant-context';

// Requires a reachable Postgres with the WebhookTenantIsolation migration
// applied (same convention as this codebase's other real-DB specs): skip
// instead of failing when no DATABASE_URL is configured.
//
// This is the actual proof of Section 20 M5's "database layer" exit
// evidence for webhook_endpoints/webhook_deliveries — every other test in
// this codebase proves *application code* filters correctly; this one
// proves PostgreSQL itself refuses to return or accept rows outside the
// caller's own tenant, independent of whether any application code
// remembered to add a WHERE clause.
//
// Critically, it does this through a real, dedicated NON-superuser
// Postgres role, not through DATABASE_URL's own connection. Postgres
// superusers unconditionally bypass row-level security regardless of
// FORCE ROW LEVEL SECURITY — this is not a bug, it's documented Postgres
// behavior, but it means this codebase's own DATABASE_URL convention
// (one role for migrations and the app, which the official postgres
// Docker image bootstraps as a superuser — POSTGRES_USER) makes RLS
// completely inert if the application actually connected as that role.
// Confirmed empirically while building this migration: `SELECT
// current_setting('is_superuser')` for this project's own scratch-stack
// DATABASE_URL role returns 'on'. See docs/DEVELOPMENT_LOG.md's M5-002
// entry ("Known gaps") for why this is flagged as a real, unresolved
// deployment gap rather than silently worked around everywhere.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

const RESTRICTED_ROLE = 'rls_spec_restricted_role';
const RESTRICTED_ROLE_PASSWORD = 'rls-spec-not-a-real-secret';

function withCredentials(url: string, user: string, password: string): string {
  const parsed = new URL(url);
  parsed.username = user;
  parsed.password = password;
  return parsed.toString();
}

describeOrSkip(
  'webhook_endpoints/webhook_deliveries row-level security',
  () => {
    let adminDataSource: DataSource;
    let restrictedDataSource: DataSource;
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    let endpointA: WebhookEndpoint;
    let endpointB: WebhookEndpoint;
    let outboxEventA: OutboxEvent;
    let deliveryA: WebhookDelivery;

    beforeAll(async () => {
      adminDataSource = new DataSource({
        type: 'postgres',
        url: DATABASE_URL,
        entities: [WebhookEndpoint, WebhookDelivery, OutboxEvent],
      });
      await adminDataSource.initialize();

      // A genuinely restricted role — LOGIN, no SUPERUSER, no BYPASSRLS —
      // is the only way to actually exercise the policy PostgreSQL will
      // enforce for a real, correctly-configured application role. Dropped
      // and recreated defensively in case a prior interrupted run left it
      // behind: a plain DROP ROLE fails with "cannot be dropped because
      // some objects depend on it" once the role holds table grants, so any
      // leftover grants must be revoked (DROP OWNED BY covers both that and
      // ownership of any object the role might hold) before the role itself
      // can be dropped.
      const existingRole = await adminDataSource.query(
        `SELECT 1 FROM pg_roles WHERE rolname = '${RESTRICTED_ROLE}'`,
      );
      if (existingRole.length > 0) {
        await adminDataSource.query(
          `REVOKE ALL ON "webhook_endpoints", "webhook_deliveries" FROM "${RESTRICTED_ROLE}"`,
        );
        await adminDataSource.query(`DROP OWNED BY "${RESTRICTED_ROLE}"`);
        await adminDataSource.query(`DROP ROLE "${RESTRICTED_ROLE}"`);
      }
      await adminDataSource.query(
        `CREATE ROLE "${RESTRICTED_ROLE}" LOGIN PASSWORD '${RESTRICTED_ROLE_PASSWORD}' NOSUPERUSER NOBYPASSRLS`,
      );
      await adminDataSource.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON "webhook_endpoints", "webhook_deliveries" TO "${RESTRICTED_ROLE}"`,
      );

      restrictedDataSource = new DataSource({
        type: 'postgres',
        url: withCredentials(
          DATABASE_URL as string,
          RESTRICTED_ROLE,
          RESTRICTED_ROLE_PASSWORD,
        ),
        // OutboxEvent must be declared too even though the restricted role
        // is never granted access to it: WebhookDelivery's ManyToOne
        // relation target must resolve during metadata build, or
        // initialize() fails before any query runs.
        entities: [WebhookEndpoint, WebhookDelivery, OutboxEvent],
      });
      await restrictedDataSource.initialize();

      // Fixture setup goes through the restricted role too, via the same
      // tenant-scoped path production code uses — proving INSERT is
      // enforced too (an RLS policy with no explicit WITH CHECK applies its
      // USING expression to writes as well as reads), not only the
      // SELECT-side isolation this file mostly exercises below.
      endpointA = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) => {
          const repo = manager.getRepository(WebhookEndpoint);
          return repo.save(
            repo.create({
              tenantId: tenantA,
              targetUrl: 'https://tenant-a.example.com/hook',
              secret: 'tenant-a-secret',
              eventTypes: ['loan_case.created'],
              status: WebhookEndpointStatus.ACTIVE,
            }),
          );
        },
      );
      endpointB = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) => {
          const repo = manager.getRepository(WebhookEndpoint);
          return repo.save(
            repo.create({
              tenantId: tenantB,
              targetUrl: 'https://tenant-b.example.com/hook',
              secret: 'tenant-b-secret',
              eventTypes: ['loan_case.created'],
              status: WebhookEndpointStatus.ACTIVE,
            }),
          );
        },
      );

      // outbox_events has no RLS policy this slice — a plain insert via the
      // admin connection (the restricted role has no grants on it at all).
      const outboxRepo = adminDataSource.getRepository(OutboxEvent);
      outboxEventA = await outboxRepo.save(
        outboxRepo.create({
          tenantId: tenantA,
          caseId: randomUUID(),
          eventType: 'loan_case.created',
          payload: { caseId: 'rls-spec-case' },
          signature: 'rls-spec-signature',
        }),
      );

      deliveryA = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) => {
          const repo = manager.getRepository(WebhookDelivery);
          return repo.save(
            repo.create({
              tenantId: tenantA,
              webhookEndpointId: endpointA.id,
              outboxEventId: outboxEventA.id,
              eventType: 'loan_case.created',
              status: WebhookDeliveryStatus.PENDING,
              attempts: [],
              nextAttemptAt: null,
            }),
          );
        },
      );
    });

    afterAll(async () => {
      if (restrictedDataSource?.isInitialized) {
        await runWithRlsBypass(restrictedDataSource, async (manager) => {
          await manager
            .getRepository(WebhookDelivery)
            .delete({ tenantId: tenantA });
          await manager
            .getRepository(WebhookEndpoint)
            .delete([endpointA.id, endpointB.id]);
        });
        await restrictedDataSource.destroy();
      }
      if (adminDataSource?.isInitialized) {
        if (outboxEventA) {
          await adminDataSource
            .getRepository(OutboxEvent)
            .delete({ id: outboxEventA.id });
        }
        await adminDataSource.query(
          `REVOKE ALL ON "webhook_endpoints", "webhook_deliveries" FROM "${RESTRICTED_ROLE}"`,
        );
        await adminDataSource.query(`DROP OWNED BY "${RESTRICTED_ROLE}"`);
        await adminDataSource.query(`DROP ROLE IF EXISTS "${RESTRICTED_ROLE}"`);
        await adminDataSource.destroy();
      }
    });

    it('a query with no tenant context and no bypass sees zero rows on either table, even though real rows exist', async () => {
      // No runInTenantContext, no runWithRlsBypass — a plain query on a
      // fresh connection, the default state any code (including a future
      // bug) would be in if it forgot to call either helper.
      const endpoints = await restrictedDataSource
        .getRepository(WebhookEndpoint)
        .find();
      const deliveries = await restrictedDataSource
        .getRepository(WebhookDelivery)
        .find();

      expect(endpoints).toHaveLength(0);
      expect(deliveries).toHaveLength(0);
    });

    it("tenant A's context sees only tenant A's rows, never tenant B's", async () => {
      const endpoints = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) => manager.getRepository(WebhookEndpoint).find(),
      );

      expect(endpoints.map((e) => e.id)).toEqual([endpointA.id]);
    });

    it("tenant B's context sees only tenant B's rows, never tenant A's — including tenant A's webhook_deliveries", async () => {
      const endpoints = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) => manager.getRepository(WebhookEndpoint).find(),
      );
      const deliveries = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) => manager.getRepository(WebhookDelivery).find(),
      );

      expect(endpoints.map((e) => e.id)).toEqual([endpointB.id]);
      expect(deliveries).toHaveLength(0);
    });

    it("a direct lookup by id for a different tenant's row returns nothing, even though the row exists", async () => {
      const found = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager
            .getRepository(WebhookEndpoint)
            .findOneBy({ id: endpointA.id }),
      );

      expect(found).toBeNull();
    });

    it("an UPDATE against a different tenant's row affects zero rows rather than erroring or succeeding silently", async () => {
      const result = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager
            .getRepository(WebhookEndpoint)
            .update(
              { id: endpointA.id },
              { targetUrl: 'https://attacker.example.com/hijacked' },
            ),
      );
      expect(result.affected).toBe(0);

      // The real row is untouched — verify with the owning tenant's own context.
      const stillIntact = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) =>
          manager
            .getRepository(WebhookEndpoint)
            .findOneByOrFail({ id: endpointA.id }),
      );
      expect(stillIntact.targetUrl).toBe('https://tenant-a.example.com/hook');
    });

    it('an INSERT whose row tenantId does not match the session tenant context is rejected by PostgreSQL itself', async () => {
      await expect(
        runInTenantContext(restrictedDataSource, tenantB, (manager) => {
          const repo = manager.getRepository(WebhookEndpoint);
          return repo.save(
            repo.create({
              // Row claims tenant A while the session context says tenant B.
              tenantId: tenantA,
              targetUrl: 'https://spoofed.example.com/hook',
              secret: 'spoofed-secret',
              eventTypes: ['loan_case.created'],
              status: WebhookEndpointStatus.ACTIVE,
            }),
          );
        }),
      ).rejects.toThrow();
    });

    it("bypass mode sees every tenant's rows on both tables at once — the one explicit, audited exception", async () => {
      const endpoints = await runWithRlsBypass(
        restrictedDataSource,
        (manager) => manager.getRepository(WebhookEndpoint).find(),
      );
      const deliveries = await runWithRlsBypass(
        restrictedDataSource,
        (manager) => manager.getRepository(WebhookDelivery).find(),
      );

      expect(endpoints.map((e) => e.id).sort()).toEqual(
        [endpointA.id, endpointB.id].sort(),
      );
      expect(deliveries.map((d) => d.id)).toEqual([deliveryA.id]);
    });
  },
);
