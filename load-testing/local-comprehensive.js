// Comprehensive local performance test.
//
// Scope, on purpose: the existing load-testing/staging-health.js only hits
// the two unauthenticated health endpoints against the real deployed staging
// environment, and says clearly why: every other route needs a real
// tenant/bearer token, and hammering those with synthetic load would leave
// garbage data in the real staging database. That test explicitly names the
// fix as "seed a dedicated synthetic load-test tenant" -- this script is
// that fix, scoped to the local dev stack instead of staging.
//
// This script creates exactly one guest sandbox tenant (the same public,
// disposable, unauthenticated-to-create demo tenant the console's "Try live
// sandbox" button uses), then drives real, authenticated business traffic
// against it: GraphQL list/detail/dashboard queries and a real case-creation
// write path, on top of the same two health endpoints for a baseline. All
// data this creates lives only in the local Postgres container
// (docker compose up -d postgres temporal) and is synthetic by construction.
//
// The guest-sandbox case-creation endpoint is intentionally throttled to
// 10 requests / 60s in application code (src/auth/guest-sandbox.controller.ts)
// -- "creating a tenant/case has durable database cost." This script respects
// that limit rather than working around it: the write scenario sends 8
// requests spread across the window, which is what "comprehensive" can
// honestly mean for a write path that is deliberately rate-limited by design.
//
// Run against a locally running API (`npm run start:dev`) with
// `docker compose up -d postgres temporal` already up:
//   npm run perf:local
//
// Prints one summary block per scenario and writes the full raw results to
// docs/performance/local-comprehensive-<timestamp>.json.

const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.LOCAL_BASE_URL || 'http://localhost:3000';

function extractCookies(setCookieHeaders) {
  const jar = {};
  for (const header of setCookieHeaders || []) {
    const [pair] = header.split(';');
    const eq = pair.indexOf('=');
    jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return jar;
}

function cookieHeader(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function createSandboxSession() {
  const res = await fetch(`${BASE_URL}/v1/demo-sandbox/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(
      `Failed to create guest sandbox session: HTTP ${res.status}`,
    );
  }
  const setCookie =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : res.headers.raw?.()['set-cookie'] || [];
  const jar = extractCookies(setCookie);
  const body = await res.json();
  return {
    cookie: cookieHeader(jar),
    caseId: body.caseId,
    csrfToken: body.csrfToken,
  };
}

function run(name, opts) {
  return new Promise((resolve, reject) => {
    const instance = autocannon({ url: BASE_URL, ...opts }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    autocannon.track(instance, { renderProgressBar: false });
  }).then((result) => {
    console.log(`\n=== ${name} ===`);
    console.log(
      `requests: ${result.requests.total}  errors: ${result.errors}  ` +
        `non2xx: ${result.non2xx}  timeouts: ${result.timeouts}`,
    );
    console.log(
      `latency ms  avg: ${result.latency.average}  p50: ${result.latency.p50}  ` +
        `p95: ${result.latency.p97_5}  p99: ${result.latency.p99}  max: ${result.latency.max}`,
    );
    console.log(
      `throughput req/s  avg: ${result.requests.average}  total: ${result.requests.total} over ${result.duration}s`,
    );
    return result;
  });
}

async function main() {
  console.log(`Comprehensive local performance test against ${BASE_URL}`);
  console.log(
    'Prerequisite: docker compose up -d postgres temporal, npm run start:dev\n',
  );

  const { cookie, caseId, csrfToken } = await createSandboxSession();
  console.log(`Created guest sandbox session, seed case: ${caseId}`);

  const results = {};

  // --- Baseline: unauthenticated health endpoints, no DB touch ---
  results.healthLive = await run('health/live (no DB, throughput ceiling)', {
    connections: 20,
    duration: 15,
    requests: [{ method: 'GET', path: '/health/live' }],
  });

  // --- Baseline: unauthenticated health endpoint with a real DB round trip ---
  results.healthReady = await run('health/ready (real SELECT 1)', {
    connections: 20,
    duration: 15,
    requests: [{ method: 'GET', path: '/health/ready' }],
  });

  const gqlHeaders = {
    'Content-Type': 'application/json',
    Cookie: cookie,
  };

  // --- Real business read: paginated case list (Triage Queue) ---
  results.casesQuery = await run('GraphQL: cases (Triage Queue list)', {
    connections: 20,
    duration: 20,
    requests: [
      {
        method: 'POST',
        path: '/graphql',
        headers: gqlHeaders,
        body: JSON.stringify({
          query: `query Cases($first: Int) {
            cases(first: $first) {
              edges { cursor node { id borrowerId requestedAmount loanType status createdAt } }
              pageInfo { hasNextPage endCursor }
            }
          }`,
          variables: { first: 20 },
        }),
      },
    ],
  });

  // --- Real business read: dashboard aggregate ---
  results.caseStatusCounts = await run(
    'GraphQL: caseStatusCounts (Ops Dashboard)',
    {
      connections: 20,
      duration: 20,
      requests: [
        {
          method: 'POST',
          path: '/graphql',
          headers: gqlHeaders,
          body: JSON.stringify({
            query: `query { caseStatusCounts { status count } }`,
          }),
        },
      ],
    },
  );

  // --- Real business read: recent activity feed ---
  results.recentActivity = await run(
    'GraphQL: recentActivity (Live Stream, poll-shaped)',
    {
      connections: 20,
      duration: 20,
      requests: [
        {
          method: 'POST',
          path: '/graphql',
          headers: gqlHeaders,
          body: JSON.stringify({
            query: `query RecentActivity($limit: Int) { recentActivity(limit: $limit) { id action actorId resourceType resourceId reason createdAt } }`,
            variables: { limit: 20 },
          }),
        },
      ],
    },
  );

  // --- Real business read: full case dossier (heaviest read: 8 nested relations) ---
  results.caseDetail = await run(
    'GraphQL: case detail (Case Dossier, heaviest read)',
    {
      connections: 20,
      duration: 20,
      requests: [
        {
          method: 'POST',
          path: '/graphql',
          headers: gqlHeaders,
          body: JSON.stringify({
            query: `query Case($caseId: ID!) {
              case(caseId: $caseId) {
                id status version
                evidenceFacts { id factType sourceKind value observedAt }
                conditions { id code description status }
                timeline { kind summary timestamp }
                providerOperations { id providerId capability state }
                auditEvents { id action actorId resourceType createdAt }
              }
            }`,
            variables: { caseId },
          }),
        },
      ],
    },
  );

  // --- Real business write: case creation, respecting the real 10/60s throttle ---
  results.caseCreation = await run(
    'POST /v1/demo-sandbox/cases (real write, throttle-respecting)',
    {
      connections: 2,
      amount: 8,
      requests: [
        {
          method: 'POST',
          path: '/v1/demo-sandbox/cases',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookie,
            'X-CSRF-Token': csrfToken,
          },
          body: JSON.stringify({}),
        },
      ],
    },
  );

  const outDir = path.join(__dirname, '..', 'docs', 'performance');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(
    outDir,
    `local-comprehensive-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\nRaw results written to ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
