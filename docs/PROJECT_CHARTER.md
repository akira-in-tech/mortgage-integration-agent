# Mortgage Integration Agent — Project Charter

> AI-assisted Loan Readiness & Integration Orchestration Platform

| Field | Value |
|---|---|
| Document status | Target-state charter; approved implementation plan, not a claim of current production readiness |
| Version | 1.0 |
| Date | 2026-08-14 |
| Maintainer | Repository owner |
| Repository | `mortgage-integration-agent` |
| Delivery model | Free local development, synthetic-data launch demo, productizable provider adapters |

## 1. Charter purpose

This charter defines the product, technical architecture, delivery plan, operating model, and launch gates required to turn the current mortgage orchestration MVP into a production-quality Fintech portfolio product.

It is the source of truth for target scope. It deliberately separates the current implementation from planned capabilities.

Status labels used throughout this document:

- **Implemented**: present in the repository and previously validated.
- **In progress**: local changes exist but have not yet been published as a completed release.
- **Planned**: target capability; it must not be described as implemented on a resume, README, demo, or interview.

## 2. Executive summary

Mortgage Integration Agent is a vendor-neutral platform for assembling a loan case, checking data completeness, orchestrating financial-data providers, explaining findings, requesting missing information, and routing cases to human reviewers.

The platform is **mortgage-first and lending-extensible**. It is not a lender, credit bureau, automated underwriting system, or replacement for an authorized decision-maker. It is an independently positioned integration and workflow product whose core value is reliable orchestration across fragmented lending systems.

The product launches with synthetic borrower data and deterministic provider simulators. Future customers can connect authorized sandbox or production providers through the same adapter contracts and supply their own credentials.

### Product promise

> Convert fragmented borrower data and provider findings into an explainable, auditable, human-reviewable loan-readiness workflow.

### Launch outcome

A partner developer or lending-operations user can create a synthetic loan case, observe the Agent select and execute approved tools, receive a readiness assessment, resolve missing information, perform human review, and inspect a complete audit trail through APIs and an operations dashboard.

## 3. Current baseline

The repository currently provides:

- **Implemented**: NestJS and TypeScript application.
- **Implemented**: GraphQL/Apollo API with an `evaluateLoan` flow.
- **Implemented**: simulated income, credit, and document integrations.
- **Implemented**: concurrent integration retrieval with `Promise.all`.
- **Implemented**: deterministic readiness rules.
- **Implemented**: TypeORM/PostgreSQL persistence with raw JSONB integration data.
- **Implemented**: Jest unit and end-to-end test foundations.
- **Implemented**: Docker and Docker Compose development path.
- **In progress**: provider-neutral local model support through Ollama and Qwen, replacing the paid-model dependency.

The following are not yet implemented and remain **Planned**:

- tenant isolation, OIDC authentication, RBAC, and API-client credentials;
- explicit database migrations and normalized lending-domain tables;
- durable asynchronous workflows, queues, outbox processing, and dead-letter recovery;
- idempotent partner APIs and signed webhooks;
- stateful tool-using Agent execution with checkpointing and human interruption;
- consent, PII controls, document object storage, retention, and deletion workflows;
- production observability, CI/CD deployment, infrastructure as code, and restore drills;
- a lender-operations dashboard;
- real provider, sandbox, or official underwriting integrations.

## 4. Product positioning

### 4.1 Target users

1. **Fintech integration developer**
   - Needs a stable API across multiple external providers.
   - Needs idempotency, test fixtures, webhooks, and traceable failures.

2. **Loan operations specialist**
   - Needs to understand case readiness and missing information.
   - Needs an actionable timeline instead of raw provider payloads.

3. **Human reviewer or underwriter**
   - Needs evidence, policy results, provenance, and override controls.
   - Must retain authority over material decisions.

4. **Compliance or risk reviewer**
   - Needs immutable audit history, consent evidence, version history, and data lineage.

5. **Tenant administrator**
   - Manages users, API clients, provider connections, webhook endpoints, and retention settings.

### 4.2 Jobs to be done

- When a loan case arrives, determine whether required data is complete enough for review.
- Choose the approved provider tools needed for that case.
- Normalize heterogeneous provider findings into one internal contract.
- Detect missing, stale, contradictory, or failed evidence.
- Request remediation or route the case to a human.
- Explain conclusions using traceable facts and policy versions.
- Notify partner systems without requiring synchronous long-running requests.

### 4.3 Differentiation

- Vendor-neutral provider contracts rather than provider-specific business logic.
- Free, deterministic simulators with fault injection for development and demos.
- Agent-assisted orchestration with deterministic policy authority.
- Durable workflow state, replay, and human-in-the-loop review.
- Evidence provenance and operational auditability built into the domain model.
- A migration path from local demo to sandbox and customer-owned production credentials.

## 5. Goals, non-goals, and principles

### 5.1 Goals

- Deliver a launchable synthetic-data product demonstration with production-grade engineering controls.
- Provide REST/OpenAPI partner contracts and GraphQL operations APIs.
- Support multi-tenant isolation and least-privilege access.
- Execute long-running work asynchronously and recover safely from failure.
- Implement a stateful AI Agent that can only use approved tools.
- Keep readiness conclusions explainable, versioned, and reviewable.
- Run locally without paid AI or provider credentials.
- Allow future sandbox and production providers without redesigning the core domain.
- Produce measurable reliability, security, and Agent-quality evidence.

### 5.2 Non-goals

- Issuing credit, originating loans, moving money, or making binding approval decisions.
- Claiming to reproduce an official automated underwriting result.
- Training a proprietary foundation model.
- Building a broad consumer chatbot.
- Supporting every lending product in the first launch.
- Creating microservices or Kubernetes infrastructure before scale requires them.
- Ingesting real consumer PII into the public demo.
- Claiming legal or regulatory certification solely from engineering controls.

### 5.3 Engineering principles

1. Deterministic policy outranks model output.
2. Humans retain authority for material or ambiguous outcomes.
3. Every external write is idempotent and auditable.
4. Every model or provider call has provenance, timeout, and failure handling.
5. Synthetic data is the default; real credentials are opt-in and tenant-owned.
6. PII is minimized before storage, logging, and model inference.
7. A modular monolith is preferred until independent scaling or ownership justifies extraction.
8. Planned, implemented, tested, deployed, and production-approved are distinct states.

