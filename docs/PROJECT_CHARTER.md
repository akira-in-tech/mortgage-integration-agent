# Mortgage Integration Agent — Product and Engineering Charter

> Mortgage-first, lending-extensible autonomous operations platform

| Field | Value |
|---|---|
| Document status | Target-state charter; implementation plan, not a production-readiness claim |
| Version | 2.5 |
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
- **Provider-integration-ready**: a named provider, capability, adapter version, schema profile, and sandbox environment use the same domain workflow and canonical contract as the simulator; certification evidence exists, but production credentials and real consumer data remain disabled.
- **Production-approved**: a named tenant, data flow, provider tuple, product, jurisdiction, and environment passed the required security, privacy, reliability, compliance, and operational gates for real customer data.
- **Planned**: target capability without implementation evidence.

These states are independent. A working local demo is not a production deployment, and a successful deployment is not proof of production approval.

## 2. Executive summary

Mortgage Integration Agent is a vendor-neutral autonomous lending operations platform that coordinates loan cases, evidence, policies, providers, AI-assisted actions, and human review across existing Fintech systems.

The initial product is **mortgage-first and lending-extensible**. Its first vertical slice resolves routine mortgage evidence and underwriting-readiness conditions using synthetic data. The core platform is designed so that future product packs can support other lending workflows without replacing the workflow, provider, governance, or audit foundations.

Under this charter, the platform does not issue credit, originate loans, reproduce an official underwriting result, or replace an authorized decision-maker. It also never accepts, holds, controls, initiates, approves, settles, disburses, or transmits funds or value; issues or commits a real rate lock; or directs a settlement, funding, or capital-delivery instruction. It may ingest authoritative downstream status, reconcile evidence, and coordinate non-monetary operational work without acquiring those authorities.

This is a structural product boundary, not a public-launch toggle. Provider certification, production credentials, tenant configuration, or Agent approval cannot expand it. Any future product that performs a currently excluded financial action requires a replacement charter, separate legal and licensing analysis, explicit accountable owners, and a newly approved architecture and operating model before implementation.

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

The implemented `evaluateLoan` path is a one-shot synthetic readiness demo, not an end-to-end mortgage origination or production underwriting workflow. It does not currently implement policy-binding validation, regulated milestone clocks, disclosures, appraisal, formal action notices, closing, funding, or post-closing quality control.

The current simulator services also predate the target `ProviderAdapter` contract. They have not passed reusable adapter contracts or an authorized provider sandbox, so the repository is not yet provider-integration-ready.

### 3.1 Current workflow audit

| Area | Implemented behavior | Production implication |
|---|---|---|
| Intake | GraphQL receives borrower identifier, requested amount, and loan type. | Insufficient to establish a complete application, legal milestone, jurisdiction, property, purpose, occupancy, or consent context. |
| Evidence | Three deterministic simulators return income, credit, and document summaries concurrently. | Useful for a demo; not authorized, complete, normalized, freshness-governed provider evidence. |
| Policy | Thresholds exist in source code and a local-model prompt. | No immutable release, jurisdiction scope, effective dating, approval, binding validation, or exception governance. |
| Evaluation | One request performs retrieval and returns a readiness-shaped decision. | No durable wait/resume, re-evaluation, workflow recovery, or mandatory current-policy guard. |
| Outcome | Legacy `APPROVED`, `CONDITIONAL`, and `DENIED` labels are persisted. | These labels are not supported as formal credit actions and must be migrated to readiness vocabulary. |
| Persistence | A single application row is saved after evaluation with raw simulator payloads. | No case aggregate, evidence lineage, condition history, policy binding, outbox, review record, or true request idempotency. |
| Coverage | Income, credit, documents, DTI, and loan-to-income are simulated. | Assets, property and collateral, appraisal, title, insurance, disclosures, formal notices, closing, funding, and post-close QC are absent. |

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
- Evaluate evidence against the policy snapshot applicable to its jurisdiction, product, lifecycle event, and relevant date.
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
- Keep simulator and real-provider modes on the same workflow, canonical contracts, and deployable artifact.
- Support tenant isolation and least-privilege access before any shared deployment.
- Produce measurable product, reliability, security, and Agent-quality evidence.
- Preserve a modular architecture that can extend beyond mortgage through product packs.

### 5.2 Non-goals

- Issuing credit or producing a binding approve/deny decision.
- Claiming equivalence with an official automated underwriting system.
- Accepting, holding, controlling, initiating, approving, settling, disbursing, or transmitting funds or value.
- Issuing or committing a real rate lock, directing settlement or funding, or delivering a loan to a capital market.
- Ordering paid services or initiating real provider orders in the public launch.
- Publishing copied proprietary guidelines or reverse-engineered vendor behavior.
- Training a proprietary foundation model.
- Building a general-purpose consumer chatbot.
- Supporting every mortgage or lending product in the first release.
- Replacing a customer's full loan origination system.
- Adopting microservices, Kubernetes, or multiple Agent frameworks without measured need.
- Ingesting real consumer PII into the public demo.
- Treating a simulator-only pass as proof of provider-integration readiness or real-data production approval.
- Claiming legal, regulatory, security, or fairness certification from software controls alone.

### 5.3 Engineering principles

1. Correctness and evidence outrank model fluency.
2. Deterministic policy owns operational status; models propose bounded actions.
3. Humans retain authority over material, ambiguous, or protected outcomes and communications; only narrowly defined routine operational messages may use pre-approved template policy.
4. Every external effect has a durable intent, attributable audit trail, and effect-specific retry and reconciliation strategy; idempotency is claimed only where certified semantics support it.
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

Every satisfied, waived, or escalated condition includes evidence or reviewer provenance and the immutable case policy snapshot that governed the transition.

### 6.3 Authority order

1. Consent, authorization, and security controls may stop processing.
2. Validated source evidence remains attributable to its origin.
3. Deterministic calculations and the resolved, released case policy snapshot determine condition state and readiness.
4. The Agent may select approved tools, compare evidence, propose actions, and draft explanations.
5. Human reviewers approve every protected communication sent through the platform, interpret out-of-policy cases, and record overrides; configured policy cannot substitute for that approval.
6. Model output never silently overrides policy, source evidence, or a human decision.

### 6.4 Communication classes and authority

A **protected communication** is any borrower- or third-party-facing message that states or could reasonably be understood to state a credit decision, eligibility or underwriting conclusion, approval status, incompleteness or adverse action, consumer right, legally significant deadline, disclosure, rate or term, waiver, exception, collection position, settlement instruction, or other legally or materially consequential outcome. The Agent may draft it, but a human reviewer must approve the exact rendered content, recipient, channel, locale, attachments, and authoritative sender before platform delivery. Formal notices that remain outside product scope are sent by the lender or another authorized downstream system, not by this platform.

A **routine operational communication** may be policy-approved without per-message human review only when it uses a version-pinned tenant-approved template to request or acknowledge ordinary evidence, contains no protected meaning or regulated deadline, uses an allowlisted recipient relationship, channel, locale, variables, and attachments, and does not change a case decision, right, term, or legal status. Template approval and message delivery are separately attributable. Any free-form material text, template drift, negative or ambiguous implication, unsupported locale, classification uncertainty, or failed variable validation upgrades the message to protected and creates review work.

Communication classification and template enforcement are deterministic application-service guards outside the model. The Agent cannot label its own message routine, supply an approval result, or downgrade a protected classification. Signed machine webhooks publish only already-authorized committed events; they cannot create or transform a protected communication.

### 6.5 Mortgage lifecycle alignment and product boundary

Mortgage production is not one universal linear workflow: product, channel, jurisdiction, lender policy, and case facts change the required path. The platform therefore records authoritative milestone events and coordinates a bounded operations segment rather than pretending to own the lender's entire origination process.

| Lifecycle area | Representative milestones | Initial product relationship | Authority boundary |
|---|---|---|---|
| Shopping, inquiry, and prequalification | Product exploration, inquiry, prequalification | Outside launch scope; may enter as context | The platform must not infer that a regulated application was received. |
| Application intake and initial disclosure triggers | Application-received event, required initial disclosures, intent to proceed | Integration boundary; record downstream-confirmed events and deadlines | The lender or authorized system determines legal application status and performs disclosures. |
| Processing and evidence assembly | Collect and verify income, assets, credit, identity, occupancy, and documents | Core launch scope with synthetic evidence | The platform may identify evidence gaps but does not make a credit decision. |
| Collateral and third-party work | Appraisal or valuation, title, flood, insurance, fraud, and other required services | Selected simulators later; real orders require authorized adapters | Provider and lender results remain attributable and authoritative. |
| Underwriting | Evaluate capacity, credit, collateral, eligibility, and approved exceptions | Prepare an evidence-complete package and ingest downstream conditions | An authorized lender or underwriting system owns formal approval, suspension, or denial. |
| Conditions and re-evaluation | Operational conditions, underwriter conditions, new evidence, changed circumstances | Core conditions-resolution loop | The platform may resolve operational work; only the authorized owner clears decision conditions. |
| Action and consumer notification | Approval, counteroffer, incompleteness, withdrawal, or adverse action and required notices | Track external status; protected drafting may be added later | Formal action and legally required communication remain outside autonomous Agent authority. |
| Clear-to-close, closing, and funding | Final verification, closing disclosure, consummation, settlement, funding | Future integrations may ingest status and coordinate non-monetary tasks only | Authorized lender, settlement, and funding systems remain authoritative; the platform cannot issue clear-to-close, create a legal disclosure, direct settlement, or initiate, approve, hold, or disburse funds. |
| Post-closing and servicing handoff | Quality control, delivery, boarding, servicing, corrections | Future integrations may ingest status and coordinate non-monetary tasks only | Downstream operational and compliance owners retain authority; capital delivery and servicing money movement remain outside this charter. |

`READY_FOR_UNDERWRITING` means only that configured evidence-readiness checks passed. `CONDITIONS_OPEN` means operational work remains. Neither status means conditional approval, final approval, clear-to-close, funding authorization, or satisfaction of a legal notice obligation.

This lifecycle map is a product-scope baseline, not a legal checklist. Authorized lending, legal, compliance, and operations owners must configure the actual milestones, notices, clocks, evidence, and decision authorities for each product and jurisdiction.

Technical provider readiness is necessary for an allowed integration but never grants lender, settlement, funds-transfer, rate-lock, disclosure, or capital-delivery authority. Sections 11.8 and 22.6 cannot override the structural boundary in Section 2 and Section 7.5.

