# Mortgage Integration Agent — Product and Engineering Charter

> Mortgage-first, lending-extensible autonomous operations platform

| Field | Value |
|---|---|
| Document status | Target-state charter; implementation plan, not a production-readiness claim |
| Version | 2.0 |
| Repository | `mortgage-integration-agent` |
| Product model | Vendor-neutral API, operations console, Agent control plane, and developer sandbox |
| Launch model | Synthetic data and deterministic simulators first; authorized integrations later through adapters |

## 1. Purpose and status language

This charter defines the independent product position, architecture, delivery sequence, operating boundaries, and launch gates for Mortgage Integration Agent. It is the source of truth for what the repository is becoming and for the evidence required before a capability is described as complete.

The project is designed for the broader lending and Fintech ecosystem. It is not tailored to, endorsed by, or presented as a copy of any company, lender, government-sponsored enterprise, automated underwriting system, or proprietary platform.

Capability status is expressed consistently:

- **Implemented**: present in the repository.
- **Verified**: implemented and supported by current, recorded test or operational evidence.
- **Deployed**: running in an identified environment with a reproducible source revision.
- **Production-approved**: passed the security, privacy, reliability, compliance, and operational gates required for real customer data.
- **Planned**: target capability without implementation evidence.

These states are independent. A working local demo is not a production deployment, and a successful deployment is not proof of production approval.

## 2. Executive summary

Mortgage Integration Agent is a vendor-neutral autonomous lending operations platform that coordinates loan cases, evidence, policies, providers, AI-assisted actions, and human review across existing Fintech systems.

The initial product is **mortgage-first and lending-extensible**. Its first vertical slice resolves routine mortgage evidence and underwriting-readiness conditions using synthetic data. The core platform is designed so that future product packs can support other lending workflows without replacing the workflow, provider, governance, or audit foundations.

The platform does not issue credit, originate loans, move money, reproduce an official underwriting result, or replace an authorized decision-maker. It advances a case toward an actionable, evidence-backed operational state and escalates protected or ambiguous actions to a person.

### Product promise

> Turn fragmented lending evidence and operational conditions into an auditable action plan that resolves routine work automatically and escalates exceptions safely.

### Launch outcome

A developer or operations user can create a synthetic loan case, add evidence, start a durable workflow, observe approved Agent tools execute, resolve conditions, approve protected actions, recover from injected provider failures, and inspect the complete history through APIs and an operations console.

## 3. Current implementation baseline

The repository currently contains:

- **Implemented**: NestJS and TypeScript backend.
- **Implemented**: GraphQL/Apollo `evaluateLoan` request path.
- **Implemented**: deterministic income, credit, and document simulators.
- **Implemented**: concurrent integration retrieval through `Promise.all`.
- **Implemented**: deterministic decision rules.
- **Implemented**: provider-neutral rules and local Ollama/Qwen decision modes.
- **Implemented**: schema-constrained local-model responses with application validation.
- **Implemented**: TypeORM/PostgreSQL persistence with JSONB integration payloads.
- **Implemented**: Jest unit and end-to-end foundations.
- **Implemented**: Docker and Docker Compose development path.
- **Implemented**: no-paid-model default execution.

The current implementation remains an MVP. The following target capabilities are **Planned**:

- case, evidence, condition, policy, workflow, and review domain models;
- explicit database migrations and tenant-first schema design;
- durable Temporal workflows, transactional outbox, safe replay, and signed webhooks;
- versioned policy-as-code DSL with validation, approval, and regression testing;
- stateful, tool-using Agent execution with budgets and human interruption;
- provider registry, normalized contracts, fault injection, sandbox, and BYOC modes;
- OIDC, API clients, RBAC, row-level security, consent, PII controls, and retention;
- React operations console and developer sandbox;
- OpenTelemetry, release evaluation, CI/CD, infrastructure as code, and restore drills;
- real provider or official underwriting integrations.

The legacy `APPROVED`, `CONDITIONAL`, and `DENIED` demo vocabulary is not the target product contract and will be migrated before launch.

## 4. Product position

### 4.1 Category

Mortgage Integration Agent is an **Autonomous Lending Operations Platform**. It sits between existing borrower experiences, loan systems, data providers, policy owners, and human operations teams.

It is not a replacement for every system in the lending stack. Customers retain their systems of record, provider contracts, policies, and decision authority while the platform coordinates the work between them.

### 4.2 Initial target users

1. **Fintech integration developer**
   - Needs stable contracts across inconsistent providers.
   - Needs idempotency, SDKs, fixtures, webhooks, and traceable failures.

2. **Lending operations specialist**
   - Needs prioritized conditions and next actions rather than raw payloads.
   - Needs cases to resume correctly after missing information arrives.

3. **Reviewer or underwriter**
   - Needs evidence, policy provenance, comparison tools, and explicit override controls.
   - Retains authority over protected decisions and communications.

4. **Risk, compliance, or audit reviewer**
   - Needs consent history, policy versions, data lineage, model versions, and actor attribution.

5. **Tenant administrator**
   - Manages users, API clients, provider connections, policy releases, budgets, retention, and webhooks.

### 4.3 Jobs to be done

- Assemble a coherent case from fragmented application, document, and provider data.
- Determine which evidence is present, missing, stale, contradictory, or unsupported.
- Evaluate evidence against a versioned operational policy pack.
- Create and prioritize resolvable conditions.
- Select approved tools and providers within cost, permission, and time constraints.
- Wait for information or review without losing workflow state.
- Re-evaluate only the affected facts and conditions when new evidence arrives.
- Explain each material result using evidence and policy provenance.
- Notify partner systems through reliable asynchronous contracts.
- Export an audit package without exposing unnecessary sensitive data.

### 4.4 Differentiation

- Works alongside existing loan and Fintech systems instead of requiring a full-stack replacement.
- Provider-neutral capability contracts with simulator, sandbox, and customer-owned production modes.
- Exception-first automation for the conditions loop, not only straight-through happy paths.
- Deterministic policy authority with AI-assisted extraction, planning, and explanation.
- Durable workflow execution separated from bounded Agent reasoning.
- Policy-as-code lifecycle with diff, testing, approval, release, and rollback.
- Agent governance with tool permissions, budgets, evaluation, replay, and human approval.
- Synthetic developer sandbox with deterministic fault injection.
- Mortgage-first domain depth with a path to reusable lending product packs.

### 4.5 Commercial model

The product is designed for a usage-based platform model:

- platform access and operations console;
- usage per active case, workflow run, or provider action;
- enterprise controls for SSO, audit export, retention, policy governance, and support;
- customer-owned provider contracts and credentials for production integrations;
- optional product packs and adapter packages.

Billing is outside the initial launch scope. Cost attribution is part of the domain from the first productized workflow.

## 5. Goals, non-goals, and engineering principles

### 5.1 Goals

