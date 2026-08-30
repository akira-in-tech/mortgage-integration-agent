import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { ProviderOperationIntent } from '../database/entities/provider-operation-intent.entity';
import { ProviderOperationIntentService } from './provider-operation-intent.service';
import { ProviderCapability } from './types';

// Requires a reachable Postgres (same convention as the other real-DB
// specs): skip instead of failing when no DATABASE_URL is configured.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

describeOrSkip('ProviderOperationIntentService', () => {
  let dataSource: DataSource;
  let service: ProviderOperationIntentService;
  const intentIds: string[] = [];

  const baseInput = {
    tenantId: '11111111-1111-1111-1111-111111111111',
    caseId: '22222222-2222-2222-2222-222222222222',
    providerId: 'plaid-simulator',
    capability: ProviderCapability.INCOME,
    effectClass: 'REUSABLE_LOOKUP' as const,
    authorizationGrantId: '44444444-4444-4444-4444-444444444444',
    logicalOperationKey: 'provider-operation-intent-service-spec',
    requestPayloadForFingerprint: { borrowerId: 'borrower-intent-spec' },
  };

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [ProviderOperationIntent],
    });
    await dataSource.initialize();
    service = new ProviderOperationIntentService(dataSource);
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

  it('prepare() persists a PREPARED intent with a sha256 fingerprint and a stable idempotency key', async () => {
    const intent = await service.prepare({
      ...baseInput,
      logicalOperationKey: randomUUID(),
    });
    intentIds.push(intent.id);

    expect(intent).toMatchObject({
      tenantId: baseInput.tenantId,
      caseId: baseInput.caseId,
      providerId: baseInput.providerId,
      capability: ProviderCapability.INCOME,
      effectClass: 'REUSABLE_LOOKUP',
      authorizationGrantId: baseInput.authorizationGrantId,
      state: 'PREPARED',
    });
    expect(intent.requestFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(intent.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('prepare() reuses one intent/idempotency key for the same logical payload and rejects changed payload reuse', async () => {
    const logicalOperationKey = randomUUID();
    const first = await service.prepare({ ...baseInput, logicalOperationKey });
    intentIds.push(first.id);
    const second = await service.prepare({
      ...baseInput,
      logicalOperationKey,
      requestPayloadForFingerprint: {
        borrowerId: 'borrower-intent-spec',
      },
    });

    expect(second.requestFingerprint).toBe(first.requestFingerprint);
    expect(second.id).toBe(first.id);
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    await expect(
      service.prepare({
        ...baseInput,
        logicalOperationKey,
        requestPayloadForFingerprint: { borrowerId: 'a-different-borrower' },
      }),
    ).rejects.toThrow(/reused with a changed/);
  });

  it('markDispatched/markSucceeded/markFailedFinal/markOutcomeUnknown each persist the expected state transition', async () => {
    const repo = dataSource.getRepository(ProviderOperationIntent);
    const stateOf = async (id: string) =>
      (await repo.findOneByOrFail({ id })).state;

    const dispatched = await service.prepare({
      ...baseInput,
      logicalOperationKey: randomUUID(),
    });
    intentIds.push(dispatched.id);
    await service.markDispatched(baseInput.tenantId, dispatched.id);
    expect(await stateOf(dispatched.id)).toBe('DISPATCHED');

    const succeeded = await service.prepare({
      ...baseInput,
      logicalOperationKey: randomUUID(),
    });
    intentIds.push(succeeded.id);
    await service.markDispatched(baseInput.tenantId, succeeded.id);
    await service.markSucceeded(
      baseInput.tenantId,
      succeeded.id,
      { status: 'COMPLETE' },
      { monthlyIncome: 1000 },
    );
    expect(await stateOf(succeeded.id)).toBe('SUCCEEDED');

    const failedFinal = await service.prepare({
      ...baseInput,
      logicalOperationKey: randomUUID(),
    });
    intentIds.push(failedFinal.id);
    await service.markFailedFinal(baseInput.tenantId, failedFinal.id);
    expect(await stateOf(failedFinal.id)).toBe('FAILED_FINAL');

    const outcomeUnknown = await service.prepare({
      ...baseInput,
      logicalOperationKey: randomUUID(),
    });
    intentIds.push(outcomeUnknown.id);
    await service.markDispatched(baseInput.tenantId, outcomeUnknown.id);
    await service.markOutcomeUnknown(baseInput.tenantId, outcomeUnknown.id);
    expect(await stateOf(outcomeUnknown.id)).toBe('OUTCOME_UNKNOWN');
  });

  it('markReconciling() persists the RECONCILING state', async () => {
    const repo = dataSource.getRepository(ProviderOperationIntent);
    const intent = await service.prepare({
      ...baseInput,
      logicalOperationKey: randomUUID(),
    });
    intentIds.push(intent.id);
    await service.markDispatched(baseInput.tenantId, intent.id);
    await service.markOutcomeUnknown(baseInput.tenantId, intent.id);

    await service.markReconciling(baseInput.tenantId, intent.id);

    expect((await repo.findOneByOrFail({ id: intent.id })).state).toBe(
      'RECONCILING',
    );
  });

  it('rejects a late state transition that would regress a terminal result', async () => {
    const intent = await service.prepare({
      ...baseInput,
      logicalOperationKey: randomUUID(),
    });
    intentIds.push(intent.id);
    await service.markDispatched(baseInput.tenantId, intent.id);
    await service.markSucceeded(baseInput.tenantId, intent.id, {}, {});

    await expect(
      service.markOutcomeUnknown(baseInput.tenantId, intent.id),
    ).rejects.toThrow(/cannot transition from SUCCEEDED/);
  });

  it('resolveManually() records a real human resolution from OUTCOME_UNKNOWN, and rejects resolving an intent that already has a real terminal outcome', async () => {
    const repo = dataSource.getRepository(ProviderOperationIntent);
    const intent = await service.prepare({
      ...baseInput,
      logicalOperationKey: randomUUID(),
    });
    intentIds.push(intent.id);
    await service.markDispatched(baseInput.tenantId, intent.id);
    await service.markOutcomeUnknown(baseInput.tenantId, intent.id);

    await service.resolveManually(
      baseInput.tenantId,
      intent.id,
      'SUCCEEDED' as never,
      'spec-operator',
      'Confirmed via provider dashboard: the real operation succeeded.',
    );

    const resolved = await repo.findOneByOrFail({ id: intent.id });
    expect(resolved.state).toBe('SUCCEEDED');
    expect(resolved.resolvedBy).toBe('spec-operator');
    expect(resolved.resolutionNote).toBe(
      'Confirmed via provider dashboard: the real operation succeeded.',
    );

    await expect(
      service.resolveManually(
        baseInput.tenantId,
        intent.id,
        'FAILED_FINAL' as never,
        'spec-operator-2',
        'trying to resolve an already-resolved intent',
      ),
    ).rejects.toThrow(/not in a reconcilable state/);
  });

  it('listNeedingReconciliation() finds OUTCOME_UNKNOWN and RECONCILING intents but not ones with a real answer, oldest first', async () => {
    // A tenant of its own, so nothing another test in this file already
    // created can sneak into the results and make the assertions flaky.
    const tenantId = randomUUID();
    const input = { ...baseInput, tenantId };

    const unclear = await service.prepare({
      ...input,
      logicalOperationKey: randomUUID(),
    });
    intentIds.push(unclear.id);
    await service.markDispatched(tenantId, unclear.id);
    await service.markOutcomeUnknown(tenantId, unclear.id);

    const beingChecked = await service.prepare({
      ...input,
      logicalOperationKey: randomUUID(),
    });
    intentIds.push(beingChecked.id);
    await service.markDispatched(tenantId, beingChecked.id);
    await service.markOutcomeUnknown(tenantId, beingChecked.id);
    await service.markReconciling(tenantId, beingChecked.id);

    const alreadyAnswered = await service.prepare({
      ...input,
      logicalOperationKey: randomUUID(),
    });
    intentIds.push(alreadyAnswered.id);
    await service.markDispatched(tenantId, alreadyAnswered.id);
    await service.markSucceeded(tenantId, alreadyAnswered.id, {}, {});

    const results = await service.listNeedingReconciliation(tenantId);

    expect(results.map((r) => r.id)).toEqual([unclear.id, beingChecked.id]);
    expect(results.map((r) => r.id)).not.toContain(alreadyAnswered.id);
  });
});
