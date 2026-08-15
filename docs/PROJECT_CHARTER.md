# Mortgage Integration Agent — Product and Engineering Charter

> Mortgage-first, lending-extensible autonomous operations platform

| Field | Value |
|---|---|
| Document status | Target-state charter; implementation plan, not a production-readiness claim |
| Version | 2.3 |
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
- **Provider-integration-ready**: simulator and authorized provider modes use the same domain workflow and adapter contract; sandbox certification evidence exists, but production credentials and real consumer data remain disabled.
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
- Moving funds, locking real rates, ordering paid services, or delivering loans to capital markets in the public launch.
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

Every satisfied, waived, or escalated condition includes evidence or reviewer provenance and the immutable case policy snapshot that governed the transition.

### 6.3 Authority order

1. Consent, authorization, and security controls may stop processing.
2. Validated source evidence remains attributable to its origin.
3. Deterministic calculations and the resolved, released case policy snapshot determine condition state and readiness.
4. The Agent may select approved tools, compare evidence, propose actions, and draft explanations.
5. Human reviewers approve protected communications, interpret out-of-policy cases, and record overrides.
6. Model output never silently overrides policy, source evidence, or a human decision.

### 6.4 Mortgage lifecycle alignment and product boundary

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
| Clear-to-close, closing, and funding | Final verification, closing disclosure, consummation, settlement, funding | Outside initial launch scope | Authorized lender, settlement, and funding systems remain authoritative. |
| Post-closing and servicing handoff | Quality control, delivery, boarding, servicing, corrections | Outside initial launch scope | Downstream operational and compliance owners retain authority. |

`READY_FOR_UNDERWRITING` means only that configured evidence-readiness checks passed. `CONDITIONS_OPEN` means operational work remains. Neither status means conditional approval, final approval, clear-to-close, funding authorization, or satisfaction of a legal notice obligation.

This lifecycle map is a product-scope baseline, not a legal checklist. Authorized lending, legal, compliance, and operations owners must configure the actual milestones, notices, clocks, evidence, and decision authorities for each product and jurisdiction.

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
8. Request an evaluation; the mandatory system guard validates or refreshes the case's current policy binding using the authoritative scope generation and relevant-facts hash.
9. Execute deterministic calculations and policy only against the validated immutable snapshot.
10. Create prioritized operational conditions for missing or contradictory evidence.
11. Let the Agent select the next approved tool within budget.
12. Pause durably for information or human approval when required.
13. Introduce a reviewed synthetic state-policy change while the case waits and produce an open-case impact assessment.
14. Resume when a signal supplies new evidence, an approved transition decision, or another review decision.
15. Before every re-evaluation, validate the binding again; reuse it when all validity predicates still hold, otherwise refresh it or create a review task.
16. Publish signed status events and display the full timeline, including the binding and validation outcome used by every evaluation.

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
- rate locking, disclosures with legal effect, closing, settlement, or capital delivery;
- production document OCR contracts;
- additional lending product packs;
- billing and subscription management;
- multi-region disaster recovery;
- high-volume batch submission.

Deferred capabilities are disabled in the public synthetic launch, not omitted from the target integration architecture. Real providers must enter through the same capability ports, workflow, canonical findings, and release artifact after the gates in Sections 11.7 and 22.6 pass.

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
| `calculate_qualified_income` | Request a policy-bound income calculation | Versioned calculation | Mandatory policy-binding validation |
| `calculate_dti` | Execute deterministic calculation | Versioned calculation | No |
| `calculate_ltv` | Execute deterministic calculation | Versioned calculation | No |
| `compare_evidence` | Detect missing, stale, or conflicting facts | None | No |
| `check_policy_change_impact` | Compare an approved policy change with open cases | Creates impact assessment | No; cannot change case applicability |
| `evaluate_policy` | Request guarded evaluation of current applicable policy | Creates assessment | Mandatory policy-binding validation |
| `create_condition` | Materialize a policy-supported operational condition | Case mutation | Validated binding and evaluation required |
| `draft_information_request` | Prepare a remediation request | Draft only | No |
| `send_information_request` | Deliver an external message | External communication | Human or configured policy approval |
| `escalate_to_reviewer` | Pause and create review task | Workflow transition | No |
| `publish_case_update` | Deliver a signed webhook | External communication | Policy-controlled and idempotent |