- Deliver one end-to-end synthetic conventional-mortgage conditions workflow.
- Make long-running work recoverable, idempotent, observable, and safely replayable.
- Expose ergonomic partner APIs and an operable human-review experience.
- Make evidence, policies, model behavior, and overrides traceable.
- Run locally without paid model or provider credentials.
- Add providers without changing case, policy, or Agent domain logic.
- Support tenant isolation and least-privilege access before any shared deployment.
- Produce measurable product, reliability, security, and Agent-quality evidence.
- Preserve a modular architecture that can extend beyond mortgage through product packs.

### 5.2 Non-goals

- Issuing credit or producing a binding approve/deny decision.
- Claiming equivalence with an official automated underwriting system.
- Moving funds, locking real rates, ordering paid services, or delivering loans to capital markets in the public launch.
- Publishing copied proprietary guidelines or reverse-engineered vendor behavior.
- Training a proprietary foundation model.
- Building a general-purpose consumer chatbot.
- Supporting every mortgage or lending product in the first release.
- Replacing a customer's full loan origination system.
- Adopting microservices, Kubernetes, or multiple Agent frameworks without measured need.
- Ingesting real consumer PII into the public demo.
- Claiming legal, regulatory, security, or fairness certification from software controls alone.

### 5.3 Engineering principles

1. Correctness and evidence outrank model fluency.
2. Deterministic policy owns operational status; models propose bounded actions.
3. Humans retain authority over material, ambiguous, or externally communicated outcomes.
4. Every external effect is idempotent, attributable, and auditable.
5. Durable business state lives outside model context.
6. Every provider and model call has provenance, validation, timeout, and failure handling.
7. Synthetic data is the default; real credentials are explicit, tenant-owned, and environment-scoped.
8. Sensitive data is minimized before storage, logging, and inference.
9. A modular monolith remains the default until scale, security, or team ownership proves another boundary.
10. Product behavior is delivered in runnable vertical slices with proportional verification.

## 6. Product language and authority boundary

### 6.1 Case statuses

| Status | Meaning |
|---|---|
| `DRAFT` | Case exists but required intake data has not been submitted. |
| `COLLECTING_EVIDENCE` | Approved evidence-gathering work is active. |
| `CONDITIONS_OPEN` | One or more operational conditions require resolution. |
| `WAITING_FOR_INFORMATION` | Workflow is durably paused for additional evidence. |
| `WAITING_FOR_REVIEW` | A protected or ambiguous action requires a person. |
| `READY_FOR_UNDERWRITING` | Configured evidence and readiness conditions are satisfied. |
| `MANUAL_REVIEW` | The case cannot proceed safely within the configured automation boundary. |
| `CLOSED` | Work ended by an authorized actor or downstream lifecycle event. |

These statuses describe workflow readiness, not formal credit decisions.

### 6.2 Condition statuses

```ts
type ConditionStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_EVIDENCE'
  | 'SATISFIED'
  | 'WAIVED'
  | 'ESCALATED';
```

Every satisfied, waived, or escalated condition includes evidence or reviewer provenance and the policy version that governed the transition.

### 6.3 Authority order

1. Consent, authorization, and security controls may stop processing.
2. Validated source evidence remains attributable to its origin.
3. Deterministic calculations and released policy packs determine condition state and readiness.
4. The Agent may select approved tools, compare evidence, propose actions, and draft explanations.
5. Human reviewers approve protected communications, interpret out-of-policy cases, and record overrides.
6. Model output never silently overrides policy, source evidence, or a human decision.

## 7. Launch product and vertical slice

### 7.1 Launch scenario

The first launch scenario uses a synthetic conventional mortgage with W-2-style employment and generated documents. It demonstrates a meaningful evidence discrepancy and a full conditions loop:

1. Create a tenant-scoped loan case with an idempotency key.
2. Record synthetic consent and intake data.
3. Upload generated documents to local S3-compatible storage.
4. Start an asynchronous workflow and return `202 Accepted`.
5. Extract candidate facts and retain source locations.
6. Run simulated income, asset, credit, identity, and document capabilities.
7. Normalize findings and compare application, document, and provider evidence.
8. Execute a released synthetic policy pack.
9. Create prioritized conditions for missing or contradictory evidence.
10. Let the Agent select the next approved tool within budget.
11. Pause durably for information or human approval when required.
12. Resume when a signal supplies new evidence or a review decision.
13. Re-evaluate affected conditions and derive workflow readiness.
14. Publish signed status events and display the full timeline.

### 7.2 Included synthetic capabilities

- application completeness;
- income and employment evidence;
- asset evidence;
- credit-profile summary;
- identity consistency;
- document classification and structured field extraction;
- qualified-income, DTI, and LTV calculations using synthetic policy;
- evidence comparison and contradiction detection;
- condition creation and resolution;
- human review and override;
- audit package export.

### 7.3 Simulator failure modes

Every simulator supports deterministic fixtures for:

- success;
- incomplete response;
- inconsistent response;
- stale evidence;
- timeout;
- temporary unavailability;
- rate limiting;
- malformed payload;
- duplicate delivery;
- callback arriving after cancellation;
- provider recovery after fallback.

### 7.4 Deferred from initial launch

- real consumer data;
- real credit pulls or paid provider orders;
- official underwriting or government-sponsored enterprise integrations;
- rate locking, disclosures with legal effect, closing, settlement, or capital delivery;
- production document OCR contracts;
- additional lending product packs;
- billing and subscription management;
- multi-region disaster recovery;
- high-volume batch submission.

## 8. Product modules

### 8.1 Case and Evidence Hub

Owns the canonical case aggregate, borrowers, consent references, documents, extracted facts, normalized findings, evidence conflicts, versions, and lineage.

### 8.2 Conditions Resolution Agent

Observes case state, selects registered tools, proposes safe next actions, explains unresolved gaps, and routes protected or ambiguous work to human review.

### 8.3 Policy-as-Code Studio

Manages synthetic policy packs, DSL validation, test cases, impact analysis, review, release, deprecation, and rollback.

### 8.4 Provider Gateway

Resolves provider capabilities, credentials, operating modes, routing policy, health, retries, normalization, and provenance.

### 8.5 Durable Workflow Runtime

Owns cross-hour and cross-day orchestration, timers, retries, signals, compensation, workflow versioning, and safe replay.

### 8.6 Human Review Console

Shows cases, evidence, conditions, workflow history, proposed actions, review queues, overrides, and actor-attributed decisions.

### 8.7 Agent Governance and Evaluation

Controls tool permissions, budgets, model and prompt versions, release evaluations, adversarial fixtures, shadow runs, and replay reports.

### 8.8 Developer Sandbox

Provides generated cases and documents, simulator configuration, webhook inspection, API credentials, deterministic scenarios, and integration quickstarts.

## 9. Agent charter

### 9.1 Mission

The Agent advances a case toward an evidence-complete operational state by choosing approved information-gathering and comparison tools, proposing condition-resolution actions, and escalating uncertainty without claiming decision authority.

