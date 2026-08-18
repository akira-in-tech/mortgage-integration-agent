import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { createServer, Server, IncomingMessage } from 'node:http';
import { AddressInfo } from 'node:net';
import { DataSource } from 'typeorm';
import { OutboxEvent } from '../database/entities/outbox-event.entity';
import { WebhookEndpoint } from '../database/entities/webhook-endpoint.entity';
import { WebhookDelivery } from '../database/entities/webhook-delivery.entity';
import { writeOutboxEvent } from '../database/outbox/outbox-writer';
import { WebhookEndpointService } from './webhook-endpoint.service';
import { WebhookDispatchService } from './webhook-dispatch.service';
import { verifyWebhookSignature } from './webhook-signer';

// Requires a reachable Postgres (same convention as this codebase's other
// real-DB specs): skip instead of failing when no DATABASE_URL is
// configured.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

const OUTBOX_SIGNING_SECRET = 'webhook-dispatch-spec-secret-32-chars';

interface RecordedRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
}

/**
 * A real local HTTP server, not a mocked `fetch` — the same "prefer real
 * infra" discipline this codebase applies elsewhere (real Postgres, real
 * Temporal). `responseQueue` lets a test script a sequence of HTTP status
 * codes across successive delivery attempts (defaulting to 200 once the
 * queue is empty).
 */
interface TestReceiver {
  url: string;
  requests: RecordedRequest[];
  responseQueue: number[];
  close: () => Promise<void>;
}