## 6. Product terminology and decision boundary

The target product must not present its output as a formal lending decision.

### 6.1 Target readiness outcomes

| Outcome | Meaning |
|---|---|
| `READY` | Required evidence is present and deterministic checks passed for the configured readiness policy. |
| `NEEDS_INFORMATION` | Specific evidence is missing, expired, unreadable, or inconsistent. |
| `MANUAL_REVIEW` | Conflicting findings, policy boundary, model uncertainty, or a protected action requires a person. |
| `NOT_READY` | Deterministic readiness requirements are not satisfied and cannot be resolved by simple supplementation. |

The current demo's `APPROVED`, `CONDITIONAL`, and `DENIED` values are legacy MVP terminology. They must be migrated before public launch.

### 6.2 Authority order

1. Consent and security controls may stop processing.
2. Deterministic validation and policy rules determine readiness status.
3. Official external findings, when eventually connected, remain unmodified source findings.
4. The Agent may select tools, summarize evidence, identify gaps, and recommend routing.
5. A human reviewer may approve, reject, or edit an Agent recommendation within their role.
6. The model may never silently override deterministic policy or human decisions.

## 7. Launch scope

### 7.1 Launch vertical slice

The first production-quality demonstration covers one synthetic conventional mortgage-readiness workflow:

1. Create a tenant-scoped loan case using an idempotency key.
2. Record synthetic borrower consent.
3. Validate case completeness and data formats.
4. Enqueue the workflow and return `202 Accepted` with a case identifier.
5. Execute simulated income, credit, asset, and document providers.
6. Normalize provider findings and record provenance.
7. Let the Agent decide whether more approved tools are needed.
8. Apply deterministic readiness policy.
9. Pause for human review when required.
10. Publish signed case-status webhooks.
11. Display the case, workflow timeline, evidence, and audit history in the dashboard.

### 7.2 Included provider simulators

- Income and employment verification.
- Credit-profile summary.
- Asset verification.
- Document classification and field extraction.
- Identity consistency check using synthetic identities.
- Readiness policy engine.

Every simulator must support deterministic fixtures and failure injection:

- success;
- incomplete response;
- inconsistent response;
- timeout;
- temporary unavailability;
- rate limiting;
- malformed payload;
- duplicate delivery.

### 7.3 Deferred after launch

- Additional lending products and policy packs.
- Real document OCR provider.
- Authorized provider sandboxes.
- Customer-owned production provider credentials.
- Multi-region disaster recovery.
- Billing and commercial subscription management.
- High-volume batch case submission.

## 8. Functional requirements

### 8.1 Tenant and identity

- **FR-001**: Every business record must belong to exactly one tenant.
- **FR-002**: Human users authenticate through OIDC/OAuth 2.0.
- **FR-003**: Partner systems authenticate with scoped API clients.
- **FR-004**: Roles include `TENANT_ADMIN`, `CASE_OPERATOR`, `REVIEWER`, `AUDITOR`, and `API_CLIENT`.
- **FR-005**: Authorization is enforced in the service layer and covered by cross-tenant negative tests.

### 8.2 Case management

- **FR-010**: Create, retrieve, list, and archive loan cases.
- **FR-011**: Accept an `Idempotency-Key` for every externally initiated mutation.
- **FR-012**: Reject a reused idempotency key when its request hash differs.
- **FR-013**: Expose case status, readiness result, outstanding conditions, and last workflow activity.
- **FR-014**: Preserve a case version and optimistic concurrency token for reviewer updates.

### 8.3 Consent and documents

- **FR-020**: Record consent purpose, scope, actor, method, policy version, and timestamps.
- **FR-021**: Prevent provider execution when required consent is absent or expired.
- **FR-022**: Store documents in S3-compatible object storage, not in relational rows.
- **FR-023**: Store checksums, media types, classification results, and retention metadata.
- **FR-024**: Scan uploads and treat document content as untrusted data, never as Agent instructions.

### 8.4 Provider orchestration

- **FR-030**: Resolve providers by capability, tenant configuration, and operating mode.
- **FR-031**: Normalize responses into internal findings without losing the encrypted raw payload.
- **FR-032**: Enforce timeout, retry, concurrency, and circuit-breaker policies per provider.
- **FR-033**: Persist every submission and attempt before publishing workflow progress.
- **FR-034**: Route exhausted failures to a dead-letter queue and operations view.

### 8.5 Agent and policy

- **FR-040**: Persist Agent graph state by tenant, case, workflow run, and thread ID.
- **FR-041**: Permit only registered, schema-validated tools.
- **FR-042**: Limit execution by maximum steps, duration, provider calls, and model tokens.
- **FR-043**: Require human review for configured risk and uncertainty conditions.
- **FR-044**: Record model, prompt, tool, policy, and schema versions for every assessment.
- **FR-045**: Reject malformed or unsupported model output and fall back to safe routing.

### 8.6 Webhooks and operations

- **FR-050**: Publish signed, timestamped, replay-protected webhooks.
- **FR-051**: Retry webhook delivery with exponential backoff and retain delivery history.
- **FR-052**: Provide dashboard views for cases, workflow steps, provider attempts, reviews, and audit events.
- **FR-053**: Permit authorized replay from a safe checkpoint without duplicating completed external effects.

## 9. Agent charter

### 9.1 Agent mission

The Agent advances a loan case toward a complete, explainable readiness assessment by selecting approved information-gathering tools, detecting unresolved gaps, and routing ambiguous cases to a human.

### 9.2 Agent state

```ts
interface LoanReadinessAgentState {
  tenantId: string;
  caseId: string;
  workflowRunId: string;
  caseVersion: number;
  consentStatus: 'VALID' | 'MISSING' | 'EXPIRED';
  availableEvidence: EvidenceSummary[];
  providerFindings: ProviderFindingSummary[];
  unresolvedConditions: Condition[];
  attemptedTools: ToolAttemptSummary[];
  policyVersion: string;
  modelVersion?: string;
  promptVersion?: string;
  remainingStepBudget: number;
  nextAction?: AgentAction;
  humanReview?: HumanReviewState;
}
```