`validate_policy_binding` is deliberately not an Agent tool. It is an unavoidable application-service guard invoked server-side for every evaluation request, including re-evaluations and retries. The Agent cannot omit it, supply its result, or choose an older snapshot.

### 9.5 Agent loop

```text
LOAD VERSIONED CASE
  -> VERIFY TENANT, CONSENT, AND BUDGET
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

Every evaluation must confirm that its policy is still current, but confirmation does not require full resolution or a new receipt every time. The policy control plane publishes approved immutable snapshots and increments a generation only for affected scope keys. The evaluation data plane performs a constant-size validation against the authoritative generation pointer, trusted time, and a hash of policy-relevant case facts.

```ts
interface CasePolicyBinding {
  id: string;
  tenantId: string;
  caseId: string;
  scopeKey: string;
  scopeGeneration: number;
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
  observedScopeGeneration: number;
  observedFactsHash: string;
  outcome: 'REUSED' | 'REFRESHED' | 'REVIEW_REQUIRED';
}
```

`scopeKey` is derived from tenant, jurisdiction, product, optional program or investor overlay, and lifecycle event. `revalidateAfter` is the earliest known scheduled activation boundary, source-freshness deadline, or configured maximum validation interval.

```text
BEGIN EVALUATION REQUEST
  -> derive scope key and relevant-facts hash from server-owned state
  -> read the indexed authoritative scope generation
  -> validate binding predicates
       generation unchanged
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

This design keeps the correctness property while eliminating per-evaluation source reads, full rule scans, and duplicate receipt writes. A successful fast path performs one indexed generation read plus in-memory hash and time comparisons. Redis or process caches may reduce latency, but they are hints only; the authoritative scope generation is read transactionally whenever an evaluation can create a material state transition.

Policy activation atomically increments only affected scope generations and emits invalidation events. A new evaluation may safely reuse a binding while every predicate remains valid. It must refresh after a relevant case mutation, affected generation change, scheduled boundary, withdrawal, coverage-freshness deadline, or hash mismatch. The invariant is therefore **validation coverage `100%` and invalid binding acceptance `0`**, not zero reuse.

The evaluation row itself is the audit record: it stores the binding ID, observed scope generation, validation time, outcome, and evaluator version. A same-request idempotent replay returns the recorded result. A new request may reuse the binding after validation without creating a separate confirmation artifact.

Validation and execution share a database snapshot or equivalent consistency boundary so a policy activation cannot create an unrecorded time-of-check/time-of-use gap. The evaluator rejects direct calls that bypass validation. The guard is deterministic infrastructure, not a human click and not an LLM judgment.

Validation reads the approved internal catalog; it does not scrape or reinterpret external legal sources in the evaluation critical path. Source monitors update freshness and candidate revisions asynchronously. If declared jurisdiction coverage is incomplete or its freshness objective has expired, validation stops and routes to review. “Current” means current within explicitly approved, fresh source coverage, never an unsupported claim that the platform knows every policy change everywhere.

For a live evaluation, `evaluationAsOf` and `policyKnowledgeAsOf` come from trusted server time. Historical values are accepted only by a separately authorized replay operation that cannot create a live case outcome.

### 10.5 Change detection and open-case impact

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

### 10.6 Example synthetic DSL

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

### 10.7 Policy invariants

- Policy identifiers and released versions are immutable.
- Every released rule has source provenance, jurisdiction, valid-time boundaries, system-time history, and approval evidence.
- Units, money, ratios, dates, and rounding behavior are explicit.
- Every condition links to the rule and evidence that created it.
- Every evaluation links to an immutable case policy snapshot and resolver version.
- Every evaluation validates a policy binding; validation coverage is `100%` and invalid binding acceptance is `0`.
- A valid binding may be reused across evaluations only while its scope generation, relevant-facts hash, time boundary, invalidation state, and source coverage remain valid.
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