## 7. Launch product and vertical slice

### 7.1 Launch scenario

The first launch scenario uses a synthetic conventional mortgage with W-2-style employment and generated documents. It demonstrates a meaningful evidence discrepancy and a full conditions loop:

1. Create a tenant-scoped loan case with an idempotency key.
2. Record synthetic consent and intake data.
3. Upload generated documents to local S3-compatible storage.
4. Start an asynchronous workflow and return `202 Accepted`.
5. Extract candidate facts and retain source locations.
6. Run simulated income, asset, credit, identity, and document capabilities.
7. Normalize findings and compare case-intake, document, and provider evidence.
8. Request an evaluation; the mandatory system guard validates or refreshes the case's current policy binding using the authoritative dependency vector and versioned relevant-facts hash.
9. Atomically freeze an evaluation input manifest containing exact case, consent, evidence, calculation, policy, and runtime versions.
10. Execute deterministic calculations and policy only against the immutable manifest; never read mutable `latest` values mid-evaluation.
11. Create prioritized operational conditions for missing or contradictory evidence using optimistic case-version checks.
12. Let the Agent select the next approved tool within budget.
13. Pause durably for information or human approval when required.
14. Introduce a reviewed synthetic state-policy change while the case waits and produce an open-case impact assessment.
15. Resume when a signal supplies new evidence, an approved transition decision, or another review decision.
16. Before every re-evaluation, validate the binding and assemble a new manifest; unchanged immutable inputs may be referenced again without being copied.
17. Publish signed status events and display the full timeline, including the binding, input manifest, and validation outcome used by every evaluation.

### 7.2 Included synthetic capabilities

- case-intake completeness without inferring regulated application status;
- income and employment evidence;
- asset evidence;
- credit-profile summary;
- identity consistency;
- document classification and structured field extraction;
- qualified-income, DTI, and LTV calculations using synthetic policy;
- jurisdiction and relevant-event-aware policy snapshot resolution;
- mandatory current-policy binding validation before every evaluation;
- future-effective policy scheduling and open-case impact simulation;
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
- production document OCR contracts;
- additional lending product packs;
- billing and subscription management;
- multi-region disaster recovery;
- high-volume batch submission.

These deferred capabilities are disabled in the public synthetic launch but may enter the target integration architecture only within the structural exclusions below and after the gates in Sections 11.8 and 22.6 pass. Passing those gates proves a declared adapter and data flow met technical and organizational controls; it does not grant a new regulated product authority.

### 7.5 Structural exclusions from this charter

The current product architecture does not expose commands that:

- accept, hold, control, initiate, approve, settle, disburse, or transmit funds or value;
- create, sign, or commit a real rate lock, payment instruction, settlement instruction, funding authorization, or capital-delivery instruction;
- issue a formal credit decision, clear-to-close determination, disclosure with legal effect, or legally required action notice;
- collect or distribute servicing payments or otherwise act as a lender, settlement agent, servicer, custodian, or funds-transfer operator.

Allowed integrations may ingest authoritative statuses and documents, reconcile evidence, open non-monetary operational conditions, and coordinate tasks without executing an excluded action. The provider capability registry, Agent tool registry, promotion-manifest validator, and production router must reject excluded command classes even when credentials exist and an adapter is technically certified.

Changing this boundary is not an ordinary roadmap item. It requires a replacement product charter and non-goal set, activity-specific legal and licensing analysis across applicable jurisdictions, accountable business and compliance owners, a new threat and funds-flow model, and separately approved implementation and launch gates. No feature flag, provider contract, tenant request, model decision, or Section 11.8/22.6 certification can authorize the change.

## 8. Product modules

### 8.1 Case and Evidence Hub

Owns the canonical case aggregate, borrowers, consent references, documents, extracted facts, normalized findings, evidence conflicts, versions, and lineage.

### 8.2 Conditions Resolution Agent

Observes case state, selects registered tools, proposes safe next actions, explains unresolved gaps, and routes protected or ambiguous work to human review.

### 8.3 Policy-as-Code Studio

Manages authorized source coverage, jurisdiction overlays, immutable synthetic policy versions, applicability, efficient binding validation, effective dates, transition rules, DSL validation, tests, impact review, scheduled activation, correction, withdrawal, and retirement.

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
  policyBindingId?: string;
  modelVersion?: string;
  promptVersion?: string;
  remainingStepBudget: number;
  remainingDurationBudgetMs: number;
  remainingTokenBudget: number;
  remainingProviderCallBudget: number;
  budgetCurrency: string;
  remainingCostBudgetMinorUnits: number;
  budgetLedgerVersion: number;
  runStartedAt: string;
  runDeadlineAt: string;
  proposedAction?: AgentAction;
  reviewState?: HumanReviewState;
}
```

Budget fields are server-issued observations, not model authority. At every graph step and tool boundary, the runtime recomputes `remainingDurationBudgetMs` from trusted time and `runDeadlineAt`, then reads or reserves cost against authoritative versioned run, workflow, and tenant ledgers. `remainingCostBudgetMinorUnits` includes incurred cost plus conservative reservations for in-flight or outcome-unknown provider operations; a model cannot increase, reset, or supply any budget value. Ledger-version mismatch, reservation failure, deadline expiry, or a negative remaining value stops further tool execution and routes safely.

`runDeadlineAt` limits one bounded Agent execution; time spent durably waiting for information or review is governed by workflow timers and is not hidden Agent runtime. Resume may create a new server-authorized run deadline only when cumulative workflow and tenant limits still permit it. Completed or dispatched step, token, provider-call, and cost usage is never credited back by retry, replay, cancellation, process restart, or resume; only an attributable reconciliation or billing correction can adjust the ledger.

### 9.4 Registered tools

| Tool | Purpose | Side effect | Approval boundary |
|---|---|---|---|
| `check_case_completeness` | Validate required intake fields | None | No |
| `inspect_documents` | Extract candidate facts from synthetic documents | Document processing | Consent required |
| `fetch_income_evidence` | Request income capability | Provider submission | Consent and budget required |
| `fetch_asset_evidence` | Request asset capability | Provider submission | Consent and budget required |
| `fetch_credit_evidence` | Request credit-summary capability | Provider submission | Consent and budget required |
| `check_identity_consistency` | Compare synthetic identity evidence | Provider submission | Consent required |
| `calculate_qualified_income` | Request a policy-bound income calculation | Versioned calculation | Mandatory policy-binding validation |
| `calculate_dti` | Execute deterministic calculation | Versioned calculation | No |
| `calculate_ltv` | Execute deterministic calculation | Versioned calculation | No |
| `compare_evidence` | Detect missing, stale, or conflicting facts | None | No |
| `check_policy_change_impact` | Compare an approved policy change with open cases | Creates impact assessment | No; cannot change case applicability |
| `evaluate_policy` | Request guarded evaluation of current applicable policy | Creates assessment | Mandatory policy-binding validation |
| `create_condition` | Materialize a policy-supported operational condition | Case mutation | Validated binding and evaluation required |
| `draft_information_request` | Prepare a remediation request | Draft only | No |
| `send_information_request` | Deliver an external message | External communication | Configured policy only for a version-pinned routine operational template; exact human approval is mandatory for protected, uncertain, or modified content; formal notices outside product scope remain prohibited |
| `escalate_to_reviewer` | Pause and create review task | Workflow transition | No |
| `publish_case_update` | Deliver a signed machine webhook | External communication | Only already-authorized committed integration events; borrower-facing protected communication content is prohibited |

`validate_policy_binding` is deliberately not an Agent tool. It is an unavoidable application-service guard invoked server-side for every evaluation request, including re-evaluations and retries. The Agent cannot omit it, supply its result, or choose an older snapshot.

### 9.5 Agent loop

```text
LOAD VERSIONED CASE
  -> VERIFY TENANT, CONSENT, TRUSTED DEADLINE, AND AUTHORITATIVE BUDGET LEDGER
  -> INSPECT CURRENT EVIDENCE AND CONDITIONS
  -> SELECT ONE OR MORE APPROVED READ-ONLY TOOLS
  -> REQUEST SIDE-EFFECTING TOOL THROUGH WORKFLOW GATE
  -> NORMALIZE AND VALIDATE OBSERVATIONS
  -> REQUEST POLICY-BOUND EVALUATION
       -> SYSTEM GUARD VALIDATES OR REFRESHES POLICY BINDING
       -> RECORD BINDING ID AND VALIDATION OUTCOME ON EVALUATION
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
- unresolved jurisdiction, effective-date, or transition-rule conflict;
- malformed model or tool output;
- manual waiver or override of a deterministic condition;
- every protected communication and any message outside a version-pinned routine operational template;
- communication classification uncertainty, free-form material text, negative implication, regulated deadline, legal effect, or rendered-template mismatch;
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
- trusted runtime deadline and versioned cost-ledger enforcement at every graph step and side-effect boundary;
- deterministic communication classification, template validation, exact-render hashing, and attributable approval outside the model;
- deterministic fallback to human review on uncertainty or runtime failure;
- no storage or display of private chain-of-thought;
- complete model, prompt, policy, tool, input-hash, and result provenance;
- dry-run and shadow modes for unapproved model or policy versions.

## 10. Temporal and jurisdiction-aware Policy-as-Code

Policy is not a static application setting. Requirements can change at different times across federal, state, and, where applicable, local jurisdictions. Applicability can also depend on product, program, tenant operating policy, lifecycle milestone, and the date of a legally relevant case event. The platform therefore separates an immutable policy version from the deterministic resolution of which approved versions apply to a case.

This subsystem organizes authorized policy content and execution evidence; it does not provide legal advice. Legal and compliance owners remain responsible for source coverage, interpretation, precedence, transition rules, and approval.

### 10.1 Policy dimensions and layers

Every released rule declares typed applicability metadata:

- jurisdiction codes and jurisdiction level;
- product and optional program or investor overlay;
- tenant operating-policy scope;
- lifecycle milestone and relevant triggering event;
- `effective_from` and optional `effective_to` valid-time boundaries;
- `recorded_at`, source revision, checksum, and provenance;
- approved transition behavior, including any grandfathering criteria;
- supersession, correction, withdrawal, and release status.

The catalog can compose a reviewed base federal pack, state or local overlays, product and program constraints, and tenant operating policies. It does not assume that a higher or lower layer automatically wins. A conflict without an explicitly approved precedence rule fails closed into policy review.