### 9.3 Approved tools

| Tool | Side effect | Human approval |
|---|---|---|
| `check_case_completeness` | None | No |
| `fetch_income_evidence` | Provider submission | Consent required |
| `fetch_credit_evidence` | Provider submission | Consent required |
| `fetch_asset_evidence` | Provider submission | Consent required |
| `inspect_documents` | Document processing | Consent required |
| `compare_evidence` | None | No |
| `calculate_readiness` | Creates versioned assessment | No; deterministic engine owns result |
| `request_missing_information` | Creates task/draft notification | Human approval for external delivery |
| `escalate_to_human` | Pauses graph and creates review | No |
| `publish_case_update` | External webhook | Policy-controlled; delivery is idempotent |

### 9.4 Required Agent loop

```text
LOAD CASE
  -> CHECK CONSENT
  -> CHECK COMPLETENESS
  -> SELECT APPROVED TOOL(S)
  -> EXECUTE THROUGH PROVIDER GATEWAY
  -> OBSERVE AND NORMALIZE FINDINGS
  -> CHECK CONTRADICTIONS / MISSING DATA / BUDGET
       -> more evidence required: select next tool
       -> ambiguous or protected action: interrupt for human review
       -> sufficient evidence: execute deterministic readiness policy
  -> EXPLAIN WITH PROVENANCE
  -> PUBLISH STATUS
  -> END
```

### 9.5 Mandatory human-review triggers

- Contradictory identity, income, asset, or document evidence.
- Agent confidence below the configured threshold.
- Model output rejected by schema or policy validation.
- Provider result requiring interpretation outside the configured policy pack.
- Manual override of a deterministic result.
- External communication containing material negative findings.
- Step, token, time, or provider-call budget exhausted.
- Any policy-controlled category designated by risk or compliance review.

### 9.6 Agent safety controls

- Tool allowlist and JSON-schema validation on all arguments and outputs.
- Treat retrieved documents and provider payloads as untrusted content.
- No arbitrary HTTP, shell, SQL, code execution, credential retrieval, or dynamic tool installation.
- Tenant-scoped credentials resolved server-side; never exposed to prompts.
- Maximum graph steps, wall-clock duration, token budget, and provider spend.
- Prompt-injection test corpus and adversarial document fixtures.
- Deterministic fallback to `MANUAL_REVIEW` on uncertainty or runtime failure.

## 10. Target architecture

### 10.1 Architecture style

Use a modular monolith with two independently deployable processes:

- **API service**: authentication, partner REST API, operations GraphQL API, validation, idempotency, and status retrieval.
- **Worker service**: durable jobs, provider orchestration, Agent execution, policy evaluation, and webhook delivery.

This preserves one codebase and transaction model while allowing API and worker capacity to scale separately. Microservice extraction is deferred until a measured scaling, security, or ownership boundary appears.

### 10.2 Logical architecture

```text
Partners / Operations Dashboard
             |
        ALB + WAF
             |
   +---------+----------+
   | API Service        |
   | REST/OpenAPI       |
   | GraphQL Operations |
   +---------+----------+
             |
   PostgreSQL transaction
   case + idempotency + outbox
             |
      Outbox Dispatcher
             |
      Valkey/Redis Queue
             |
   +---------+----------+
   | Worker Service     |
   | Workflow Runtime   |
   | LangGraph Agent    |
   | Policy Engine      |
   +----+----------+----+
        |          |
 Provider       Model Gateway
 Gateway        |-- Ollama: local development
 |              `-- private vLLM: production option
 |-- Simulator
 |-- Sandbox adapter
 `-- BYOC production adapter

PostgreSQL: transactional state, audit, outbox, Agent checkpoints
S3 + KMS: documents and encrypted large/raw payloads
OpenTelemetry: traces and metrics; redacted structured application logs
```

### 10.3 Module boundaries

```text
src/
  identity/          tenant context, OIDC/API clients, RBAC
  cases/             case aggregate and lifecycle
  borrowers/         synthetic borrower profiles and PII boundary
  consents/          purpose and authorization records
  documents/         metadata, storage, scan and classification
  providers/         registry, adapters, simulator and normalized findings
  workflows/         jobs, outbox, checkpoints and state transitions
  agent/             graph, tools, budgets and model gateway
  policy/            deterministic readiness policies
  reviews/           human review and override workflow
  webhooks/          endpoints, signatures, delivery and replay protection
  audit/             append-only domain and security events
  observability/     telemetry, health, readiness and redaction
```

Dependencies point inward toward domain contracts. Provider SDKs, queue clients, model clients, cloud storage, and web frameworks remain adapters.

## 11. Target technology stack

| Layer | Target | Rationale |
|---|---|---|
| Runtime | Node.js 24 LTS | Supported production LTS; Node 20 is EOL. |
| Language | TypeScript 6 stable | Compatibility-stable target for Nest CLI; TypeScript 7.0 is released but is not adopted until the programmatic compiler API/toolchain is compatible. |
| Backend | NestJS 11 + Express 5 | Mainstream upgrade path with measured migration scope. |
| Partner API | REST + OpenAPI | Stable integration contract, SDK generation, and webhook-friendly semantics. |
| Operations API | GraphQL + Apollo Server 5 | Flexible dashboard querying; disabled public playground/introspection in production. |
| Database | PostgreSQL 18 | Durable domain data, RLS defense in depth, outbox, and Agent checkpoints. |
| ORM | TypeORM 0.3 latest patched | Preserve current investment; explicit migrations required. |
| Queue | BullMQ + managed Valkey/Redis | Background work, delayed retry, concurrency control, and DLQ patterns. |
| Agent runtime | LangGraph.js v1 + PostgreSQL checkpointer | Stateful execution, resume, replay, and human interruption. |
| Local model | Ollama + Qwen3.5-9B | Apache-2.0 model with tool-use, structured-response, multilingual, and future document-vision capability at a size suitable for the target development machine. |
| Production model | Private vLLM through Model Gateway | OpenAI-compatible serving, provider neutrality, and open-weight deployment path. |
| Object storage | S3-compatible storage + KMS | Durable documents, encryption, lifecycle, and signed access. |
| Identity | Managed OIDC/OAuth 2.0 | Avoid implementing password and token security in the product core. |
| Telemetry | OpenTelemetry + CloudWatch-compatible backend | Vendor-neutral traces and metrics with correlated logs. |
| Tests | Jest 30, Supertest, Testcontainers, contract tests | Unit, integration, end-to-end, migration, and provider verification. |
| Infrastructure | Terraform/OpenTofu + AWS ECS Fargate | Reproducible infrastructure without premature Kubernetes operations. |
| CI/CD | GitHub Actions with OIDC | Short-lived cloud credentials and auditable deployment gates. |

