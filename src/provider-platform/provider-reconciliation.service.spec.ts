import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { ProviderOperationIntent } from '../database/entities/provider-operation-intent.entity';
import { ProviderOperationIntentService } from './provider-operation-intent.service';
import { ProviderReconciliationService } from './provider-reconciliation.service';
import { ProviderCapability } from './types';

// Requires a reachable Postgres (same convention as the other real-DB
// specs): skip instead of failing when no DATABASE_URL is configured.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

describeOrSkip('ProviderReconciliationService (Section 11.5, M5-027)', () => {
  let dataSource: DataSource;
  let intentService: ProviderOperationIntentService;
  let reconciliationService: ProviderReconciliationService;
  const intentIds: string[] = [];

  function baseInput(tenantId: string) {
    return {
      tenantId,
      caseId: randomUUID(),
      providerId: 'plaid-simulator',
      capability: ProviderCapability.INCOME,
      effectClass: 'REUSABLE_LOOKUP' as const,
      authorizationGrantId: randomUUID(),
      requestPayloadForFingerprint: { borrowerId: 'reconciliation-spec' },
    };
  }

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [ProviderOperationIntent],
    });
    await dataSource.initialize();
    intentService = new ProviderOperationIntentService(dataSource);
    reconciliationService = new ProviderReconciliationService(
      dataSource,
      intentService,
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (intentIds.length > 0) {
        await dataSource
          .getRepository(ProviderOperationIntent)
          .delete(intentIds);
      }
      await dataSource.destroy();
    }
  });

  it('moves an OUTCOME_UNKNOWN intent older than the stale threshold to RECONCILING, across tenants', async () => {
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const staleA = await intentService.prepare(baseInput(tenantA));
    intentIds.push(staleA.id);
    await intentService.markOutcomeUnknown(tenantA, staleA.id);
    const staleB = await intentService.prepare(baseInput(tenantB));
    intentIds.push(staleB.id);
    await intentService.markOutcomeUnknown(tenantB, staleB.id);

    // Both intents' updatedAt is "now" (just written) — reconciling with
    // a threshold in the past (relative to a `now` far enough in the
    // future) simulates real aging without a real wall-clock wait.
    const farFuture = new Date(Date.now() + 10 * 60_000);
    const result = await reconciliationService.reconcilePendingIntents(
      5 * 60_000,
      { now: farFuture },
    );

    expect(result.scanned).toBeGreaterThanOrEqual(2);
    expect(result.movedToReconciling).toBeGreaterThanOrEqual(2);

    const repo = dataSource.getRepository(ProviderOperationIntent);
    expect((await repo.findOneByOrFail({ id: staleA.id })).state).toBe(
      'RECONCILING',
    );
    expect((await repo.findOneByOrFail({ id: staleB.id })).state).toBe(
      'RECONCILING',
    );
  });

  it('leaves an OUTCOME_UNKNOWN intent younger than the stale threshold untouched', async () => {
    const tenantId = randomUUID();
    const fresh = await intentService.prepare(baseInput(tenantId));
    intentIds.push(fresh.id);
    await intentService.markOutcomeUnknown(tenantId, fresh.id);

    // "now" is only 1 second after the intent was marked — nowhere near
    // the 5-minute stale threshold.
    await reconciliationService.reconcilePendingIntents(5 * 60_000, {
      now: new Date(Date.now() + 1000),
    });

    const repo = dataSource.getRepository(ProviderOperationIntent);
    expect((await repo.findOneByOrFail({ id: fresh.id })).state).toBe(
      'OUTCOME_UNKNOWN',
    );
  });

  it('leaves a DISPATCHED (never-ambiguous) intent untouched regardless of age', async () => {
    const tenantId = randomUUID();
    const dispatched = await intentService.prepare(baseInput(tenantId));
    intentIds.push(dispatched.id);
    await intentService.markDispatched(tenantId, dispatched.id);

    const farFuture = new Date(Date.now() + 10 * 60_000);
    await reconciliationService.reconcilePendingIntents(5 * 60_000, {
      now: farFuture,
    });

    const repo = dataSource.getRepository(ProviderOperationIntent);
    expect((await repo.findOneByOrFail({ id: dispatched.id })).state).toBe(
      'DISPATCHED',
    );
  });
});