Changing from simulator to a real provider is a reviewed configuration and secret activation, not a source-code edit, rebuild, or alternate business workflow. The same immutable application artifact is promoted across environments.

Sandbox parity has limits: a provider test environment may not reproduce institution-specific authentication, data quality, latency, rate limits, or failure behavior. Production readiness therefore requires both deterministic simulator coverage and an authorized provider-certification sequence before live traffic.

### 11.3 Capability contract

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

### 11.4 Promotion manifest

```ts
interface ProviderPromotionManifest {
  tenantId: string;
  providerId: string;
  adapterVersion: string;
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
  certificationReportId: string;
  enabled: boolean;
}
```

Manifests contain references and policy identifiers, never raw credentials. Enabling `PRODUCTION_BYOC` requires an approved manifest, isolated secret reference, explicit tenant authorization, and an attributable change record. A kill switch can disable a provider or capability without redeploying the application.

### 11.5 Routing

Provider selection uses deterministic constraints before optimization:

1. tenant authorization and operating mode;
2. product, jurisdiction, and capability eligibility;
3. consent and permissible-use configuration;
4. provider health and circuit state;
5. data freshness requirements;
6. latency, cost, and reliability score;
7. configured fallback order.

LLMs do not choose a provider by unconstrained preference. More advanced optimization may be added after the routing inputs and objectives are measurable.

### 11.6 Contract and certification tests

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

The same suite runs against simulators and authorized sandboxes. A production certification run additionally verifies endpoint and credential isolation, real authentication behavior, representative schema variance, webhook signatures, documented rate limits, support correlation identifiers, canary routing, kill-switch behavior, and rollback to a safe provider state.

### 11.7 Real-data enablement boundary

The codebase is **provider-integration-ready** only when real providers can be enabled through a promotion manifest and secret activation with no domain or workflow code change. It becomes **production-approved** for real data only after all of the following are evidenced for the specific tenant, provider, capability, product, jurisdiction, and environment:

- executed contract and production access approval;
- consent and permissible-purpose configuration;
- data-flow, classification, minimization, retention, deletion, and residency review;
- managed credentials, rotation, revocation, egress allowlist, and webhook verification;
- tenant isolation, field authorization, encryption, redaction, and audit tests;
- provider-specific certification, rate-limit and cost budgets, canary plan, kill switch, and incident runbook;
- legal, compliance, privacy, security, and operations approval with named owners;
- monitored first-live workflow and verified rollback.

Real data is never copied into public fixtures, model-evaluation corpora, screenshots, local development, or shared staging. Production adapters receive only the minimum authorized fields, and model access remains independently governed from provider access.

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
| `policy_scope_generations` | Authoritative generation and next boundary for each affected tenant, jurisdiction, product, program, and lifecycle scope. |
| `case_policy_snapshots` | Immutable resolved versions, source revisions, context hash, and resolution reasons. |
| `case_policy_bindings` | Reusable case-to-snapshot binding with scope generation, relevant-facts hash, time boundary, and invalidation state. |
| `policy_impact_assessments` | Dry-run comparison and disposition for potentially affected open cases. |
| `policy_evaluations` | Binding ID, validation observation, evaluator version, rule execution, and evidence references. |
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
- Policy data retains separate valid-time and system-time fields so historical execution can be reproduced as both effective and known at a declared instant.
- Policy source coverage and freshness are explicit per jurisdiction; missing coverage is an operational state, not an implicit default.
- Policy bindings and their observed generations are server-owned; clients and models cannot supply, select, or extend them.
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
GET    /v1/loan-cases/{caseId}/policy-snapshots
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
policy_version.scheduled
policy_version.activated
policy_change.detected
case_policy_snapshot.resolved
policy_binding.validated
policy_binding.refreshed
policy_binding.review_required
policy_impact.review_required
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
- separate policy-author and policy-approver roles, with independent approval for releases and transition logic;
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
- duplicate provider callbacks after workflow cancellation;
- malicious file content and decompression abuse;
- unauthorized review override or audit tampering.
- bypass, stale reuse, substitution, or time-of-check/time-of-use race involving a policy binding.