Exact patch versions must be locked, security-scanned, and refreshed during each upgrade PR. Major versions in this table are architecture targets, not evidence that the repository already uses them.

## 12. Data architecture

### 12.1 Core entities

| Entity | Purpose |
|---|---|
| `tenants` | Organization boundary and configuration. |
| `users` | OIDC-linked human identity. |
| `tenant_memberships` | User roles per tenant. |
| `api_clients` | Scoped machine credentials and key metadata. |
| `loan_cases` | Case aggregate, lifecycle, version, and current readiness summary. |
| `borrowers` | Minimized borrower profile with encrypted sensitive fields. |
| `consent_records` | Purpose, scope, version, grant and expiration evidence. |
| `documents` | Object metadata, hash, classification, retention, and scan state. |
| `provider_connections` | Tenant-owned provider mode and encrypted credential reference. |
| `provider_submissions` | Idempotent external request and attempt state. |
| `provider_findings` | Normalized findings and provenance. |
| `readiness_assessments` | Versioned deterministic result and supporting evidence. |
| `workflow_runs` | Durable workflow instance and aggregate status. |
| `workflow_steps` | Individual execution steps, attempts, latency, and errors. |
| `agent_runs` | Agent configuration, budget, versions, and final route. |
| `human_reviews` | Reviewer decision, reason, version, and override history. |
| `idempotency_keys` | Tenant, route, key, request hash, and response reference. |
| `webhook_endpoints` | Destination, secret reference, event subscriptions, and state. |
| `webhook_deliveries` | Signed delivery attempts and outcomes. |
| `audit_events` | Append-only actor/action/resource/security history. |
| `outbox_events` | Transactionally committed events awaiting publication. |

### 12.2 Data rules

- Every tenant-owned table includes `tenant_id` and tenant-first indexes.
- Database row-level security provides defense in depth; service-layer authorization remains mandatory.
- Money is stored as integer minor units plus currency, or through an explicit decimal transformer.
- Every mutable aggregate includes `version`, `created_at`, `updated_at`, and actor provenance.
- Raw provider payloads are encrypted, access-controlled, and subject to short retention.
- Logs contain identifiers and hashes, not full borrower PII or document text.
- Demo and automated-test datasets are synthetic and visibly labeled.

## 13. API contract

### 13.1 Partner REST API

```text
POST   /v1/loan-cases
GET    /v1/loan-cases/{caseId}
POST   /v1/loan-cases/{caseId}/consents
POST   /v1/loan-cases/{caseId}/documents
POST   /v1/loan-cases/{caseId}/workflow-runs
GET    /v1/loan-cases/{caseId}/workflow-runs/{runId}
GET    /v1/loan-cases/{caseId}/readiness-assessments/latest
POST   /v1/loan-cases/{caseId}/reviews
POST   /v1/webhook-endpoints
GET    /v1/webhook-deliveries/{deliveryId}
```

Long-running operations return `202 Accepted`:

```json
{
  "caseId": "case_...",
  "workflowRunId": "run_...",
  "status": "QUEUED",
  "statusUrl": "/v1/loan-cases/case_.../workflow-runs/run_..."
}
```

### 13.2 API requirements

- OpenAPI schema generated and checked into release artifacts.
- Consistent problem-details error format.
- Request ID and trace ID returned on all responses.
- Cursor pagination for collections.
- API-version and deprecation policy.
- Payload size and upload limits.
- Per-tenant and per-client rate limits.
- Idempotency required for mutations with external effects.

### 13.3 Webhook events

```text
loan_case.created
workflow_run.started
workflow_run.waiting_for_information
workflow_run.waiting_for_review
workflow_run.completed
workflow_run.failed
readiness_assessment.created
human_review.completed
```

Signatures use a timestamped HMAC over the raw body. Receivers can reject stale timestamps, and each event ID is stable across retries.

## 14. Provider platform

### 14.1 Operating modes

```ts
type ProviderMode = 'SIMULATOR' | 'OFFICIAL_SANDBOX' | 'PRODUCTION_BYOC';
```

- `SIMULATOR`: free default using deterministic synthetic fixtures.
- `OFFICIAL_SANDBOX`: optional adapter enabled only with authorized access.
- `PRODUCTION_BYOC`: tenant supplies its own contract, credentials, and authorization.

### 14.2 Provider contract

```ts
interface ProviderAdapter<TRequest, TNormalizedFinding> {
  readonly capability: ProviderCapability;
  readonly mode: ProviderMode;
  submit(request: TRequest, context: ProviderContext): Promise<ProviderReceipt>;
  poll?(receipt: ProviderReceipt, context: ProviderContext): Promise<ProviderStatus>;
  normalize(payload: unknown): TNormalizedFinding;
  healthCheck(): Promise<ProviderHealth>;
}
```

Adapters do not write loan-case state directly. They return normalized results to the workflow layer, which commits state and outbox events transactionally.

### 14.3 Contract-test suite

Every adapter must pass the same reusable tests:

- schema validation;
- deterministic idempotency behavior;
- authentication failure mapping;
- timeout and retry classification;
- rate-limit handling;
- malformed and partial payload rejection;
- duplicate callback handling;
- normalized provenance fields;
- PII redaction in logs and errors.

## 15. Security, privacy, and responsible AI

This section defines engineering launch gates, not a claim of legal compliance. Production use with real consumer data requires qualified legal, security, privacy, and compliance review.

