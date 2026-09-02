import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { WebhookEndpoint } from '../database/entities/webhook-endpoint.entity';
import { WebhookEndpointStatus } from '../database/enums/webhook.enum';
import { WebhookEndpointService } from './webhook-endpoint.service';
import { runInTenantContext } from '../database/tenant-context';

const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

describeOrSkip('WebhookEndpointService', () => {
  let dataSource: DataSource;
  let service: WebhookEndpointService;
  const endpointIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [WebhookEndpoint],
    });
    await dataSource.initialize();
    const configService = { get: () => 'test' };
    service = new WebhookEndpointService(dataSource, configService as never);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (endpointIds.length > 0) {
        await dataSource.getRepository(WebhookEndpoint).delete(endpointIds);
      }
      await dataSource.destroy();
    }
  });

  const tenantId = '33333333-3333-3333-3333-333333333333';

  it('create() persists an ACTIVE endpoint with a real, unique secret', async () => {
    const endpoint = await service.create(tenantId, {
      targetUrl: 'https://example.com/hook-1',
      eventTypes: ['loan_case.created'],
    });
    endpointIds.push(endpoint.id);

    expect(endpoint).toMatchObject({
      tenantId,
      targetUrl: 'https://example.com/hook-1',
      eventTypes: ['loan_case.created'],
      status: WebhookEndpointStatus.ACTIVE,
    });
    expect(endpoint.secret).toMatch(/^[0-9a-f]{64}$/);

    const second = await service.create(tenantId, {
      targetUrl: 'https://example.com/hook-2',
      eventTypes: ['loan_case.created'],
    });
    endpointIds.push(second.id);
    expect(second.secret).not.toBe(endpoint.secret);
  });

  it('findActiveForTenantAndEventType() returns only ACTIVE endpoints subscribed to that event type', async () => {
    const subscribed = await service.create(tenantId, {
      targetUrl: 'https://example.com/subscribed',
      eventTypes: ['condition.opened', 'condition.satisfied'],
    });
    endpointIds.push(subscribed.id);

    const unsubscribed = await service.create(tenantId, {
      targetUrl: 'https://example.com/unsubscribed',
      eventTypes: ['evidence.updated'],
    });
    endpointIds.push(unsubscribed.id);

    const disabled = await service.create(tenantId, {
      targetUrl: 'https://example.com/disabled',
      eventTypes: ['condition.opened'],
    });
    endpointIds.push(disabled.id);
    await runInTenantContext(dataSource, tenantId, (manager) =>
      manager
        .getRepository(WebhookEndpoint)
        .update(
          { id: disabled.id },
          { status: WebhookEndpointStatus.DISABLED },
        ),
    );

    const results = await service.findActiveForTenantAndEventType(
      tenantId,
      'condition.opened',
    );

    expect(results.map((e) => e.id)).toEqual([subscribed.id]);
  });

  it('create() rejects a targetUrl that resolves to a private address, and persists nothing', async () => {
    await expect(
      service.create(tenantId, {
        targetUrl: 'http://169.254.169.254/hook',
        eventTypes: ['loan_case.created'],
      }),
    ).rejects.toThrow('private or reserved address');

    const persisted = await runInTenantContext(
      dataSource,
      tenantId,
      (manager) =>
        manager.getRepository(WebhookEndpoint).find({
          where: { tenantId, targetUrl: 'http://169.254.169.254/hook' },
        }),
    );
    expect(persisted).toHaveLength(0);
  });

  it('create() still rejects a loopback targetUrl under NODE_ENV=production — the sandbox exception never applies there (M5-013)', async () => {
    const prodConfigService = { get: () => 'production' };
    const prodService = new WebhookEndpointService(
      dataSource,
      prodConfigService as never,
    );

    await expect(
      prodService.create(tenantId, {
        targetUrl: 'http://127.0.0.1:4000/inbound',
        eventTypes: ['loan_case.created'],
      }),
    ).rejects.toThrow('private or reserved address');

    const persisted = await runInTenantContext(
      dataSource,
      tenantId,
      (manager) =>
        manager.getRepository(WebhookEndpoint).find({
          where: { tenantId, targetUrl: 'http://127.0.0.1:4000/inbound' },
        }),
    );
    expect(persisted).toHaveLength(0);
  });

  it("create() allows a loopback targetUrl under NODE_ENV=development — the sandbox exception this codebase's webhook inspector relies on (M5-013)", async () => {
    const devConfigService = { get: () => 'development' };
    const devService = new WebhookEndpointService(
      dataSource,
      devConfigService as never,
    );

    const endpoint = await devService.create(tenantId, {
      targetUrl: 'http://127.0.0.1:4000/inbound',
      eventTypes: ['loan_case.created'],
    });
    endpointIds.push(endpoint.id);
    expect(endpoint.targetUrl).toBe('http://127.0.0.1:4000/inbound');
  });

  it('findByIdOrFail() throws NotFoundException for an unknown id', async () => {
    await expect(
      service.findByIdOrFail(tenantId, '99999999-9999-9999-9999-999999999999'),
    ).rejects.toThrow('not found');
  });

  it('lists, safely updates, and disables only the requested tenant endpoint', async () => {
    const endpoint = await service.create(tenantId, {
      targetUrl: 'https://example.com/lifecycle-original',
      eventTypes: ['loan_case.created'],
    });
    endpointIds.push(endpoint.id);

    const listed = await service.list(tenantId);
    expect(listed.map((item) => item.id)).toContain(endpoint.id);

    const updated = await service.update(tenantId, endpoint.id, {
      targetUrl: 'https://example.com/lifecycle-updated',
      eventTypes: ['condition.opened'],
    });
    expect(updated).toMatchObject({
      id: endpoint.id,
      targetUrl: 'https://example.com/lifecycle-updated',
      eventTypes: ['condition.opened'],
      secret: endpoint.secret,
      status: WebhookEndpointStatus.ACTIVE,
    });

    const disabled = await service.disable(tenantId, endpoint.id);
    expect(disabled.status).toBe(WebhookEndpointStatus.DISABLED);
    await expect(
      service.update(tenantId, '99999999-9999-9999-9999-999999999999', {
        eventTypes: ['condition.opened'],
      }),
    ).rejects.toThrow('not found');
  });

  it('rejects an unsafe target when editing an existing endpoint', async () => {
    const endpoint = await service.create(tenantId, {
      targetUrl: 'https://example.com/update-guard',
      eventTypes: ['loan_case.created'],
    });
    endpointIds.push(endpoint.id);

    await expect(
      service.update(tenantId, endpoint.id, {
        targetUrl: 'http://169.254.169.254/metadata',
      }),
    ).rejects.toThrow('private or reserved address');

    expect(
      (await service.findByIdOrFail(tenantId, endpoint.id)).targetUrl,
    ).toBe('https://example.com/update-guard');
  });

  it('atomically reserves only the configured number of attempts in a UTC-minute window', async () => {
    const endpoint = await service.create(tenantId, {
      targetUrl: 'https://example.com/rate-limited',
      eventTypes: ['loan_case.created'],
    });
    endpointIds.push(endpoint.id);
    await service.update(tenantId, endpoint.id, {
      outboundRateLimitPerMinute: 1,
    });

    const firstMinute = new Date('2026-08-31T12:34:12.000Z');
    const first = await service.reserveOutboundAttempt(
      tenantId,
      endpoint.id,
      firstMinute,
    );
    const blocked = await service.reserveOutboundAttempt(
      tenantId,
      endpoint.id,
      new Date('2026-08-31T12:34:59.000Z'),
    );
    const nextWindow = await service.reserveOutboundAttempt(
      tenantId,
      endpoint.id,
      new Date('2026-08-31T12:35:00.000Z'),
    );

    // The database update is the shared coordinator across worker replicas;
    // this proof verifies both a blocked second reservation and the next
    // window's reset without relying on process-local counters.
    expect(first).toEqual({
      reserved: true,
      nextWindowAt: new Date('2026-08-31T12:35:00.000Z'),
    });
    expect(blocked).toEqual({
      reserved: false,
      nextWindowAt: new Date('2026-08-31T12:35:00.000Z'),
    });
    expect(nextWindow).toEqual({
      reserved: true,
      nextWindowAt: new Date('2026-08-31T12:36:00.000Z'),
    });
  });
});