### 9.2 Runtime separation

```text
Temporal workflow
  owns durable lifecycle, waiting, retries, and external effects
        |
        `-- bounded Agent run
              owns short-lived planning and approved tool selection
                    |
                    `-- deterministic policy engine
                          owns calculations, conditions, and readiness
```

Temporal and PostgreSQL hold authoritative state. LangGraph is an Agent runtime adapter, not the system of record. Model conversation history is neither a workflow database nor an audit record.

### 9.3 Agent state

```ts
interface LendingOperationsAgentState {
  tenantId: string;
  caseId: string;
  caseVersion: number;
  workflowRunId: string;
  workflowStatus: string;
  consentStatus: 'VALID' | 'MISSING' | 'EXPIRED';
  evidenceSummary: EvidenceSummary[];
  openConditions: ConditionSummary[];
  providerHealth: ProviderHealthSummary[];
  attemptedTools: ToolAttemptSummary[];
  policyPackId: string;
  policyVersion: string;
  modelVersion?: string;
  promptVersion?: string;
  remainingStepBudget: number;
  remainingProviderBudget: number;
  remainingTokenBudget: number;
  proposedAction?: AgentAction;
  reviewState?: HumanReviewState;
}
```

### 9.4 Registered tools

| Tool | Purpose | Side effect | Approval boundary |
|---|---|---|---|
| `check_case_completeness` | Validate required intake fields | None | No |
| `inspect_documents` | Extract candidate facts from synthetic documents | Document processing | Consent required |
| `fetch_income_evidence` | Request income capability | Provider submission | Consent and budget required |
| `fetch_asset_evidence` | Request asset capability | Provider submission | Consent and budget required |
| `fetch_credit_evidence` | Request credit-summary capability | Provider submission | Consent and budget required |
| `check_identity_consistency` | Compare synthetic identity evidence | Provider submission | Consent required |
| `calculate_qualified_income` | Execute deterministic calculation | Versioned calculation | No |
| `calculate_dti` | Execute deterministic calculation | Versioned calculation | No |
| `calculate_ltv` | Execute deterministic calculation | Versioned calculation | No |
| `compare_evidence` | Detect missing, stale, or conflicting facts | None | No |
| `evaluate_policy` | Execute released policy pack | Creates assessment | No; policy owns result |
| `create_condition` | Materialize policy-supported condition | Case mutation | Schema and policy required |
| `draft_information_request` | Prepare a remediation request | Draft only | No |
| `send_information_request` | Deliver an external message | External communication | Human or configured policy approval |
| `escalate_to_reviewer` | Pause and create review task | Workflow transition | No |
| `publish_case_update` | Deliver a signed webhook | External communication | Policy-controlled and idempotent |

### 9.5 Agent loop

```text
LOAD VERSIONED CASE
  -> VERIFY TENANT, CONSENT, POLICY, AND BUDGET
  -> INSPECT CURRENT EVIDENCE AND CONDITIONS
  -> SELECT ONE OR MORE APPROVED READ-ONLY TOOLS
  -> REQUEST SIDE-EFFECTING TOOL THROUGH WORKFLOW GATE
  -> NORMALIZE AND VALIDATE OBSERVATIONS
  -> EXECUTE DETERMINISTIC CALCULATIONS AND POLICY
       -> sufficient evidence: propose condition transitions
       -> more information: draft request and wait
       -> ambiguity or protected action: interrupt for review
       -> budget or runtime failure: route to manual review
  -> EXPLAIN USING EVIDENCE AND POLICY REFERENCES
  -> COMMIT STATE AND OUTBOX EVENT
  -> END BOUNDED RUN
```

### 9.6 Mandatory review triggers

- contradictory identity, income, asset, credit, or document evidence;
- evidence confidence below the configured threshold for a material fact;
- unsupported policy interpretation or rule conflict;
- malformed model or tool output;
- manual waiver or override of a deterministic condition;
- material negative external communication;
- provider result outside the normalized contract;
- step, token, time, or provider-cost budget exhaustion;
- prompt-injection or tool-manipulation signal;
- any category configured by tenant risk policy.

### 9.7 Safety controls

- allowlisted tools with schema-validated arguments and results;
- server-side tenant context and credential resolution;
- no arbitrary HTTP, SQL, shell, code execution, secret retrieval, or tool installation;
- documents and provider payloads treated as untrusted content, never as instructions;
- explicit step, duration, token, provider-call, and cost budgets;
- deterministic fallback to human review on uncertainty or runtime failure;
- no storage or display of private chain-of-thought;
- complete model, prompt, policy, tool, input-hash, and result provenance;
- dry-run and shadow modes for unapproved model or policy versions.

## 10. Policy-as-Code

### 10.1 Policy lifecycle

```text
author synthetic rule
  -> validate DSL schema and types
  -> lint references and units
  -> detect conflicts and unreachable branches
  -> generate or attach test cases
  -> run regression and impact analysis
  -> reviewer approval
  -> immutable release
  -> case version pinning
  -> observe outcomes
  -> deprecate or roll back
```

AI may draft a candidate rule from authorized text, but generated rules never publish automatically. A released policy pack is human-reviewed, versioned, immutable, and covered by executable tests.

### 10.2 Example synthetic DSL

```yaml
rule:
  id: synthetic-income-discrepancy-review
  version: 1.0.0
  when:
    difference_percent:
      left: application.monthly_income
      right: evidence.verified_monthly_income
      greater_than: 10
  outcome:
    condition: VERIFY_INCOME_DISCREPANCY
    route: MANUAL_REVIEW
```

### 10.3 Policy invariants

- Policy identifiers and released versions are immutable.
- Units, money, ratios, dates, and rounding behavior are explicit.
- Every condition links to the rule and evidence that created it.
- Case evaluation pins a policy version and never silently changes mid-run.
- A policy upgrade requires regression evidence and an impact summary.
- Official or proprietary guidelines are not copied into the public repository.

## 11. Provider platform

### 11.1 Operating modes

```ts
type ProviderMode = 'SIMULATOR' | 'AUTHORIZED_SANDBOX' | 'PRODUCTION_BYOC';
```

- `SIMULATOR`: free default with deterministic synthetic fixtures.
- `AUTHORIZED_SANDBOX`: optional provider test environment enabled through authorized credentials.
- `PRODUCTION_BYOC`: customer supplies the contract, authority, credentials, and configuration.

### 11.2 Capability contract

```ts
interface ProviderAdapter<TRequest, TReceipt, TFinding> {
  readonly providerId: string;
  readonly capability: ProviderCapability;
  readonly mode: ProviderMode;
  submit(request: TRequest, context: ProviderContext): Promise<TReceipt>;
  poll?(receipt: TReceipt, context: ProviderContext): Promise<ProviderStatus>;
  normalize(payload: unknown, context: ProviderContext): TFinding;
  cancel?(receipt: TReceipt, context: ProviderContext): Promise<void>;
  healthCheck(): Promise<ProviderHealth>;
}
```

