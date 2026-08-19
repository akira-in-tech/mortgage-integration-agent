# mortgage-integration-agent

A vendor-neutral lending orchestration MVP that pulls simulated income, credit, and document-verification data in parallel and produces a structured loan-readiness result. It supports a deterministic rules provider and an optional local open-weight model through Ollama.

Built with NestJS, GraphQL, TypeORM, PostgreSQL, and Ollama-compatible local models. No paid AI API key is required.

> The current integrations and decisions are simulations for development and demonstration. They are not official lender, GSE, or automated underwriting system findings.

## Architecture

```text
                          ┌─────────────────────────────────────────────────┐
                          │           mortgage-integration-agent            │
                          │                                                 │
  Client (GraphQL)        │   ┌────────────┐      ┌──────────────────────┐  │
  ─────────────────────►  │   │   Loan     │      │    Agent Service     │  │
                          │   │  Resolver  │─────►│  (Orchestration      │  │
  query {                 │   └────────────┘      │   Core)              │  │
    evaluateLoan(input) { │                       └──────────┬───────────┘  │
      decision            │                                  │              │
      confidence          │              ┌───────────────────┼────────────┐ │
      reasoning           │              │      Promise.all  │            │ │
      conditions          │              ▼                   ▼            ▼ │
    }                     │   ┌──────────────┐  ┌────────────────┐  ┌──────────────┐ │
  }                       │   │   Plaid      │  │ Credit Bureau  │  │  Document    │ │
                          │   │  Service     │  │   Service      │  │  Service     │ │
                          │   │ (Income)     │  │ (FICO/DTI)     │  │  (IDP/OCR)   │ │
                          │   └──────┬───────┘  └───────┬────────┘  └──────┬───────┘ │
                          │          └──────────────────┼───────────────────┘ │
                          │                             │                     │
                          │                             ▼                      │
                          │              ┌─────────────────────────┐           │
                          │              │ Decision Provider       │           │
                          │              │ rules | local Ollama    │           │
                          │              │                         │           │
                          │              │  Underwriting prompt +  │           │
                          │              │  borrower data ->       │           │
                          │              │  JSON decision          │           │
                          │              └────────────┬────────────┘           │
                          │                           │                        │
                          │                           ▼                        │
                          │              ┌─────────────────────────┐           │
                          │              │   PostgreSQL (TypeORM)  │           │
                          │              │   loan_applications     │           │
                          │              │   + raw JSONB audit log │           │
                          │              └─────────────────────────┘           │
                          └─────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| API | GraphQL (code-first), Apollo Server |
| Framework | NestJS 11 |
| Language | TypeScript 6 (strict mode) |
| Decisioning | Deterministic rules or local Ollama + Qwen3.5 |
| ORM | TypeORM 0.3 |
| Database | PostgreSQL 15+ |
| Validation | class-validator, class-transformer |
| Testing | Jest |

## Demo

**No API key, no database, no setup:**

```bash
npm install
npm run demo
```

```text
  Mortgage Integration Agent  demo mode
  Rule-based underwriter · no API key required · no database

  ────────────────────────────────────────────────────────────────
  Sarah Chen  (CONVENTIONAL · $420,000)
  ────────────────────────────────────────────────────────────────
  Decision    ✓ APPROVED
  Confidence  ██████████████████████░░ 94%
  Strong application: score 745 with excellent payment history, DTI 31.0%,
  verified income $150,000/yr, all documents valid.

  Integration data  (fetched in parallel)
    Plaid    $150,000/yr · FULL TIME · stability 94/100
    Credit   score 745 · DTI 31.0% · excellent history · 0 derog
    Docs     all valid

  ────────────────────────────────────────────────────────────────
  Marcus Rivera  (FHA · $285,000)
  ────────────────────────────────────────────────────────────────
  Decision    ◐ CONDITIONAL
  Confidence  ██████████████░░░░░░░░░░ 60%
  ...
```

**Full GraphQL playground via Docker (recommended):**

```bash
# Deterministic rules — no model or API key required
docker-compose up

# Local open-weight model — Ollama must be running on the host
DECISION_PROVIDER=ollama docker-compose up
```

Open **<http://localhost:3000/graphql>** once the app is running.

## Setup (local, without Docker)

**Prerequisites:** Node.js 24+, PostgreSQL 15+. Ollama is optional.

```bash
npm install
createdb mortgage_agent
# Copy .env.example to .env and set DATABASE_URL
npm run start:dev
```

To use the local AI provider:

```bash
ollama pull qwen3.5:9b
ollama serve
DECISION_PROVIDER=ollama npm run start:dev
```

`qwen3.5:9b` is the default local model. It supports tool-oriented workflows, structured responses, and future document-image inputs while remaining practical on a 16 GB Apple Silicon development machine. On a lower-memory machine, set `OLLAMA_MODEL=qwen3.5:4b`.

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgres://` or `postgresql://`) |
| `NODE_ENV` | No | `development` (default) / `test` / `staging` / `production` |
| `PORT` | No | TCP port, `1`-`65535`; defaults to `3000` |
| `DECISION_PROVIDER` | No | `rules` (default) or `ollama` |
| `OLLAMA_BASE_URL` | With `ollama` | Local Ollama endpoint; defaults to `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | With `ollama` | Local model tag; defaults to `qwen3.5:9b` |
| `OLLAMA_TIMEOUT_MS` | No | Positive request timeout in milliseconds; defaults to `60000` |
| `CORS_ALLOWED_ORIGINS` | No | Comma-separated `http(s)://` origins; unset allows any `http://localhost:<port>` in development and none elsewhere |
| `RATE_LIMIT_TTL_MS` | No | Rate-limit window in milliseconds; defaults to `60000` |
| `RATE_LIMIT_MAX` | No | Max requests per client IP per window (all routes except `/health/*`); defaults to `100` |
| `TEMPORAL_ADDRESS` | No | Temporal frontend host:port; defaults to `localhost:7233` |
| `TEMPORAL_NAMESPACE` | No | Temporal namespace; defaults to `default` |
| `OUTBOX_SIGNING_SECRET` | No | HMAC secret for signed outbox events (see below); the default is for local development only |