## 17. Reliability and observability

### 17.1 Reliability behavior

- API acknowledgment occurs only after durable state is committed.
- Temporal owns workflow retries and waits; activities remain idempotent.
- External delivery uses outbox-backed publication and stable event identifiers.
- Retries use explicit classifications, bounded attempts, backoff, and jitter.
- Circuit breakers prevent repeated calls to unhealthy providers.
- Workflow replay does not duplicate completed external effects.
- Workflow replay cannot bypass policy-binding validation; a new evaluation validates again, while an idempotent replay of the same completed request returns its recorded result.
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
- provider mode, adapter and certification version, latency, normalization failures, authentication expiry, webhook verification, rate limits, fallback, canary allocation, kill-switch state, and circuit state;
- condition age, reopen rate, and time waiting for evidence;
- Agent steps, tool choices, schema failures, escalation, tokens, and cost;
- policy source freshness and coverage gaps by jurisdiction;
- time from detected source revision to reviewed version and scheduled activation;
- policy snapshot resolution conflicts, failures, and version distribution;
- policy-binding validation coverage, fast-path reuse, refresh rate, latency, invalid-binding rejection, and review-required rate;
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
13. **Policy-binding tests**: validation-bypass rejection, safe unchanged-binding reuse, facts and scope-generation mismatch, scheduled-boundary expiry, invalidation events, catalog activation races, idempotent same-request replay, and mandatory validation on every re-evaluation.

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
- idempotency prevents duplicate provider and model cost;
- model and provider usage attributed to workflow runs;
- local and staging model services can remain off outside evaluation windows;
- cost-bearing infrastructure requires a documented budget and teardown path;
- business metrics include cost per workflow and per resolved condition.

### 19.5 Production-readiness levels

1. **Synthetic launch ready**: the production-shaped stack, complete workflow, security controls, observability, recovery, and release gates pass using generated data and deterministic simulators.
2. **Provider-integration-ready**: the same artifact passes reusable adapter contracts and authorized sandbox certification; production endpoints, production credentials, and real consumer data remain disabled.
3. **Production-approved**: a specific tenant, provider, capability, product, jurisdiction, and environment pass the real-data enablement gates in Section 11.7 and Section 22.6.

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
- unavoidable `PolicyEvaluationService` binding-validation guard, scope generations, and invalidation events;
- future-effective scheduling, transition approval, and open-case impact assessment;
- change fixtures covering state overlays, corrections, withdrawals, and relevant lifecycle events;
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
- the same as-of context reproduces the same policy snapshot, including at effective-date boundaries;
- every evaluation and re-evaluation records a binding-validation outcome, while direct evaluator calls that bypass validation fail closed;
- unchanged valid bindings use the fast path; affected generations, facts, or time boundaries force refresh or review;
- a catalog activation racing with evaluation produces one internally consistent, auditable result;
- a future-effective or jurisdiction-mismatched version is never selected;
- an ambiguous transition or policy-layer conflict always creates a review task;
- malformed model output routes safely.

### M4 — Provider and developer platform vertical slice

**Developer-visible outcome:** an integration developer can use the REST API, SDK, simulator, and signed webhooks while exercising provider failures deterministically.

Scope:

- provider registry, capability contracts, health, routing, and normalization;
- income, asset, credit, identity, and document simulators;
- promotion manifests and configuration-only simulator, sandbox, and production modes;
- reusable adapter contract suite;
- REST/OpenAPI contract and TypeScript client;
- webhook subscriptions, delivery retries, history, and replay protection;
- sandbox scenarios, webhook inspector, and quickstart;
- safe replay and provider fallback operations.

Exit evidence:

- a new simulator adapter is added without domain or Agent changes;
- an authorized sandbox adapter runs the same workflow and canonical contracts as its simulator;
- changing provider mode requires configuration and secret activation, not a different application build;
- every documented failure mode is covered by a deterministic test;
- generated client completes the published quickstart.

