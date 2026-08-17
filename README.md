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

### Health checks

- `GET /health/live` — process is up; no dependency checks.
- `GET /health/ready` — process is up and the database is reachable; returns `503` otherwise.

Both are exempt from rate limiting so frequent infra polling can't report a healthy instance as unavailable.

### Temporal worker

Durable, long-running case work (starting with the M2 conditions workflow — collecting evidence, opening a condition, and durably waiting on a reviewer's `resolveCondition` signal, surviving process restarts in between) runs on [Temporal](https://temporal.io) rather than in-process. This splits the app into two processes that share the same database and codebase but have distinct responsibilities:

- **API process** (`npm run start:dev` / `node dist/main`) — GraphQL/REST entry points; starts workflows and delivers signals via `TemporalClientService`, but never executes workflow or activity code itself.
- **Worker process** (`npm run start:worker:dev` / `node dist/worker`) — polls the `case-conditions` task queue and executes workflow and activity code. Stateless and horizontally scalable; if it crashes or restarts, Temporal replays in-flight workflows from their persisted history rather than losing progress.

`docker-compose up` starts a local Temporal server (`temporalio/auto-setup`, backed by the same Postgres instance under separate `temporal`/`temporal_visibility` databases) plus both the `app` and `worker` services. Outside Docker, run a Temporal dev server (`temporal server start-dev`, or `docker compose up temporal`) and then `npm run start:worker:dev` alongside `npm run start:dev`.

### Case REST API

A narrower slice of the target `/v1/loan-cases` contract (see the project charter, Section 15.1) — enough to create a case and drive it through the M2 conditions workflow from outside the process:

| Method & path | Purpose |
| --- | --- |
| `POST /v1/loan-cases` | Create a case (`{ tenantId, borrowerId, requestedAmount, loanType, statedMonthlyIncome, jurisdictionCode }`). Requires an `Idempotency-Key` header; a repeated key returns the original case instead of creating a duplicate. `jurisdictionCode` must reference a row in the jurisdiction catalog (404 otherwise). |
| `GET /v1/loan-cases/{caseId}` | Fetch a case. |
| `POST /v1/loan-cases/{caseId}/workflow-runs` | Start the case-conditions workflow. `202 Accepted`; safe to retry — a case with a workflow already running returns that same run rather than starting a second one. |
| `GET /v1/loan-cases/{caseId}/workflow-runs/{runId}` | Current Temporal status of that run. |
| `POST /v1/loan-cases/{caseId}/reviews` | A reviewer action, discriminated by `reviewType`: `{ reviewType: "CONDITION_RESOLUTION", actorId, resolution: "SATISFIED" \| "WAIVED", reason? }` resolves the case's open condition (the `resolveCondition` signal); `{ reviewType: "RESUME_EVALUATION", actorId, reason? }` resumes an evaluation the Agent run interrupted for policy-applicability ambiguity (the `resumeInterruptedEvaluation` signal — see Agent runtime below). `202 Accepted`. |

No authentication or tenant-scoped access control exists yet (`tenantId` is a plain request field) — full RBAC/RLS is M5 scope. There is also no `/v1/loan-cases` endpoint for creating a tenant itself; seed one directly via the `tenants` table for local use.

### Policy-driven conditions

The case-conditions workflow's decision to open a condition is no longer a hardcoded rule — it's driven by a bounded Agent run (`src/agent-runtime/langgraph/`, see below) that in turn calls the policy engine (`src/policy/`): `evaluate_policy` calls `PolicyEvaluationService` (Section 10.4's binding-validation guard, simplified — see `docs/DEVELOPMENT_LOG.md`), which resolves which released policy version(s) apply to the case's jurisdiction/product/lifecycle event, persists an immutable `CasePolicySnapshot`, and binds the case to it (`CasePolicyBinding`) so a later evaluation with an unchanged policy state reuses that snapshot instead of creating a duplicate. Each resolved rule is then evaluated against the case's real evidence. The database ships seeded with the charter's own canonical example (`docs/PROJECT_CHARTER.md` Section 10.7): a `US-CA` / `CONVENTIONAL_MORTGAGE` / `UNDERWRITING_REVIEW` rule that opens a `VERIFY_INCOME_DISCREPANCY` condition when a case's `statedMonthlyIncome` differs from Plaid's verified income by more than 10%. A case whose jurisdiction has no reviewed policy coverage, or whose applicable policy is ambiguous (overlapping released versions), routes to `MANUAL_REVIEW` instead of guessing.

### Transactional outbox

Every domain state change that matters externally (`loan_case.created`, `workflow_run.started`/`waiting_for_review`/`completed`/`failed`, `evidence.updated`, `condition.opened`/`satisfied`/`waived`) is written to the `outbox_events` table in the same database transaction as the change itself, HMAC-signed with `OUTBOX_SIGNING_SECRET`. This is the transactional-outbox pattern: a committed domain change and its event can never diverge, because they're the same transaction. There is no dispatcher yet — `outbox_events.publishedAt` stays `null` — actual webhook delivery to subscribers is M4 scope; this is the durable, signed foundation it will read from.

### Retry classification and fault injection

No real provider integration exists yet, so `case-conditions.activities.ts`'s evidence-fetch activities classify failures from the Plaid/credit/document simulators using a deterministic, opt-in trigger — a `SYNTHETIC-TRANSIENT-FAILURE-` or `SYNTHETIC-TERMINAL-FAILURE-` `borrowerId` prefix (see `src/integrations/synthetic-provider-failures.ts`), the same idea as a payment processor's test-mode card numbers. Transient failures are retried up to the workflow's configured policy (3 attempts, exponential backoff); terminal failures fail immediately, wasting no retries. Either way, an activity failure that survives retries routes the case to `MANUAL_REVIEW` and writes a `workflow_run.failed` outbox event, rather than crashing the workflow outright.

### Agent runtime (Section 9)

`src/agent-runtime/` holds the contract for the charter's stateful, tool-using Agent (Section 9) — distinct from the older `src/agent/` one-shot `evaluateLoan` decisioning path, a naming collision the charter's Section 9 rewrite introduced but that this codebase hasn't renamed away yet. `AgentRuntimePort` (`agent-runtime.types.ts`) is the interface a future LangGraph.js v1 adapter will implement; nothing implements it yet. `AgentTool` (`agent-tool.types.ts`) is the registered-tool contract from Section 9.4's table — `buildToolRegistry`/`invokeTool` never let an unregistered tool name or a tool's own exception escape as a throw, only as a typed `FAILURE` result. Three of Section 9.4's sixteen tools are real: `check_case_completeness`, `evaluate_policy` (a thin wrapper over `PolicyEvaluationService`), and `create_condition` — the last one is the actual implementation `case-conditions.activities.ts` calls to open a condition, not a parallel stub, which is also what closed a long-standing gap: `LoanCondition.policySnapshotId` is now genuinely populated. The rest of the table (document inspection, calculations, communication tools, escalation) has no backing capability yet and isn't stubbed.

`src/agent-runtime/langgraph/lending-operations-agent-runtime.ts` is `AgentRuntimePort`'s first implementation: a real, compiled LangGraph.js v1 `StateGraph` that orchestrates the three tools above in Section 9.5's Agent-loop order (verify consent → check completeness → request a guarded policy evaluation → propose/execute a condition transition), enforcing `allowedTools` by only registering the tools a run names and enforcing a trusted deadline plus step-count budget before every tool call. `case-conditions.activities.ts`'s `evaluateConditions` now calls this runtime instead of the policy engine and condition tool directly — the workflow itself is unchanged (it just calls the same activity), but that activity's decision is now genuinely produced by a bounded Agent run, per Section 9.2's runtime-separation design. Condition and case-readiness writes are compare-and-swap protected against `LoanCase.version` (Section 10.5): a write based on a stale evaluation is rejected and the whole evaluation retried, rather than silently overwriting a case that changed in the meantime. Policy-applicability ambiguity now genuinely interrupts (`INTERRUPTED_FOR_REVIEW`) rather than routing straight to `MANUAL_REVIEW`: the case moves to `WAITING_FOR_REVIEW`, and `case-conditions.workflow.ts` durably waits for a `RESUME_EVALUATION` review (see the REST table above) before re-running the whole evaluation — an unresolved ambiguity is something a reviewer can fix and retry, not a hard stop. Token/cost/provider-call budgets and most of Section 9.6's other trigger categories (no backing signal exists for them yet — see `docs/DEVELOPMENT_LOG.md` for exactly which) remain open.

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

## Design Notes

The three integration calls (Plaid, credit bureau, document parser) run in parallel via `Promise.all` before decisioning. This keeps latency low since the integrations are independent of each other.

All raw integration responses are stored as JSONB alongside each result. This makes it straightforward to audit what data the selected provider saw for any given application.

The default `rules` provider is deterministic and runs fully locally. The optional `ollama` provider uses an open-weight local model and never sends borrower data to a paid cloud-model API.