### 15.1 Security controls

- OIDC authentication, short-lived sessions, scoped API credentials, and RBAC.
- Tenant isolation tests plus PostgreSQL RLS defense in depth.
- TLS in transit; managed encryption at rest; field-level envelope encryption for designated PII.
- Secrets stored in a managed secret service, never repository variables or model prompts.
- WAF, request-size limits, schema validation, rate limiting, and abuse protection.
- Read-only container root filesystem where compatible; non-root runtime user.
- Immutable container tags tied to commit SHA; signed provenance and dependency inventory.
- Dependency, secret, container, infrastructure, and static-code scanning in CI.
- Centralized, access-controlled security events and alerting.

### 15.2 Privacy controls

- Synthetic data only in public demo and automated tests.
- Purpose-bound consent checked before provider access.
- Data minimization before model inference.
- No full government identifiers, account numbers, or raw documents in prompts or logs.
- Configurable retention and deletion workflows.
- Signed, time-limited object access.
- Document and provider-payload access audited separately from ordinary case access.

### 15.3 Responsible-AI controls

- Model output is advisory and never the sole authority for material readiness results.
- Deterministic policy produces reason codes from versioned input facts.
- Protected characteristics are excluded from readiness policies and model prompts unless explicitly required and approved for a lawful control.
- Explanations cite internal evidence IDs, not invented facts.
- Model, prompt, tool schema, policy, and evaluation-dataset versions are recorded.
- Human overrides require reason codes and remain visible in history.
- Drift and regression evaluations block deployment when guardrails fail.

### 15.4 Threat scenarios covered in testing

- Cross-tenant identifier enumeration.
- Prompt injection embedded in a document.
- Tool-argument injection and schema bypass.
- Webhook replay or signature downgrade.
- Duplicate partner submission.
- Provider timeout storm and queue exhaustion.
- Poisoned or malformed provider payload.
- Excessive model/tool loop.
- Credential leakage through logs, traces, exceptions, or prompts.
- Reviewer race and stale override.

## 16. Reliability objectives

These are target service-level objectives and must not be reported as achieved until measured in a deployed environment.

| Signal | Launch target |
|---|---|
| API availability | 99.9% monthly, excluding announced maintenance |
| Accepted-command latency | p95 under 300 ms excluding document upload transfer |
| Case-read latency | p95 under 500 ms |
| Simulator workflow completion | p95 under 60 seconds |
| Durable job loss | 0 acknowledged jobs lost |
| Duplicate external effect | 0 in idempotency and replay test suites |
| Webhook successful delivery | 99.5% within retry window for healthy receivers |
| Recovery point objective | 15 minutes |
| Recovery time objective | 60 minutes |
| Critical security findings | 0 open at launch |
| High dependency findings | 0 open unless documented, mitigated, and time-bound |

### 16.1 Failure behavior

- Liveness reports only process viability.
- Readiness fails when required database or queue dependencies cannot support traffic.
- Provider degradation does not crash the API.
- Model degradation routes eligible workflows to deterministic or human-review paths.
- Exhausted jobs enter a DLQ with a visible operational action.
- Graceful shutdown stops new work and returns/requeues unfinished jobs safely.

## 17. Observability

### 17.1 Required telemetry

- Distributed traces across API, outbox, queue, Agent steps, providers, model, and webhooks.
- Metrics for request rate, error rate, latency, queue depth, job age, retries, circuit state, Agent steps, token usage, and human-review duration.
- Structured logs containing tenant-safe identifiers, trace IDs, event names, and redacted errors.
- Audit events for security and business actions; audit is separate from diagnostic logging.

### 17.2 Required dashboards

- API health and latency.
- Queue depth, oldest job age, retries, and DLQ count.
- Provider latency, error class, and circuit-breaker state.
- Agent completion, escalation, invalid-action, and budget-exhaustion rates.
- Webhook delivery success and retry backlog.
- Database connection, query latency, storage, and replication/backup signals.

### 17.3 Required alerts

- Elevated 5xx or authentication failures.
- Queue oldest-job age above objective.
- DLQ nonzero for longer than the response threshold.
- Provider circuit open or material timeout increase.
- Webhook failure spike.
- Backup failure or restore verification failure.
- Suspected cross-tenant access or secret exposure.

## 18. Testing and Agent evaluation

### 18.1 Test pyramid

1. Unit tests for domain rules, value objects, redaction, signatures, and Agent routing functions.
2. Integration tests with real PostgreSQL and Valkey/Redis through Testcontainers.
3. Migration tests from an empty database and the previous released schema.
4. Provider contract tests shared by simulator and future adapters.
5. API end-to-end tests for auth, tenancy, idempotency, and error contracts.
6. Workflow tests for retries, resume, timeout, DLQ, replay, and human interruption.
7. Security tests for tenant isolation, authorization, prompt injection, and webhook replay.
8. Load and soak tests for API and worker scaling.
9. Backup restore and disaster-recovery exercises.

### 18.2 Agent evaluation dataset

Maintain a versioned set of at least 150 synthetic cases across:

- complete low-risk evidence;
- missing and expired evidence;
- contradictory income or asset evidence;
- unreadable and adversarial documents;
- provider timeout, rate limit, malformed response, and duplicate callback;
- model invalid JSON, unsupported assertion, and tool-selection error;
- human-review boundaries and policy-version changes.

### 18.3 Agent release metrics

| Metric | Initial release gate |
|---|---|
| Tool-selection accuracy | >= 95% on approved evaluation set |
| Missing-information recall | >= 95% |
| Required-human-review recall | 100% for designated mandatory scenarios |
| Unauthorized-tool rate | 0% |
| Unsupported factual claim rate | <= 1% |
| Schema-valid final output | 100%, including fallback behavior |
| Workflow completion | >= 99% for simulator cases without injected terminal failure |
| Deterministic replay match | 100% for rules-only fixtures |

Thresholds are provisional product targets. Baseline measurements must be recorded before they become release gates; no unmeasured metric may appear as an achieved claim.

## 19. Infrastructure and deployment

### 19.1 Local zero-cost profile