async function startTestReceiver(): Promise<TestReceiver> {
  const requests: RecordedRequest[] = [];
  const responseQueue: number[] = [];

  const server: Server = createServer((req: IncomingMessage, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      requests.push({
        headers: req.headers,
        rawBody: Buffer.concat(chunks).toString('utf8'),
      });
      const status = responseQueue.shift() ?? 200;
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ received: true }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    responseQueue,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

describeOrSkip('WebhookDispatchService', () => {
  let dataSource: DataSource;
  let endpointService: WebhookEndpointService;
  let dispatchService: WebhookDispatchService;
  // This dispatcher sweeps every unpublished outbox event and every due
  // delivery in the whole table (by design — see its own class comment),
  // so a persistent scratch database left with cross-test/cross-run
  // leftover rows can make an unrelated later run pick up stale
  // in-progress retries. Every test uses a fresh randomUUID() tenantId
  // and tracks it here so afterAll can remove exactly what this file
  // created, leaving the database as clean as it found it.
  const testTenantIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [OutboxEvent, WebhookEndpoint, WebhookDelivery],
    });
    await dataSource.initialize();
    endpointService = new WebhookEndpointService(
      dataSource.getRepository(WebhookEndpoint),
    );
    dispatchService = new WebhookDispatchService(
      dataSource.getRepository(OutboxEvent),
      dataSource.getRepository(WebhookDelivery),
      endpointService,
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (testTenantIds.length > 0) {
        await dataSource
          .getRepository(WebhookDelivery)
          .createQueryBuilder()
          .delete()
          .where('"tenantId" IN (:...ids)', { ids: testTenantIds })
          .execute();
        await dataSource
          .getRepository(WebhookEndpoint)
          .createQueryBuilder()
          .delete()
          .where('"tenantId" IN (:...ids)', { ids: testTenantIds })
          .execute();
        await dataSource
          .getRepository(OutboxEvent)
          .createQueryBuilder()
          .delete()
          .where('"tenantId" IN (:...ids)', { ids: testTenantIds })
          .execute();
      }
      await dataSource.destroy();
    }
  });

  function newTenantId(): string {
    const id = randomUUID();
    testTenantIds.push(id);
    return id;
  }

  async function makeOutboxEvent(
    tenantId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<OutboxEvent> {
    return dataSource.transaction((manager) =>
      writeOutboxEvent(manager, OUTBOX_SIGNING_SECRET, {
        tenantId,
        caseId: randomUUID(),
        eventType,
        payload,
      }).then(() =>
        manager
          .getRepository(OutboxEvent)
          .findOneByOrFail({ tenantId, eventType }),
      ),
    );
  }

  it('delivers a real signed HTTP POST to a subscribed endpoint, marks the outbox event published, and skips an unsubscribed endpoint', async () => {
    const tenantId = newTenantId();
    const receiver = await startTestReceiver();
    try {
      const subscribed = await endpointService.create({
        tenantId,
        targetUrl: receiver.url,
        eventTypes: ['loan_case.created'],
      });
      await endpointService.create({
        tenantId,
        targetUrl: receiver.url,
        eventTypes: ['evidence.updated'],
      });

      const event = await makeOutboxEvent(tenantId, 'loan_case.created', {
        caseId: 'case-1',
        borrowerId: 'borrower-1',
      });

      // dispatchPendingEvents() sweeps every unpublished event in the
      // table, not only this test's own — assert on this test's own
      // created rows, not a global count, so a leftover unpublished event
      // from unrelated manual verification against the same scratch
      // database can't make this assertion flaky.
      await dispatchService.dispatchPendingEvents();

      expect(receiver.requests).toHaveLength(1);

      const [request] = receiver.requests;
      const deliveryId = request.headers['x-webhook-id'] as string;
      const timestamp = request.headers['x-webhook-timestamp'] as string;
      const signature = request.headers['x-webhook-signature'] as string;
      expect(deliveryId).toBeTruthy();
      expect(
        verifyWebhookSignature(
          deliveryId,
          timestamp,
          request.rawBody,
          signature,
          subscribed.secret,
        ).valid,
      ).toBe(true);

      const body = JSON.parse(request.rawBody);
      expect(body).toMatchObject({
        id: deliveryId,
        type: 'loan_case.created',
        data: { caseId: 'case-1', borrowerId: 'borrower-1' },
      });

      const delivery = await dataSource
        .getRepository(WebhookDelivery)
        .findOneByOrFail({ webhookEndpointId: subscribed.id });
      expect(delivery.status).toBe('SUCCEEDED');
      expect(delivery.attempts).toHaveLength(1);
      expect(delivery.attempts[0]).toMatchObject({
        attemptNumber: 1,
        httpStatusCode: 200,
        outcome: 'SUCCEEDED',
      });

      const refreshedEvent = await dataSource
        .getRepository(OutboxEvent)
        .findOneByOrFail({ id: event.id });
      expect(refreshedEvent.publishedAt).not.toBeNull();
    } finally {
      await receiver.close();
    }
  });

  it('retries a failing delivery with exponential backoff and eventually succeeds', async () => {
    const tenantId = newTenantId();
    const receiver = await startTestReceiver();
    try {
      const endpoint = await endpointService.create({
        tenantId,
        targetUrl: receiver.url,
        eventTypes: ['condition.opened'],
      });
      await makeOutboxEvent(tenantId, 'condition.opened', {
        conditionId: 'c-1',
      });

      receiver.responseQueue.push(500, 500);

      let now = new Date();
      await dispatchService.dispatchPendingEvents({ now });
      let delivery = await dataSource
        .getRepository(WebhookDelivery)
        .findOneByOrFail({ webhookEndpointId: endpoint.id });
      expect(delivery.status).toBe('PENDING');
      expect(delivery.attempts).toHaveLength(1);
      expect(delivery.attempts[0].outcome).toBe('FAILED');
      expect(delivery.nextAttemptAt).not.toBeNull();

      // Not yet due — a dispatch right now must not attempt it again.
      await dispatchService.dispatchPendingEvents({ now });
      delivery = await dataSource
        .getRepository(WebhookDelivery)
        .findOneByOrFail({ id: delivery.id });
      expect(delivery.attempts).toHaveLength(1);

      // Fast-forward past the backoff window (real time is never actually
      // waited — the injectable clock simulates it) for the 2nd attempt.
      now = new Date(now.getTime() + 5 * 60 * 1000);
      await dispatchService.dispatchPendingEvents({ now });
      delivery = await dataSource
        .getRepository(WebhookDelivery)
        .findOneByOrFail({ id: delivery.id });
      expect(delivery.status).toBe('PENDING');
      expect(delivery.attempts).toHaveLength(2);

      // 3rd attempt succeeds (queue is now empty -> 200).
      now = new Date(now.getTime() + 5 * 60 * 1000);
      await dispatchService.dispatchPendingEvents({ now });
      delivery = await dataSource
        .getRepository(WebhookDelivery)
        .findOneByOrFail({ id: delivery.id });
      expect(delivery.status).toBe('SUCCEEDED');
      expect(delivery.nextAttemptAt).toBeNull();
      expect(delivery.attempts.map((a) => a.outcome)).toEqual([
        'FAILED',
        'FAILED',
        'SUCCEEDED',
      ]);
      expect(receiver.requests).toHaveLength(3);
    } finally {
      await receiver.close();
    }
  });

  it('reaches FAILED_FINAL after exhausting the max attempt budget, and stops retrying', async () => {
    const tenantId = newTenantId();
    const receiver = await startTestReceiver();
    try {
      const endpoint = await endpointService.create({
        tenantId,
        targetUrl: receiver.url,
        eventTypes: ['evaluation.interrupted'],
      });
      await makeOutboxEvent(tenantId, 'evaluation.interrupted', {
        caseId: 'case-2',
      });
      receiver.responseQueue.push(500, 500, 500, 500, 500);

      let now = new Date();
      for (let i = 0; i < 5; i++) {
        await dispatchService.dispatchPendingEvents({ now });
        now = new Date(now.getTime() + 5 * 60 * 1000);
      }

      const delivery = await dataSource
        .getRepository(WebhookDelivery)
        .findOneByOrFail({ webhookEndpointId: endpoint.id });
      expect(delivery.status).toBe('FAILED_FINAL');
      expect(delivery.attempts).toHaveLength(5);
      expect(delivery.nextAttemptAt).toBeNull();
      expect(receiver.requests).toHaveLength(5);

      // A further dispatch pass must not attempt a FAILED_FINAL delivery again.
      await dispatchService.dispatchPendingEvents({ now });
      const stillFive = await dataSource
        .getRepository(WebhookDelivery)
        .findOneByOrFail({ id: delivery.id });
      expect(stillFive.attempts).toHaveLength(5);
      expect(receiver.requests).toHaveLength(5);
    } finally {
      await receiver.close();
    }
  });

  it('records a FAILED attempt with a null httpStatusCode for a network-level failure', async () => {
    const tenantId = newTenantId();
    // Nothing listens here — an ECONNREFUSED, not an HTTP response.
    const unreachableUrl = 'http://127.0.0.1:1';
    const endpoint = await endpointService.create({
      tenantId,
      targetUrl: unreachableUrl,
      eventTypes: ['case.escalated'],
    });
    await makeOutboxEvent(tenantId, 'case.escalated', { caseId: 'case-3' });

    await dispatchService.dispatchPendingEvents();

    const delivery = await dataSource
      .getRepository(WebhookDelivery)
      .findOneByOrFail({ webhookEndpointId: endpoint.id });
    expect(delivery.status).toBe('PENDING');
    expect(delivery.attempts).toHaveLength(1);
    expect(delivery.attempts[0]).toMatchObject({
      httpStatusCode: null,
      outcome: 'FAILED',
    });
    expect(delivery.attempts[0].errorMessage).toBeTruthy();
  }, 15_000);
});
