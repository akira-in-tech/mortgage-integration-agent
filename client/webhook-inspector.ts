import { config as loadEnv } from 'dotenv';
loadEnv();

import { randomUUID } from 'node:crypto';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { Client as PgClient } from 'pg';
import { DataSource } from 'typeorm';
import { createApiClient } from './index';
import { ApiClient } from '../src/database/entities/api-client.entity';
import { ApiClientService } from '../src/auth/api-client.service';
import { OutboxEventType } from '../src/database/outbox/outbox-event-types';
import { verifyWebhookSignature } from '../src/webhooks/webhook-signer';

/**
 * Section 8.8/15.5's "Developer Sandbox... webhook inspection" — the one
 * named sandbox capability M4's own scope listed but never built (see
 * docs/DEVELOPMENT_LOG.md's M4-004/M5-011 entries). A real local HTTP
 * listener, not a mock: it registers itself as a genuine
 * `POST /v1/webhook-endpoints` target through the same real, generated
 * client `quickstart.ts` uses, then verifies every inbound delivery's
 * real HMAC signature (`webhook-signer.ts`'s own `verifyWebhookSignature`
 * — the identical code a real external partner integration would run) as
 * it arrives, live.
 *
 * Registering `http://127.0.0.1:<port>/inbound` only succeeds because
 * `WebhookEndpointService.create()`'s SSRF guard (M5-011) carries a
 * narrow, environment-gated exception for exactly this (M5-013,
 * `webhook-url-guard.ts`'s own `allowLoopbackForSandbox` — `NODE_ENV`
 * `development`/`test` only, verified to still fail closed under
 * `production` by a dedicated test). Run this against a real API server
 * that is NOT `NODE_ENV=production`, or registration fails with the
 * exact same 400 a hostile caller would get.
 */

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL;
const INSPECTOR_PORT = Number(process.env.WEBHOOK_INSPECTOR_PORT ?? 4500);
const INSPECTOR_HOST = '127.0.0.1';

async function seedInspectorTenant(): Promise<string> {
  if (!DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is required to seed a tenant for the webhook inspector.',
    );
  }
  const pg = new PgClient({ connectionString: DATABASE_URL });
  await pg.connect();
  try {
    const tenantId = randomUUID();
    await pg.query('INSERT INTO tenants (id, name) VALUES ($1, $2)', [
      tenantId,
      `Webhook inspector tenant ${new Date().toISOString()}`,
    ]);
    return tenantId;
  } finally {
    await pg.end();
  }
}

async function createInspectorApiClient(tenantId: string): Promise<string> {
  if (!DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is required to mint an API client for the webhook inspector.',
    );
  }
  const dataSource = new DataSource({
    type: 'postgres',
    url: DATABASE_URL,
    entities: [ApiClient],
  });
  await dataSource.initialize();
  try {
    const service = new ApiClientService(dataSource.getRepository(ApiClient));
    const { token } = await service.create({
      tenantId,
      name: `webhook-inspector-client-${new Date().toISOString()}`,
    });
    return token;
  } finally {
    await dataSource.destroy();
  }
}

function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function header(req: IncomingMessage, name: string): string {
  const value = req.headers[name];
  return typeof value === 'string' ? value : '';
}

async function main(): Promise<void> {
  console.log(`Webhook inspector — API at ${API_BASE_URL}`);
  const tenantId = await seedInspectorTenant();
  console.log(`Seeded tenant ${tenantId} (direct SQL, same as quickstart.ts)`);
  const token = await createInspectorApiClient(tenantId);
  console.log(`Minted a scoped API-client credential for that tenant`);

  const client = createApiClient(API_BASE_URL, token);

  let deliveredCount = 0;
  // Assigned once registration below succeeds — no real request can
  // arrive before then, since nothing knows this listener's address
  // until the registration call that follows returns it.
  let endpointSecret = '';

  const server = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      const rawBody = await readRawBody(req);
      const deliveryId = header(req, 'x-webhook-id');
      const timestamp = header(req, 'x-webhook-timestamp');
      const signature = header(req, 'x-webhook-signature');

      let event: { type?: string; data?: unknown } = {};
      try {
        event = JSON.parse(rawBody);
      } catch {
        // Body isn't JSON — verification below will report the mismatch
        // either way; still show what arrived.
      }

      const verification = verifyWebhookSignature(
        deliveryId,
        timestamp,
        rawBody,
        signature,
        endpointSecret,
      );

      deliveredCount += 1;
      console.log('');
      console.log(
        `── delivery #${deliveredCount} ─────────────────────────────────`,
      );
      console.log(`  id:        ${deliveryId}`);
      console.log(`  type:      ${event.type ?? '(unparseable body)'}`);
      console.log(`  timestamp: ${timestamp}`);
      console.log(
        `  signature: ${verification.valid ? 'VALID' : `INVALID (${verification.reason})`}`,
      );
      console.log(`  payload:   ${JSON.stringify(event.data ?? null)}`);

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ received: true }));
    },
  );

  await new Promise<void>((resolve) =>
    server.listen(INSPECTOR_PORT, INSPECTOR_HOST, resolve),
  );
  console.log(
    `Listening on http://${INSPECTOR_HOST}:${INSPECTOR_PORT}/inbound`,
  );

  const { data: endpoint, error: registerError } = await client.POST(
    '/v1/webhook-endpoints',
    {
      body: {
        targetUrl: `http://${INSPECTOR_HOST}:${INSPECTOR_PORT}/inbound`,
        eventTypes: Object.values(OutboxEventType),
      },
    },
  );
  if (registerError || !endpoint) {
    server.close();
    throw new Error(
      `Registering the inspector's own webhook endpoint failed: ${JSON.stringify(
        registerError,
      )} — is the API server running with NODE_ENV=development or =test? ` +
        `The SSRF guard (M5-011/M5-013) only allows a loopback target outside production.`,
    );
  }
  endpointSecret = endpoint.secret;
  console.log(
    `Registered webhook endpoint ${endpoint.id}, subscribed to all ${
      Object.values(OutboxEventType).length
    } known event types`,
  );
  console.log('');
  console.log(
    'Trigger real events against the API (create a case, start a workflow run, ...)',
  );
  console.log('and watch signed deliveries arrive here. Ctrl+C to stop.');

  const shutdown = () => {
    console.log('\nShutting down webhook inspector...');
    server.close(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Webhook inspector failed to start:', error);
  process.exit(1);
});
