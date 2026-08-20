import 'reflect-metadata';
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

  it('prepare() persists a PREPARED intent with a sha256 fingerprint and a fresh idempotency key', async () => {
    const intent = await service.prepare(baseInput);
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

  it('prepare() produces the same fingerprint for the same request payload and a different one for a different payload', async () => {
    const first = await service.prepare(baseInput);
    intentIds.push(first.id);
    const second = await service.prepare(baseInput);
    intentIds.push(second.id);
    const third = await service.prepare({
      ...baseInput,
      requestPayloadForFingerprint: { borrowerId: 'a-different-borrower' },
    });
    intentIds.push(third.id);

    expect(second.requestFingerprint).toBe(first.requestFingerprint);
    expect(third.requestFingerprint).not.toBe(first.requestFingerprint);
    // Each prepare() is still a distinct attempt row with its own identity.
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it('markDispatched/markSucceeded/markFailedFinal/markOutcomeUnknown each persist the expected state transition', async () => {
    const repo = dataSource.getRepository(ProviderOperationIntent);
    const stateOf = async (id: string) =>
      (await repo.findOneByOrFail({ id })).state;

    const dispatched = await service.prepare(baseInput);
    intentIds.push(dispatched.id);
    await service.markDispatched(baseInput.tenantId, dispatched.id);
    expect(await stateOf(dispatched.id)).toBe('DISPATCHED');

    const succeeded = await service.prepare(baseInput);
    intentIds.push(succeeded.id);
    await service.markSucceeded(baseInput.tenantId, succeeded.id);
    expect(await stateOf(succeeded.id)).toBe('SUCCEEDED');

    const failedFinal = await service.prepare(baseInput);
    intentIds.push(failedFinal.id);
    await service.markFailedFinal(baseInput.tenantId, failedFinal.id);
    expect(await stateOf(failedFinal.id)).toBe('FAILED_FINAL');

    const outcomeUnknown = await service.prepare(baseInput);
    intentIds.push(outcomeUnknown.id);
    await service.markOutcomeUnknown(baseInput.tenantId, outcomeUnknown.id);
    expect(await stateOf(outcomeUnknown.id)).toBe('OUTCOME_UNKNOWN');
  });

  it('markReconciling() persists the RECONCILING state', async () => {
    const repo = dataSource.getRepository(ProviderOperationIntent);
    const intent = await service.prepare(baseInput);
    intentIds.push(intent.id);
    await service.markOutcomeUnknown(baseInput.tenantId, intent.id);

    await service.markReconciling(baseInput.tenantId, intent.id);

    expect((await repo.findOneByOrFail({ id: intent.id })).state).toBe(
      'RECONCILING',
    );
  });

  it('resolveManually() records a real human resolution from OUTCOME_UNKNOWN, and rejects resolving an intent that already has a real terminal outcome', async () => {
    const repo = dataSource.getRepository(ProviderOperationIntent);
    const intent = await service.prepare(baseInput);
    intentIds.push(intent.id);
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
});
