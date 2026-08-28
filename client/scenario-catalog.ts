import { config as loadEnv } from 'dotenv';
loadEnv();

import { randomUUID, randomBytes } from 'node:crypto';
import { Client as PgClient } from 'pg';
import { DataSource } from 'typeorm';
import { createApiClient } from './index';
import { ApiClient } from '../src/database/entities/api-client.entity';
import { ApiClientRole } from '../src/database/enums/api-client.enum';
import { ApiClientService } from '../src/auth/api-client.service';

/**
 * Section 8.8/15.5's "deterministic scenarios"/"scenario catalog" — the
 * other half of M4's developer-sandbox item `webhook-inspector.ts`
 * (M5-013) closed. Six named, reproducible scenarios exercising every
 * deterministic outcome shape this codebase currently produces through
 * the real REST API + Temporal worker, each with an *expected* outcome
 * the script asserts against — not just narrates — so drift in this
 * codebase's own deterministic behavior fails this script loudly, the
 * same "real assertions, not fabricated coverage" standard every spec in
 * this codebase already holds itself to.
 *
 * Run `npm run scenario-catalog` for every scenario in order, or
 * `npm run scenario-catalog -- <name>` for one (see SCENARIOS below for
 * names). Requires a real API server + Temporal worker already running
 * (see README.md's generated-client quickstart) — every call goes through
 * the real, generated client, never a mock.
 */

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL;
const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 30_000;
// The transient-failure scenario burns through 3 retries per evidence
// fetch (1s + 2s + 4s backoff) before the workflow gives up — a longer
// ceiling than the other scenarios need.
const RETRY_SCENARIO_TIMEOUT_MS = 45_000;
const TERMINAL_WORKFLOW_STATUSES = new Set([
  'COMPLETED',
  'FAILED',
  'CANCELED',
  'TERMINATED',
  'TIMED_OUT',
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withPg<T>(work: (pg: PgClient) => Promise<T>): Promise<T> {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run the scenario catalog.');
  }
  const pg = new PgClient({ connectionString: DATABASE_URL });
  await pg.connect();
  try {
    return await work(pg);
  } finally {
    await pg.end();
  }
}

async function seedTenant(): Promise<string> {
  return withPg(async (pg) => {
    const tenantId = randomUUID();
    await pg.query('INSERT INTO tenants (id, name) VALUES ($1, $2)', [
      tenantId,
      `Scenario catalog tenant ${new Date().toISOString()}`,
    ]);
    return tenantId;
  });
}

async function createApiClientCredential(
  tenantId: string,
  role: ApiClientRole,
): Promise<string> {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is required to mint an API client.');
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
      name: `scenario-catalog-${role.toLowerCase()}-client-${new Date().toISOString()}`,
      role,
    });
    return token;
  } finally {
    await dataSource.destroy();
  }
}

/** Section 10.6's jurisdiction catalog has no REST management surface (no `@Controller` in `src/policy/` at all) — the same honest direct-SQL gap `quickstart.ts` already documents for tenant/API-client seeding, not a fabricated endpoint. */
async function seedNotCoveredJurisdiction(): Promise<string> {
  const code = `ZZ-${randomBytes(4).toString('hex')}`;
  await withPg((pg) =>
    pg.query(
      `INSERT INTO jurisdictions (code, level, "parentCode", name, "coverageStatus") VALUES ($1, 'STATE', NULL, $2, 'NOT_COVERED')`,
      [code, `Scenario catalog sandbox jurisdiction (${code})`],
    ),
  );
  return code;
}

async function markJurisdictionCovered(code: string): Promise<void> {
  await withPg((pg) =>
    pg.query(
      `UPDATE jurisdictions SET "coverageStatus" = 'COVERED' WHERE code = $1`,
      [code],
    ),
  );
}

type ApiClientInstance = ReturnType<typeof createApiClient>;

interface CaseHandle {
  caseId: string;
  status: string;
}

async function createCase(
  client: ApiClientInstance,
  overrides: {
    borrowerId: string;
    jurisdictionCode: string;
    loanType: 'CONVENTIONAL' | 'FHA' | 'VA' | 'JUMBO';
    statedMonthlyIncome: number;
  },
): Promise<CaseHandle> {
  const { data, error } = await client.POST('/v1/loan-cases', {
    params: { header: { 'Idempotency-Key': randomUUID() } },
    body: {
      borrowerId: overrides.borrowerId,
      requestedAmount: 300_000,
      loanType: overrides.loanType,
      statedMonthlyIncome: overrides.statedMonthlyIncome,
      jurisdictionCode: overrides.jurisdictionCode,
    },
  });
  if (error || !data) {
    throw new Error(`createCase failed: ${JSON.stringify(error)}`);
  }
  return { caseId: data.id, status: data.status };
}

