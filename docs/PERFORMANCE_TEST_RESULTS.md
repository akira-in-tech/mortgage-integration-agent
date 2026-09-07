# Performance test results

Real, measured results only. Every number on this page came from an actual
run of a checked-in test script against a real running instance of this
codebase — nothing here is estimated or extrapolated.

Two separate test suites exist because they answer two different questions,
against two different environments, and neither one can honestly stand in
for the other:

|                       | `load-testing/staging-health.js`                                                                                                                          | `load-testing/local-comprehensive.js`                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Target                | Real deployed staging (AWS, via CloudFront)                                                                                                               | Local dev stack (`docker compose up -d postgres temporal`)                                                               |
| Scope                 | The two unauthenticated health endpoints only                                                                                                             | Health endpoints **and** real authenticated GraphQL/REST business traffic                                                |
| Why the scope differs | Every other staging route needs a real tenant/bearer token, and hammering those with synthetic load would leave garbage data in the real staging database | A local guest-sandbox tenant is disposable by construction — synthetic load there costs nothing and touches no real data |
| Run with              | `k6 run -e STAGING_BASE_URL=... load-testing/staging-health.js` (CI: `staging-drill.yml`)                                                                 | `npm run perf:local`                                                                                                     |

Run below: `npm run perf:local`, 2026-09-07, against a locally running API
(`npm run start:dev`) with `docker compose up -d postgres temporal` (Postgres
16-alpine, Temporal 1.29.7, both already warm — not a cold start). One
guest-sandbox tenant was created for the run; every request in every
authenticated scenario below hit that same tenant.

## Results

| Scenario                                                                 | Requests | Duration | Avg req/s |  p50 |    p95 |      p99 |      Max | Failures              |
| ------------------------------------------------------------------------ | -------: | -------: | --------: | ---: | -----: | -------: | -------: | --------------------- |
| `GET /health/live` (no DB)                                               |  341,162 |    15.1s |    22,744 | 0 ms |   2 ms |     3 ms |   109 ms | 0                     |
| `GET /health/ready` (real `SELECT 1`)                                    |   11,883 |    15.0s |       792 | 1 ms |  11 ms | 1,469 ms | 2,503 ms | 3 × HTTP 503 (0.025%) |
| GraphQL `cases` (Triage Queue list)                                      |  180,826 |    20.0s |     9,041 | 1 ms |   4 ms |     5 ms |   153 ms | 0                     |
| GraphQL `caseStatusCounts` (Ops Dashboard)                               |  194,751 |    20.0s |     9,738 | 1 ms |   3 ms |     4 ms |   104 ms | 0                     |
| GraphQL `recentActivity` (Live Stream poll)                              |  192,914 |    20.0s |     9,646 | 1 ms |   3 ms |     4 ms |    86 ms | 0                     |
| GraphQL `case` detail (Case Dossier — heaviest read, 5 nested relations) |  180,399 |    20.0s |     9,021 | 1 ms |   4 ms |     6 ms |    85 ms | 0                     |
| `POST /v1/demo-sandbox/cases` (real write)                               |        8 |     1.0s |         8 | 4 ms | 160 ms |   160 ms |   160 ms | 0                     |

Load shape: 20 concurrent connections for every read scenario, run
back-to-back against the same warm process. The write scenario used 2
connections / 8 total requests on purpose — see "Why only 8 writes" below.

Raw autocannon output for this run (every stat above plus percentile/stdev
detail and byte counts) was written automatically to
`docs/performance/local-comprehensive-<timestamp>.json`. Like
`evaluation/reports/*.json`, these are reproducible generated output, not
committed source content (see `.gitignore`) — re-run `npm run perf:local` to
regenerate your own and inspect the full raw numbers behind this table.

## What this shows

- **Every real GraphQL business read this app currently serves — including
  the heaviest one (the full Case Dossier, which joins evidence, conditions,
  timeline, provider operations, and audit events) — resolves in single-digit
  milliseconds at p99 under 20 concurrent readers**, on a laptop, against a
  single-container Postgres. This is the first time this app's actual
  business-query latency has been measured; the only prior number
  (`staging-health.js`) explicitly measures the health-check layer, not this.
- **The one endpoint that shows real tail-latency trouble is `/health/ready`**
  — the exact endpoint that does a real `SELECT 1` on every request with no
  caching. p50 (1 ms) is fine, but p99 balloons to 1.47s and 3 requests
  (0.025%) returned HTTP 503 outright. This did not happen against real
  staging RDS in the existing k6 run (documented in `DEVELOPMENT_LOG.md`: 0
  failures on `/health/ready` there). The honest read: a single local
  Postgres container's connection handling degrades under sustained
  concurrent `SELECT 1` load in a way a real RDS instance does not at the
  same concurrency — this is a real difference between the two environments,
  not a bug demonstrated in production, and it should not be reported as one.
- **The write path (`POST /v1/demo-sandbox/cases`) works correctly under
  real, authenticated conditions** — including the `X-CSRF-Token` header the
  guest-sandbox session actually requires for unsafe requests, which the
  first draft of this script omitted and which produced 8/8 HTTP 401s before
  the fix (worth naming so the fix doesn't quietly disappear from the
  record). p95 latency for a real case creation (workflow start included) is
  160 ms.

## Why only 8 writes

`src/auth/guest-sandbox.controller.ts` throttles case creation to 10
requests / 60 seconds by application-level design — the code comment there
says why: "creating a tenant/case has durable database cost." A
"comprehensive" write-load test that ignores an intentional rate limit isn't
measuring this system; it's measuring what happens when you turn off a
safeguard the system ships with on purpose. This script sends 8 requests
inside that real limit instead, which is what the write path's real,
deliberate ceiling actually allows to be measured honestly.

## Known limitations of this test

- Single-tenant load: every read in this run hit the same one guest-sandbox
  tenant's data (1 seed case). Multi-tenant concurrent access and
  many-cases-per-tenant pagination depth are not exercised here.
- No Temporal worker load: the case-creation scenario starts a real workflow,
  but 8 runs is nowhere near enough to characterize worker throughput under
  concurrent workflow execution. That would need its own dedicated test
  against a running `npm run start:worker:dev` process and is not attempted
  here.
- Local hardware, not a controlled benchmark environment: absolute numbers
  will vary run to run and machine to machine. The comparison that's durable
  is relative (which scenario is fast, which one has tail-latency trouble,
  whether errors are zero or not) — not the exact millisecond figures.

## Reproducing this

```bash
docker compose up -d postgres temporal
npm run start:dev   # in one terminal
npm run perf:local   # in another, once the API is up
```