Policy records are bitemporal: **valid time** describes when a rule is intended to apply, while **system time** records when the platform learned and stored that source revision. Both are required for historical replay, late publications, corrections, and audit explanations.

### 10.2 Policy lifecycle

```text
register authorized source or author synthetic rule
  -> capture provenance, jurisdiction, publication, and effective metadata
  -> create proposed immutable version
  -> validate DSL schema, types, references, units, and boundaries
  -> detect conflicts and unreachable branches
  -> attach tests and approved transition logic
  -> simulate impact on synthetic and potentially affected open cases
  -> independent reviewer approvals
  -> schedule activation by effective boundary
  -> activate without mutating prior versions
  -> observe freshness, conflicts, and outcomes
  -> supersede, correct, withdraw, or retire while retaining history
```

AI may summarize a change or draft a candidate rule from an authorized source, but it cannot publish a rule, decide legal precedence, infer transition treatment, or activate a version. Source ingestion never implies approval. Released versions and approval records are immutable; a correction creates a new version and an explicit relationship to the corrected record.

### 10.3 Deterministic applicability resolution

```ts
interface PolicyResolutionContext {
  tenantId: string;
  caseId: string;
  caseFactVersion: number;
  jurisdictionCodes: string[];
  productCode: string;
  programCode?: string;
  lifecycleEvent: string;
  eventOccurredAt: string;
  relevantEventDates: Record<string, string | undefined>;
  evaluationAsOf: string;
  policyKnowledgeAsOf: string;
}

interface CasePolicySnapshot {
  id: string;
  resolvedAt: string;
  contextHash: string;
  resolverVersion: string;
  policyKnowledgeAsOf: string;
  resolutionStatus: 'RESOLVED' | 'REVIEW_REQUIRED';
  versions: Array<{
    policyVersionId: string;
    sourceRevisionId: string;
    effectiveFrom: string;
    effectiveTo?: string;
    applicabilityDecision: 'CURRENT' | 'GRANDFATHERED';
    resolutionReasons: string[];
  }>;
  unresolvedReasons: string[];
}
```

The resolver receives server-owned tenant and case facts, then selects only released policy versions whose reviewed applicability constraints match. It returns an immutable `CasePolicySnapshot`, not a mutable global policy pointer. The workflow binds a case scope and relevant-facts hash to that snapshot. Every later evaluation validates the binding; full applicability resolution runs again only when a validity predicate fails.

The same resolution context, policy catalog knowledge time, and resolver version must reproduce the same snapshot. Missing jurisdiction data, overlapping versions, a gap around an effective boundary, or unresolved precedence produces `REVIEW_REQUIRED`; the system never asks the model to guess.

### 10.4 Efficient mandatory validation before every evaluation

Every evaluation must confirm that its policy is still current, but confirmation does not require full resolution or a new receipt every time. A single composite scope generation is insufficient because a case can depend simultaneously on federal, state, local, product, program, tenant, lifecycle, source-coverage, and resolver definitions. A parent-layer change could otherwise leave a narrower case scope unchanged and incorrectly reusable.

The policy control plane therefore maintains a bounded dependency vector. Dependency keys exist even when no rule is currently present, so publishing a newly applicable overlay still changes the vector. The evaluation data plane derives the expected key set from the current server-owned context, reads all generations in one indexed query, and compares a canonical digest, trusted time, and versioned policy-relevant facts.

```ts
interface PolicyDependencyRef {
  key: string;
  kind:
    | 'CATALOG'
    | 'JURISDICTION'
    | 'PRODUCT'
    | 'PROGRAM'
    | 'TENANT'
    | 'LIFECYCLE'
    | 'SOURCE_COVERAGE'
    | 'RESOLVER';
  generation: number;
}

interface CasePolicyBinding {
  id: string;
  tenantId: string;
  caseId: string;
  dependencyKeySetHash: string;
  dependencyRefs: PolicyDependencyRef[];
  dependencyDigest: string;
  relevantFactSchemaVersion: string;
  relevantFactsHash: string;
  policySnapshotId: string;
  boundAt: string;
  validFrom: string;
  revalidateAfter: string;
  invalidatedAt?: string;
}

interface PolicyBindingValidation {
  bindingId: string;
  validatedAt: string;
  observedDependencyDigest: string;
  observedRelevantFactSchemaVersion: string;
  observedFactsHash: string;
  outcome: 'REUSED' | 'REFRESHED' | 'REVIEW_REQUIRED';
}
```

The dependency set covers the catalog, the full jurisdiction ancestry, product, optional program or investor overlay, tenant policy, lifecycle event, declared source coverage, and resolver release; the relevant-fact selector is compared through its separate schema version. `revalidateAfter` is the earliest known scheduled activation boundary, source-freshness deadline, or configured maximum validation interval. Consent and provider authorization are intentionally excluded from the policy-binding lifecycle and are checked independently during evaluation-manifest creation and immediately before external dispatch.

```text
BEGIN EVALUATION REQUEST
  -> derive expected dependency keys from current server-owned context
  -> read the bounded authoritative dependency vector in one indexed query
  -> derive relevant facts with a versioned selector and canonical encoding
  -> validate binding predicates
       dependency key set and digest unchanged
       relevant-fact selector version unchanged
       relevant-facts hash unchanged
       trusted time before revalidateAfter
       binding not invalidated or withdrawn
       jurisdiction coverage still fresh
  -> all valid: reuse immutable binding and snapshot
  -> any invalid: perform full applicability resolution
       -> resolved: atomically refresh binding
       -> ambiguity, gap, stale coverage, or conflict: create review task
  -> record binding ID and validation outcome on the evaluation
  -> execute against that binding in the same consistency boundary
```

This design keeps the correctness property while eliminating per-evaluation source reads, full rule scans, and duplicate receipt writes. A successful fast path performs one bounded indexed query plus in-memory canonical hash and time comparisons. Redis or process caches may reduce latency, but they are hints only; the authoritative dependency vector is read transactionally whenever an evaluation can create a material state transition.

Policy activation atomically increments every affected dependency generation and emits invalidation events. Jurisdiction hierarchy changes, newly introduced overlays, source-coverage changes, and resolver or relevant-fact-selector releases are first-class invalidators. A new evaluation may safely reuse a binding while every predicate remains valid. It must refresh after a relevant case mutation, dependency change, scheduled boundary, withdrawal, coverage-freshness deadline, selector-version change, or hash mismatch. The invariant is therefore **validation coverage `100%` and invalid binding acceptance `0`**, not zero reuse.

The evaluation row itself is the audit record: it stores the binding ID, observed dependency digest, validation time, outcome, and evaluator version. A same-request idempotent replay returns the recorded result. A new request may reuse the binding after validation without creating a separate confirmation artifact.

Validation and execution share a database snapshot or equivalent consistency boundary so a policy activation cannot create an unrecorded time-of-check/time-of-use gap. The evaluator rejects direct calls that bypass validation. The guard is deterministic infrastructure, not a human click and not an LLM judgment.

Validation reads the approved internal catalog; it does not scrape or reinterpret external legal sources in the evaluation critical path. Source monitors update freshness and candidate revisions asynchronously. If declared jurisdiction coverage is incomplete or its freshness objective has expired, validation stops and routes to review. “Current” means current within explicitly approved, fresh source coverage, never an unsupported claim that the platform knows every policy change everywhere.

For a live evaluation, `evaluationAsOf` and `policyKnowledgeAsOf` come from trusted server time. Historical values are accepted only by a separately authorized replay operation that cannot create a live case outcome.

### 10.5 Immutable evaluation input manifest

Policy consistency alone does not make an evaluation reproducible. Evidence, consent, case facts, calculations, adapter normalization, and model configuration can change while an evaluation is running. Every evaluation therefore consumes one server-created immutable input manifest rather than querying mutable `latest` records.

```ts
interface EvaluationInputManifest {
  id: string;
  tenantId: string;
  caseId: string;
  caseVersion: number;
  authorizationDecisionId: string;
  consentVersionRefs: string[];
  evidenceRefs: Array<{
    evidenceId: string;
    version: number;
    contentHash: string;
    validThrough?: string;
    adapterVersion?: string;
    normalizationSchemaVersion?: string;
  }>;
  calculationRefs: Array<{ calculationId: string; version: string }>;
  policyBindingId: string;
  observedPolicyDependencyDigest: string;
  evaluatorVersion: string;
  modelAndPromptManifestId?: string;
  createdAt: string;
  manifestHash: string;
}
```

Manifest assembly and case-version comparison occur transactionally after policy, authorization, consent, evidence freshness, contradiction, and completeness checks. Deterministic calculation and policy execution read only the referenced versions. A concurrent document, provider callback, consent change, policy activation, or case mutation cannot alter a running evaluation; it creates a new case version and requires a new evaluation manifest. Condition writes use compare-and-swap against the expected case version, so an older evaluation cannot overwrite newer case state.

The manifest records exact references and hashes without becoming a retention bypass. If an authorized deletion removes underlying content, the audit record retains only the metadata permitted by the applicable retention or legal-hold decision and reports that full content replay is no longer available.

### 10.6 Change detection and open-case impact

```text
authorized source revision detected
  -> provenance and completeness review
  -> candidate policy and transition rule authored
  -> future-effective activation scheduled
  -> applicability index finds potentially affected open cases
  -> dry-run compares old and proposed snapshots
       -> no impact
       -> applies at a future lifecycle event
       -> approved grandfathering rule preserves prior treatment
       -> re-evaluation required
       -> ambiguity requires human review
  -> approved activation emits audit and change events
  -> affected cases receive new snapshots only through workflow commands
```

An open case does not silently inherit the newest version, and it is not permanently frozen to the first version. Its treatment follows an approved transition rule tied to the relevant event and effective boundary. Impact assessment is advisory until an authorized reviewer approves the transition configuration; activation and re-evaluation remain idempotent, attributable workflow actions.

Initial launch uses curated synthetic policy sources and change events. Future official-source connectors are read-only ingestion adapters with per-jurisdiction coverage, freshness objectives, schema-drift alerts, and manual fallback. No connector is described as complete coverage until that coverage is reviewed and tested.

### 10.7 Example synthetic DSL