- Docker Compose.
- PostgreSQL.
- Valkey/Redis.
- MinIO or filesystem-backed S3-compatible development storage.
- Provider simulators.
- Deterministic policy engine.
- Optional Ollama/Qwen.

The complete launch workflow must work without a paid model key or paid provider account.

### 19.2 Cloud target

- ALB, TLS certificate, WAF, and private networking.
- ECS Fargate services for API and worker.
- RDS PostgreSQL 18 with Multi-AZ for production.
- Managed Valkey/Redis.
- S3 with KMS, versioning, lifecycle, and blocked public access.
- Secrets Manager or equivalent.
- Immutable ECR images tagged by commit SHA.
- OpenTelemetry collector and CloudWatch-compatible telemetry backend.
- Managed OIDC provider.

The model server is a separate private capability. Ollama is for local development; production vLLM must sit behind private networking, authentication, authorization, request limits, and a reverse proxy/API gateway.

### 19.3 Environments

| Environment | Data | Purpose |
|---|---|---|
| Local | Synthetic | Development and deterministic demos. |
| CI | Ephemeral synthetic | Tests, migrations, security scans, and evaluation subset. |
| Staging | Synthetic only | Release candidate, load, failure, restore, and demo verification. |
| Production | Disabled for real PII until approval | Operational target after security/compliance launch gates. |

### 19.4 CI/CD gates

- Format, lint, typecheck, unit, integration, and end-to-end tests.
- Database migration up/down compatibility check where safe.
- Agent evaluation regression subset on every PR; full evaluation before release.
- Dependency, secret, SAST, IaC, license, and container scans.
- Build once; promote the same immutable artifact.
- GitHub Actions authenticates to cloud through OIDC, not long-lived access keys.
- Staging smoke test verifies health and a real synthetic loan-case workflow.
- Production promotion requires release approval and successful backup/rollback checks.

## 20. Cost strategy

### 20.1 Free-by-default development

- Simulators replace paid provider calls.
- Rules mode is the default decision path.
- Ollama is optional for local Agent/model development.
- CI uses deterministic rules for most tests and a bounded local-model evaluation where infrastructure permits.

### 20.2 Productizable cost controls

- Per-tenant model token, Agent step, provider-call, storage, and concurrency budgets.
- Cached immutable findings when consent and freshness policy permit.
- Idempotency prevents duplicate provider spend.
- Provider and model costs recorded per workflow run.
- GPU model serving can remain off outside scheduled evaluation or demand windows.
- Staging auto-scales to zero where supported, with documented cold-start tradeoffs.

Cloud infrastructure, real providers, and production model serving are not assumed to be free. Any cost-bearing deployment requires an explicit approved budget.

## 21. Delivery roadmap

The sequence below is dependency-based. Durations are estimates for planning, not delivery promises.

### Phase status

| Phase | Scope | Status |
|---|---|---|
| Milestone 0 | Open-model baseline | In progress |
| Milestone 1 | Runtime and security baseline | Planned |
| Milestone 2 | Domain, tenancy, consent, and audit | Planned |
| Milestone 3 | Durable asynchronous workflow | Planned |
| Milestone 4 | Provider platform | Planned |
| Milestone 5 | Stateful Agent and human review | Planned |
| Milestone 6 | Operations dashboard and launch | Planned |

### Development execution protocol

Every implementation follows this loop:

```text
select one acceptance criterion
  -> write or update the test
  -> implement one coherent feature slice
  -> add rationale-focused code comments
  -> run proportional verification
  -> update docs/DEVELOPMENT_LOG.md
  -> review the exact diff
  -> create one atomic commit
  -> move to the next feature
```

Rules:

- One independently understandable and revertible feature slice maps to one commit.
- Implementation, tests, migration, documentation, and development-log evidence for that slice belong in the same commit when practical.
- Unrelated changes are never mixed into a feature commit.
- Large features are split by acceptance criterion, not by arbitrary file count.
- Temporary local work may be incomplete, but committed feature branches should remain buildable and testable.
- A failing or partially verified commit is labeled explicitly and is not presented as completed work.

### Milestone 0 — Preserve and finish the open-model baseline

**Objective:** complete the existing paid-model removal without mixing it with the architecture migration.

Deliverables:

- rules/Ollama provider abstraction;
- structured output validation and safe failure behavior;
- updated tests and documentation;
- clean build, lint, unit, demo, and applicable e2e evidence.

Exit gate:

- no paid model credential required for default execution;
- current uncommitted scope reviewed and released as a separate, auditable change.

### Milestone 1 — Runtime and security baseline

**Objective:** move onto supported runtime and framework versions.

Deliverables:

- Node.js 24 LTS, NestJS 11, Express 5, Apollo Server 5, GraphQL supported baseline, TypeScript 6, Jest 30;
- dependency remediation;
- environment-schema validation;
- Helmet, CORS allowlist, rate limiting, body limits, graceful shutdown;
- production GraphQL playground/introspection disabled;
- real liveness and readiness endpoints;
- explicit TypeORM migrations and `synchronize: false` everywhere except disposable tests.

Exit gate:

- clean install, build, lint, unit, e2e, migration, Docker, and vulnerability gates.

### Milestone 2 — Domain, tenancy, consent, and audit

**Objective:** establish the Fintech trust boundary.

Deliverables:

- normalized case schema;
- tenant context, OIDC/API-client authentication, RBAC, and RLS;
- consent enforcement;
- append-only audit events;
- target readiness terminology;
- encrypted PII boundary and synthetic-data generator.

Exit gate:

- cross-tenant access tests fail closed;
- every material action has actor, tenant, resource, timestamp, and correlation provenance.

### Milestone 3 — Durable asynchronous workflow

**Objective:** make provider work recoverable and idempotent.

Deliverables:

- REST/OpenAPI partner API returning `202`;
- API/worker process split;
- transactional outbox;
- BullMQ queue, retry, timeout, circuit breaker, and DLQ;
- status retrieval, SSE or event stream for dashboard, and signed webhooks;
- safe replay and idempotency behavior.

Exit gate:

- injected crashes, timeouts, duplicates, and restarts do not lose acknowledged work or duplicate effects.