All variables above are validated at startup (`src/config/env.validation.ts`); a missing or malformed value fails immediately with every problem listed at once, instead of surfacing later as a database or server error. `NODE_ENV=production` disables the GraphQL playground/introspection and TypeORM schema auto-synchronization — see [Database migrations](#database-migrations).

When `DECISION_PROVIDER=ollama`, the app logs the selected local model and endpoint. Ollama structured output is constrained by a JSON schema and then validated again before the result is accepted.

### Database migrations

Local development (`NODE_ENV=development`, the default) still auto-synchronizes the schema from entities — `createdb mortgage_agent && npm run start:dev` above is unchanged. Any environment running with `NODE_ENV=production` has auto-sync disabled and must have its schema created by migrations instead:

```bash
npm run migration:run       # apply pending migrations
npm run migration:revert    # roll back the most recently applied migration
npm run migration:generate -- src/database/migrations/<Name>   # after changing an entity, against an up-to-date target database
```

Migrations live in `src/database/migrations/`; the CLI reads connection settings from `DATABASE_URL` via `src/database/data-source.ts`, a standalone `DataSource` kept separate from `AppModule` because the CLI runs outside Nest's dependency-injection container.

**Production only, the application's own runtime role (M5-003).** The `AppRuntimeRole` migration provisions `mortgage_app`: a real, restricted PostgreSQL role with plain `SELECT/INSERT/UPDATE/DELETE` grants and no DDL rights at all — no `CREATE`, no `SUPERUSER`, no `BYPASSRLS`. Set `APP_DATABASE_URL` to that role's connection string and `NODE_ENV=production`, and `createTypeOrmOptions` uses it for the app/worker's own runtime queries instead of `DATABASE_URL`'s role. This is the fix for M5-002's own headline caveat: PostgreSQL superusers (which `DATABASE_URL`'s role is, by default, in this project's own `docker-compose.yml`) unconditionally bypass row-level security, so without this, none of the RLS policies below (webhooks, or M5-004's case-conditions core) ever actually apply to a single query the running application issues. Deliberately production-only, not the local dev default — `NODE_ENV=development`'s `synchronize: true` above needs real DDL rights, so it keeps using `DATABASE_URL`'s role exactly as before; local `docker-compose up` is unaffected. If `APP_DATABASE_URL` is unset in production, the app still boots (falls back to `DATABASE_URL`) but logs a startup warning, since a silent fallback here would quietly reopen the exact gap this migration exists to close. See `docs/DEVELOPMENT_LOG.md`'s M5-002/M5-003 entries for the full story, including a real Postgres GUC-casting bug this migration's own proof test found along the way.

### Health checks

- `GET /health/live` — process is up; no dependency checks.
- `GET /health/ready` — process is up and the database is reachable; returns `503` otherwise.

Both are exempt from rate limiting so frequent infra polling can't report a healthy instance as unavailable.

### Temporal worker