```yaml
rule:
  id: synthetic-income-discrepancy-review
  version: 1.0.0
  applicability:
    jurisdictions: [US-CA]
    product: CONVENTIONAL_MORTGAGE
    lifecycle_events: [UNDERWRITING_REVIEW]
    effective_from: 2027-01-01T00:00:00-08:00
    transition_rule: application_received_on_or_after_effective_date
  when:
    difference_percent:
      left: application.monthly_income
      right: evidence.verified_monthly_income
      greater_than: 10
  outcome:
    condition: VERIFY_INCOME_DISCREPANCY
    route: MANUAL_REVIEW
```

### 10.8 Policy invariants

- Policy identifiers and released versions are immutable.
- Every released rule has source provenance, jurisdiction, valid-time boundaries, system-time history, and approval evidence.
- Units, money, ratios, dates, and rounding behavior are explicit.
- Every condition links to the rule and evidence that created it.
- Every evaluation links to an immutable input manifest, case policy snapshot, dependency digest, and evaluator version.
- Every evaluation validates a policy binding; validation coverage is `100%` and invalid binding acceptance is `0`.
- A valid binding may be reused across evaluations only while its dependency key set and digest, relevant-fact selector and hash, time boundary, invalidation state, and source coverage remain valid; consent and provider authorization are separate execution guards.
- Evaluations never read mutable latest-case, latest-evidence, latest-consent, or latest-policy values after manifest creation.
- Policy activation never mutates a running evaluation or silently reinterprets an open case.
- A policy change requires regression evidence, effective-date boundary tests, transition approval, and an open-case impact summary.
- Future-effective policy never activates early; expired, withdrawn, conflicting, or coverage-unknown policy fails closed.
- Historical replay declares both the policy valid time and the platform knowledge time.
- Official or proprietary guidelines are not copied into the public repository.

## 11. Provider platform

### 11.1 Operating modes

```ts
type ProviderMode = 'SIMULATOR' | 'AUTHORIZED_SANDBOX' | 'PRODUCTION_BYOC';
```

- `SIMULATOR`: free default with deterministic synthetic fixtures.
- `AUTHORIZED_SANDBOX`: optional provider test environment enabled through authorized credentials.
- `PRODUCTION_BYOC`: customer supplies the contract, authority, credentials, and configuration.

### 11.2 Simulator-to-production parity

Simulator, authorized sandbox, and production adapters implement the same capability port and return the same canonical findings. Domain, workflow, policy, and Agent code cannot branch on a provider brand or operating mode. Environment-specific authentication, endpoints, bootstrap calls, and payload quirks stay inside the adapter and credential boundary.

Activating an already implemented and certified adapter is a reviewed configuration and secret operation, not a source-code edit, rebuild, or alternate business workflow. Adding a new provider, capability, schema profile, or materially changed adapter may require code and a new certified artifact; “configuration-only” never means an arbitrary provider can be connected without implementation and certification. The same certified immutable application artifact is promoted across environments.

Sandbox parity has limits: a provider test environment may not reproduce institution-specific authentication, data quality, latency, rate limits, or failure behavior. Production readiness therefore requires both deterministic simulator coverage and an authorized provider-certification sequence before live traffic.

### 11.3 Capability contract

```ts
interface ProviderAdapter<TRequest, TReceipt, TFinding> {
  readonly providerId: string;
  readonly capability: ProviderCapability;
  readonly mode: ProviderMode;
  readonly operation: ProviderOperationDescriptor;
  submit(
    request: TRequest,
    intent: ProviderOperationIntent,
    authorization: ProviderAuthorizationGrant,
    context: ProviderContext,
  ): Promise<TReceipt>;
  poll?(receipt: TReceipt, context: ProviderContext): Promise<ProviderStatus>;
  normalize(payload: unknown, context: ProviderContext): TFinding;
  cancel?(receipt: TReceipt, context: ProviderContext): Promise<void>;
  healthCheck(): Promise<ProviderHealth>;
}
```

Adapters never write case state directly. Workflow activities validate and normalize provider output, then the domain layer commits state and an outbox event transactionally.

### 11.4 Promotion manifest

```ts
interface ProviderPromotionManifest {
  id: string;
  version: number;
  tenantId: string;
  providerId: string;
  adapterVersion: string;
  adapterArtifactDigest: string;
  schemaProfile: string;
  mode: ProviderMode;
  capabilities: ProviderCapability[];
  endpointAllowlist: string[];
  credentialRef: string;
  webhookSecretRef?: string;
  dataClassifications: string[];
  consentAndPurposePolicyId: string;
  timeoutPolicyId: string;
  retryPolicyId: string;
  rateAndCostBudgetId: string;
  validFrom: string;
  validUntil?: string;
  contentHash: string;
}

interface ProviderCertificationRecord {
  id: string;
  manifestId: string;
  manifestVersion: number;
  environment: string;
  certificationEvidenceRef: string;
  certifiedArtifactDigest: string;
  decidedAt: string;
  expiresAt: string;
  decision: 'PASSED' | 'FAILED' | 'REVOKED';
}

interface ProviderApprovalRecord {
  id: string;
  manifestId: string;
  manifestVersion: number;
  approvalRole: string;
  actorId: string;
  decision: 'APPROVED' | 'REJECTED' | 'REVOKED';
  decidedAt: string;
  expiresAt: string;
}

interface ProviderActivation {
  manifestId: string;
  manifestVersion: number;
  environment: string;
  expectedPreviousActivationVersion: number;
  state: 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  activatedBy: string;
  activatedAt: string;
}
```

Manifests are immutable, versioned desired state and contain references and policy identifiers, never raw credentials. Certification, approval, revocation, and activation are separate append-only records that reference the manifest; approving a manifest never mutates its content. Enabling or re-enabling `PRODUCTION_BYOC` requires current passing certification, sufficient unexpired approvals, exact artifact and schema-profile match, isolated secret reference, explicit tenant authorization, optimistic activation-version check, and two-person control with no self-approval. Emergency disable remains a single authorized fail-safe action; re-enable requires normal approval. Every activation is attributable and a kill switch can suspend a provider or capability without redeploying the application.

### 11.5 External-effect, authorization, retry, and fallback safety

Transport retries are not automatically business-safe. A timeout after request transmission may mean the provider completed an order even though the platform did not receive the response. Retrying or falling back at that point can duplicate fees, consumer-impacting inquiries, communications, or other irreversible work.

```ts
type ProviderEffectClass =
  | 'READ_ONLY'
  | 'REUSABLE_LOOKUP'
  | 'COST_BEARING_ORDER'
  | 'CONSUMER_IMPACTING'
  | 'IRREVERSIBLE';

interface ProviderOperationDescriptor {
  effectClass: ProviderEffectClass;
  providerIdempotencyScope?: string;
  supportsStatusLookup: boolean;
  supportsCancellation: boolean;
  fallbackPolicy: 'AUTOMATIC' | 'REAUTHORIZE' | 'HUMAN_REVIEW' | 'PROHIBITED';
}

interface ProviderAuthorizationGrant {
  id: string;
  tenantId: string;
  caseId: string;
  borrowerSubjectId: string;
  providerId: string;
  capability: ProviderCapability;
  purposeCode: string;
  permittedDataClasses: string[];
  consentRecordIds: string[];
  permissiblePurposeDecisionId?: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string;
}

interface ProviderOperationIntent {
  id: string;
  tenantId: string;
  caseId: string;
  providerId: string;
  capability: ProviderCapability;
  effectClass: ProviderEffectClass;
  requestFingerprint: string;
  idempotencyKey: string;
  authorizationGrantId: string;
  state:
    | 'PREPARED'
    | 'DISPATCHED'
    | 'SUCCEEDED'
    | 'FAILED_FINAL'
    | 'OUTCOME_UNKNOWN'
    | 'RECONCILING'
    | 'CANCELLED';
}
```

The platform persists the operation intent before dispatch and revalidates the authorization grant immediately before every external request. Authorization is case-, borrower-, provider-, capability-, purpose-, field-, and time-bound. For consumer-report capabilities, the permissible-purpose decision is consumer- and transaction-specific; a tenant-wide setting or disclaimer is insufficient.

A stable platform idempotency key and request fingerprint are reused only for the same logical intent. They prevent duplicate platform commands but do not prove that a provider enforces idempotency. Retry is automatic only when the adapter's certified semantics establish that the request was not transmitted or that the same provider key/status resource safely reconciles the original operation. After an ambiguous timeout, the state becomes `OUTCOME_UNKNOWN`; the workflow polls, consumes a verified callback, or creates reconciliation work before any new order.

Fallback is a new external effect, not merely another retry. Before changing providers, the router must revalidate authorization, permissible purpose, data scope, expected cost, freshness, duplicate-impact risk, and provider-specific contract terms. `COST_BEARING_ORDER`, `CONSUMER_IMPACTING`, and `IRREVERSIBLE` operations never cross-provider fallback automatically unless an explicitly approved policy and provider semantics prove the action safe. Cancellation records intent but does not claim the provider cancelled work until that outcome is verified.

### 11.6 Routing

Provider selection uses deterministic constraints before optimization:

1. tenant authorization and operating mode;
2. product, jurisdiction, and capability eligibility;
3. consent and permissible-use configuration;
4. provider health and circuit state;
5. data freshness requirements;
6. latency, cost, and reliability score;
7. operation effect class and unresolved prior intent;
8. configured fallback policy and order.

LLMs do not choose a provider by unconstrained preference. More advanced optimization may be added after the routing inputs and objectives are measurable.

### 11.7 Contract and certification tests

Every adapter passes the same reusable suite:

- input and output schema validation;
- request fingerprinting, provider idempotency scope, and changed-payload rejection;
- authentication and authorization failure mapping;
- pre-dispatch failure, post-dispatch timeout, unknown-outcome reconciliation, and safe retry classification;
- rate-limit handling;
- malformed, partial, stale, and contradictory payload behavior;
- duplicate and out-of-order callback handling;
- cancellation race behavior;
- normalized provenance;
- log and error redaction;
- authorization expiry and revocation races;
- effect-class-specific cancellation and fallback behavior;
- health and routing behavior.

The same suite runs against simulators and authorized sandboxes. A production certification run additionally verifies endpoint and credential isolation, real authentication behavior, representative schema variance, webhook signatures, documented rate limits, support correlation identifiers, canary routing, kill-switch behavior, and rollback to a safe provider state.

### 11.8 Real-data enablement boundary

The codebase is **provider-integration-ready** for a declared provider/capability/adapter-version/schema-profile tuple only when that already implemented adapter can be enabled through a promotion manifest and secret activation with no domain or workflow code change. It becomes **production-approved** for real data only after all of the following are evidenced for the specific tenant, provider, capability, adapter version, schema profile, product, jurisdiction, and environment:

- executed contract and production access approval;
- runtime authorization grants plus consent and permissible-purpose enforcement;
- data-flow, classification, minimization, retention, deletion, and residency review;
- managed credentials, rotation, revocation, egress allowlist, and webhook verification;
- tenant isolation, field authorization, encryption, redaction, and audit tests;
- provider-specific certification, effect semantics, reconciliation, rate-limit and cost budgets, canary plan, kill switch, and incident runbook;
- legal, compliance, privacy, security, and operations approval with named owners and enforced separation of duties;
- monitored first-live workflow and verified rollback.

Real data is never copied into public fixtures, model-evaluation corpora, screenshots, local development, or shared staging. Production adapters receive only the minimum authorized fields, and model access remains independently governed from provider access.

Provider certification is scoped evidence for an already allowed capability; it is not product-authority, licensing, or funds-flow approval. Promotion-manifest validation and routing fail closed for every command class excluded by Section 7.5, including funds or value movement, binding rate locks, legal disclosures or action notices, clear-to-close, settlement or funding direction, and capital delivery. An adapter may expose allowed read-only status or evidence capabilities for those lifecycle areas without exposing their execution commands.

## 12. Target architecture

### 12.1 Architecture style

Use a modular monolith with independently deployable API, worker, and web processes from one repository:

- **API service**: partner REST API, operations GraphQL API, authentication, validation, idempotency, and status retrieval.
- **Worker service**: Temporal workers, provider activities, Agent runs, policy-source monitoring, applicability resolution, policy execution, impact assessment, and webhook delivery.
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
  policy/              sources, catalog, DSL, resolver, evaluator, impact, lifecycle
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
| Identity | Managed OIDC/OAuth 2.0 + scoped API clients; FAPI 2.0 profile where ecosystem-compatible | Use established high-security financial API patterns without implementing authorization security in the domain core. |
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
| `jurisdictions` | Stable codes, levels, parent relationships, and supported coverage status. |
| `policy_sources` | Authorized source registry, owner, jurisdiction, retrieval mode, and freshness objective. |
| `policy_source_revisions` | Immutable retrieved content metadata, checksum, publication time, and system-time history. |
| `policy_packs` | Composable federal, jurisdiction, product, program, and tenant policy metadata. |
| `policy_versions` | Immutable DSL, valid-time interval, release status, approvals, and test manifest. |
| `policy_applicability` | Typed scope, triggering event, precedence, and approved transition criteria. |
| `policy_change_events` | Detected, scheduled, activated, corrected, withdrawn, or superseded change history. |
| `policy_dependency_generations` | Authoritative generations and next boundaries for catalog, jurisdiction, product, program, tenant, lifecycle, coverage, and resolver dependency keys. |
| `case_policy_snapshots` | Immutable resolved versions, source revisions, context hash, and resolution reasons. |
| `case_policy_bindings` | Reusable case-to-snapshot binding with dependency vector, selector version, relevant-facts hash, time boundary, and invalidation state. |
| `policy_impact_assessments` | Dry-run comparison and disposition for potentially affected open cases. |
| `evaluation_input_manifests` | Immutable case, authorization, consent, evidence, calculation, policy, evaluator, and optional model-version references. |
| `policy_evaluations` | Input-manifest ID, binding validation observation, evaluator version, rule execution, and outcome. |
| `loan_conditions` | Condition lifecycle and required evidence. |
| `condition_transitions` | Actor-attributed condition state history. |
| `provider_connections` | Tenant provider mode and credential reference. |
| `provider_authorization_grants` | Case-, subject-, provider-, capability-, purpose-, data-, and time-bound external-call authority. |
| `provider_operation_intents` | Durable request fingerprint, effect class, idempotency key, authorization, and dispatch outcome. |
| `provider_attempts` | Attempt, latency, error, retry, and cost metadata. |
| `provider_reconciliations` | Evidence and resolution of ambiguous, delayed, cancelled, or externally completed operations. |
| `provider_findings` | Normalized results and provenance. |
| `provider_promotion_manifests` | Immutable adapter, schema, endpoint, control, and secret-reference desired state. |
| `provider_certifications` | Append-only manifest-scoped test report, artifact digest, validity, outcome, and revocation history. |
| `provider_approvals` | Append-only manifest-scoped independent approval, expiry, rejection, and revocation history. |
| `provider_activations` | Versioned environment activation, suspension, disablement, and actor history. |
| `workflow_runs` | Durable business workflow identity and status. |
| `workflow_steps` | User-facing activity timeline and failure state. |
| `agent_runs` | Runtime, model, prompt, budgets, tools, and final route. |
| `agent_budget_ledgers` | Versioned run, workflow, and tenant step, duration, token, provider-call, cost limit, usage, reservation, and currency state. |
| `agent_budget_reservations` | Atomic cost and capacity reservations for in-flight or outcome-unknown work. |
| `tool_attempts` | Arguments hash, result hash, side effect, and outcome. |
| `review_tasks` | Pending protected action or exception review. |
| `review_decisions` | Reviewer result, rationale, version, and override history. |
| `communication_templates` | Immutable tenant-approved routine template, locale, variable, attachment, recipient, channel, purpose, and validity rules. |
| `communication_classifications` | Deterministic routine, protected, or uncertain decision with reasons, policy version, and rendered-content hash. |
| `communication_approvals` | Exact protected message, recipient, channel, locale, attachment, sender, reviewer, expiry, and revocation evidence. |
| `communication_deliveries` | Idempotent attempt, approval or template reference, exact render hash, destination, and terminal outcome. |
| `idempotency_keys` | Tenant, route, key, request hash, and response reference. |
| `webhook_endpoints` | Destination, secret reference, subscriptions, and state. |
| `webhook_deliveries` | Signed attempt history and replay state. |
| `legal_holds` | Scoped hold authority, reason, owner, validity, review, and release history. |
| `data_disposition_tasks` | Lineage-aware retention, deletion, anonymization, hold, and verification state. |
| `audit_events` | Append-only actor, action, resource, and security history. |
| `outbox_events` | Transactionally committed events awaiting publication. |

### 14.2 Data rules