Adapters never write case state directly. Workflow activities validate and normalize provider output, then the domain layer commits state and an outbox event transactionally.

### 11.3 Routing

Provider selection uses deterministic constraints before optimization:

1. tenant authorization and operating mode;
2. product, jurisdiction, and capability eligibility;
3. consent and permissible-use configuration;
4. provider health and circuit state;
5. data freshness requirements;
6. latency, cost, and reliability score;
7. configured fallback order.

LLMs do not choose a provider by unconstrained preference. More advanced optimization may be added after the routing inputs and objectives are measurable.

### 11.4 Contract tests

Every adapter passes the same reusable suite:

- input and output schema validation;
- request idempotency;
- authentication and authorization failure mapping;
- timeout and retry classification;
- rate-limit handling;
- malformed, partial, stale, and contradictory payload behavior;
- duplicate and out-of-order callback handling;
- cancellation race behavior;
- normalized provenance;
- log and error redaction;
- health and fallback behavior.

## 12. Target architecture

### 12.1 Architecture style

Use a modular monolith with independently deployable API, worker, and web processes from one repository:

- **API service**: partner REST API, operations GraphQL API, authentication, validation, idempotency, and status retrieval.
- **Worker service**: Temporal workers, provider activities, Agent runs, policy execution, and webhook delivery.
- **Web application**: operations console, review experience, policy and sandbox surfaces.

This structure preserves one domain model and release train while allowing independent runtime scaling. Service extraction follows measured boundaries rather than speculative architecture.

### 12.2 Logical architecture

```text
Partner Systems                      Operations Users
 REST / OpenAPI                             React Web
       |                                        |
       +----------------+-----------------------+
                        |
                 API Service
        REST + GraphQL + Auth + Idempotency
                        |
             PostgreSQL transaction
           domain state + audit + outbox
                        |
        +---------------+----------------+
        |                                |
 Outbox dispatcher                 Temporal client
        |                                |
 Signed webhooks                  Temporal service
                                         |
                                  Worker Service
                           workflow + activities + signals
                              |          |          |
                         AgentRuntime  Policy     Provider
                         port/adapter   Engine     Gateway
                              |                     |
                    LangGraph.js / rules       Simulator
                    Model Gateway              Sandbox
                    Ollama or vLLM             BYOC

 PostgreSQL: domain, versions, audit, idempotency, outbox, Agent metadata
 S3/MinIO: documents and encrypted large or raw payloads
 OpenTelemetry: correlated traces, metrics, and redacted logs
```

### 12.3 Module boundaries

```text
apps/
  api/                 REST, GraphQL, auth, validation, status
  worker/              Temporal workers and activities
  web/                 operations console
libs/
  domain/              cases, evidence, conditions, policy contracts
  application/         use cases, ports, authorization decisions
  workflows/           workflow definitions, signals, versioning
  agent/               graph, tools, budgets, runtime port
  policy/              DSL, compiler, evaluator, release lifecycle
  providers/           registry, routing, adapters, simulators
  reviews/             review tasks, decisions, overrides
  audit/               append-only domain and security events
  platform/            database, storage, telemetry, configuration
```

The repository remains a single package until the API, worker, and web boundaries exist. Workspace or task-graph tooling is introduced only when it removes measured build or dependency-management friction.

### 12.4 Dependency direction

Domain and application contracts do not import web frameworks, model SDKs, queue clients, cloud SDKs, or provider packages. Infrastructure adapters depend inward on ports owned by the application core.

## 13. Target technology stack

| Layer | Target | Rationale |
|---|---|---|
| Runtime | Node.js 24 LTS | Active LTS production baseline; non-LTS Current releases are deferred. |
| Language | TypeScript 6, strict | Stable bridge for tools requiring the programmatic compiler API; TypeScript 7 adoption is compatibility-gated. |
| Backend | NestJS 11 + Express 5 | Mature modular TypeScript framework and supported migration path. |
| Partner API | REST + OpenAPI 3.1 | Broad Fintech interoperability and SDK generation. |
| Operations API | GraphQL + Apollo Server | Flexible case, evidence, and timeline querying for the console. |
| Database | PostgreSQL 18 | Supported relational system of record with transactions, JSON, RLS, and indexing. |
| Data access | TypeORM 0.3 patched + explicit SQL where warranted | Preserve current investment; migrations and transaction boundaries stay explicit. |
| Durable execution | Temporal + TypeScript SDK | Long-running waits, retries, signals, recovery, and workflow versioning. |
| Agent runtime | `AgentRuntime` port with LangGraph.js v1 adapter | Stateful bounded Agent execution without framework lock-in. |
| Policy | Versioned internal DSL + deterministic evaluator | Testable authority independent of model behavior. |
| Local inference | Ollama + Qwen3.5-9B | Free local structured inference for the target development machine. |
| Production inference | Model Gateway + private vLLM-compatible serving | OpenAI-compatible, model-neutral serving boundary. |
| Web | React 19 + TypeScript + query/state tooling | Mainstream operations UI with explicit loading, error, and recovery states. |
| Object storage | S3-compatible storage; MinIO locally | Durable document and raw-payload boundary with lifecycle support. |
| Identity | Managed OIDC/OAuth 2.0 + scoped API clients | Avoid implementing credential security in the domain core. |
| Telemetry | OpenTelemetry | Vendor-neutral traces, metrics, logs, and context propagation. |
| Tests | Jest, Supertest, Testcontainers, property and contract tests | Layered correctness and integration evidence. |
| Infrastructure | Terraform/OpenTofu + AWS ECS Fargate target | Portable infrastructure definitions without premature Kubernetes. |
| CI/CD | GitHub Actions + OIDC | Short-lived cloud credentials and auditable gates. |

Exact patch versions are selected, locked, security-scanned, and compatibility-tested in the implementation commit. Newest is not synonymous with safest: Active LTS and ecosystem support take precedence over version numbers.

TypeScript 7 is released but does not yet expose the same programmatic API used by parts of the current JavaScript toolchain. The migration proceeds through TypeScript 6 and may evaluate TypeScript 7 side-by-side before making it the repository default.

## 14. Data architecture

### 14.1 Core entities