Durable, long-running case work (starting with the M2 conditions workflow — collecting evidence, opening a condition, and durably waiting on a reviewer's `resolveCondition` signal, surviving process restarts in between) runs on [Temporal](https://temporal.io) rather than in-process. This splits the app into two processes that share the same database and codebase but have distinct responsibilities:

- **API process** (`npm run start:dev` / `node dist/main`) — GraphQL/REST entry points; starts workflows and delivers signals via `TemporalClientService`, but never executes workflow or activity code itself.
- **Worker process** (`npm run start:worker:dev` / `node dist/worker`) — polls the `case-conditions` task queue and executes workflow and activity code. Stateless and horizontally scalable; if it crashes or restarts, Temporal replays in-flight workflows from their persisted history rather than losing progress.

`docker-compose up` starts a local Temporal server (`temporalio/auto-setup`, backed by the same Postgres instance under separate `temporal`/`temporal_visibility` databases) plus both the `app` and `worker` services. Outside Docker, run a Temporal dev server (`temporal server start-dev`, or `docker compose up temporal`) and then `npm run start:worker:dev` alongside `npm run start:dev`.

### Authentication and tenant isolation (Section 20 M5)

Every route under `/v1/loan-cases`, `/v1/webhook-endpoints`, and `/v1/webhook-deliveries` requires an `Authorization: Bearer {clientId}.{secret}` header — a Section 20 M5 "scoped API-client" credential (`ApiClient`, `src/auth/`), checked by `ApiKeyGuard` before the request ever reaches a controller. There is no self-service credential endpoint (the same honest gap tenant creation itself already has): `npm run create-api-client -- <tenantId> <name>` mints one and prints its bearer token exactly once. The tenant a client acts as is fixed by its own credential — `CreateCaseDto`/`CreateWebhookEndpointDto` have no `tenantId` field at all, so there is nothing left for a request body to get right or wrong. A case (or webhook endpoint, or delivery) owned by a different tenant 404s exactly like a nonexistent one would; there is no separate 403 that would leak whether the resource exists. Full OIDC/FAPI 2.0 (Section 20 M5's other named target) and RBAC roles are not attempted here — this is deliberately the smallest real slice that closes the actual gap this codebase had (zero authentication, a plain `tenantId` request field anyone could set to anyone's tenant), not the whole milestone. See `docs/DEVELOPMENT_LOG.md`'s M5-001 entry for the full scope decision and a real NestJS testing-injector quirk this slice found and worked around.

**PostgreSQL row-level security (M5-002/M5-004/M5-006 through M5-010) — `webhook_endpoints`/`webhook_deliveries`, `loan_cases`, `evidence_facts`, `outbox_events`, `condition_transitions`, `loan_conditions`, `agent_runs`, `tool_attempts`, `evaluation_input_manifests`, `policy_change_impact_assessments`, `communication_messages`, `communication_templates`, `case_policy_snapshots`, and `case_policy_bindings` — effectively the entire case-conditions core and its audit trails — and it requires a non-superuser database role to actually do anything.** `src/database/tenant-context.ts`'s `runInTenantContext`/`runWithRlsBypass` set a per-transaction Postgres session variable (`app.current_tenant_id`, or an explicit `app.bypass_rls` opt-out for the handful of queries that are genuinely cross-tenant by design — `WebhookDispatchService`'s due-delivery and unpublished-event scans, `PolicyChangeImpactService`'s catalog-wide impact scan) that a `FORCE ROW LEVEL SECURITY` policy on each table reads; a connection that calls neither sees zero rows, not an error and not a leak. **The connecting role matters more than the policy SQL**: PostgreSQL superusers unconditionally bypass row-level security, full stop, regardless of `FORCE ROW LEVEL SECURITY` — and the `mortgage` role this project's own `docker-compose.yml`/`.env.example` `DATABASE_URL` convention connects as (via `POSTGRES_USER` on the stock `postgres` image) *is* a superuser. M5-003 (below) closes that gap for production. `condition_transitions` and `tool_attempts` have no `tenantId` column of their own — their policies resolve tenant ownership through a join (to `loan_conditions` and `agent_runs`, respectively). `case-timeline.service.ts` (`GET .../timeline`) was the one real gap M5-006 found and closed: it read `agent_runs`/`loan_conditions`/`tool_attempts` with bare, unwrapped queries even after M5-004 protected the rest of the core. M5-007 protected `evaluation_input_manifests`; M5-008 protected `policy_change_impact_assessments`; M5-009 protected `communication_messages`/`communication_templates` and fixed `send_information_request`'s tool wrapper to thread its own already-available `tenantId` through instead of discarding it. M5-010 protected `case_policy_snapshots`/`case_policy_bindings` (`PolicyEvaluationService`'s own tables) — the trickiest of this whole series: `evaluate()`'s concurrency-recovery path (a real unique-constraint race, Section 20's exit evidence H) reads back a winning row inside a `catch` block, so wrapping the whole method in one shared transaction would abort it the moment the constraint violation fired and break that recovery read — the identical class of bug M5-002/M5-003 found for `DROP ROLE`'s own error handling. Fixed by keeping each step in its own separate transaction, verified by actually running the concurrency tests (not just reasoning about it) before considering the slice done. All of M5-007 through M5-010 were verified against the real refactored service code under the restricted role — M5-010 could use a genuine live HTTP-driven run (`evaluate_policy` is a registered Agent tool), while M5-008/M5-009's tools aren't wired into the live graph yet, so those needed a standalone script instead — since the isolated RLS-policy spec alone can't prove a service is actually wired to its policy correctly. Deliberately still out of scope: `communication_approvals` (its sole writer has no `tenantId` in its signature and no real caller yet to define one) and `provider_operation_intents`/`provider_authorization_grants` (several methods don't have `tenantId` in scope yet) — see `docs/DEVELOPMENT_LOG.md`'s M5-004 and M5-006 through M5-010 entries for exactly why each is deferred and what real live-workflow proofs demonstrated along the way, including a real production-code concurrency bug (`Promise.all` racing two queries on one connection) M5-004's own proof test caught.

**Consent enforcement (M5-005) — Section 6.3's own top-priority authority-order item: "Consent, authorization, and security controls may stop processing."** `consent_records` (RLS-protected from the migration that created it, unlike the retrofitted tables above) backs `LendingOperationsAgentState.consentStatus` with real data for the first time — `case-conditions.activities.ts`'s `evaluateConditions` used to hardcode `'VALID'` because no consent-tracking entity existed, which meant the LangGraph runtime's own `verifyConsent` node (built in M3-009, genuinely wired as the graph's first step) was real, tested code that could never actually fail in production. Every new case gets an implicit `GRANTED` consent record automatically at creation (applying for a mortgage is itself the act of consenting to the processing that evaluates it — this keeps case creation behaviorally unchanged for every existing caller); `POST .../consents` with `{action: "REVOKE"}` is the new real capability, and a case whose consent is revoked routes to `MANUAL_REVIEW` the next time its evaluation runs. `ProviderAuthorizationService.revalidate()` also now confirms a grant's referenced consent record is still granted and unrevoked (Section 11.5) immediately before every provider dispatch — a revalidation failure (mismatched, expired, revoked grant, or now an invalidated consent reference) is classified `ApplicationFailure.nonRetryable`, the same terminal treatment a permanent provider rejection already gets, so Temporal doesn't waste attempts retrying something that can never succeed. Deliberately not implemented: Section 14.2's third consequence of revocation, "opens a data-disposition review for evidence already collected" — this closes the "stop new processing" requirement, not evidence lifecycle management. See `docs/DEVELOPMENT_LOG.md`'s M5-005 entry for the full story, including a real live-workflow proof and what its own generic error-reporting revealed as a pre-existing, separately-scoped gap.