### Milestone 4 — Provider platform

**Objective:** replace hard-coded mocks with product-grade simulator adapters.

Deliverables:

- provider registry and capability resolution;
- simulator/sandbox/BYOC modes;
- income, credit, asset, and document contracts;
- deterministic fixtures and fault injection;
- reusable provider contract suite.

Exit gate:

- a new adapter can be added without changing case or Agent domain logic.

### Milestone 5 — Stateful Agent and human review

**Objective:** implement a defensible AI Agent rather than a single model call.

Deliverables:

- LangGraph state graph and PostgreSQL checkpointer;
- approved tools and execution budgets;
- Model Gateway for rules, Ollama, and private vLLM-compatible inference;
- interrupts and reviewer resume flow;
- provenance-backed explanations;
- 150-case Agent evaluation dataset and release report.

Exit gate:

- Agent release metrics pass; mandatory review recall and unauthorized-tool rate meet gates.

### Milestone 6 — Operations dashboard and launch

**Objective:** make the workflow understandable and operable.

Deliverables:

- case list/detail, evidence, workflow timeline, human review, audit, provider, and webhook views;
- Terraform/OpenTofu environment definitions;
- GitHub Actions OIDC deployment;
- staging deployment with synthetic data;
- telemetry dashboards and alerts;
- load, soak, security, backup, restore, and runbook evidence;
- architecture decision records and demo walkthrough.

Exit gate:

- all launch gates in Section 24 pass in staging.

## 22. Product metrics

These metrics evaluate whether the platform improves the workflow, not whether it approves loans.

### Primary outcome

- Median time from case creation to actionable readiness status.

### Supporting product metrics

- Percentage of cases receiving an actionable status without workflow failure.
- Time spent waiting for missing information.
- Human-review rate and median review duration.
- Percentage of conditions linked to supporting evidence.
- Provider retry and terminal-failure rates.
- Webhook delivery success and latency.
- Agent tool-selection accuracy and escalation quality.
- Cost per synthetic workflow and, later, per tenant workflow.

### Guardrails

- Cross-tenant access incidents: zero.
- Unauthorized Agent tool execution: zero.
- Unsupported material factual claims: within release threshold.
- Lost acknowledged workflow jobs: zero.
- Unattributed human overrides: zero.

## 23. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Product appears to make official approval decisions | Legal, trust, and positioning risk | Readiness terminology, explicit disclaimers, deterministic/human authority. |
| Model fabricates or misreads evidence | Incorrect routing | Evidence IDs, schema validation, policy engine, HITL, evaluations. |
| Provider unavailable or unaffordable | Workflow failure or cost | Simulator default, BYOC, timeouts, circuit breakers, budgets. |
| Sensitive data leaks to model/logs | Severe privacy risk | Synthetic demo, minimization, redaction, private inference, access audit. |
| Duplicate requests create duplicate effects | Cost and data inconsistency | Idempotency records, request hashes, outbox, stable event IDs. |
| Queue or worker crash loses work | Reliability failure | Durable queue, checkpointing, leases, retry, DLQ, recovery tests. |
| Premature microservices slow delivery | Complexity and operational burden | Modular monolith and evidence-based extraction. |
| Open-weight model quality is insufficient | Poor Agent routing | Rules baseline, model gateway, eval gates, human fallback. |
| Real provider access remains gated | Demo cannot prove real integration | Contract-tested simulator and optional sandbox/BYOC adapters. |
| Resume overstates implementation | Credibility risk | Status labels and evidence-linked release notes. |

## 24. Launch gates

The product is **ready to launch as a synthetic-data staging product** only when every gate below has objective evidence.

### Product gates

- The complete launch vertical slice works through API and dashboard.
- All user-visible loading, empty, failure, retry, stale-data, and permission-denied states are designed.
- The interface always labels synthetic and simulated results.
- No public copy describes readiness as official approval or underwriting.

### Security and privacy gates

- Threat model reviewed and critical/high findings resolved or formally time-bound.
- Tenant-isolation test suite passes.
- No secrets in repository history introduced by the release.
- No real PII in demo, fixtures, telemetry, screenshots, or evaluation data.
- Encryption, access, retention, and deletion controls are tested.

### Reliability gates

- Idempotency, retry, restart, duplicate callback, DLQ, and replay tests pass.
- Load test meets stated staging objectives.
- Backup completes and a restore drill succeeds.
- Runbooks cover provider outage, queue backlog, database degradation, model outage, webhook failures, and rollback.

### AI gates

- Agent evaluation report is reproducible from a versioned dataset.
- Mandatory-human-review recall is 100% on designated cases.
- Unauthorized-tool executions are zero.
- Every explanation maps material statements to evidence or deterministic policy.
- Model outage and invalid output degrade safely.

### Delivery gates

- CI passes on the exact deployed commit.
- Container and infrastructure artifacts are immutable and traceable to that commit.
- Staging health endpoint and one real synthetic API workflow are verified after deployment.
- Release approval records the target environment, cost settings, deployed commit, and rollback scope.

## 25. Definition of done

A feature is done only when:

- acceptance criteria are met;
- authorization and tenant behavior are defined;
- happy and unhappy paths are tested;
- migrations and rollback/forward strategy are documented;
- telemetry and redaction are included;
- API and event contracts are versioned;
- operational failure and recovery behavior are documented;
- documentation reflects the implemented state;
- non-obvious business, security, reliability, and Agent-routing decisions have maintained code comments;
- `docs/DEVELOPMENT_LOG.md` records the scope, decisions, files, verification, failures, and remaining gaps;
- the implementation is captured in an atomic, descriptive commit;
- no planned capability is presented as completed;
- the change is reviewed and released according to repository governance.

## 26. Ten-point portfolio scorecard