| Entity | Purpose |
|---|---|
| `tenants` | Organization boundary and configuration. |
| `users` | OIDC-linked human identity. |
| `tenant_memberships` | Role assignment by tenant. |
| `api_clients` | Scoped machine identity and key metadata. |
| `loan_cases` | Versioned aggregate and current workflow readiness. |
| `borrowers` | Minimized borrower profile with encrypted sensitive fields. |
| `consent_records` | Purpose, scope, policy version, grant, and expiration evidence. |
| `documents` | Object metadata, checksum, media type, scan, and retention state. |
| `evidence_facts` | Typed facts with source, confidence, validity, and lineage. |
| `evidence_conflicts` | Contradictory fact relationships and resolution state. |
| `policy_packs` | Product and policy package metadata. |
| `policy_versions` | Immutable released DSL and test manifest. |
| `policy_evaluations` | Versioned rule execution and evidence references. |
| `loan_conditions` | Condition lifecycle and required evidence. |
| `condition_transitions` | Actor-attributed condition state history. |
| `provider_connections` | Tenant provider mode and credential reference. |
| `provider_submissions` | Idempotent provider request and aggregate status. |
| `provider_attempts` | Attempt, latency, error, retry, and cost metadata. |
| `provider_findings` | Normalized results and provenance. |
| `workflow_runs` | Durable business workflow identity and status. |
| `workflow_steps` | User-facing activity timeline and failure state. |
| `agent_runs` | Runtime, model, prompt, budgets, tools, and final route. |
| `tool_attempts` | Arguments hash, result hash, side effect, and outcome. |
| `review_tasks` | Pending protected action or exception review. |
| `review_decisions` | Reviewer result, rationale, version, and override history. |
| `idempotency_keys` | Tenant, route, key, request hash, and response reference. |
| `webhook_endpoints` | Destination, secret reference, subscriptions, and state. |
| `webhook_deliveries` | Signed attempt history and replay state. |
| `audit_events` | Append-only actor, action, resource, and security history. |
| `outbox_events` | Transactionally committed events awaiting publication. |

### 14.2 Data rules

- Every tenant-owned table includes `tenant_id` and tenant-first indexes.
- Service authorization is primary; PostgreSQL row-level security provides defense in depth.
- Money uses integer minor units plus currency or an explicit decimal type and rounding policy.
- Ratios store defined scale and rounding behavior.
- Every mutable aggregate includes version and actor provenance.
- Evidence retains source location, observed time, validity interval, and transformation history.
- Raw provider payloads are encrypted, access-controlled, and short-lived.
- Documents live in object storage rather than relational binary columns.
- Logs contain identifiers, classifications, and hashes instead of full borrower data.
- Public demos and automated tests use visibly synthetic data only.
- Deletion and retention workflows preserve only the audit metadata legally and operationally permitted.

## 15. API and developer experience

### 15.1 Partner REST API

```text
POST   /v1/loan-cases
GET    /v1/loan-cases/{caseId}
POST   /v1/loan-cases/{caseId}/consents
POST   /v1/loan-cases/{caseId}/documents
POST   /v1/loan-cases/{caseId}/workflow-runs
GET    /v1/loan-cases/{caseId}/workflow-runs/{runId}
GET    /v1/loan-cases/{caseId}/conditions
GET    /v1/loan-cases/{caseId}/evidence
POST   /v1/loan-cases/{caseId}/reviews
GET    /v1/loan-cases/{caseId}/audit-export
POST   /v1/webhook-endpoints
GET    /v1/webhook-deliveries/{deliveryId}
```

Long-running commands return `202 Accepted` with stable status URLs.

### 15.2 Operations GraphQL API

GraphQL serves case lists, evidence graphs, timelines, review queues, policy releases, provider health, Agent runs, and evaluation reports. Production environments disable public introspection and interactive explorers unless explicitly authorized.

### 15.3 API standards

- checked and published OpenAPI artifact;
- stable operation identifiers for SDK generation;
- consistent RFC 9457-style problem details;
- request and trace identifiers on all responses;
- cursor pagination and explicit filtering;
- API version and deprecation policy;
- request, upload, and query-complexity limits;
- tenant and client rate limits;
- idempotency for every externally initiated mutation with side effects;
- timestamped HMAC webhook signatures and replay protection;
- stable event identifiers across retries;
- contract tests for backward compatibility.

### 15.4 Event catalog

```text
loan_case.created
workflow_run.started
workflow_run.waiting_for_information
workflow_run.waiting_for_review
workflow_run.completed
workflow_run.failed
evidence.updated
condition.opened
condition.satisfied
condition.escalated
review.completed
policy_version.released
provider_submission.failed
```

### 15.5 Sandbox and SDKs

The launch includes a TypeScript SDK or generated client, runnable examples, deterministic API fixtures, webhook inspector, scenario catalog, and a one-command local environment. A generated Python example client may follow after the OpenAPI contract stabilizes.

MCP is an optional adapter over the same registered tools and authorization layer. It is not a separate source of business logic or an early launch dependency.

## 16. Security, privacy, and responsible AI

### 16.1 Security controls

- OIDC/OAuth 2.0 for people and scoped credentials for machines;
- service-layer RBAC and tenant-context enforcement;
- PostgreSQL RLS as defense in depth;
- envelope encryption or managed KMS for sensitive fields and objects;
- centralized secret references without prompt or log exposure;
- secure headers, strict CORS, body and upload limits, and rate limiting;
- production GraphQL explorer and broad introspection disabled;
- malware scanning and media verification for uploads;
- signed URLs with short expiry;
- dependency, secret, container, and infrastructure scanning;
- append-only security audit events;
- documented incident response, key rotation, backup, and restore procedures.

### 16.2 Privacy controls

- purpose-bound consent checked before provider and document processing;
- data minimization and field-level access policy;
- configurable retention and deletion workflows;
- redacted logs, traces, errors, prompts, and evaluation artifacts;
- environment and tenant separation;
- no real consumer data in public demos, fixtures, screenshots, or evaluation corpora;
- data export and deletion operations recorded with actor provenance.

### 16.3 Responsible-AI controls

- deterministic policy authority and visible human-review boundary;
- protected characteristics excluded from model inputs unless an approved, documented use requires them;
- evidence references for material claims;
- model, prompt, schema, tool, and policy versioning;
- output schema and semantic validation;
- uncertainty and contradiction routed to a person;
- no private chain-of-thought retention or display;
- adversarial evaluation for prompt injection, unsupported claims, and unsafe tools;
- model changes gated by evaluation rather than anecdotal examples;
- synthetic policy results never represented as legal or official underwriting findings.

### 16.4 Threat scenarios

- cross-tenant object reference and query leakage;
- forged tenant or role context;
- webhook replay and signature confusion;
- idempotency-key reuse with a changed request;
- prompt injection embedded in documents or provider payloads;
- tool argument manipulation and privilege escalation;
- SSRF through provider or webhook configuration;
- raw PII in logs, traces, model requests, or error messages;
- stale policy or model version execution;
- duplicate provider callbacks after workflow cancellation;
- malicious file content and decompression abuse;
- unauthorized review override or audit tampering.

## 17. Reliability and observability

### 17.1 Reliability behavior

- API acknowledgment occurs only after durable state is committed.
- Temporal owns workflow retries and waits; activities remain idempotent.
- External delivery uses outbox-backed publication and stable event identifiers.
- Retries use explicit classifications, bounded attempts, backoff, and jitter.
- Circuit breakers prevent repeated calls to unhealthy providers.
- Workflow replay does not duplicate completed external effects.
- Versioned workflow code preserves deterministic replay compatibility.
- Failed work remains inspectable and recoverable through operations tooling.
- Provider fallback never changes the semantic capability contract silently.
- Graceful shutdown stops new work and safely finishes or abandons leased activity work.

