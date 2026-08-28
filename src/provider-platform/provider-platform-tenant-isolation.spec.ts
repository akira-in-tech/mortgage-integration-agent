import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { ProviderAuthorizationGrant } from '../database/entities/provider-authorization-grant.entity';
import { ProviderOperationIntent } from '../database/entities/provider-operation-intent.entity';
import {
  ProviderCapabilityStatus,
  ProviderOperationIntentStatus,
} from '../database/enums/provider-platform.enum';
import {
  runInTenantContext,
  runWithRlsBypass,
} from '../database/tenant-context';

// Requires a reachable Postgres with the ProviderPlatformTenantIsolation
// and AppRuntimeRole migrations applied: skip instead of failing when no
// DATABASE_URL is configured — same convention as every other real-DB spec
// in this codebase.
//
// M5-014's proof, same pattern as consent-tenant-isolation.spec.ts
// (M5-005) and case-policy-tenant-isolation.spec.ts (M5-010): connects as
// the real `mortgage_app` role (M5-003), not DATABASE_URL's own, since a
// superuser connection would pass every one of these assertions trivially
// by bypassing RLS entirely. Both tables have their own `tenantId` column
// directly, no join needed.
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

describeOrSkip(
  'provider_authorization_grants/provider_operation_intents row-level security',
  () => {
    let restrictedDataSource: DataSource;
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    let grantA: ProviderAuthorizationGrant;
    let grantB: ProviderAuthorizationGrant;
    let intentA: ProviderOperationIntent;
    let intentB: ProviderOperationIntent;

    beforeAll(async () => {
      restrictedDataSource = new DataSource({
        type: 'postgres',
        url: withCredentials(
          DATABASE_URL as string,
          APP_ROLE,
          APP_ROLE_PASSWORD,
        ),
        entities: [ProviderAuthorizationGrant, ProviderOperationIntent],
      });
      await restrictedDataSource.initialize();

      function makeGrant(tenantId: string) {
        const repo = restrictedDataSource.getRepository(
          ProviderAuthorizationGrant,
        );
        return repo.create({
          tenantId,
          caseId: randomUUID(),
          borrowerSubjectId: 'tenant-isolation-spec-borrower',
          providerId: 'plaid-simulator',
          capability: ProviderCapabilityStatus.INCOME,
          purposeCode: 'UNDERWRITING_EVIDENCE',
          permittedDataClasses: ['INCOME'],
          permittedFields: null,
          consentRecordIds: [],
          permissiblePurposeDecisionId: null,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          revokedAt: null,
        });
      }

      grantA = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) =>
          manager
            .getRepository(ProviderAuthorizationGrant)
            .save(makeGrant(tenantA)),
      );
      grantB = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager
            .getRepository(ProviderAuthorizationGrant)
            .save(makeGrant(tenantB)),
      );

      function makeIntent(tenantId: string, authorizationGrantId: string) {
        const repo = restrictedDataSource.getRepository(
          ProviderOperationIntent,
        );
        return repo.create({
          tenantId,
          caseId: randomUUID(),
          providerId: 'plaid-simulator',
          capability: ProviderCapabilityStatus.INCOME,
          effectClass: 'REUSABLE_LOOKUP',
          requestFingerprint: 'a'.repeat(64),
          idempotencyKey: randomUUID(),
          authorizationGrantId,
        });
      }

      intentA = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) =>
          manager
            .getRepository(ProviderOperationIntent)
            .save(makeIntent(tenantA, grantA.id)),
      );
      intentB = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager
            .getRepository(ProviderOperationIntent)
            .save(makeIntent(tenantB, grantB.id)),
      );
    });

    afterAll(async () => {
      if (restrictedDataSource?.isInitialized) {
        await runWithRlsBypass(restrictedDataSource, async (manager) => {
          await manager
            .getRepository(ProviderOperationIntent)
            .delete([intentA.id, intentB.id]);
          await manager
            .getRepository(ProviderAuthorizationGrant)
            .delete([grantA.id, grantB.id]);
        });
        await restrictedDataSource.destroy();
      }
    });

    it('a query with no tenant context and no bypass sees zero rows on either table, even though real rows exist', async () => {
      const grants = await restrictedDataSource
        .getRepository(ProviderAuthorizationGrant)
        .find();
      const intents = await restrictedDataSource
        .getRepository(ProviderOperationIntent)
        .find();
      expect(grants).toHaveLength(0);
      expect(intents).toHaveLength(0);
    });

    it("tenant A's context sees only tenant A's grant and intent", async () => {
      const grants = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) => manager.getRepository(ProviderAuthorizationGrant).find(),
      );
      const intents = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) => manager.getRepository(ProviderOperationIntent).find(),
      );
      expect(grants.map((g) => g.id)).toEqual([grantA.id]);
      expect(intents.map((i) => i.id)).toEqual([intentA.id]);
    });

    it("tenant B's context sees only tenant B's grant and intent, never tenant A's", async () => {
      const grants = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) => manager.getRepository(ProviderAuthorizationGrant).find(),
      );
      const intents = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) => manager.getRepository(ProviderOperationIntent).find(),
      );
      expect(grants.map((g) => g.id)).toEqual([grantB.id]);
      expect(intents.map((i) => i.id)).toEqual([intentB.id]);
    });

    it("a direct lookup by id for a different tenant's grant returns nothing, even though the row exists", async () => {
      const found = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager.getRepository(ProviderAuthorizationGrant).findOneBy({
            id: grantA.id,
          }),
      );
      expect(found).toBeNull();
    });

    it("an UPDATE against a different tenant's grant (revoke's own real query shape) affects zero rows rather than erroring or succeeding silently", async () => {
      const result = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager
            .getRepository(ProviderAuthorizationGrant)
            .update({ id: grantA.id }, { revokedAt: new Date() }),
      );
      expect(result.affected).toBe(0);

      const stillIntact = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) =>
          manager
            .getRepository(ProviderAuthorizationGrant)
            .findOneByOrFail({ id: grantA.id }),
      );
      expect(stillIntact.revokedAt).toBeNull();
    });

    it("an UPDATE against a different tenant's intent (mark*()'s own real query shape) affects zero rows rather than erroring or succeeding silently", async () => {
      const result = await runInTenantContext(
        restrictedDataSource,
        tenantB,
        (manager) =>
          manager
            .getRepository(ProviderOperationIntent)
            .update(
              { id: intentA.id },
              { state: ProviderOperationIntentStatus.FAILED_FINAL },
            ),
      );
      expect(result.affected).toBe(0);

      const stillIntact = await runInTenantContext(
        restrictedDataSource,
        tenantA,
        (manager) =>
          manager
            .getRepository(ProviderOperationIntent)
            .findOneByOrFail({ id: intentA.id }),
      );
      expect(stillIntact.state).toBe('PREPARED');
    });

    it('an INSERT whose row tenantId does not match the session tenant context is rejected by PostgreSQL itself', async () => {
      await expect(
        runInTenantContext(restrictedDataSource, tenantB, (manager) => {
          const repo = manager.getRepository(ProviderAuthorizationGrant);
          return repo.save(
            repo.create({
              // Row claims tenant A while the session context says tenant B.
              tenantId: tenantA,
              caseId: randomUUID(),
              borrowerSubjectId: 'tenant-isolation-spec-borrower',
              providerId: 'plaid-simulator',
              capability: ProviderCapabilityStatus.INCOME,
              purposeCode: 'UNDERWRITING_EVIDENCE',
              permittedDataClasses: ['INCOME'],
              permittedFields: null,
              consentRecordIds: [],
              permissiblePurposeDecisionId: null,
              expiresAt: new Date(Date.now() + 5 * 60 * 1000),
              revokedAt: null,
            }),
          );
        }),
      ).rejects.toThrow();
    });

    it("bypass mode sees every tenant's grants and intents at once — the one explicit, audited exception", async () => {
      const grants = await runWithRlsBypass(restrictedDataSource, (manager) =>
        manager.getRepository(ProviderAuthorizationGrant).find(),
      );
      const intents = await runWithRlsBypass(restrictedDataSource, (manager) =>
        manager.getRepository(ProviderOperationIntent).find(),
      );
      expect(grants.map((g) => g.id)).toEqual(
        expect.arrayContaining([grantA.id, grantB.id]),
      );
      expect(intents.map((i) => i.id)).toEqual(
        expect.arrayContaining([intentA.id, intentB.id]),
      );
    });
  },
);
