# Quickstart

Section 15's developer platform, M4-003 scope: a checked, published OpenAPI
artifact, a generated TypeScript client, and this runnable quickstart. Every
step below uses real infrastructure — a real Postgres database, a real
Temporal server, and a real HTTP server — not a mock or a simulation of the
API.

This walks through the `/v1/loan-cases` surface this codebase actually
implements today: create a case, start its workflow, watch it open an
income-discrepancy condition, resolve that condition as a reviewer, and read
back the resulting timeline. It does **not** cover the rest of Section
15.1's target partner API (consents, documents, conditions/evidence listing,
policy snapshots, provider operations, audit export, webhooks) — none of
those exist in this codebase yet.

## 1. Start the infrastructure

A real Postgres and a real Temporal server. From the repo root, using the
same scratch stack this project's own verification uses:

```bash
docker compose -f <path-to-your-compose-file> up -d
```

At minimum you need `DATABASE_URL` (a Postgres connection string) and
`TEMPORAL_ADDRESS` (defaults to `localhost:7233`) reachable.

## 2. Run migrations

```bash
DATABASE_URL=postgres://... npm run migration:run
```

## 3. Start the API server and the Temporal worker

In two separate terminals:

```bash
DATABASE_URL=postgres://... TEMPORAL_ADDRESS=localhost:7233 npm run start:dev
DATABASE_URL=postgres://... TEMPORAL_ADDRESS=localhost:7233 npm run start:worker:dev
```

In development (`NODE_ENV` unset or `development`), the API server also
serves an interactive Swagger UI at `http://localhost:3000/api-docs` — the
same reasoning that already gates the GraphQL Playground to development
applies here (Section 16.1): interactive API documentation leaks the full
REST surface to anyone who can reach the endpoint, so it's disabled outside
development.

## 4. Generate the checked OpenAPI artifact and the TypeScript client

```bash
DATABASE_URL=postgres://... npm run generate:openapi
npm run generate:client
```

- `generate:openapi` boots the real Nest application (needs a reachable
  database — `TypeOrmModule` connects during module init) and writes the
  real, decorated `CasesController`'s OpenAPI document to
  `openapi/openapi.json` (Section 15.3: "checked and published OpenAPI
  artifact"). It does **not** need a running Temporal server or an HTTP
  listener — it builds the document and exits.
- `generate:client` runs [`openapi-typescript`](https://openapi-ts.dev)
  against that file, producing `client/generated/schema.d.ts` — real
  generated TypeScript types, not hand-maintained duplicates that could
  drift from the actual API.

Re-run both after any change to `CasesController` or its DTOs/response
types — a stale `schema.d.ts` fails to compile against a changed route
rather than silently drifting.

## 5. Run the quickstart

```bash
DATABASE_URL=postgres://... API_BASE_URL=http://localhost:3000 npm run quickstart
```

`client/quickstart.ts` is the concrete realization of Section 20's M4 exit
evidence: "generated client completes the published quickstart." It:

1. Seeds one tenant directly via SQL — there is no `POST /v1/tenants`
   endpoint yet (a known gap, not a fabricated shortcut; see
   `docs/DEVELOPMENT_LOG.md`'s M4-003 entry).
2. Creates a loan case (`POST /v1/loan-cases`) through the generated,
   fully-typed client (`client/index.ts`, an `openapi-fetch` client typed
   against `client/generated/schema.d.ts`).
3. Starts the case-conditions workflow (`POST .../workflow-runs`).
4. Polls the workflow run's status (`GET .../workflow-runs/{runId}`). The
   seeded policy rule (the charter's own Section 10.7 example) opens a
   `VERIFY_INCOME_DISCREPANCY` condition whenever the case's stated income
   diverges from the Plaid simulator's deterministic verified figure by
   more than 10% — the moment the quickstart sees the case reach
   `CONDITIONS_OPEN`, it submits a real reviewer decision
   (`POST .../reviews`) to resolve it, so the workflow can complete.
5. Reads back the final case (`GET /v1/loan-cases/{caseId}`) and its full
   timeline (`GET .../timeline`), printing every entry.

A successful run ends with `Quickstart completed successfully.` and exits 0;
any failed call, or a workflow that doesn't reach Temporal's `COMPLETED`
status within 30 seconds, exits 1 with the failing step's error.

## What this quickstart does not cover

- Authentication — no auth/API-client layer exists yet on this REST surface
  (a known gap this codebase has carried since M2).
- Idempotency-fingerprint or problem-details error responses (Section
  15.3's full target contract) — only the `Idempotency-Key` header itself
  is implemented.
- Any endpoint beyond `/v1/loan-cases/*` — the rest of Section 15.1's
  target partner API, and all of webhooks, are not built.