### 17.2 Initial SLO targets

Targets are release objectives, not current measurements:

- monthly API availability: `99.9%` for the synthetic staging service;
- acknowledged case and review mutations lost: `0`;
- duplicate externally visible effects from idempotent replay: `0`;
- p95 non-workflow API latency: below `500 ms` under the published load profile;
- p95 workflow-start acknowledgment: below `1 s` under the published load profile;
- signed webhook eventual delivery: at least `99.9%` within the configured retry window for healthy receivers;
- cross-tenant authorization failures that expose data: `0`.

The load profile, environment, sample size, and measurement method accompany every reported result.

### 17.3 Telemetry

Every request, workflow, Agent run, provider attempt, policy evaluation, review, and webhook carries correlated tenant-safe identifiers.

Required telemetry includes:

- request rate, errors, duration, and saturation;
- workflow state, schedule-to-start, activity retries, and stuck executions;
- provider latency, errors, rate limits, fallback, and circuit state;
- condition age, reopen rate, and time waiting for evidence;
- Agent steps, tool choices, schema failures, escalation, tokens, and cost;
- policy version distribution and evaluation failures;
- webhook backlog and terminal delivery failures;
- database pool, query latency, locks, and migration state;
- redaction failures and security events.

## 18. Testing and evaluation

### 18.1 Test strategy

1. **Unit tests**: calculations, domain transitions, authorization, redaction, and pure policy rules.
2. **Property-based tests**: money, ratios, policy invariants, idempotency, and condition-state machines.
3. **Migration tests**: clean installation, forward migration, data preservation, and compatibility checks.
4. **Integration tests**: PostgreSQL, Temporal, object storage, provider adapters, and outbox behavior.
5. **Contract tests**: API compatibility, webhooks, and reusable provider expectations.
6. **Workflow tests**: timers, signals, retries, cancellation, versioning, and replay.
7. **End-to-end tests**: complete synthetic case and review journeys.
8. **Security tests**: tenant isolation, authorization, injection, SSRF, upload, and webhook abuse.
9. **Reliability tests**: crash, timeout, duplicate, partial failure, and recovery scenarios.
10. **Load and soak tests**: declared environment and reproducible workload.
11. **Agent evaluation**: golden cases, adversarial documents, tool constraints, and model comparisons.

### 18.2 Evaluation corpus

```text
evaluation/
  cases/                 synthetic case inputs
  documents/             generated and adversarial documents
  expected-facts/        extraction ground truth
  expected-conditions/   policy and condition ground truth
  provider-failures/     timeout, duplicate, stale, malformed scenarios
  prompt-injection/      untrusted content fixtures
  model-configs/         model and prompt manifests
  reports/               reproducible release reports
```

The first release target is at least 150 synthetic cases across normal, boundary, contradiction, missing-data, provider-failure, and adversarial categories.

### 18.3 Agent release gates

- unauthorized tool execution: `0`;
- material unsupported claims: `0` on the release corpus;
- evidence reference coverage for material output: `100%`;
- mandatory-review recall: `100%` on designated release cases;
- deterministic policy repeatability: `100%` for identical versioned inputs;
- malformed output accepted as valid: `0`;
- tool-selection, condition precision, and condition recall thresholds are declared before evaluation and recorded with the report;
- model, prompt, policy, dataset, and code revisions are pinned in every report.

Failed or partial results remain visible. Evaluation reports distinguish cache hits and replayed results from new inference cost.

## 19. Deployment and cost strategy

### 19.1 Free local profile

Local development uses:

- Docker Compose;
- PostgreSQL;
- Temporal development service;
- MinIO or filesystem-backed S3-compatible storage;
- deterministic provider simulators;
- rules as the default decision provider;
- optional Ollama and Qwen local inference;
- local OpenTelemetry-compatible collection where practical.

The primary demo path requires no paid model key or provider credential.

### 19.2 Cloud target

The first cloud architecture targets AWS ECS Fargate with managed PostgreSQL, S3, KMS, managed secrets, load balancing, WAF, and OpenTelemetry-compatible telemetry. Temporal may be self-hosted for controlled staging evaluation or consumed as a managed service after cost and operational review.

Kubernetes is deferred until measured scheduling, portability, or organizational needs justify its control-plane cost.

### 19.3 Environments

- `local`: synthetic data, local dependencies, developer-owned.
- `test`: ephemeral dependencies and deterministic fixtures.
- `staging`: synthetic data only, production-like controls and deployment path.
- `production`: absent until real-data, legal, provider, security, privacy, and operational approval exists.

### 19.4 Cost controls

- per-tenant and per-workflow step, provider, token, storage, and concurrency budgets;
- immutable finding reuse when consent, freshness, and policy permit;
- idempotency prevents duplicate provider and model cost;
- model and provider usage attributed to workflow runs;
- local and staging model services can remain off outside evaluation windows;
- cost-bearing infrastructure requires a documented budget and teardown path;
- business metrics include cost per workflow and per resolved condition.

## 20. Delivery strategy

Delivery proceeds through runnable vertical slices. Each milestone ends with a demonstrable user or developer outcome, current verification evidence, and a separately reviewable set of commits.

### Milestone status

| Milestone | Outcome | Status |
|---|---|---|
| M0 | Stable free model baseline and independent product charter | Implemented |
| M1 | Supported runtime, migrations, and security baseline | Planned |
| M2 | Durable loan case, evidence, and condition workflow | Planned |
| M3 | Policy DSL, bounded Agent tools, and human review | Planned |
| M4 | Provider gateway, partner API, webhooks, and sandbox | Planned |
| M5 | Tenant trust boundary and audit controls | Planned |
| M6 | Operations console and release evaluation | Planned |
| M7 | Synthetic staging and launch evidence | Planned |

### M0 — Product foundation

**Outcome:** the repository runs without a paid model credential and has an independent, vendor-neutral product contract.

Evidence:

- deterministic rules default;
- optional local Qwen/Ollama provider;
- structured-output validation and safe failure behavior;
- current MVP tests and build evidence recorded in the development journal;
- this target-state charter and public engineering guidelines.

### M1 — Supported runtime and security baseline

**User-visible outcome:** the existing demo retains behavior on a supported, hardened runtime with explicit database lifecycle.

Scope:

- Node.js 24 LTS;
- NestJS 11, Express 5, compatible Apollo and GraphQL packages;
- TypeScript 6 bridge and Jest migration;
- patched dependencies and lockfile review;
- environment schema validation;
- explicit TypeORM migrations and production `synchronize: false`;
- secure headers, CORS allowlist, rate limiting, body limits, and graceful shutdown;
- liveness and dependency-aware readiness endpoints;
- production GraphQL explorer and broad introspection controls.

