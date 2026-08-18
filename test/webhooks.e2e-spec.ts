/// <reference types="jest" />
import 'reflect-metadata';
require('dotenv').config();

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { WebhookEndpoint } from '../src/database/entities/webhook-endpoint.entity';
import { WebhookDelivery } from '../src/database/entities/webhook-delivery.entity';
import { OutboxEvent } from '../src/database/entities/outbox-event.entity';
import { WebhookDeliveryStatus } from '../src/database/enums/webhook.enum';

// Same "skip instead of failing" convention as cases.e2e-spec.ts — this
// exercises the real REST surface (Section 15.1's `POST
// /v1/webhook-endpoints` and `GET /v1/webhook-deliveries/{deliveryId}`)
// against a real database, through the real, fully-bootstrapped
// AppModule + supertest. Unlike cases.e2e-spec.ts, no Temporal server is
// required: nothing in the webhooks surface touches
// TemporalClientService, which only ever connects lazily on first use.
const missingVars = ['DATABASE_URL'].filter((v) => !process.env[v]);

if (missingVars.length > 0) {
  console.warn(
    `\n[e2e] Skipping webhooks.e2e-spec — missing env vars: ${missingVars.join(', ')}\n`,
  );
}

const describeOrSkip = missingVars.length > 0 ? describe.skip : describe;

describeOrSkip('Webhooks — REST endpoints and deliveries (e2e)', () => {
  let app: INestApplication;
  let endpointRepo: Repository<WebhookEndpoint>;
  let deliveryRepo: Repository<WebhookDelivery>;
  let outboxRepo: Repository<OutboxEvent>;
  const tenantId = randomUUID();
  const createdEndpointIds: string[] = [];
  const createdDeliveryIds: string[] = [];
  const createdOutboxEventIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    endpointRepo = moduleRef.get(getRepositoryToken(WebhookEndpoint));
    deliveryRepo = moduleRef.get(getRepositoryToken(WebhookDelivery));
    outboxRepo = moduleRef.get(getRepositoryToken(OutboxEvent));
  }, 30_000);

  afterAll(async () => {
    if (createdDeliveryIds.length > 0) {
      await deliveryRepo.delete(createdDeliveryIds);
    }
    if (createdEndpointIds.length > 0) {
      await endpointRepo.delete(createdEndpointIds);
    }
    if (createdOutboxEventIds.length > 0) {
      await outboxRepo.delete(createdOutboxEventIds);
    }
    await app?.close();
  });

  it('creates a webhook endpoint and returns its secret exactly once', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/webhook-endpoints')
      .send({
        tenantId,
        targetUrl: 'https://partner.example.com/hooks/mortgage-agent',
        eventTypes: ['loan_case.created', 'condition.opened'],
      })
      .expect(201);

    createdEndpointIds.push(response.body.id);
    expect(response.body).toMatchObject({
      tenantId,
      targetUrl: 'https://partner.example.com/hooks/mortgage-agent',
      eventTypes: ['loan_case.created', 'condition.opened'],
      status: 'ACTIVE',
    });
    expect(response.body.secret).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects an eventTypes value outside the known event catalog', async () => {
    await request(app.getHttpServer())
      .post('/v1/webhook-endpoints')
      .send({
        tenantId,
        targetUrl: 'https://partner.example.com/hooks/mortgage-agent',
        eventTypes: ['not_a_real_event_type'],
      })
      .expect(400);
  });

  it('rejects a non-URL targetUrl', async () => {
    await request(app.getHttpServer())
      .post('/v1/webhook-endpoints')
      .send({
        tenantId,
        targetUrl: 'not-a-url',
        eventTypes: ['loan_case.created'],
      })
      .expect(400);
  });

  it('rejects an empty eventTypes array', async () => {
    await request(app.getHttpServer())
      .post('/v1/webhook-endpoints')
      .send({
        tenantId,
        targetUrl: 'https://partner.example.com/hooks/mortgage-agent',
        eventTypes: [],
      })
      .expect(400);
  });

  it('returns 404 for an unknown delivery id', async () => {
    await request(app.getHttpServer())
      .get(`/v1/webhook-deliveries/${randomUUID()}`)
      .expect(404);
  });

  it('GET returns a real delivery with its attempt history', async () => {
    const endpoint = await endpointRepo.save(
      endpointRepo.create({
        tenantId,
        targetUrl: 'https://partner.example.com/hooks/mortgage-agent',
        secret: 'e2e-fixture-secret',
        eventTypes: ['loan_case.created'],
      }),
    );
    createdEndpointIds.push(endpoint.id);

    const outboxEvent = await outboxRepo.save(
      outboxRepo.create({
        tenantId,
        caseId: randomUUID(),
        eventType: 'loan_case.created',
        payload: { caseId: 'e2e-fixture-case' },
        signature: 'e2e-fixture-signature',
      }),
    );
    createdOutboxEventIds.push(outboxEvent.id);

    const delivery = await deliveryRepo.save(
      deliveryRepo.create({
        tenantId,
        webhookEndpointId: endpoint.id,
        outboxEventId: outboxEvent.id,
        eventType: 'loan_case.created',
        status: WebhookDeliveryStatus.FAILED_FINAL,
        attempts: [
          {
            attemptNumber: 1,
            attemptedAt: new Date().toISOString(),
            httpStatusCode: 500,
            outcome: 'FAILED',
            errorMessage: 'receiver responded HTTP 500',
          },
        ],
        nextAttemptAt: null,
      }),
    );
    createdDeliveryIds.push(delivery.id);

    const response = await request(app.getHttpServer())
      .get(`/v1/webhook-deliveries/${delivery.id}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: delivery.id,
      tenantId,
      webhookEndpointId: endpoint.id,
      eventType: 'loan_case.created',
      status: 'FAILED_FINAL',
    });
    expect(response.body.attempts).toHaveLength(1);
    expect(response.body.attempts[0]).toMatchObject({
      attemptNumber: 1,
      httpStatusCode: 500,
      outcome: 'FAILED',
    });
  });
});