- Every tenant-owned table includes `tenant_id` and tenant-first indexes.
- Service authorization is primary; PostgreSQL row-level security provides defense in depth.
- Money uses integer minor units plus currency or an explicit decimal type and rounding policy.
- Ratios store defined scale and rounding behavior.
- Every mutable aggregate includes version and actor provenance.
- Evidence retains source location, observed time, validity interval, and transformation history.
- Policy data retains separate valid-time and system-time fields so historical execution can be reproduced as both effective and known at a declared instant.
- Policy source coverage and freshness are explicit per jurisdiction; missing coverage is an operational state, not an implicit default.
- Policy bindings and their observed generations are server-owned; clients and models cannot supply, select, or extend them.
- Evaluation input manifests are immutable and reference exact versions; an evaluation never follows mutable latest-value pointers.
- Provider operation intents are persisted before dispatch; `OUTCOME_UNKNOWN` is a first-class state that blocks a new effect until reconciliation or authorized review.
- Agent budget observations are derived from trusted deadlines and a versioned ledger; models and clients cannot supply, extend, reset, or race a budget reservation.
- Protected communication approval is bound to the exact rendered-content hash, recipient, channel, locale, attachments, sender, and validity interval; changing any bound field invalidates reuse.
- Routine communication delivery requires an exact active template version and allowlisted variable set; classification uncertainty fails closed to human review.
- Raw provider payloads are encrypted, access-controlled, and short-lived.
- Documents live in object storage rather than relational binary columns.
- Logs contain identifiers, classifications, and hashes instead of full borrower data.
- Public demos and automated tests use visibly synthetic data only.
- Retention and deletion traverse document, evidence, normalized finding, cache, search index, prompt, evaluation artifact, object, and backup lineage; legal holds are explicit, scoped, reviewable, and never inferred from an undeletable implementation detail.
- Deletion verification records what was deleted, anonymized, retained under a valid hold, or pending backup expiry without retaining the removed content itself.

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
GET    /v1/loan-cases/{caseId}/policy-snapshots
GET    /v1/loan-cases/{caseId}/provider-operations/{operationId}
POST   /v1/loan-cases/{caseId}/reviews
GET    /v1/loan-cases/{caseId}/audit-export
POST   /v1/webhook-endpoints
GET    /v1/webhook-deliveries/{deliveryId}
```

Long-running commands return `202 Accepted` with stable status URLs.

### 15.2 Operations GraphQL API

GraphQL serves case lists, evidence graphs, timelines, review and provider-reconciliation queues, policy releases, provider operations and health, Agent runs, data-disposition work, activation governance, and evaluation reports. Production environments disable public introspection and interactive explorers unless explicitly authorized.

### 15.3 API standards

- checked and published OpenAPI artifact;
- stable operation identifiers for SDK generation;
- consistent RFC 9457-style problem details;
- request and trace identifiers on all responses;
- cursor pagination and explicit filtering;
- API version and deprecation policy;
- request, upload, and query-complexity limits;
- tenant and client rate limits;
- idempotency for every externally initiated mutation with side effects, including documented scope and retention, tenant-bound keys, canonical request fingerprints, changed-payload rejection, and concurrent-request conflict behavior;
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
policy_version.scheduled
policy_version.activated
policy_change.detected
case_policy_snapshot.resolved
policy_binding.validated
policy_binding.refreshed
policy_binding.review_required
evaluation_input_manifest.created
policy_impact.review_required
agent_budget.reserved
agent_budget.exhausted
communication.review_required
communication.approved
communication.sent
provider_authorization.denied
provider_operation.prepared
provider_operation.dispatched
provider_operation.outcome_unknown
provider_operation.reconciled
provider_activation.changed
data_disposition.completed
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
- separate policy-author and policy-approver roles, with independent approval for releases and transition logic;
- immutable provider-promotion manifests with separate proposer, certifier, approver, and activator duties for production enablement;
- two-person control for production provider enablement or re-enablement, with self-approval prohibited and emergency disable independently available;
- immutable routine communication templates, deterministic classification, exact-render approval binding, and protected-message review enforcement;
- trusted Agent deadlines plus versioned, atomic budget usage and reservation ledgers enforced outside model state;
- documented incident response, key rotation, backup, and restore procedures.

### 16.2 Privacy controls

- case-, subject-, provider-, capability-, purpose-, data-, and time-bound authorization checked immediately before every external request, retry, and fallback;
- data minimization and field-level access policy;
- lineage-aware retention, deletion, legal-hold, backup-expiry, and deletion-verification workflows;
- redacted logs, traces, errors, prompts, and evaluation artifacts;
- environment and tenant separation;
- no real consumer data in public demos, fixtures, screenshots, or evaluation corpora;
- data export and deletion operations recorded with actor provenance.

### 16.3 Responsible-AI controls

- deterministic policy authority and visible human-review boundary;
- protected characteristics excluded from model inputs unless an approved, documented use requires them;
- evidence references for material claims;
- model, prompt, schema, tool, and policy versioning;
- deterministic policy applicability resolution outside the model boundary;
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
- early activation, jurisdiction mismatch, unresolved policy conflict, or missed source update;
- missed parent-layer, new-overlay, coverage, resolver, or relevant-fact-selector invalidation;
- evaluation reads evidence, consent, or case state newer than its recorded policy input;
- provider timeout is misclassified as failure and retried into a duplicate paid or consumer-impacting operation;
- cross-provider fallback reuses an authorization or permissible-purpose decision outside its approved scope;
- production manifest self-approval, artifact mismatch, stale activation race, or unsafe re-enable;
- provider capability or Agent tool configuration attempts to expose a structurally excluded funds, rate-lock, settlement, disclosure, decision, or capital-delivery command;
- model output, template variables, or free-form text downgrade a protected communication into a routine message;
- protected-message approval is replayed after content, recipient, channel, locale, attachment, sender, or validity changes;
- stale Agent budget state, concurrent reservations, or unknown provider cost permit work beyond a deadline or cost ceiling;
- duplicate provider callbacks after workflow cancellation;
- malicious file content and decompression abuse;
- incomplete deletion lineage, invalid legal hold, or sensitive content retained in derived stores;
- unauthorized review override or audit tampering;
- bypass, stale reuse, substitution, or time-of-check/time-of-use race involving a policy binding.

## 17. Reliability and observability

### 17.1 Reliability behavior

- API acknowledgment occurs only after durable state is committed.
- Temporal owns workflow retries and waits; activities use durable intents and effect-specific retry safety rather than assuming every provider action is idempotent.
- External delivery uses outbox-backed publication and stable event identifiers.
- Retries use explicit classifications, bounded attempts, backoff, and jitter.
- Circuit breakers prevent repeated calls to unhealthy providers.
- Every provider call starts from a durable operation intent, certified effect classification, current authorization grant, and stable request fingerprint.
- A post-dispatch timeout is an unknown business outcome until provider status, verified callback, or attributable reconciliation proves otherwise; it is never silently converted into a fresh order.
- Provider fallback reauthorizes the new provider and cannot bypass cost, duplicate-impact, consumer-impact, or human-review gates.
- Workflow replay does not duplicate completed external effects.
- Workflow replay cannot bypass policy-binding validation; a new evaluation validates again, while an idempotent replay of the same completed request returns its recorded result.
- Evaluation replay consumes its immutable input manifest; new evidence or consent state creates a new manifest rather than altering historical execution.
- Provider activation uses immutable manifest versions and compare-and-swap so concurrent administrative changes cannot overwrite a newer state.
- Every Agent graph step and side-effect gate rechecks trusted time and atomically reserves authoritative budget; in-flight and unknown provider costs remain conservatively reserved until reconciliation.
- Communication delivery revalidates classification, template or exact human approval, recipient, channel, locale, attachments, sender, render hash, and expiry immediately before dispatch.
- Versioned workflow code preserves deterministic replay compatibility.
- Failed work remains inspectable and recoverable through operations tooling.
- Provider fallback never changes the semantic capability contract silently.
- Graceful shutdown stops new work and safely finishes or abandons leased activity work.

### 17.2 Initial SLO targets

Targets are release objectives, not current measurements:

- monthly API availability: `99.9%` for the synthetic staging service;
- acknowledged case and review mutations lost: `0`;
- duplicate externally visible effects from idempotent replay: `0`;
- duplicate cost-bearing or consumer-impacting provider operations caused by retry or fallback: `0` in the release fault corpus;
- protected communications delivered without exact current human approval: `0`;
- Agent tool effects accepted after deadline or without sufficient authoritative cost reservation: `0`;
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
- provider mode, adapter and certification version, effect class, authorization failure, latency, normalization failure, authentication expiry, webhook verification, rate limit, retry, fallback, unknown outcome, reconciliation age, duplicate prevention, cost, canary allocation, kill-switch state, and circuit state;
- condition age, reopen rate, and time waiting for evidence;
- Agent steps, tool choices, schema failures, escalation, trusted time remaining, tokens, provider calls, budget reservations, incurred and unknown cost, and ledger conflicts;
- communication classification, template version, review, approval expiry, rendered-hash mismatch, delivery, and protected-message policy violations;
- policy source freshness and coverage gaps by jurisdiction;
- time from detected source revision to reviewed version and scheduled activation;
- policy snapshot resolution conflicts, failures, and version distribution;
- policy-binding validation coverage, fast-path reuse, refresh rate, latency, invalid-binding rejection, and review-required rate;
- evaluation-manifest creation failures, mutable-read rejection, case-version conflicts, replay success, and unreplayable-content reason;
- open cases awaiting change-impact review and changes approaching an effective date without approved treatment;
- policy evaluation failures;
- webhook backlog and terminal delivery failures;
- database pool, query latency, locks, and migration state;
- redaction failures and security events.

## 18. Testing and evaluation

### 18.1 Test strategy

1. **Unit tests**: calculations, domain transitions, authorization, redaction, and pure policy rules.
2. **Property-based tests**: money, ratios, temporal policy invariants, idempotency, and condition-state machines.
3. **Migration tests**: clean installation, forward migration, data preservation, and compatibility checks.
4. **Integration tests**: PostgreSQL, Temporal, object storage, provider adapters, and outbox behavior.
5. **Contract tests**: API compatibility, webhooks, and reusable provider expectations.
6. **Workflow tests**: timers, signals, retries, cancellation, versioning, and replay.
7. **End-to-end tests**: complete synthetic case and review journeys.
8. **Security tests**: tenant isolation, authorization, injection, SSRF, upload, and webhook abuse.
9. **Reliability tests**: crash, timeout, duplicate, partial failure, and recovery scenarios.
10. **Load and soak tests**: declared environment and reproducible workload.
11. **Agent evaluation**: golden cases, adversarial documents, tool constraints, and model comparisons.
12. **Policy time-travel tests**: jurisdiction matrices, effective-boundary instants, scheduled activation, grandfathering, corrections, withdrawals, late or out-of-order source revisions, and deterministic as-of replay.
13. **Policy-binding tests**: validation-bypass rejection, safe unchanged-binding reuse, dependency-key and digest mismatch, parent-layer and newly introduced overlay invalidation, selector-version and facts mismatch, scheduled-boundary expiry, invalidation events, catalog activation races, idempotent same-request replay, and mandatory validation on every re-evaluation.
14. **Evaluation-input tests**: immutable version references, latest-read rejection, evidence and consent races, stale case compare-and-swap, manifest-hash verification, replay, and deletion-aware audit behavior.
15. **Provider-effect tests**: pre- and post-dispatch failures, changed-payload idempotency rejection, unknown outcomes, delayed success, reconciliation, duplicate callbacks, cancellation ambiguity, cost-bearing and consumer-impacting retry, and cross-provider fallback authorization.
16. **Administrative-control tests**: manifest immutability, artifact and schema mismatch, self-approval rejection, dual authorization, expired approval, concurrent activation, emergency disable, and controlled re-enable.
17. **Communication-authority tests**: routine-template allowlists, free-form and variable injection, negative and ambiguous meaning, regulated deadlines, locale and attachment changes, exact-render approval binding, approval expiry and revocation, retry, and protected-message fail-closed behavior.
18. **Agent-budget tests**: trusted deadline expiry, stale client state, concurrent steps, atomic cost reservation, currency and rounding, in-flight and unknown provider cost, ledger-version conflict, retry, replay, cancellation, process restart, resume without cumulative-budget reset, and attempted model-supplied budget increase.

### 18.2 Evaluation corpus

```text
evaluation/
  cases/                 synthetic case inputs
  documents/             generated and adversarial documents
  expected-facts/        extraction ground truth
  expected-conditions/   policy and condition ground truth
  policy-timelines/      jurisdiction, effective-date, transition, and correction fixtures
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
- policy snapshot repeatability: `100%` for identical context, catalog knowledge time, and resolver version;
- evaluations with a validated policy binding: `100%`;
- invalid or stale policy bindings accepted: `0`;
- evaluations without a valid immutable input manifest accepted: `0`;
- external provider dispatches without a current scoped authorization grant: `0`;
- duplicate cost-bearing or consumer-impacting provider effects caused by platform retry or fallback: `0`;
- ambiguous provider outcomes automatically treated as confirmed failure: `0`;
- protected communications delivered without exact current human approval: `0`;
- routine communications delivered outside an active exact template and variable allowlist: `0`;
- Agent tool effects accepted after deadline or beyond authoritative step, token, provider-call, or cost budget: `0`;
- future-effective policy activated early: `0`;
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
- `provider-certification`: isolated authorized sandboxes and, only when separately approved, a controlled provider canary with restricted real data.
- `production`: the same immutable artifact and domain workflow, with real adapters disabled by default and enabled per tenant only through an approved promotion manifest and secret activation.

### 19.4 Cost controls

- per-tenant and per-workflow step, provider, token, storage, and concurrency budgets;
- immutable finding reuse when consent, freshness, and policy permit;
- immutable intent reuse, certified provider idempotency where available, and reconciliation reduce duplicate provider and model cost;
- model and provider usage attributed to workflow runs;
- local and staging model services can remain off outside evaluation windows;
- cost-bearing infrastructure requires a documented budget and teardown path;
- business metrics include cost per workflow and per resolved condition.

### 19.5 Production-readiness levels

1. **Synthetic launch ready**: the production-shaped stack, complete workflow, security controls, observability, recovery, and release gates pass using generated data and deterministic simulators.
2. **Provider-integration-ready**: a declared provider/capability/adapter-version/schema-profile tuple in the same artifact passes reusable contracts and authorized sandbox certification; production endpoints, production credentials, and real consumer data remain disabled.
3. **Production-approved**: a specific tenant, provider, capability, adapter version, schema profile, product, jurisdiction, and environment pass the real-data enablement gates in Section 11.8 and Section 22.6.