### M5 — Fintech trust boundary

**User-visible outcome:** multiple tenants can use the platform without crossing identity, data, provider, policy, or audit boundaries.

Scope:

- OIDC and scoped API-client authentication;
- FAPI 2.0 security profile compatibility where required by the provider or customer ecosystem;
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

### M7 — Synthetic staging and provider-integration readiness

**Outcome:** the product is reproducibly deployed with synthetic data and production-like controls, and the same artifact is certifiably ready for authorized real-provider configuration.

Scope:

- Terraform/OpenTofu environment definitions;
- GitHub Actions OIDC deployment;
- synthetic staging data and access controls;
- load, soak, security, backup, restore, and failure-recovery evidence;
- SLO dashboards, alerts, runbooks, and incident exercise;
- architecture decision records and demo walkthrough;
- provider promotion manifests, certification reports, kill-switch exercise, and configuration-only mode-switch evidence;
- release artifact, dependency, and source-revision traceability.

Exit evidence:

- all launch gates in Section 22 pass in staging;
- live health, workflow, review, webhook, and recovery paths are verified;
- provider-integration-ready status is claimed only after at least one authorized sandbox integration passes the same contract suite and end-to-end workflow as its simulator;
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
- unattributed human override: `0`;
- real consumer data in public demo or evaluation artifacts: `0`.

## 22. Launch gates

### 22.1 Product gates

- end-to-end synthetic conditions journey is usable through documented APIs and the console;
- every condition links to evidence and an immutable case policy snapshot;
- workflow and UI distinguish evidence readiness, operational conditions, downstream underwriting status, and formal credit action;
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
- every evaluated case records the exact applicable versions, source revisions, jurisdiction context, effective boundaries, resolver version, and resolution reasons;
- every evaluation and re-evaluation records a validated policy binding and observed scope generation; bypassed, stale, invalidated, or mismatched bindings are rejected;
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
- the identical application artifact runs all provider modes; only reviewed configuration and secret references differ;
- sandbox-only behavior is isolated inside adapters and cannot enter production routing;
- promotion manifest, endpoint allowlist, credential rotation, webhook verification, rate and cost budgets, canary, kill switch, and rollback are exercised;
- provider-specific schema variance, partial results, authentication expiry, rate limits, duplicate callbacks, delayed callbacks, and outages are tested;
- consent, permissible purpose, minimization, retention, deletion, residency, model-access, and audit controls are approved for the exact data flow;
- production routing remains disabled until tenant, provider, capability, product, jurisdiction, environment, and named approvers match the approved manifest;
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
| Evaluation bypasses or races policy validation | Make binding validation an internal application-service guard, use authoritative scope generations and hashes, execute in one consistency boundary, and reject direct evaluator calls. |
| Readiness automation is mistaken for the full approval process | Model regulated milestones explicitly, label lifecycle ownership, and keep formal underwriting action, notices, closing, and funding outside Agent authority. |
| Provider behavior corrupts case state | Normalize through contracts, isolate activities, validate payloads, and commit through the domain layer. |
| Simulator success hides production-provider behavior | Run the same contracts in authorized sandboxes, document parity gaps, certify provider-specific failures, and use controlled canaries with a kill switch. |
| Real data is enabled by an unsafe environment toggle | Require an approved promotion manifest, managed secret reference, exact scope match, attributable activation, and default-deny production routing. |
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
9. Efficient mandatory policy-binding validation with scoped generations and safe reuse.
10. Mortgage lifecycle milestones and explicit readiness-versus-decision boundaries.
11. Provider modes with contract parity, promotion manifests, certification, and configuration-only activation.
12. Synthetic-only public launch and real-data approval boundary.
13. Terraform/OpenTofu and ECS Fargate before Kubernetes.
14. Stable repository name with product identity expressed through documentation.

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

Technology references justify maturity and compatibility only. Regulatory references illustrate source versioning, effective-date, relevant-event, and federal/state interaction requirements; they are not legal interpretation, complete jurisdiction coverage, or proof that target capabilities are implemented.