| Dimension | Points | Evidence required for full points |
|---|---:|---|
| Product clarity | 1.0 | Clear users, problem, workflow, non-goals, and readiness terminology. |
| Fintech domain model | 1.0 | Consent, cases, findings, assessments, reviews, audit, and provenance. |
| Backend architecture | 1.5 | REST/OpenAPI, GraphQL ops, migrations, tenancy, API/worker split. |
| Distributed reliability | 1.5 | Outbox, queue, idempotency, retries, DLQ, replay, webhooks. |
| AI Agent quality | 1.5 | Stateful tool loop, budgets, HITL, model gateway, reproducible eval. |
| Security and privacy | 1.5 | OIDC/RBAC/RLS, encryption, redaction, synthetic demo, threat tests. |
| Testing and operations | 1.0 | Testcontainers, contract/load/security tests, telemetry, runbooks, restore. |
| Launch evidence | 1.0 | CI-gated synthetic staging, verified workflow, dashboard, demo and ADRs. |
| **Total** | **10.0** | All evidence is present and reproducible. |

No single framework, model, cloud deployment, or feature awards ten points. The score comes from a coherent product plus trustworthy evidence.

## 27. Release governance

- Material changes are delivered through reviewable pull requests with linked acceptance evidence.
- Each coherent feature is committed separately with a conventional subject such as `feat(scope): ...`, `fix(scope): ...`, `test(scope): ...`, or `docs(scope): ...`.
- Commits must remain narrowly scoped, independently reviewable, and safely revertible.
- Protected branches require passing CI and review before merge.
- Release artifacts are immutable and traceable to a source commit and dependency lockfile.
- Staging promotion requires automated smoke tests against a real synthetic workflow.
- Production promotion requires explicit release approval, a rollback plan, and successful backup checks.
- Cloud and provider permissions follow least privilege and use short-lived credentials.
- Cost-bearing infrastructure requires a documented budget, scaling limits, and teardown procedure.

### Development journal

`docs/DEVELOPMENT_LOG.md` is an append-only engineering journal. Every feature entry records:

- milestone, status, and acceptance criterion;
- problem and intended outcome;
- implementation details and affected files;
- architecture and product decisions, including rejected alternatives;
- commands executed and exact verification results;
- failures encountered, root cause, and resolution;
- security, privacy, data, cost, and compatibility considerations;
- known gaps and the next safe step.

Entries are organized by milestone and feature identifier rather than calendar date. The journal records evidence, not a polished retrospective. Failed experiments and unverified boundaries remain visible.

### Code documentation guidelines

Useful comments and JSDoc preserve context that is difficult to infer from code alone. They are especially valuable around:

- lending-policy intent and readiness boundaries;
- tenant, consent, privacy, and authorization constraints;
- idempotency, transaction, retry, timeout, circuit-breaker, and replay reasoning;
- provider normalization assumptions and lossy transformations;
- Agent tool permissions, routing conditions, budgets, fallback, and human-review triggers;
- non-obvious compatibility workarounds and performance tradeoffs;
- public interfaces, provider adapters, Agent tools, and domain invariants.

A good comment explains **why** a design exists, which assumptions it relies on, and how it behaves when something fails. Comments that merely restate syntax, narrate each line, preserve dead code, or imply unsupported compliance guarantees add noise instead of context. When behavior changes, the related documentation evolves with it so that the code and its rationale remain aligned.

## 28. Decision records

The following architecture decisions are established by this charter and should receive dedicated ADR files when implementation begins:

1. Modular monolith with separately deployed API and worker.
2. REST/OpenAPI for partners and GraphQL for internal operations.
3. PostgreSQL as system of record and transactional outbox store.
4. BullMQ/Valkey for background execution; LangGraph for Agent state and HITL.
5. Deterministic readiness policy is authoritative over model recommendations.
6. Provider modes are simulator, authorized sandbox, and production BYOC.
7. Ollama is local-only; production open-weight inference uses a protected Model Gateway and private serving layer.
8. Synthetic-only public launch before any real-PII production approval.
9. ECS Fargate before Kubernetes.
10. Existing repository name remains stable; product identity is expressed through the subtitle and documentation.

## 29. Immediate next implementation slice

The next change after the current Ollama work should be **Milestone 1 only**, not the entire charter in one pull request.

Recommended pull-request acceptance criteria:

1. Runtime upgraded to Node.js 24 LTS.
2. NestJS 11/Express 5 and compatible Apollo Server 5/GraphQL packages installed.
3. TypeScript 6 and Jest 30 migration completed; TypeScript 7 remains a later compatibility-gated upgrade.
4. TypeORM upgraded to a patched version with an initial explicit migration.
5. `synchronize` disabled outside isolated tests.
6. Environment variables validated at startup.
7. Production GraphQL playground and introspection disabled.
8. Helmet, allowlisted CORS, bounded request bodies, and rate limiting enabled.
9. `/health/live` and `/health/ready` implemented with database checks.
10. Graceful shutdown and non-root production container implemented.
11. Clean install, build, lint, unit, e2e, migration, Docker, and dependency-audit evidence recorded.

This gives the project a supported, secure foundation before domain and Agent complexity is added.

## 30. Reference baseline

Architecture choices should be refreshed during implementation against primary documentation:

- [Node.js release schedule](https://nodejs.org/en/about/previous-releases)
- [NestJS 11 migration guide](https://docs.nestjs.com/migration-guide)
- [Apollo Server 5 migration guidance](https://www.apollographql.com/docs/apollo-server/migration)
- [TypeScript 6 stable release](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
- [TypeScript 7 stable release](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
- [Nest CLI TypeScript 7.0 compatibility issue](https://github.com/nestjs/nest-cli/issues/3477)
- [Jest 30 release](https://jestjs.io/blog/2025/06/04/jest-30)
- [PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/)
- [LangGraph JavaScript persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence)
- [LangGraph.js npm package and release history](https://www.npmjs.com/package/@langchain/langgraph?activeTab=versions)
- [Qwen3.5-9B model card](https://huggingface.co/Qwen/Qwen3.5-9B)
- [Ollama tool-calling support](https://docs.ollama.com/capabilities/tool-calling)
- [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs)
- [vLLM OpenAI-compatible server](https://docs.vllm.ai/en/latest/serving/online_serving/openai_compatible_server/)
- [vLLM security guidance](https://docs.vllm.ai/en/latest/usage/security/)
- [OpenTelemetry JavaScript](https://opentelemetry.io/docs/languages/js/)
- [Amazon ECS architecture guidance](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-configuration.html)