async function getCaseStatus(
  client: ApiClientInstance,
  caseId: string,
): Promise<string> {
  const { data, error } = await client.GET('/v1/loan-cases/{caseId}', {
    params: { path: { caseId } },
  });
  if (error || !data) {
    throw new Error(`getCase failed: ${JSON.stringify(error)}`);
  }
  return data.status;
}

async function startWorkflow(
  client: ApiClientInstance,
  caseId: string,
): Promise<string> {
  const { data, error } = await client.POST(
    '/v1/loan-cases/{caseId}/workflow-runs',
    { params: { path: { caseId } } },
  );
  if (error || !data) {
    throw new Error(`startWorkflowRun failed: ${JSON.stringify(error)}`);
  }
  return data.runId;
}

/** Polls the workflow run's own Temporal execution status to terminal, optionally invoking `onTick` each poll so a scenario can react to a case-level status change (e.g. submit a review the moment a condition opens) without a second, uncoordinated poll loop. */
async function pollWorkflowToTerminal(
  client: ApiClientInstance,
  caseId: string,
  runId: string,
  timeoutMs: number,
  onTick?: () => Promise<void>,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let status = 'RUNNING';
  while (Date.now() < deadline) {
    const { data, error } = await client.GET(
      '/v1/loan-cases/{caseId}/workflow-runs/{runId}',
      { params: { path: { caseId, runId } } },
    );
    if (error || !data) {
      throw new Error(`getWorkflowRun failed: ${JSON.stringify(error)}`);
    }
    status = data.status;
    if (TERMINAL_WORKFLOW_STATUSES.has(status)) {
      return status;
    }
    if (onTick) {
      await onTick();
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(
    `workflow run ${runId} did not reach a terminal status within ${timeoutMs}ms (last seen: ${status})`,
  );
}

/** Polls case status until it matches `target`, independent of workflow terminality — for observing a durable mid-workflow state (CONDITIONS_OPEN, WAITING_FOR_REVIEW) the workflow is deliberately paused in. */
async function pollCaseStatusUntil(
  client: ApiClientInstance,
  caseId: string,
  target: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let status = '';
  while (Date.now() < deadline) {
    status = await getCaseStatus(client, caseId);
    if (status === target) {
      return;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(
    `case ${caseId} did not reach status=${target} within ${timeoutMs}ms (last seen: ${status})`,
  );
}

function assertEqual(actual: string, expected: string, what: string): void {
  if (actual !== expected) {
    throw new Error(`${what}: expected ${expected}, got ${actual}`);
  }
}

interface ScenarioContext {
  client: ApiClientInstance;
  /** A REVIEWER-role credential (M5-017) — `POST .../reviews` requires it; the shared `client` above is PARTNER-role. */
  reviewerClient: ApiClientInstance;
}

interface Scenario {
  name: string;
  description: string;
  run(ctx: ScenarioContext): Promise<void>;
}

const SCENARIOS: Scenario[] = [
  {
    name: 'straight-through-approval',
    description:
      'Jurisdiction "US" has no policy applicability row for CONVENTIONAL — no rule ever evaluates, no condition opens, the case goes straight to READY_FOR_UNDERWRITING.',
    async run({ client }) {
      const { caseId } = await createCase(client, {
        borrowerId: `scenario-straight-through-${randomUUID()}`,
        jurisdictionCode: 'US',
        loanType: 'CONVENTIONAL',
        statedMonthlyIncome: 9000,
      });
      const runId = await startWorkflow(client, caseId);
      const workflowStatus = await pollWorkflowToTerminal(
        client,
        caseId,
        runId,
        POLL_TIMEOUT_MS,
      );
      assertEqual(workflowStatus, 'COMPLETED', 'workflow status');
      assertEqual(
        await getCaseStatus(client, caseId),
        'READY_FOR_UNDERWRITING',
        'case status',
      );
    },
  },
  {
    name: 'income-discrepancy-condition',
    description:
      'Jurisdiction "US-CA" + CONVENTIONAL matches the seeded synthetic-income-discrepancy-review rule. statedMonthlyIncome=1 guarantees a >10% mismatch against Plaid\'s $4,000-$25,000 simulated range, opening a VERIFY_INCOME_DISCREPANCY condition — resolved here via a real reviewer decision.',
    async run({ client, reviewerClient }) {
      const { caseId } = await createCase(client, {
        borrowerId: `scenario-income-discrepancy-${randomUUID()}`,
        jurisdictionCode: 'US-CA',
        loanType: 'CONVENTIONAL',
        statedMonthlyIncome: 1,
      });
      const runId = await startWorkflow(client, caseId);

      let reviewSubmitted = false;
      const workflowStatus = await pollWorkflowToTerminal(
        client,
        caseId,
        runId,
        POLL_TIMEOUT_MS,
        async () => {
          if (reviewSubmitted) return;
          const status = await getCaseStatus(client, caseId);
          if (status === 'CONDITIONS_OPEN') {
            const { error } = await reviewerClient.POST(
              '/v1/loan-cases/{caseId}/reviews',
              {
                params: { path: { caseId } },
                body: {
                  reviewType: 'CONDITION_RESOLUTION',
                  actorId: 'scenario-catalog-reviewer',
                  resolution: 'SATISFIED',
                  reason: 'Resolved by the scenario catalog.',
                },
              },
            );
            if (error) {
              throw new Error(`submitReview failed: ${JSON.stringify(error)}`);
            }
            reviewSubmitted = true;
          }
        },
      );
      if (!reviewSubmitted) {
        throw new Error(
          'case never reached CONDITIONS_OPEN — the income-discrepancy rule did not match as expected',
        );
      }
      assertEqual(workflowStatus, 'COMPLETED', 'workflow status');
      assertEqual(
        await getCaseStatus(client, caseId),
        'READY_FOR_UNDERWRITING',
        'case status',
      );
    },
  },
  {
    name: 'transient-provider-failure',
    description:
      'A borrowerId prefixed SYNTHETIC-TRANSIENT-FAILURE- makes every provider simulator throw a transient timeout. Temporal retries each evidence fetch 3 times (1s/2s/4s backoff) before giving up — the workflow run itself still completes; the case routes to MANUAL_REVIEW.',
    async run({ client }) {
      const { caseId } = await createCase(client, {
        borrowerId: `SYNTHETIC-TRANSIENT-FAILURE-${randomUUID()}`,
        jurisdictionCode: 'US',
        loanType: 'CONVENTIONAL',
        statedMonthlyIncome: 9000,
      });
      const runId = await startWorkflow(client, caseId);
      const workflowStatus = await pollWorkflowToTerminal(
        client,
        caseId,
        runId,
        RETRY_SCENARIO_TIMEOUT_MS,
      );
      assertEqual(workflowStatus, 'COMPLETED', 'workflow status');
      assertEqual(
        await getCaseStatus(client, caseId),
        'MANUAL_REVIEW',
        'case status',
      );
    },
  },
  {
    name: 'terminal-provider-failure',
    description:
      'A borrowerId prefixed SYNTHETIC-TERMINAL-FAILURE- makes every provider simulator throw a terminal rejection, classified non-retryable — no retries wasted, the case routes to MANUAL_REVIEW almost immediately.',
    async run({ client }) {
      const { caseId } = await createCase(client, {
        borrowerId: `SYNTHETIC-TERMINAL-FAILURE-${randomUUID()}`,
        jurisdictionCode: 'US',
        loanType: 'CONVENTIONAL',
        statedMonthlyIncome: 9000,
      });
      const runId = await startWorkflow(client, caseId);
      const workflowStatus = await pollWorkflowToTerminal(
        client,
        caseId,
        runId,
        POLL_TIMEOUT_MS,
      );
      assertEqual(workflowStatus, 'COMPLETED', 'workflow status');
      assertEqual(
        await getCaseStatus(client, caseId),
        'MANUAL_REVIEW',
        'case status',
      );
    },
  },
  {
    name: 'consent-revoked-before-dispatch',
    description:
      "Consent revoked before the workflow starts makes every evidence-fetch's provider-authorization revalidation fail closed (Section 11.5) — non-retryable, so the case routes to MANUAL_REVIEW without ever reaching the Agent.",
    async run({ client }) {
      const { caseId } = await createCase(client, {
        borrowerId: `scenario-consent-revoked-${randomUUID()}`,
        jurisdictionCode: 'US',
        loanType: 'CONVENTIONAL',
        statedMonthlyIncome: 9000,
      });
      const { error: revokeError } = await client.POST(
        '/v1/loan-cases/{caseId}/consents',
        {
          params: { path: { caseId } },
          body: {
            action: 'REVOKE',
            reason: 'Scenario catalog: consent revoked before dispatch.',
          },
        },
      );
      if (revokeError) {
        throw new Error(
          `submitConsentAction(REVOKE) failed: ${JSON.stringify(revokeError)}`,
        );
      }
      const runId = await startWorkflow(client, caseId);
      const workflowStatus = await pollWorkflowToTerminal(
        client,
        caseId,
        runId,
        POLL_TIMEOUT_MS,
      );
      assertEqual(workflowStatus, 'COMPLETED', 'workflow status');
      assertEqual(
        await getCaseStatus(client, caseId),
        'MANUAL_REVIEW',
        'case status',
      );
    },
  },
  {
    name: 'policy-ambiguity-unresolved-jurisdiction',
    description:
      "A case filed against a jurisdiction whose coverageStatus is not COVERED cannot resolve policy applicability — the Agent run interrupts for review (Section 9.5/9.6's POLICY_AMBIGUITY), the case durably waits at WAITING_FOR_REVIEW. Resolved here by an out-of-band jurisdiction-coverage fix (no REST surface exists for that — the same honest direct-SQL gap this script already documents for tenant seeding) followed by a real RESUME_EVALUATION signal.",
    async run({ client, reviewerClient }) {
      const jurisdictionCode = await seedNotCoveredJurisdiction();
      const { caseId } = await createCase(client, {
        borrowerId: `scenario-policy-ambiguity-${randomUUID()}`,
        jurisdictionCode,
        loanType: 'FHA',
        statedMonthlyIncome: 9000,
      });
      const runId = await startWorkflow(client, caseId);

      await pollCaseStatusUntil(
        client,
        caseId,
        'WAITING_FOR_REVIEW',
        POLL_TIMEOUT_MS,
      );

      await markJurisdictionCovered(jurisdictionCode);
      const { error: resumeError } = await reviewerClient.POST(
        '/v1/loan-cases/{caseId}/reviews',
        {
          params: { path: { caseId } },
          body: {
            reviewType: 'RESUME_EVALUATION',
            actorId: 'scenario-catalog-reviewer',
            reason: 'Scenario catalog: jurisdiction coverage corrected.',
          },
        },
      );
      if (resumeError) {
        throw new Error(
          `submitReview(RESUME_EVALUATION) failed: ${JSON.stringify(resumeError)}`,
        );
      }

      const workflowStatus = await pollWorkflowToTerminal(
        client,
        caseId,
        runId,
        POLL_TIMEOUT_MS,
      );
      assertEqual(workflowStatus, 'COMPLETED', 'workflow status');
      assertEqual(
        await getCaseStatus(client, caseId),
        'READY_FOR_UNDERWRITING',
        'case status',
      );
    },
  },
];

async function main(): Promise<void> {
  const requestedName = process.argv[2];
  const scenarios = requestedName
    ? SCENARIOS.filter((s) => s.name === requestedName)
    : SCENARIOS;
  if (requestedName && scenarios.length === 0) {
    console.error(`Unknown scenario "${requestedName}". Known scenarios:`);
    for (const s of SCENARIOS) console.error(`  ${s.name}`);
    process.exit(1);
  }

  console.log(`Scenario catalog against ${API_BASE_URL}`);
  const tenantId = await seedTenant();
  console.log(
    `Seeded tenant ${tenantId} (direct SQL — no REST endpoint exists yet)`,
  );
  const token = await createApiClientCredential(
    tenantId,
    ApiClientRole.PARTNER,
  );
  const reviewerToken = await createApiClientCredential(
    tenantId,
    ApiClientRole.REVIEWER,
  );
  console.log(
    'Minted a PARTNER-role and a REVIEWER-role API-client credential (M5-017) for that tenant',
  );
  const client = createApiClient(API_BASE_URL, token);
  const reviewerClient = createApiClient(API_BASE_URL, reviewerToken);

  let failures = 0;
  for (const scenario of scenarios) {
    console.log('');
    console.log(`── ${scenario.name} ──────────────────────────────────`);
    console.log(`   ${scenario.description}`);
    const startedAt = Date.now();
    try {
      await scenario.run({ client, reviewerClient });
      console.log(`   PASS (${Date.now() - startedAt}ms)`);
    } catch (error) {
      failures += 1;
      console.error(
        `   FAIL (${Date.now() - startedAt}ms): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  console.log('');
  console.log(
    `${scenarios.length - failures}/${scenarios.length} scenarios passed.`,
  );
  if (failures > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Scenario catalog failed to run:', error);
  process.exit(1);
});