Exit evidence:

- clean install, build, lint, unit, end-to-end, migration, Docker, and vulnerability checks;
- current compatibility decisions recorded with exact versions.

### M2 — Durable conditions vertical slice

**User-visible outcome:** a synthetic case enters a condition workflow, waits, receives evidence, resumes after restart, and reaches a readiness state.

Scope:

- tenant-keyed case, evidence, condition, audit, workflow, and idempotency schema;
- REST workflow-start and status endpoints;
- API and worker process boundaries;
- Temporal workflow, activities, signals, retry classification, and replay tests;
- transactional outbox and signed status event foundation;
- deterministic synthetic discrepancy scenario.

Exit evidence:

- injected process restart loses no acknowledged work;
- duplicate command and signal tests produce no duplicate domain effect;
- workflow history and condition transitions are inspectable.

### M3 — Policy and Agent vertical slice

**User-visible outcome:** the Agent inspects evidence, selects allowed tools, applies a released synthetic policy, pauses for review, and resumes after a decision.

Scope:

- policy DSL parser, validator, evaluator, versioning, and golden tests;
- `AgentRuntime` port and LangGraph.js v1 adapter;
- registered tools, schemas, budgets, and side-effect gates;
- reviewer interrupt and resume flow;
- minimal review surface sufficient to operate the workflow;
- evidence-backed explanations and Agent run timeline;
- initial release evaluation corpus and report command.

Exit evidence:

- unauthorized tools remain unreachable;
- designated review cases always interrupt;
- repeated versioned inputs produce the same policy result;
- malformed model output routes safely.

### M4 — Provider and developer platform vertical slice

**Developer-visible outcome:** an integration developer can use the REST API, SDK, simulator, and signed webhooks while exercising provider failures deterministically.

Scope:

- provider registry, capability contracts, health, routing, and normalization;
- income, asset, credit, identity, and document simulators;
- reusable adapter contract suite;
- REST/OpenAPI contract and TypeScript client;
- webhook subscriptions, delivery retries, history, and replay protection;
- sandbox scenarios, webhook inspector, and quickstart;
- safe replay and provider fallback operations.

Exit evidence:

- a new simulator adapter is added without domain or Agent changes;
- every documented failure mode is covered by a deterministic test;
- generated client completes the published quickstart.

### M5 — Fintech trust boundary

**User-visible outcome:** multiple tenants can use the platform without crossing identity, data, provider, policy, or audit boundaries.

Scope:

- OIDC and scoped API-client authentication;
- RBAC, tenant context, and PostgreSQL RLS;
- consent enforcement;
- encrypted field and object boundaries;
- retention, deletion, and audit export workflows;
- tenant-owned provider, policy, webhook, and budget configuration;
- threat-model tests and negative authorization suite.

Exit evidence:

- cross-tenant tests fail closed at API, service, and database layers;
- every material mutation records actor, tenant, resource, correlation, and reason provenance.

### M6 — Operations and evaluation vertical slice

**User-visible outcome:** operations users can understand, review, and recover every synthetic case without direct database access.

Scope:

- React case list and detail;
- evidence, condition, policy, provider, Agent, workflow, review, and audit views;
- explicit empty, loading, degraded, retrying, stale, unauthorized, and disconnected states;
- accessible interaction and keyboard navigation;
- evaluation dashboard and downloadable release report;
- OpenTelemetry dashboards and alerts;
- operational replay, cancellation, and recovery controls.

Exit evidence:

- the launch scenario and injected failure scenario are operable through the UI;
- accessibility and unhappy-path checks pass;
- no sensitive fixture content appears in telemetry or unauthorized views.

### M7 — Synthetic staging launch

**Outcome:** the product is reproducibly deployed with synthetic data and production-like engineering controls.

Scope:

- Terraform/OpenTofu environment definitions;
- GitHub Actions OIDC deployment;
- synthetic staging data and access controls;
- load, soak, security, backup, restore, and failure-recovery evidence;
- SLO dashboards, alerts, runbooks, and incident exercise;
- architecture decision records and demo walkthrough;
- release artifact, dependency, and source-revision traceability.

Exit evidence:

- all launch gates in Section 22 pass in staging;
- live health, workflow, review, webhook, and recovery paths are verified;
- the release remains explicitly synthetic and is not represented as approved for real borrower data.

## 21. Product and operational metrics

### 21.1 Primary product outcome

- Median time from case creation to the first actionable evidence-and-condition plan.

### 21.2 Workflow metrics

- time spent waiting for information;
- time from new evidence to affected-condition re-evaluation;
- manual touches per case;
- percentage of conditions resolved without manual interpretation;
- condition reopen rate;
- human-review rate and duration;
- workflow completion, cancellation, and terminal-failure rates;
- provider retry, fallback, and terminal-failure rates;
- signed webhook delivery latency and success;
- cost per workflow and resolved condition.

### 21.3 Agent and policy metrics

- tool-selection accuracy;
- mandatory-review recall;
- condition precision and recall;
- evidence reference coverage;
- unsupported material claim rate;
- unauthorized tool rate;
- malformed output rejection rate;
- policy conflict and regression rate;
- steps, latency, tokens, and cost by model configuration.

### 21.4 Guardrails

- cross-tenant data exposure: `0`;
- unauthorized Agent tool execution: `0`;
- unsupported material claim accepted by a release gate: `0`;
- lost acknowledged workflow work: `0`;
- duplicate external side effects caused by replay: `0`;
- unattributed human override: `0`;
- real consumer data in public demo or evaluation artifacts: `0`.

## 22. Launch gates

### 22.1 Product gates

- end-to-end synthetic conditions journey is usable through documented APIs and the console;
- every condition links to evidence and a policy version;
- review, wait, resume, cancellation, and recovery paths are demonstrated;
- API, SDK, webhook, and sandbox quickstarts are current;
- all user-visible capabilities distinguish synthetic from official results.

### 22.2 Security and privacy gates

- tenant-isolation and authorization suites pass;
- secrets, dependency, container, and infrastructure scans pass at the declared threshold;
- threat model and abuse-case tests are current;
- logs, traces, prompts, errors, screenshots, and fixtures pass PII review;
- backup, restore, retention, deletion, and key-rotation procedures are exercised;
- no real borrower data is accepted by the public launch environment.

### 22.3 Reliability gates

- migration, workflow replay, crash recovery, duplicate delivery, and webhook retry tests pass;
- declared load and soak profiles meet release objectives;
- alerts fire in injected provider, queue, database, and webhook failure scenarios;
- operations users can recover documented failures without database mutation;
- runbooks identify owners, detection, mitigation, rollback, and verification.

### 22.4 AI and policy gates

- pinned evaluation corpus and configuration produce a reproducible report;
- unauthorized-tool, mandatory-review, evidence-coverage, malformed-output, and unsupported-claim gates pass;
- every released policy version has approval and regression evidence;
- Agent and policy failures route to safe states;
- no model output is represented as private reasoning or official underwriting authority.