### Case REST API

A narrower slice of the target `/v1/loan-cases` contract (see the project charter, Section 15.1) — enough to create a case and drive it through the M2 conditions workflow from outside the process. Every route below requires the bearer credential described above; `tenantId` in the table below is always the one that credential resolves to, never a request field.

| Method & path | Purpose |
| --- | --- |
| `POST /v1/loan-cases` | Create a case (`{ borrowerId, requestedAmount, loanType, statedMonthlyIncome, jurisdictionCode }`). Requires an `Idempotency-Key` header; a repeated key returns the original case instead of creating a duplicate. `jurisdictionCode` must reference a row in the jurisdiction catalog (404 otherwise). |
| `GET /v1/loan-cases/{caseId}` | Fetch a case. |
| `GET /v1/loan-cases/{caseId}/timeline` | The case's full chronological history — every domain event from `outbox_events` plus every persisted Agent run and its tool-by-tool outcomes, merged and sorted by timestamp (see Agent run timeline below). |
| `POST /v1/loan-cases/{caseId}/workflow-runs` | Start the case-conditions workflow. `202 Accepted`; safe to retry — a case with a workflow already running returns that same run rather than starting a second one. |
| `GET /v1/loan-cases/{caseId}/workflow-runs/{runId}` | Current Temporal status of that run. |
| `POST /v1/loan-cases/{caseId}/reviews` | A reviewer action, discriminated by `reviewType`: `{ reviewType: "CONDITION_RESOLUTION", actorId, resolution: "SATISFIED" \| "WAIVED", reason? }` resolves the case's open condition (the `resolveCondition` signal); `{ reviewType: "RESUME_EVALUATION", actorId, reason? }` resumes an evaluation the Agent run interrupted for policy-applicability ambiguity (the `resumeInterruptedEvaluation` signal — see Agent runtime below). `202 Accepted`. |
| `POST /v1/loan-cases/{caseId}/consents` | Grant or revoke consent (M5-005): `{ action: "GRANT" \| "REVOKE", reason? }`. Synchronous (not a Temporal signal) — returns the resulting `ConsentRecord` directly, `201 Created`. See "Consent enforcement" below. |

There is no `/v1/loan-cases` endpoint for creating a tenant itself; seed one directly via the `tenants` table for local use, same as before.

### OpenAPI contract, generated client, and quickstart (Section 15.3, M4-003)

