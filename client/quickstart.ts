import { config as loadEnv } from 'dotenv';
loadEnv();

import { randomUUID } from 'node:crypto';
import { Client as PgClient } from 'pg';
import { DataSource } from 'typeorm';
import { createApiClient } from './index';
import { ApiClient } from '../src/database/entities/api-client.entity';
import { ApiClientService } from '../src/auth/api-client.service';

/**
 * Section 20 M4 exit evidence: "generated client completes the published
 * quickstart." Run via `npm run quickstart` after `npm run generate:openapi
 * && npm run generate:client` and after a real API server + Temporal
 * worker are running (see docs/QUICKSTART.md) — every call below goes
 * through the real, generated, fully-typed client (`client/index.ts`)
 * against the real REST API, never a mock.
 *
 * Tenant creation has no REST endpoint yet (Section 15.1's target surface
 * doesn't include one, and this codebase hasn't built one) — this script
 * inserts one directly via SQL, the same honest gap this codebase's other
 * scripts (evaluation-report.ts) already document rather than paper over
 * with a fabricated endpoint. API-client creation (Section 20 M5) has the
 * same honest gap — `ApiClientService` directly, matching
 * `create-api-client.ts`'s own script, not a fabricated endpoint either.
 */

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL;
const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 30_000;
const TERMINAL_STATUSES = new Set([
  'COMPLETED',
  'FAILED',
  'CANCELED',
  'TERMINATED',
  'TIMED_OUT',
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function seedQuickstartTenant(): Promise<string> {
  if (!DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is required to seed a tenant for this quickstart.',
    );
  }
  const pg = new PgClient({ connectionString: DATABASE_URL });
  await pg.connect();
  try {
    const tenantId = randomUUID();
    await pg.query('INSERT INTO tenants (id, name) VALUES ($1, $2)', [
      tenantId,
      `Quickstart tenant ${new Date().toISOString()}`,
    ]);
    return tenantId;
  } finally {
    await pg.end();
  }
}

async function createQuickstartApiClient(tenantId: string): Promise<string> {
  if (!DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is required to mint an API client for this quickstart.',
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
      name: `quickstart-client-${new Date().toISOString()}`,
    });
    return token;
  } finally {
    await dataSource.destroy();
  }
}

async function main(): Promise<void> {
  console.log(`Quickstart against ${API_BASE_URL}`);
  const tenantId = await seedQuickstartTenant();
  console.log(
    `Seeded tenant ${tenantId} (direct SQL — no REST endpoint exists yet)`,
  );
  const token = await createQuickstartApiClient(tenantId);
  console.log(
    `Minted a scoped API-client credential for that tenant (ApiClientService directly — no REST endpoint exists yet)`,
  );

  const client = createApiClient(API_BASE_URL, token);

  const { data: loanCase, error: createError } = await client.POST(
    '/v1/loan-cases',
    {
      params: { header: { 'Idempotency-Key': randomUUID() } },
      body: {
        borrowerId: 'quickstart-borrower',
        requestedAmount: 300000,
        loanType: 'CONVENTIONAL',
        statedMonthlyIncome: 9000,
        jurisdictionCode: 'US-CA',
      },
    },
  );
  if (createError || !loanCase) {
    throw new Error(`createCase failed: ${JSON.stringify(createError)}`);
  }
  console.log(`Created case ${loanCase.id} (status=${loanCase.status})`);

  const { data: run, error: startError } = await client.POST(
    '/v1/loan-cases/{caseId}/workflow-runs',
    { params: { path: { caseId: loanCase.id } } },
  );
  if (startError || !run) {
    throw new Error(`startWorkflowRun failed: ${JSON.stringify(startError)}`);
  }
  console.log(`Started workflow run ${run.runId}`);

  // The seeded policy rule (docs/PROJECT_CHARTER.md Section 10.7's own
  // example) opens a VERIFY_INCOME_DISCREPANCY condition whenever the
  // Plaid simulator's deterministic verified income for this borrowerId
  // diverges from statedMonthlyIncome by more than 10% — which borrowerId
  // hashes to depends on the simulator's own seed, so this quickstart
  // doesn't gamble on it: it watches the *case* status (not just the
  // workflow run) and, the moment it sees CONDITIONS_OPEN, submits a real
  // reviewer decision via `submitReview` so the workflow can proceed —
  // demonstrating the review endpoint too, not only the happy path.
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let status = 'RUNNING';
  let reviewSubmitted = false;
  while (Date.now() < deadline) {
    const { data: runStatus, error: statusError } = await client.GET(
      '/v1/loan-cases/{caseId}/workflow-runs/{runId}',
      { params: { path: { caseId: loanCase.id, runId: run.runId } } },
    );
    if (statusError || !runStatus) {
      throw new Error(`getWorkflowRun failed: ${JSON.stringify(statusError)}`);
    }
    status = runStatus.status;
    if (TERMINAL_STATUSES.has(status)) {
      break;
    }

    if (!reviewSubmitted) {
      const { data: caseNow, error: caseError } = await client.GET(
        '/v1/loan-cases/{caseId}',
        { params: { path: { caseId: loanCase.id } } },
      );
      if (caseError || !caseNow) {
        throw new Error(`getCase failed: ${JSON.stringify(caseError)}`);
      }
      if (caseNow.status === 'CONDITIONS_OPEN') {
        console.log(
          'Case has an open condition (income discrepancy) — submitting a reviewer decision via submitReview',
        );
        const { error: reviewError } = await client.POST(
          '/v1/loan-cases/{caseId}/reviews',
          {
            params: { path: { caseId: loanCase.id } },
            body: {
              reviewType: 'CONDITION_RESOLUTION',
              actorId: 'quickstart-reviewer',
              resolution: 'SATISFIED',
              reason: 'Resolved by the published quickstart script.',
            },
          },
        );
        if (reviewError) {
          throw new Error(
            `submitReview failed: ${JSON.stringify(reviewError)}`,
          );
        }
        reviewSubmitted = true;
      }
    }

    await sleep(POLL_INTERVAL_MS);
  }
  console.log(`Workflow run reached status=${status}`);

  const { data: finalCase, error: getError } = await client.GET(
    '/v1/loan-cases/{caseId}',
    { params: { path: { caseId: loanCase.id } } },
  );
  if (getError || !finalCase) {
    throw new Error(`getCase failed: ${JSON.stringify(getError)}`);
  }
  console.log(`Case ${finalCase.id} now status=${finalCase.status}`);

  const { data: timeline, error: timelineError } = await client.GET(
    '/v1/loan-cases/{caseId}/timeline',
    { params: { path: { caseId: loanCase.id } } },
  );
  if (timelineError || !timeline) {
    throw new Error(`getCaseTimeline failed: ${JSON.stringify(timelineError)}`);
  }
  console.log(`Timeline (${timeline.length} entries):`);
  for (const entry of timeline) {
    console.log(`  [${entry.timestamp}] ${entry.kind}: ${entry.summary}`);
  }

  if (status !== 'COMPLETED') {
    throw new Error(
      `Quickstart did not reach a COMPLETED workflow run (got ${status}) within ${POLL_TIMEOUT_MS}ms`,
    );
  }
  console.log('Quickstart completed successfully.');
}

main().catch((error) => {
  console.error('Quickstart failed:', error);
  process.exit(1);
});