Level 2 is the repository engineering target. Level 3 is an environment and organizational approval state, not a claim that can be established from public source code alone.

## 20. Delivery strategy

Delivery proceeds through runnable vertical slices. Each milestone ends with a demonstrable user or developer outcome, current verification evidence, and a separately reviewable set of commits.

### Milestone status

| Milestone | Outcome | Status |
|---|---|---|
| M0 | Stable free model baseline and independent product charter | Implemented |
| M1 | Supported runtime, migrations, and security baseline | Planned |
| M2 | Durable loan case, evidence, and condition workflow | Planned |
| M3 | Temporal policy resolution, bounded Agent tools, and human review | Planned |
| M4 | Provider gateway, partner API, webhooks, and sandbox | Planned |
| M5 | Tenant trust boundary and audit controls | Planned |
| M6 | Operations console and release evaluation | Planned |
| M7 | Synthetic staging and provider-integration-readiness evidence | Planned |

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

**User-visible outcome:** the Agent inspects evidence and selects allowed tools; every policy-bound evaluation first validates or refreshes the current synthetic policy binding, then pauses for review or resumes safely.

Scope:

- policy source registry, jurisdiction catalog, and explicit coverage status;
- policy DSL parser, validator, evaluator, immutable versions, and golden tests;
- bitemporal applicability resolver and immutable case policy snapshots;
- unavoidable `PolicyEvaluationService` binding-validation guard, dependency generations, and invalidation events;
- immutable evaluation input manifests and expected case-version writes;
- future-effective scheduling, transition approval, and open-case impact assessment;
- change fixtures covering state overlays, corrections, withdrawals, and relevant lifecycle events;
- `AgentRuntime` port and LangGraph.js v1 adapter;
- registered tools, schemas, budgets, and side-effect gates;
- trusted Agent deadlines, authoritative budget ledgers and reservations, and budget-exhaustion review routing;
- deterministic communication classification, immutable routine templates, exact protected-message approval binding, and delivery guards;
- reviewer interrupt and resume flow;
- minimal review surface sufficient to operate the workflow;
- evidence-backed explanations and Agent run timeline;
- initial release evaluation corpus and report command.

Exit evidence:

- unauthorized tools remain unreachable;
- designated review cases always interrupt;
- repeated versioned inputs produce the same policy result;
- the same as-of context reproduces the same policy snapshot, including at effective-date boundaries;
- every evaluation and re-evaluation records a binding-validation outcome, while direct evaluator calls that bypass validation fail closed;
- every evaluation reads one immutable input manifest, while mutable-latest reads and stale case writes fail closed;
- unchanged valid bindings use the fast path; affected dependency keys, selector versions, facts, or policy time boundaries force refresh or review, while failed consent or authorization blocks manifest creation independently;
- a catalog activation racing with evaluation produces one internally consistent, auditable result;
- a future-effective or jurisdiction-mismatched version is never selected;
- an ambiguous transition or policy-layer conflict always creates a review task;
- malformed model output routes safely.
- protected or uncertain communication cannot bypass exact human approval, while an unchanged approved routine template follows the configured policy path;
- deadline and ledger-race tests prevent every over-budget tool effect, including conservatively reserved unknown provider cost.

### M4 — Provider and developer platform vertical slice

**Developer-visible outcome:** an integration developer can use the REST API, SDK, simulator, and signed webhooks while exercising provider failures deterministically.

Scope:

- provider registry, capability contracts, health, routing, and normalization;
- capability and promotion validation that rejects all structurally excluded command classes in Section 7.5;
- income, asset, credit, identity, and document simulators;
- promotion manifests and controlled mode activation for already certified adapter tuples;
- scoped runtime authorization grants, durable operation intents, effect classes, unknown-outcome reconciliation, and fallback gates;
- reusable adapter contract suite;
- REST/OpenAPI contract and TypeScript client;
- webhook subscriptions, delivery retries, history, and replay protection;
- sandbox scenarios, webhook inspector, and quickstart;
- safe replay, unknown-outcome reconciliation, and authorization-gated provider fallback operations.

Exit evidence:

- a new simulator adapter is added without domain or Agent changes;
- an authorized sandbox adapter runs the same workflow and canonical contracts as its simulator;
- an already implemented and certified adapter changes mode through configuration and secret activation, not a different application build;
- post-dispatch timeout, delayed callback, cancellation, retry, and fallback tests produce no duplicate cost-bearing or consumer-impacting effect;
- every documented failure mode is covered by a deterministic test;
- generated client completes the published quickstart.
- no simulator, sandbox, production manifest, router, or Agent tool exposes a funds-movement, binding rate-lock, legal-disclosure, formal-decision, clear-to-close, settlement, funding, servicing-payment, or capital-delivery command.

### M5 — Fintech trust boundary

**User-visible outcome:** multiple tenants can use the platform without crossing identity, data, provider, policy, or audit boundaries.

Scope:

- OIDC and scoped API-client authentication;
- FAPI 2.0 security profile compatibility where required by the provider or customer ecosystem;
- RBAC, tenant context, and PostgreSQL RLS;
- consent enforcement;
- encrypted field and object boundaries;
- lineage-aware retention, deletion, legal-hold, backup-expiry, deletion-verification, and audit-export workflows;
- tenant-owned provider, policy, webhook, communication-template, and budget configuration;
- immutable provider manifests, separated administrative duties, dual production activation, emergency disable, and controlled re-enable;
- threat-model tests and negative authorization suite.

Exit evidence:

- cross-tenant tests fail closed at API, service, and database layers;
- every material mutation records actor, tenant, resource, correlation, and reason provenance.
- self-approval, stale activation, artifact mismatch, expired grant, and incomplete deletion-lineage tests fail closed.

### M6 — Operations and evaluation vertical slice

**User-visible outcome:** operations users can understand, review, and recover every synthetic case without direct database access.

Scope:

- React case list and detail;
- evidence, condition, policy, provider, Agent, workflow, review, and audit views;
- provider unknown-outcome reconciliation, production-activation approval, and data-disposition queues with least-privilege actions;
- protected-communication exact-render review and Agent deadline, usage, reservation, and cost-ledger views;
- explicit empty, loading, degraded, retrying, stale, unauthorized, and disconnected states;
- accessible interaction and keyboard navigation;
- evaluation dashboard and downloadable release report;
- OpenTelemetry dashboards and alerts;
- operational replay, cancellation, and recovery controls.

Exit evidence:

- the launch scenario and injected failure scenario are operable through the UI;
- accessibility and unhappy-path checks pass;
- no sensitive fixture content appears in telemetry or unauthorized views.

### M7 — Synthetic staging and provider-integration readiness

**Outcome:** the product is reproducibly deployed with synthetic data and production-like controls, and the same artifact is certifiably ready for authorized real-provider configuration.

Scope:

- Terraform/OpenTofu environment definitions;
- GitHub Actions OIDC deployment;
- synthetic staging data and access controls;
- load, soak, security, backup, restore, and failure-recovery evidence;
- SLO dashboards, alerts, runbooks, and incident exercise;
- architecture decision records and demo walkthrough;
- provider promotion manifests, certification reports, kill-switch exercise, and certified-adapter mode-activation evidence;
- release artifact, dependency, and source-revision traceability.

Exit evidence:

- all launch gates in Section 22 pass in staging;
- live health, workflow, review, webhook, and recovery paths are verified;
- provider-integration-ready status is claimed only for each named provider, capability, adapter version, schema profile, and authorized sandbox that passes the same contract suite and end-to-end workflow as its simulator;
- absence of optional provider credentials does not block synthetic-launch-ready status, but it prevents a provider-integration-ready claim and remains an explicit unverified boundary;
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
- provider authorization rejection, retry, unknown-outcome, reconciliation age, fallback, duplicate-prevention, and terminal-failure rates;
- evaluation input-manifest creation, case-version conflict, and deterministic replay rates;
- routine and protected communication classification, review, approval, template rejection, and delivery rates;
- Agent deadline expiry, step, token, provider-call, cost usage, reservation conflict, unknown-cost reserve, and budget-exhaustion rates;
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
- policy source coverage and freshness by jurisdiction;
- time from source-change detection to reviewed, scheduled policy version;
- policy snapshot resolution conflict and failure rate;
- policy-binding validation coverage, fast-path reuse, refresh, latency, invalid-binding rejection, and review-required rate;
- open cases awaiting policy-impact disposition;
- steps, latency, tokens, and cost by model configuration.

### 21.4 Guardrails

- cross-tenant data exposure: `0`;
- unauthorized Agent tool execution: `0`;
- unsupported material claim accepted by a release gate: `0`;
- lost acknowledged workflow work: `0`;
- duplicate external side effects caused by replay: `0`;
- duplicate cost-bearing or consumer-impacting provider effects caused by retry or fallback: `0`;
- provider dispatch without current scoped authorization: `0`;
- structurally excluded financial command classes registered or activated: `0`;
- protected communication delivered without exact current human approval: `0`;
- Agent tool effects accepted after trusted deadline or authoritative budget exhaustion: `0`;
- production provider enablement or re-enablement without two distinct current approvals and no self-approval: `0`;
- unattributed human override: `0`;
- real consumer data in public demo or evaluation artifacts: `0`.

## 22. Launch gates

### 22.1 Product gates

- end-to-end synthetic conditions journey is usable through documented APIs and the console;
- every condition links to an immutable evaluation input manifest, exact evidence versions, and an immutable case policy snapshot;
- workflow and UI distinguish evidence readiness, operational conditions, downstream underwriting status, and formal credit action;
- workflow and UI distinguish routine operational messages, protected drafts awaiting exact human approval, sent communications, and authoritative downstream notices;
- review, wait, resume, cancellation, and recovery paths are demonstrated;
- API, SDK, webhook, and sandbox quickstarts are current;
- all user-visible capabilities distinguish synthetic from official results.

### 22.2 Security and privacy gates

- tenant-isolation and authorization suites pass;
- secrets, dependency, container, and infrastructure scans pass at the declared threshold;
- threat model and abuse-case tests are current;
- protected-message classification and exact-render approval enforcement pass negative and race tests;
- logs, traces, prompts, errors, screenshots, and fixtures pass PII review;
- backup, restore, lineage-aware retention, deletion, legal hold, backup expiry, deletion verification, and key-rotation procedures are exercised;
- no real borrower data is accepted by the public launch environment.