### 22.5 Delivery gates

- source, dependencies, migrations, infrastructure, release artifact, and deployed revision are traceable;
- CI is green from a clean checkout;
- rollback and restore paths are documented and exercised;
- known limitations and unverified boundaries are published with the release.

## 23. Risks and mitigation

| Risk | Mitigation |
|---|---|
| Product becomes a generic Agent demo | Keep the conditions loop, evidence graph, policy lifecycle, and provider failures central. |
| Product becomes a copy of one company | Maintain independent positioning, public standards, provider neutrality, and a multi-lending extension model. |
| Model output is mistaken for a lending decision | Use workflow-readiness vocabulary, deterministic authority, visible provenance, and human review. |
| Architecture grows faster than evidence | Deliver vertical slices and defer service extraction, Kubernetes, and secondary frameworks. |
| Temporal and LangGraph duplicate state | Temporal owns durable lifecycle; LangGraph remains bounded behind `AgentRuntime`. |
| Rules encode hidden errors | Add types, units, property tests, human approval, regression, impact analysis, and rollback. |
| Provider behavior corrupts case state | Normalize through contracts, isolate activities, validate payloads, and commit through the domain layer. |
| Synthetic demo overstates production | Preserve explicit status labels and prohibit real-data claims without launch gates. |
| PII reaches models or telemetry | Minimize inputs, redact at boundaries, test logging, and use tenant-controlled inference configuration. |
| Latest versions destabilize delivery | Prefer LTS and supported compatibility; gate major upgrades separately. |
| Expansion breadth obscures product depth | Complete one conventional-mortgage vertical slice before additional product packs. |
| Cloud cost expands without value | Keep local free defaults, attribute usage, require budgets, and avoid idle model infrastructure. |

## 24. Definition of done

A feature slice is complete when applicable evidence includes:

- acceptance criterion and user or developer outcome;
- domain and architecture fit;
- implementation and migration;
- unit, property, integration, contract, workflow, security, or end-to-end tests proportional to risk;
- authorization, privacy, failure, idempotency, and observability behavior;
- API and documentation changes;
- development-journal entry with commands and exact results;
- reviewed diff without unrelated changes;
- one coherent, independently revertible commit;
- explicit disclosure of untested, undeployed, or deferred boundaries.

Passing unit tests alone does not establish production readiness.

## 25. Release and repository governance

- One coherent, independently understandable feature slice maps to one commit.
- Implementation, migration, tests, documentation, and journal evidence stay in the same commit when practical.
- Unrelated changes are not mixed into a feature commit.
- Large features are divided by acceptance criterion and observable outcome.
- Material changes are reviewed through pull requests with linked verification evidence.
- Protected branches require current CI and review before merge.
- Release artifacts are immutable and traceable to source and lockfile revisions.
- Cost-bearing infrastructure requires a budget, scaling limits, and teardown procedure.
- Real providers and real data require explicit authorization, credentials, legal and compliance review, and environment approval.

## 26. Development journal

`docs/DEVELOPMENT_LOG.md` is an append-only engineering record organized by milestone and feature identifier rather than calendar date.

Each feature entry records:

- milestone, status, and acceptance criterion;
- problem and intended outcome;
- implementation and affected files;
- architecture and product decisions, including rejected alternatives;
- commands and exact verification results;
- failures, root cause, and resolution;
- security, privacy, data, cost, and compatibility considerations;
- known gaps and the next safe step.

The journal preserves evidence rather than polishing history. Failed experiments, stale assumptions, and unverified boundaries remain visible.

## 27. Code documentation guidelines

Useful comments and JSDoc preserve context that is difficult to infer from syntax. They are especially valuable around:

- lending-policy intent, units, rounding, and authority boundaries;
- tenant, consent, privacy, and authorization constraints;
- transaction, idempotency, retry, timeout, cancellation, replay, and compensation reasoning;
- provider normalization assumptions and lossy transformations;
- workflow versioning and deterministic replay constraints;
- Agent permissions, budgets, routing, fallback, and review triggers;
- public interfaces, adapters, policy contracts, and domain invariants;
- non-obvious compatibility workarounds and performance tradeoffs.

A good comment explains why a design exists, which assumptions it relies on, and what failure behavior protects. Comments that repeat syntax, narrate every line, preserve dead code, or imply unsupported compliance guarantees add noise. Related documentation evolves with behavior so the implementation and rationale remain aligned.

## 28. Architecture decision records

Implementation creates focused ADRs for decisions with durable consequences, beginning with:

1. Modular monolith with separately deployed API, worker, and web processes.
2. REST/OpenAPI for partners and GraphQL for operations.
3. PostgreSQL as system of record with transactional outbox.
4. Temporal as durable workflow owner and LangGraph behind an `AgentRuntime` port.
5. Deterministic policy authority over model proposals.
6. Versioned internal policy DSL and release lifecycle.
7. Provider modes: simulator, authorized sandbox, and production BYOC.
8. Synthetic-only public launch and real-data approval boundary.
9. Terraform/OpenTofu and ECS Fargate before Kubernetes.
10. Stable repository name with product identity expressed through documentation.

## 29. Immediate next implementation slice

The next implementation milestone is **M1: supported runtime and security baseline**. It remains separate from the domain and workflow migration.

Recommended first acceptance-criterion commits:

1. Upgrade Node.js and NestJS/Express/Apollo runtime packages with compatibility tests.
2. Migrate TypeScript and Jest tooling without changing product behavior.
3. Add startup environment validation and production-safe defaults.
4. Add explicit initial TypeORM migration and disable production schema synchronization.
5. Add liveness, readiness, graceful shutdown, secure headers, CORS, rate limiting, and request limits.
6. Record clean-install, build, lint, test, migration, Docker, and dependency evidence.

M2 begins only after the supported baseline is verified. Its first vertical slice is a tenant-keyed `LoanCase -> Evidence -> Condition -> Temporal wait -> Signal -> Resume` workflow using synthetic data.

## 30. Reference baseline

Technology choices are based on official project documentation and are revalidated during implementation:

- Node.js release schedule: <https://github.com/nodejs/release>
- NestJS 11 migration guide: <https://docs.nestjs.com/migration-guide>
- TypeScript release notes: <https://devblogs.microsoft.com/typescript/>
- PostgreSQL version policy: <https://www.postgresql.org/support/versioning/>
- Temporal documentation: <https://docs.temporal.io/>
- LangGraph.js v1 release notes: <https://docs.langchain.com/oss/javascript/releases/langgraph-v1>
- React versions: <https://react.dev/versions>
- OpenAPI specification: <https://spec.openapis.org/oas/>
- OpenTelemetry documentation: <https://opentelemetry.io/docs/>

External references justify technology maturity and compatibility only. They do not prove that target capabilities are implemented in this repository.