This REST surface is `@nestjs/swagger`-decorated with explicit, stable `operationId`s (Section 15.3: "stable operation identifiers for SDK generation") — `npm run generate:openapi` boots the real app and writes the resulting document to the checked-in `openapi/openapi.json` (Section 15.3: "checked and published OpenAPI artifact"); `npm run generate:client` runs [`openapi-typescript`](https://openapi-ts.dev) against that file to produce a genuinely generated `client/generated/schema.d.ts`, which `client/index.ts` (a thin [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) wrapper) uses to make every call fully typed. In development, the API server also serves an interactive Swagger UI at `/api-docs` — gated to `NODE_ENV=development` for the same reason the GraphQL Playground already is (charter 16.1: interactive documentation leaks the full surface to anyone who can reach it). `client/quickstart.ts` (`npm run quickstart`) is the concrete realization of Section 20's M4 exit evidence, "generated client completes the published quickstart": it drives a real case through creation, workflow start, condition-opening, reviewer resolution, and completion using only the generated client against a real running API + Temporal worker — see `docs/QUICKSTART.md` for the full walkthrough. The artifact now also documents the webhook-endpoint and webhook-delivery routes (M4-004, below); the rest of Section 15.1's target partner API (consents, documents, conditions/evidence listing, policy snapshots, provider operations, audit export) still doesn't exist and isn't represented in the artifact.

### Policy-driven conditions

The case-conditions workflow's decision to open a condition is no longer a hardcoded rule — it's driven by a bounded Agent run (`src/agent-runtime/langgraph/`, see below) that in turn calls the policy engine (`src/policy/`): `evaluate_policy` calls `PolicyEvaluationService` (Section 10.4's binding-validation guard), which resolves which released policy version(s) apply to the case's jurisdiction/product/lifecycle event, persists an immutable `CasePolicySnapshot`, and binds the case to it (`CasePolicyBinding`) so a later evaluation with an unchanged policy state reuses that snapshot instead of creating a duplicate. Each resolved rule is then evaluated against the case's real evidence. The database ships seeded with the charter's own canonical example (`docs/PROJECT_CHARTER.md` Section 10.7): a `US-CA` / `CONVENTIONAL_MORTGAGE` / `UNDERWRITING_REVIEW` rule that opens a `VERIFY_INCOME_DISCREPANCY` condition when a case's `statedMonthlyIncome` differs from Plaid's verified income by more than 10%. A case whose jurisdiction has no reviewed policy coverage, or whose applicable policy is ambiguous (overlapping released versions), interrupts for review (`WAITING_FOR_REVIEW`, see the reviews table above) rather than guessing.

`PolicyEvaluationService`'s reuse decision is a real fast path (Section 10.4): a global `PolicyCatalogGeneration` counter bumps on every real policy activation/withdrawal (`PolicyActivationService`), and a case's binding skips calling the resolver entirely when its `observedCatalogGeneration`/`contextKey` still match — no I/O beyond a snapshot read. Activating or withdrawing a policy version also runs `PolicyChangeImpactService` (Section 10.6): it finds every open case the change could affect, dry-runs the resolver against each, and persists an advisory `PolicyChangeImpactAssessment` (`NO_IMPACT` / `REQUIRES_REEVALUATION` / `AMBIGUOUS`) — it never touches the case's own binding, only records what a re-evaluation would find. `check_policy_change_impact` (an Agent tool) wraps a case-scoped counterpart, `assessImpactForCase()`, letting one case ask the same question on demand. `PolicyActivationService.activate()` now requires a real, independently-approved `PolicyTransitionApproval` first (Section 16.1: "separate policy-author and policy-approver roles") — `PolicyTransitionApprovalService.propose()`/`approve()` reject self-approval (the same actor id cannot do both) with no formal RBAC system behind it, since none exists anywhere in this codebase yet. None of these services have a REST/GraphQL surface yet; all are exercised by real-database tests (`src/policy/policy-activation.service.spec.ts`). `CasePolicyBinding` is guarded by a real partial unique index (`IDX_case_policy_bindings_one_active`, one active row per case) — two concurrent `evaluate()` calls for the same case now provably converge on exactly one binding instead of racing to both insert one; see `policy-evaluation.service.spec.ts`'s `concurrency` tests, which are instrumented to genuinely force the race rather than hope timing cooperates.

### Evaluation input manifest (Section 10.5)

`EvaluationInputManifest` (`src/database/entities/evaluation-input-manifest.entity.ts`) is a real, immutable, database-backed record of exactly what one evaluation read — assembled by `EvaluationManifestService` (`src/policy/evaluation-manifest.service.ts`) for every completed DSL evaluation in `resolveOutcomeNode`, not only ones that open a condition (M3-022): a case whose evidence matches expectations, or whose product has no applicable policy at all, gets a real manifest too, referenced by `LoanCondition.evaluationManifestId` only when a condition actually results. `caseVersion`, `policyBindingId`, `observedPolicyDependencyDigest`, `evaluatorVersion`, and `evidenceRefs` (with a real per-fact content hash) are all sourced from real data; `authorizationDecisionId`, `consentVersionRefs`, `calculationRefs`, and `modelAndPromptManifestId` stay null/empty because no authorization-grant, consent-versioning, calculation, or Agent model-call subsystem exists yet — matching this codebase's consistent rule of never fabricating a value for a field with no real backing subsystem. The one deliberate exception is a `REVIEW_REQUIRED` (policy-ambiguity) evaluation, which never gets a manifest since no binding exists yet to reference. This is a durable audit record, not a new enforcement gate: `create_condition`'s own `expectedCaseVersion` compare-and-swap is still what actually protects the write.

### Agent run timeline (Section 7.1, M3 scope)

Every `LendingOperationsAgentRuntime.run()` call now persists an `AgentRun` row (route, proposed action, review state) plus one `ToolAttempt` row per tool the run actually called (`agent-run.entity.ts`, `tool-attempt.entity.ts`) — closing a gap where the Agent's own run history existed only in memory and was discarded after every evaluation. `CaseTimelineService` (`src/cases/case-timeline.service.ts`) merges this with `outbox_events` into one chronological account, exposed via `GET /v1/loan-cases/{caseId}/timeline` above. A `condition.opened` entry is enriched with the condition's own real description (the policy DSL evaluator's reason string, e.g. `difference_percent(...) = 11.88% > 10%`) rather than restating the raw event payload — every summary is built from data already persisted for another reason, never a freshly generated narrative. Section 15.2 targets GraphQL for timeline queries; REST stands in for now, matching every other case endpoint in this controller.

### Transactional outbox

Every domain state change that matters externally (`loan_case.created`, `workflow_run.started`/`waiting_for_review`/`completed`/`failed`, `evidence.updated`, `condition.opened`/`satisfied`/`waived`) is written to the `outbox_events` table in the same database transaction as the change itself, HMAC-signed with `OUTBOX_SIGNING_SECRET`. This is the transactional-outbox pattern: a committed domain change and its event can never diverge, because they're the same transaction. `WebhookDispatchService` (M4-004, below) is the real dispatcher that reads from it — `publishedAt` now genuinely gets set once an event has been handed off to that subsystem.

### Webhook delivery (Section 14.1, M4-004)

`WebhookEndpoint`/`WebhookDelivery` (`src/database/entities/`) back Section 15.1's exact two webhook routes: `POST /v1/webhook-endpoints` registers a destination URL plus the exact `OutboxEventType`s it subscribes to, generating a real per-endpoint HMAC secret that's returned exactly once, in the creation response; `GET /v1/webhook-deliveries/{deliveryId}` reads back one delivery's full attempt history. `WebhookDispatchService` (`src/webhooks/webhook-dispatch.service.ts`) is the real dispatcher `outbox_events` never had before this slice: it sweeps unpublished events, fans each out to a `WebhookDelivery` row per currently-active subscribed endpoint, and attempts every due delivery with a real signed HTTP POST — `X-Webhook-Id` (stable across retries), `X-Webhook-Timestamp`, and `X-Webhook-Signature` (HMAC over `id.timestamp.body`, verifiable via the exported `verifyWebhookSignature`) together give a receiver genuine replay protection, not just a documented intent. A failed attempt retries with exponential backoff up to 5 attempts before the delivery reaches `FAILED_FINAL`; every attempt (status code, outcome, timestamp) is appended to the delivery's own `attempts` history, not just the most recent one. `worker.ts` runs the dispatch loop on a plain interval (`WEBHOOK_DISPATCH_INTERVAL_MS`, default 5s) — not a Temporal workflow, since a `WebhookDelivery` row already is the durable record of what's left to do; a crash between polls loses nothing. No SSRF/egress protection on `targetUrl`, no endpoint listing/update/delete surface, and no per-endpoint rate limiting exist yet (Known gaps — see `docs/DEVELOPMENT_LOG.md`'s M4-004 entry).

### Retry classification and fault injection

No real provider integration exists yet, so `case-conditions.activities.ts`'s evidence-fetch activities classify failures from the Plaid/credit/document simulators using a deterministic, opt-in trigger — a `SYNTHETIC-TRANSIENT-FAILURE-` or `SYNTHETIC-TERMINAL-FAILURE-` `borrowerId` prefix (see `src/integrations/synthetic-provider-failures.ts`), the same idea as a payment processor's test-mode card numbers. Transient failures are retried up to the workflow's configured policy (3 attempts, exponential backoff); terminal failures fail immediately, wasting no retries. Either way, an activity failure that survives retries routes the case to `MANUAL_REVIEW` and writes a `workflow_run.failed` outbox event, rather than crashing the workflow outright.

### Provider platform (Section 11, M4-001/M4-002/M4-005)

`src/provider-platform/` is Section 11's capability-contract layer, real but honestly scoped: `ProviderRegistryService` (`register()`/`resolve()` by capability+mode), `ProviderAuthorizationService` (issues a short-lived, case/borrower/provider/capability/purpose/data-class-bound `ProviderAuthorizationGrant`, and `revalidate()`s it immediately before every dispatch, failing closed on any mismatch, expiry, or revocation), and `ProviderOperationIntentService` (persists a `ProviderOperationIntent` row *before* dispatch, through `PREPARED` → `DISPATCHED` → `SUCCEEDED`/`FAILED_FINAL`/`OUTCOME_UNKNOWN`). `dispatch-provider-request.ts` is the generic pipeline every capability routes through: resolve the adapter, issue the grant, persist the intent, revalidate, dispatch, classify the outcome onto the intent. All five capabilities Section 7.2 names now have a real registered `SIMULATOR` adapter — `PlaidIncomeAdapter`, `CreditReportAdapter`, `DocumentVerificationAdapter`, `AssetVerificationAdapter`, `IdentityVerificationAdapter` — each wrapping its own simulator service unchanged; M4-002 and M4-005 added the latter four with no change to the registry, dispatch helper, or authorization/intent services, the concrete proof (not just an assertion) of Section 20's M4 exit evidence ("a new simulator adapter is added without domain or Agent changes"). `ProviderAdapterBootstrapService` registers every real adapter at process startup — adding a capability means one adapter class plus one `register()` call there. Asset and identity are deliberately *not* wired into `case-conditions.workflow.ts` or `check_case_completeness`'s required-evidence list (M4-005's own Known gap) — no real policy rule or Agent tool consumes that evidence yet, and fetching it into every case regardless would be inert scaffolding, not a real integration. `ProviderMode` names `AUTHORIZED_SANDBOX`/`PRODUCTION_BYOC` (Section 11.1's full vocabulary) but only `SIMULATOR` has a real implementation; promotion manifests, certification records, and two-person production-activation approval (Section 11.4/11.8) aren't built, since there's no second real provider mode yet to promote to. `ProviderAuthorizationGrant`'s `consentRecordIds`/`permissiblePurposeDecisionId`/`permittedFields` stay always-empty/null — no consent-record, permissible-purpose, or field-level-capability subsystem exists yet, the same honest-null pattern `EvaluationInputManifest` established. The older one-shot `evaluateLoan` path (`src/agent/agent.service.ts`) still calls the Plaid/credit/document simulator services directly, bypassing the registry entirely — that path predates Section 9's Agent-runtime rewrite and is out of this milestone's scope.

### Agent runtime (Section 9)

`src/agent-runtime/` holds the contract for the charter's stateful, tool-using Agent (Section 9) — distinct from the older `src/agent/` one-shot `evaluateLoan` decisioning path, a naming collision the charter's Section 9 rewrite introduced but that this codebase hasn't renamed away yet. `AgentRuntimePort` (`agent-runtime.types.ts`) is the interface `src/agent-runtime/langgraph/` implements (see below). `AgentTool` (`agent-tool.types.ts`) is the registered-tool contract from Section 9.4's table — `buildToolRegistry`/`invokeTool` never let an unregistered tool name or a tool's own exception escape as a throw, only as a typed `FAILURE` result. Seven of Section 9.4's sixteen tools are real: `check_case_completeness`, `evaluate_policy` (a thin wrapper over `PolicyEvaluationService`), `create_condition` (the actual implementation `case-conditions.activities.ts` calls to open a condition, which is also what closed a long-standing gap: `LoanCondition.policySnapshotId` is now genuinely populated), `draft_information_request` (drafts and classifies a communication via `src/communications/`, see below), `escalate_to_reviewer` (a CAS-protected transition to `WAITING_FOR_REVIEW` plus a signed `case.escalated` event — the Agent's own explicit "this needs a human" choice, distinct from the runtime's automatic ambiguity/failure routing), `check_policy_change_impact` (a thin wrapper over `PolicyChangeImpactService.assessImpactForCase()` — a new per-case entry point alongside the existing catalog-wide scan `PolicyActivationService` already triggers), and `send_information_request` (delivers a ready-to-send communication via `CommunicationDeliveryService`, see below). The rest of the table (document inspection, calculations, `publish_case_update`) needs a real provider adapter, calculation engine, or webhook subsystem that doesn't exist yet, and isn't stubbed. `draft_information_request`, `escalate_to_reviewer`, `check_policy_change_impact`, and `send_information_request` are real and independently tested but not wired into the live LangGraph graph — no current run scenario needs them yet.

`src/communications/` implements Section 6.4's protected/routine communication classification: `classifyCommunication()` (pure, no model) requires a version-pinned `APPROVED` `CommunicationTemplate`, matching channel/locale/recipient relationship, fully-declared variables, and no negative-implication keyword in any supplied variable value for a `ROUTINE` result — anything else is `PROTECTED`, with every failing reason recorded. `CommunicationApprovalService` binds a human's approval to the message's exact `renderedContentHash` (Section 6.4: "approve the exact rendered content") and is deliberately not an Agent tool, since Section 6.4 says the Agent cannot supply an approval result itself. `CommunicationDeliveryService` + `CommunicationDeliverySimulator` (M3-018) give messages a real delivery path — same simulator status as `PlaidService`/`CreditService`/`DocumentService`, not a real email/SMS channel: a message reaches `SENT` only via `ROUTINE`+`DRAFTED` or `PROTECTED`+`APPROVED`, anything else is rejected as not ready, structurally enforced by `send_information_request` (an Agent tool) rather than just documented.

`src/agent-runtime/langgraph/lending-operations-agent-runtime.ts` is `AgentRuntimePort`'s first implementation: a real, compiled LangGraph.js v1 `StateGraph` that orchestrates the three tools above in Section 9.5's Agent-loop order (verify consent → check completeness → request a guarded policy evaluation → propose/execute a condition transition), enforcing `allowedTools` by only registering the tools a run names and enforcing a trusted deadline plus step-count budget before every tool call. `case-conditions.activities.ts`'s `evaluateConditions` now calls this runtime instead of the policy engine and condition tool directly — the workflow itself is unchanged (it just calls the same activity), but that activity's decision is now genuinely produced by a bounded Agent run, per Section 9.2's runtime-separation design. Condition and case-readiness writes are compare-and-swap protected against `LoanCase.version` (Section 10.5): a write based on a stale evaluation is rejected and the whole evaluation retried, rather than silently overwriting a case that changed in the meantime. Policy-applicability ambiguity now genuinely interrupts (`INTERRUPTED_FOR_REVIEW`) rather than routing straight to `MANUAL_REVIEW`: the case moves to `WAITING_FOR_REVIEW`, and `case-conditions.workflow.ts` durably waits for a `RESUME_EVALUATION` review (see the REST table above) before re-running the whole evaluation — an unresolved ambiguity is something a reviewer can fix and retry, not a hard stop. Token/cost/provider-call budgets and most of Section 9.6's other trigger categories (no backing signal exists for them yet — see `docs/DEVELOPMENT_LOG.md` for exactly which) remain open.

Every mandatory-review trigger this runtime can detect (`mandatory-review-triggers.ts`) is classified through one shared table before it routes — `POLICY_AMBIGUITY` interrupts (resumable, per Section 9.5's own "ambiguity... interrupt for review"); `CONSENT_INVALID`, `BUDGET_OR_DEADLINE_EXHAUSTED`, and `TOOL_EXECUTION_FAILURE` route to manual review (terminal, per that same text's "budget or runtime failure"). The classification, not just the free-text reason, is persisted (`AgentRun.reviewCategory`) and surfaced in the case timeline, so a reviewer or auditor can filter by which Section 9.6 concern triggered a run without parsing prose.

## Example Mutation

```graphql
mutation {
  evaluateLoan(input: {
    borrowerId: "B001"
    requestedAmount: 450000
    loanType: CONVENTIONAL
  }) {
    applicationId
    decision
    confidence
    reasoning
    incomeVerified
    creditScore
    documentsValid
    conditions
    createdAt
  }
}
```

The following examples show the response contract. Exact reasoning varies by provider and generated borrower scenario.

### CONDITIONAL — High credit score, DTI exceeds guideline

```json
{
  "data": {
    "evaluateLoan": {
      "applicationId": "670756c8-0432-4a71-b665-b463f283cd60",
      "decision": "CONDITIONAL",
      "confidence": 0.78,
      "reasoning": "Borrower presents a strong credit score of 759 and an excellent loan-to-income ratio of 1.94x, well within the 4.5x threshold. However, the DTI of 46.0% exceeds the conventional standard limit of 43% (though remains below the 50% denial threshold), placing this application in conditional territory. Additionally, the FAIR payment history and 2 derogatory marks on the credit report introduce elevated risk that must be addressed, particularly given the self-employed income status which warrants additional income documentation scrutiny.",
      "incomeVerified": true,
      "creditScore": 759,
      "documentsValid": true,
      "conditions": [
        "DTI of 46.0% exceeds conventional guideline of 43%; borrower must provide a letter of explanation and evidence of compensating factors",
        "Two derogatory marks on credit report require written explanation letters detailing the nature, date, and resolution status of each item",
        "Self-employed status requires 2 years of signed federal tax returns and a year-to-date profit and loss statement prepared by a licensed CPA"
      ],
      "createdAt": "2026-06-28T12:12:08.123Z"
    }
  }
}
```

### DENIED — Credit score below JUMBO minimum

```json
{
  "data": {
    "evaluateLoan": {
      "applicationId": "e8106610-f0f0-4b1f-8fdc-0e562ca8fc6c",
      "decision": "DENIED",
      "confidence": 0.97,
      "reasoning": "This application is denied primarily because the borrower's credit score of 598 falls significantly below the JUMBO loan minimum requirement of 720. JUMBO loan guidelines are strictly enforced and require both a credit score ≥ 720 and DTI ≤ 0.38; this borrower meets neither threshold. While the DTI of 21.0%, loan-to-income ratio of 2.44x, and document validity are all strong positives, the credit score deficiency for a JUMBO product is a disqualifying condition that cannot be conditionally remediated without a fundamental improvement in the borrower's credit profile.",
      "incomeVerified": true,
      "creditScore": 598,
      "documentsValid": true,
      "conditions": [],
      "createdAt": "2026-06-28T12:13:09.007Z"
    }
  }
}
```

## Tests

End-to-end tests use the configured decision provider and require a live database. They default to the deterministic rules provider, so no model or API key is required:

```bash
# Set DATABASE_URL in .env, then:
npm run test:e2e
```

Tests are automatically skipped with a warning if either env var is missing.

The Temporal workflow and activities suites (`src/workflows/*.spec.ts`) follow the same convention: they run against a real Temporal server and database when `TEMPORAL_ADDRESS`/`DATABASE_URL` are set, and skip otherwise.

### Evaluation corpus (Section 18.2)

```bash
# Set DATABASE_URL in .env, then:
npm run evaluate
```

Drives every fixture in `evaluation/cases/*.json` through the real `case-conditions.activities.ts` functions (the same code the M2 Temporal workflow calls, no Temporal server required) against a real database, then writes a reproducible JSON report to `evaluation/reports/` (gitignored — a report is a snapshot of one run, not durable source content) with per-category pass counts, condition precision/recall, and pinned git commit + released policy version ids. Exits non-zero if any case fails, so it's usable as a CI gate. 12 real cases across `normal`/`boundary`/`missing-data`/`policy-coverage`/`provider-failure` categories — deliberately not Section 18.2's full 150-case target, since this codebase has exactly one seeded synthetic policy rule to test meaningful variation against; `contradiction`/`adversarial` categories are omitted rather than faked, since no contradiction detector or model-facing surface exists yet to genuinely check against. See `docs/DEVELOPMENT_LOG.md`'s M3-019 entry for the full reasoning, including a real gap the corpus itself surfaced: `evaluateConditions` doesn't currently distinguish "evidence was missing" from "evidence was fine" in its return value — both collapse to the same no-condition outcome.

## Design Notes

The three integration calls (Plaid, credit bureau, document parser) run in parallel via `Promise.all` before decisioning. This keeps latency low since the integrations are independent of each other.

All raw integration responses are stored as JSONB alongside each result. This makes it straightforward to audit what data the selected provider saw for any given application.

The default `rules` provider is deterministic and runs fully locally. The optional `ollama` provider uses an open-weight local model and never sends borrower data to a paid cloud-model API.