### 22.3 Reliability gates

- migration, workflow replay, crash recovery, duplicate delivery, and webhook retry tests pass;
- ambiguous provider outcomes reconcile without a duplicate order, fee, consumer-impacting inquiry, or false cancellation claim;
- Agent step and side-effect gates enforce trusted deadlines and atomic authoritative budget reservations under concurrent and replayed execution;
- declared load and soak profiles meet release objectives;
- alerts fire in injected provider, queue, database, and webhook failure scenarios;
- operations users can recover documented failures without database mutation;
- runbooks identify owners, detection, mitigation, rollback, and verification.

### 22.4 AI and policy gates

- pinned evaluation corpus and configuration produce a reproducible report;
- unauthorized-tool, mandatory-review, evidence-coverage, malformed-output, and unsupported-claim gates pass;
- every released policy version has approval and regression evidence;
- every evaluated case records the exact applicable versions, source revisions, jurisdiction context, effective boundaries, resolver version, and resolution reasons;
- every evaluation and re-evaluation records an immutable input manifest, validated policy binding, and observed dependency digest; bypassed, stale, invalidated, or mismatched inputs are rejected;
- parent-layer, new-overlay, coverage, resolver, and relevant-fact-selector changes invalidate affected bindings;
- concurrent evidence, consent, policy, and case changes cannot alter a running evaluation or accept a stale condition write;
- protected or uncertain communication always interrupts for exact human approval; routine policy delivery is limited to an unchanged active template and allowlisted render;
- models and clients cannot increase, reset, or bypass duration, step, token, provider-call, or cost budgets;
- historical replay reproduces the same snapshot for the declared valid time and system knowledge time;
- future-effective versions never activate early, and unresolved coverage or transition states fail closed to review;
- approaching effective dates with stale sources or incomplete impact review trigger an operational alert;
- Agent and policy failures route to safe states;
- no model output is represented as private reasoning or official underwriting authority.

### 22.5 Delivery gates

- source, dependencies, migrations, infrastructure, release artifact, and deployed revision are traceable;
- CI is green from a clean checkout;
- rollback and restore paths are documented and exercised;
- known limitations and unverified boundaries are published with the release.

### 22.6 Provider-integration and real-data gates

- simulator and authorized sandbox adapters pass the same canonical capability contract and end-to-end workflow tests;
- the identical certified application artifact runs all modes for the declared provider, capability, adapter version, and schema profile; only reviewed configuration and secret references differ;
- sandbox-only behavior is isolated inside adapters and cannot enter production routing;
- immutable promotion manifest, artifact digest, schema profile, endpoint allowlist, credential rotation, webhook verification, rate and cost budgets, canary, kill switch, and rollback are exercised;
- provider-specific schema variance, partial results, authentication expiry, rate limits, pre- and post-dispatch timeouts, unknown outcomes, duplicate and delayed callbacks, cancellation ambiguity, and outages are tested;
- runtime authorization, consent, permissible purpose, data minimization, retention, deletion, residency, model access, and audit controls are approved for the exact data flow;
- operation intents prove that retry and fallback cannot duplicate cost-bearing, consumer-impacting, or irreversible effects; unresolved outcomes block new effects pending reconciliation or authorized review;
- production enablement and re-enablement enforce separated duties, two-person control, no self-approval, approval expiry, and optimistic activation versioning; emergency disable remains immediately available and attributable;
- production routing remains disabled until tenant, provider, capability, adapter version, schema profile, product, jurisdiction, environment, artifact digest, and named approvers match the approved manifest;
- provider certification and production approval reject every command class structurally excluded by Section 7.5; read-only lifecycle status integration cannot be promoted into funds movement, rate-lock, disclosure, decision, settlement, funding, servicing-payment, or capital-delivery authority;
- provider-integration-ready and production-approved status are reported separately.

## 23. Risks and mitigation

| Risk | Mitigation |
|---|---|
| Product becomes a generic Agent demo | Keep the conditions loop, evidence graph, policy lifecycle, and provider failures central. |
| Product becomes a copy of one company | Maintain independent positioning, public standards, provider neutrality, and a multi-lending extension model. |
| Model output is mistaken for a lending decision | Use workflow-readiness vocabulary, deterministic authority, visible provenance, and human review. |
| Architecture grows faster than evidence | Deliver vertical slices and defer service extraction, Kubernetes, and secondary frameworks. |
| Temporal and LangGraph duplicate state | Temporal owns durable lifecycle; LangGraph remains bounded behind `AgentRuntime`. |
| Rules encode hidden errors | Add types, units, property tests, human approval, regression, impact analysis, and rollback. |
| Policy drift or wrong jurisdiction changes case treatment | Track source freshness and coverage, resolve bitemporal case snapshots, test effective boundaries, assess open-case impact, and fail closed on ambiguity. |
| A parent policy, new overlay, resolver, or fact-selector change misses a narrower binding | Validate a complete dependency key set and digest, including empty scopes and hierarchy generations, before every evaluation. |
| Evaluation bypasses or races policy or evidence state | Make binding validation and immutable input-manifest creation internal application-service guards, use authoritative dependency vectors and hashes, execute in one consistency boundary, and reject mutable-latest reads. |
| Readiness automation is mistaken for the full approval process | Model regulated milestones explicitly, label lifecycle ownership, and keep formal underwriting action, notices, closing, and funding outside Agent authority. |
| Provider certification is misread as authority to move funds or perform another structurally excluded action | Enforce a permanent capability denylist across registries, manifests, routers, and Agent tools; require a replacement charter and separate activity-specific review before any boundary change. |
| Routine-message policy is used to send a protected or legally consequential communication | Use deterministic classification, immutable template allowlists, exact-render human approval for protected content, and fail closed on uncertainty or render drift. |
| Stale Agent state or concurrent work bypasses duration or cost limits | Enforce trusted absolute deadlines and atomic versioned budget reservations outside the graph; reserve unknown provider cost conservatively. |
| Provider behavior corrupts case state | Normalize through contracts, isolate activities, validate payloads, and commit through the domain layer. |
| Timeout, retry, cancellation, or fallback duplicates a paid or consumer-impacting operation | Persist effect-classified intents before dispatch, preserve unknown outcomes, reconcile first, reauthorize fallback, and require review where safety is not proven. |
| Simulator success hides production-provider behavior | Run the same contracts in authorized sandboxes, document parity gaps, certify provider-specific failures, and use controlled canaries with a kill switch. |
| Real data is enabled by an unsafe environment toggle | Require an approved promotion manifest, managed secret reference, exact scope match, attributable activation, and default-deny production routing. |
| One administrator certifies and enables an unsafe provider configuration | Separate proposal, certification, approval, and activation; prohibit self-approval; require dual enablement; keep unilateral emergency disable. |
| Deletion removes a primary record but leaves derived consumer data | Traverse lineage across findings, indexes, caches, model artifacts, objects, and backups; verify disposition and explicitly govern legal holds. |
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
7. Bitemporal, jurisdiction-aware policy resolution with immutable case snapshots.
8. Policy-change impact assessment and approved open-case transition handling.
9. Efficient mandatory policy-binding validation with dependency vectors, versioned fact selectors, and safe reuse.
10. Mortgage lifecycle milestones and explicit readiness-versus-decision boundaries.
11. Provider modes with contract parity, scoped certification, and controlled activation of already certified adapters.
12. Synthetic-only public launch and real-data approval boundary.
13. Terraform/OpenTofu and ECS Fargate before Kubernetes.
14. Stable repository name with product identity expressed through documentation.
15. Immutable evaluation input manifests and optimistic case-version writes.
16. Effect-classified provider intents, unknown-outcome reconciliation, and authorization-bound fallback.
17. Immutable provider promotion manifests with separated duties and dual production activation.
18. Structural prohibition on funds movement, binding rate locks, formal decisions and notices, settlement, funding, servicing payments, and capital delivery.
19. Deterministic routine-versus-protected communication authority with exact-render human approval.
20. Trusted Agent deadlines and authoritative versioned budget ledgers and reservations.

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
- eCFR API documentation: <https://www.ecfr.gov/developers/documentation/api/v1>
- Federal Register API documentation: <https://www.federalregister.gov/developers/documentation/api/v1>
- CFPB Regulation Z current and historical versions: <https://www.consumerfinance.gov/rules-policy/regulations/1026/>
- CFPB mortgage origination examination procedures: <https://www.consumerfinance.gov/compliance/supervision-examinations/mortgage-origination-examination-procedures/>
- CFPB TILA-RESPA Integrated Disclosure FAQs: <https://www.consumerfinance.gov/compliance/compliance-resources/mortgage-resources/tila-respa-integrated-disclosures/tila-respa-integrated-disclosure-faqs/>
- CFPB Regulation B action-notification requirements: <https://www.consumerfinance.gov/rules-policy/regulations/1002/9/>
- OCC Mortgage Banking handbook: <https://www.occ.treas.gov/publications-and-resources/publications/comptrollers-handbook/files/mortgage-banking/pub-ch-mortgage-banking.pdf>
- OCC Residential Real Estate Lending handbook: <https://www.occ.treas.gov/publications-and-resources/publications/comptrollers-handbook/files/residential-real-estate-lending/pub-ch-residential-real-estate.pdf>
- OpenID Foundation FAPI 2.0 Security Profile: <https://openid.net/specs/fapi-security-profile-2_0.html>
- Example provider sandbox and production environment guidance: <https://plaid.com/docs/sandbox/>
- CFPB advisory opinion on consumer-specific permissible purpose: <https://www.consumerfinance.gov/rules-policy/final-rules/fair-credit-reporting-permissible-purposes-for-furnishing-using-and-obtaining-consumer-reports/>
- IETF HTTPAPI Idempotency-Key draft: <https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header>
- NIST SP 800-53 Rev. 5 separation-of-duties and dual-authorization controls: <https://doi.org/10.6028/NIST.SP.800-53r5>
- FinCEN money-transmission definition and facts-and-circumstances guidance: <https://www.fincen.gov/resources/statutes-regulations/administrative-rulings/whether-company-provides-online-real-time>

Technology references justify maturity and compatibility only. Regulatory references illustrate source versioning, effective-date, relevant-event, and federal/state interaction requirements; they are not legal interpretation, complete jurisdiction coverage, or proof that target capabilities are implemented.
