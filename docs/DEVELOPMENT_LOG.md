# Development Log

This append-only journal records implementation evidence, decisions, failures, and remaining gaps. Product claims must be supported by the repository and the verification recorded here.

## M0-001: Local open-model decision provider

### Status

Implemented and locally verified; not committed, published, deployed, or validated against a live model at the time this entry was written.

### Acceptance criterion

The application must run in its default mode without a paid AI API key and must optionally support a local open-weight model through a provider-neutral configuration.

### Problem

The previous implementation coupled the Agent service to a paid model SDK and credential. That made the default development path dependent on external billing and prevented fully local execution.

### Implementation

- Replaced the paid SDK path with `DECISION_PROVIDER=rules|ollama`.
- Kept deterministic rules as the zero-cost default and safe fallback path.
- Added a direct Ollama `/api/chat` integration with a bounded request timeout.
- Constrained output with a JSON schema and validated the parsed response again before accepting it.
- Disabled model thinking for the current single-step structured readiness response; adaptive reasoning remains planned for the stateful Agent milestone.
- Selected `qwen3.5:9b` as the local default for the target M2 Pro 16 GB development machine.
- Preserved explicit language that results and integrations are simulated rather than official findings.
- Removed the paid provider package and credential documentation.

### Affected files

- `.env.example`
- `.gitignore`
- `README.md`
- `demo.js`
- `docker-compose.yml`
- `package.json`
- `package-lock.json`
- `src/agent/agent.service.ts`
- `src/agent/agent.service.spec.ts`
- `src/agent/agent.types.ts`
- `test/loan.e2e-spec.ts`

### Decisions and alternatives

- **Rules remain the default**: a model outage or missing local runtime must not block the free demo.
- **Qwen3.5-9B over Qwen3.5-4B**: the 9B model offers more capacity for tool selection and evidence explanation while its Ollama artifact remains practical on the target 16 GB machine.
- **Qwen3.5-9B over 20B/27B candidates**: larger artifacts leave insufficient memory for the operating system, application, model context, and concurrent services.
- **Direct HTTP before a new client dependency**: the current integration uses one stable Ollama endpoint and does not require another runtime package.
- **Thinking disabled for this slice**: the current call is structured synthesis, not the future Agent planning loop. Thinking will be evaluated per node rather than enabled globally.

### Verification

Verification was performed in the fully local temporary checkout `/private/tmp/mortgage-ollama-verify.6MtDyp` because the workspace dependency tree may contain dataless files.

Commands and results:

```text
npm test -- --runInBand --no-cache --silent
  8 suites passed
  65 tests passed

npm run build
  passed

npx eslint "{src,apps,libs,test}/**/*.ts"
  passed

git diff --check
  passed in the workspace
```

The Agent-specific suite included 32 passing tests covering the rules path, valid local-model responses, schema parsing, malformed output, provider unavailability, HTTP errors, missing content, and model selection.

### Failures and resolution

- The original workspace has previously stalled during heavyweight checks because dependency files were not fully materialized. Verification was moved to a fully local temporary checkout with installed dependencies.
- The local Ollama service was not running during this work. Mocked HTTP tests passed, but no live inference claim is made.

### Security, privacy, cost, and compatibility

- Default execution requires no paid API credential.
- The local-model path avoids sending simulated borrower data to a paid cloud model.
- Model output remains untrusted and must pass schema and semantic validation.
- Raw chain-of-thought is not stored or exposed as an audit explanation.
- Qwen3.5-9B is Apache-2.0, but every production model/runtime combination still requires pinned-version and license verification.

### Known gaps

- The `qwen3.5:9b` artifact has not been downloaded or exercised on this machine.
- Latency, memory use, schema-validity rate, and quality have not yet been measured against the synthetic evaluation dataset.
- The current code performs one structured model call; it is not yet a stateful tool-using Agent.
- Adaptive thinking, tool calling, persistent checkpoints, and human review belong to Milestone 5.

### Next safe step

Complete and commit this isolated Milestone 0 feature, then begin the supported runtime and security baseline without mixing the two scopes.

## M0-002: Project charter and engineering execution protocol

### Status

Documentation implemented and locally validated; target capabilities remain planned until their individual milestone evidence exists.

### Acceptance criterion

The repository must contain one implementation-oriented charter that defines the product boundary, phased roadmap, architecture, Agent authority, security and reliability gates, atomic-commit discipline, development-journal requirements, and code-comment standards.

### Implementation

- Added a 30-section target-state project charter.
- Separated implemented, in-progress, and planned capabilities.
- Defined Milestones 0 through 6 with deliverables and exit gates.
- Added a phase-status table and per-feature execution loop.
- Defined one coherent, independently revertible feature slice per commit.
- Made this development journal part of the definition of done.
- Added public code-documentation guidelines for domain, security, reliability, provider, and Agent logic.
- Defined launch gates, SLO targets, Agent evaluation targets, provider modes, data boundaries, and release governance.
- Removed personal collaboration and identity instructions from the public charter; repository documentation now contains only product and software-delivery governance.

### Affected files

- `docs/PROJECT_CHARTER.md`
- `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Milestones instead of one large rewrite**: each architecture capability must land as a tested, auditable slice.
- **Atomic feature commits instead of commit-per-function**: a commit must be meaningful, buildable, reviewable, and revertible; mechanical fragmentation would obscure behavior and test evidence.
- **Detailed journal plus concise code comments**: the journal preserves implementation evidence and verification, while comments preserve non-obvious rationale next to the code. Comments that merely duplicate implementation syntax are treated as noise rather than documentation.
- **TypeScript 6 for Milestone 1**: TypeScript 7 is released, but current Nest CLI programmatic compiler compatibility is not ready for this migration; the newer compiler remains a separately gated upgrade.
- **Public governance only**: private operator or assistant instructions are not product requirements and do not belong in repository architecture documentation.

### Verification

```text
git diff --check
  passed

personal/internal identity phrase search
  no matches

prohibited product-name search
  no matches

Markdown code-fence balance check
  passed
```

No application test was required for the charter-only change. The immediately preceding feature commit retained successful build, lint, and 65-test evidence.

### Failures and resolution

- An early charter draft included a private identity constraint. It was identified as inappropriate for a public product document and replaced with ordinary release governance.
- A version review initially treated TypeScript 6 as the newest stable release. Current research found TypeScript 7 had shipped, followed by a confirmed Nest CLI compatibility problem; the charter now records the compatibility-driven TypeScript 6 decision accurately.

### Known gaps

- The charter is a target-state contract, not proof that Milestones 1 through 6 are implemented.
- Milestone status must be updated only when exit-gate evidence is recorded.
- Architecture decision records will be added as each corresponding implementation begins.

### Next safe step

Begin Milestone 1 as small acceptance-criterion commits, starting with the supported runtime/framework upgrade and retaining a development-log entry for every completed feature slice.

## M0-003: Public-facing documentation guidelines

### Status

Documentation revised and locally validated; no application behavior changed.

### Acceptance criterion

Development-log entries use stable milestone identifiers without calendar dates, and the code-documentation guidance reads as a public engineering standard for all contributors rather than as an instruction to a particular developer or tool.

### Implementation

- Removed date prefixes from existing development-log headings.
- Removed the date field from the charter's development-journal entry schema.
- Documented milestone and feature identifiers as the journal's organizing keys.
- Reframed the code-comment section as public code-documentation guidance centered on useful rationale, assumptions, failure behavior, and long-term alignment with the implementation.
- Updated the earlier charter log entry to use the same public-facing language.

### Affected files

- `docs/PROJECT_CHARTER.md`
- `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Stable feature identifiers over dates**: milestone identifiers communicate delivery order and scope without requiring calendar metadata in every journal entry.
- **Contributor guidance over command language**: public documentation describes the qualities of maintainable comments and the contexts where they add value.
- **Charter metadata remains separate**: the charter's document-control date remains useful version metadata and is not part of the development journal.

### Verification

```text
git diff --check
  passed

date-prefixed development-log heading search
  no matches

superseded code-comment wording search
  no matches

Markdown code-fence balance check
  passed
```

No application test is required because this change affects documentation only.

### Known gaps

- Future feature entries still depend on contributors following the published journal structure.
- Existing source comments have not yet been audited against the revised guidance; that work belongs with the implementation slices they describe.

### Next safe step

Begin Milestone 1 with the supported runtime and framework upgrade, documenting each coherent feature slice under its milestone identifier.

## M0-004: Autonomous lending operations charter

### Status

Product and engineering charter rewritten and locally validated; the new capabilities described by the charter remain planned until their milestone evidence exists.

### Acceptance criterion

The public charter defines an independent, vendor-neutral, mortgage-first and lending-extensible product; centers the launch on an evidence-and-conditions workflow; uses broadly applicable Fintech architecture; separates durable workflow, bounded Agent reasoning, deterministic policy, and human authority; and organizes delivery as runnable vertical slices.

### Problem

The previous charter described a capable loan-readiness integration platform, but it did not make the conditions loop, policy lifecycle, developer sandbox, or Agent control plane central enough to the product. Its roadmap was organized primarily by architecture layer, which delayed the first complete operational workflow and made the product easier to interpret as a generic AI integration demo.

### Implementation

- Repositioned the product as an Autonomous Lending Operations Platform that works alongside existing Fintech systems.
- Defined the product promise around evidence, conditions, routine resolution, and safe exception escalation.
- Added product modules for the Case and Evidence Hub, Conditions Resolution Agent, Policy-as-Code Studio, Provider Gateway, Durable Workflow Runtime, Human Review Console, Agent Governance and Evaluation, and Developer Sandbox.
- Replaced generic readiness flow with one synthetic conventional-mortgage conditions loop that waits, resumes, re-evaluates affected evidence, and records provenance.
- Added stable case and condition vocabularies that avoid formal credit-decision claims.
- Separated Temporal's durable workflow ownership from bounded LangGraph Agent execution and deterministic policy authority.
- Added a human-reviewed policy DSL lifecycle with validation, conflict detection, regression testing, release pinning, and rollback.
- Expanded provider modes, deterministic routing, failure fixtures, adapter contracts, and contract-test requirements.
- Reworked the target architecture into API, worker, and web processes from one modular repository.
- Updated the mainstream technology baseline to Node.js 24 LTS, NestJS 11, TypeScript 6 as a compatibility bridge, PostgreSQL 18, Temporal, LangGraph.js v1, React 19, OpenTelemetry, Terraform/OpenTofu, and ECS Fargate.
- Added explicit data, API, event, security, privacy, responsible-AI, reliability, observability, testing, evaluation, cost, and deployment contracts.
- Replaced the layer-first roadmap with Milestones M1 through M7, each ending in a runnable user or developer outcome.
- Preserved public development-journal and code-documentation guidelines without private collaboration or identity instructions.

### Affected files

- `docs/PROJECT_CHARTER.md`
- `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Operations control plane over full-stack replacement**: the platform coordinates existing systems, providers, policies, and reviewers rather than requiring customers to replace their complete lending stack.
- **Conditions loop over one-shot decisioning**: evidence discrepancies, waiting, resumption, and exception handling create a more defensible operational Agent than a single model response.
- **Mortgage-first and lending-extensible**: one mortgage vertical slice provides domain depth while product packs preserve a path to other lending workflows.
- **Temporal outside, Agent runtime inside**: Temporal owns cross-day durability and side effects; LangGraph remains replaceable behind an application port and never becomes the system of record.
- **REST for partners and GraphQL for operations**: this serves broad integration compatibility without discarding the repository's GraphQL investment.
- **TypeScript 6 before TypeScript 7**: TypeScript 7 is released, but its programmatic compiler API transition still affects dependent tooling; compatibility evidence takes precedence over adopting the newest major number.
- **Terraform/OpenTofu over company-specific infrastructure choices**: portable infrastructure and broad Fintech applicability take priority over matching any individual employer's stack.
- **Vertical slices over layer-first delivery**: each milestone produces a demonstrable workflow while retaining production-quality gates.
- **Synthetic policy and provider behavior only**: the public repository does not copy proprietary guidelines, claim official findings, or require paid credentials.

### Verification

```text
git diff --check
  passed

top-level charter section sequence check
  sections 1 through 30 present in order

Markdown code-fence balance check
  passed with 26 fence markers

company, personal identity, and private-instruction phrase search
  no matches

date-prefixed development-log heading search
  no matches

milestone status inspection
  M0 marked Implemented; M1 through M7 marked Planned
```

No application test was required because this feature changes product and engineering documentation only. Implemented and planned claims were compared with the active repository structure, package manifest, source modules, and recent commit history.

### Security, privacy, cost, and compatibility

- Public launch remains synthetic-only and does not claim approval for real borrower data.
- Deterministic policy and human authority remain above model output.
- Default development continues to require no paid model or provider credential.
- Current LTS and supported stable versions are favored over newer but compatibility-incomplete releases.
- Cost-bearing infrastructure, real provider credentials, and real-data processing remain separately authorized future work.

### Known gaps

- The rewritten charter is a target-state contract; Milestones M1 through M7 are not implemented by this documentation change.
- README positioning still reflects the current MVP and should evolve with the first implementation milestone rather than advertising planned capabilities as present.
- Exact dependency patch versions will be selected and verified in their implementation commits.
- Product metrics and Agent release thresholds remain targets until a reproducible evaluation report exists.

### Next safe step

Begin M1 with an isolated supported-runtime upgrade, preserving current behavior and recording clean installation, compatibility, build, lint, test, migration, Docker, and dependency evidence before starting the durable conditions workflow.

## M0-005: Temporal and jurisdiction-aware policy architecture

### Status

Architecture documentation corrected and locally validated; the policy catalog, resolver, change monitoring, and impact workflow remain planned for M3.

### Acceptance criterion

The charter must not treat policy as one globally current or permanently case-pinned configuration. It must define how immutable policy history is resolved by jurisdiction, product, lifecycle event, relevant event date, and platform knowledge time; how future changes affect open cases; and where legal, compliance, deterministic-system, Agent, and human authority begin and end.

### Problem

The prior policy lifecycle correctly made released versions immutable, but its case-pinning language was incomplete. Federal, state, and sometimes local rules can change on different schedules. Applicability can depend on a triggering event such as application receipt, disclosure, underwriting review, closing, or a later servicing event. Permanently retaining the first version could apply stale treatment, while silently moving every open case to the newest version could ignore effective dates or approved transition treatment.

### Implementation

- Replaced the static policy section with a temporal and jurisdiction-aware Policy-as-Code contract.
- Separated immutable policy versions from deterministic, context-specific `CasePolicySnapshot` resolution.
- Added jurisdiction, product, program, tenant, lifecycle event, relevant-event dates, valid-time, system-time, provenance, correction, withdrawal, and transition metadata.
- Added a bitemporal model that records both when a rule is effective and when the platform learned about the source revision.
- Added source coverage and freshness as explicit per-jurisdiction operational states.
- Added deterministic resolution behavior that fails closed when jurisdiction data, coverage, version boundaries, precedence, or transition logic is ambiguous.
- Added scheduled activation for future-effective versions and prohibited early activation.
- Added open-case impact assessment with no-impact, future-milestone, approved-grandfathering, re-evaluation, and review-required dispositions.
- Added Agent tool boundaries for requesting snapshot resolution and change-impact assessment without giving the model policy authority.
- Expanded the data model, API surface, event catalog, roles, threats, telemetry, tests, evaluation fixtures, metrics, launch gates, risks, roadmap, and ADR backlog.
- Extended the synthetic launch scenario with a reviewed state-policy change while a workflow is waiting.
- Added official eCFR, Federal Register, and CFPB references as architecture inputs without claiming legal interpretation or jurisdiction coverage.

### Affected files

- `docs/PROJECT_CHARTER.md`
- `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Immutable versions plus dynamic resolution**: released records never mutate, but each evaluation resolves an immutable snapshot from the approved catalog and case context.
- **Bitemporal history over a single effective date**: valid time supports applicability, while system time makes late publications and corrections replayable.
- **Relevant events over calendar-only switching**: a rule may key off a case milestone rather than the wall-clock time of evaluation.
- **Explicit reviewed composition over hard-coded precedence**: federal, state, product, program, and tenant layers compose only under approved rules; unresolved conflicts enter review.
- **Impact workflow over bulk automatic migration**: policy changes first generate dry-run classifications for potentially affected open cases, then approved workflow commands create any new snapshots.
- **Deterministic resolver over model interpretation**: AI may summarize or draft, but cannot decide applicability, precedence, transition treatment, approval, or activation.
- **Synthetic sources first**: official-source adapters remain a future read-only ingestion boundary with explicit coverage and freshness objectives.

### Verification

```text
git diff --check
  passed

top-level charter section sequence check
  sections 1 through 30 present in order

Markdown code-fence balance check
  PROJECT_CHARTER.md: 30 fence markers
  DEVELOPMENT_LOG.md: 10 fence markers

company, personal identity, and private-instruction phrase search
  no matches

date-prefixed development-log heading search
  no matches

dynamic-policy architecture term inspection
  policy knowledge time, case policy snapshots, change events, impact review,
  future-effective scheduling, and jurisdiction handling are present
```

No application test was required because this feature changes architecture documentation only. The new policy capabilities are explicitly marked planned rather than implemented.

### Security, compliance, and operational boundaries

- Separate author and approver roles govern releases and transition logic.
- Source ingestion never activates policy automatically.
- Missing coverage, unresolved conflicts, and stale policy state fail closed to review.
- The public repository continues to use synthetic policy content and generated cases only.
- Official references demonstrate why version, event, and jurisdiction metadata are necessary; they do not authorize legal conclusions.

### Known gaps

- No policy-source registry, jurisdiction coverage service, applicability resolver, scheduler, or impact-assessment workflow exists in application code yet.
- No official federal or state source connector has been implemented or validated.
- The repository contains no complete legal rule set and makes no claim of nationwide regulatory coverage.
- Source selection, legal interpretation, precedence, transition logic, and review service-level objectives require authorized legal and compliance ownership before real-data use.
- State and local publication systems vary, so production coverage will require monitored connectors plus a documented manual fallback rather than one universal scraper.

### Next safe step

Continue with M1 and M2 as sequenced. When M3 begins, implement the smallest policy slice first: jurisdiction and source schemas, two synthetic time-bounded versions, a pure applicability resolver, effective-boundary and replay tests, and one open-case impact-review path before adding Agent-assisted authoring or external source ingestion.

## M0-006: Per-evaluation policy confirmation and lifecycle audit

### Status

Architecture and current-workflow audit completed and locally validated; the mandatory policy-confirmation guard and expanded lifecycle domain remain planned implementation work.

### Acceptance criterion

Every policy-bound evaluation and re-evaluation must execute an unavoidable server-side action that confirms the currently applicable approved policy before calculation or rule execution. The charter must also distinguish the current repository workflow, the product's intended conditions-operations scope, and the broader mortgage production lifecycle without presenting readiness automation as formal loan approval.

### Research and repository review

- Reviewed the current GraphQL input, `LoanService`, `AgentService`, persistence entity, test vocabulary, and README workflow.
- Confirmed that the implemented path accepts only borrower identifier, requested amount, and loan type; retrieves three synthetic findings; applies hard-coded rules or a local-model prompt; returns legacy decision labels; and persists one result row.
- Confirmed that the current code has no policy catalog, version, confirmation receipt, jurisdiction context, regulated milestone event, durable wait/resume, formal action-notice workflow, appraisal, closing, funding, or post-closing quality-control flow.
- Compared the target workflow with CFPB mortgage-origination examination modules, mortgage application and disclosure triggers, Regulation B notification handling, and OCC mortgage production and underwriting-control guidance.
- Confirmed that origination, processing, underwriting, and closing are distinct controlled areas, while this product's launch value lies primarily in evidence processing and conditions resolution around underwriting readiness.

### Implementation

- Added a code-backed current-workflow audit to the charter instead of treating target architecture as implemented behavior.
- Added an end-to-end mortgage lifecycle scope map covering inquiry, application and disclosure triggers, processing, collateral work, underwriting, conditions, action notification, closing and funding, and post-closing handoff.
- Explicitly separated `READY_FOR_UNDERWRITING` and operational `CONDITIONS_OPEN` from conditional approval, final approval, clear-to-close, funding authority, and legal notices.
- Required the system to record authoritative downstream milestone events rather than infer regulated application receipt from partial case data.
- Replaced event-trigger-only policy re-resolution with mandatory confirmation before every evaluation and re-evaluation.
- Defined a request-bound `PolicyConfirmationReceipt` containing the evaluation request, case-fact version, context hash, snapshot, catalog revision, knowledge time, confirmation time, validity boundary, and status.
- Made confirmation an internal `PolicyEvaluationService` guard rather than an Agent-selectable tool or manual per-loan click.
- Bound confirmation and execution to one consistency boundary to prevent unrecorded time-of-check/time-of-use races.
- Kept external source monitoring asynchronous; the evaluation guard confirms against the approved catalog and fails closed when declared coverage is incomplete or stale instead of scraping and interpreting law during a loan workflow.
- Reserved historical policy clocks for an authorized replay path; live evaluations use trusted server time.
- Defined idempotent same-request replay while prohibiting receipt reuse for a new evaluation request.
- Added confirmation persistence, events, security threats, reliability rules, telemetry, test cases, metrics, launch gates, risks, roadmap scope, and ADRs.
- Added regulator and bank-supervision references as workflow and control baselines without representing them as a complete legal checklist.

### Affected files

- `docs/PROJECT_CHARTER.md`
- `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Confirm on every evaluation over change-event-only resolution**: change notifications improve readiness, but only an evaluation-time guard can prove which approved policy was checked for that specific execution.
- **Automated guard over repeated human confirmation**: approved policy interpretation remains human-governed; routine current-version confirmation is deterministic infrastructure so it cannot be forgotten or inconsistently performed.
- **Request-bound receipt over a mutable current-policy pointer**: binding the request, case facts, context, catalog revision, and snapshot makes substitution and stale reuse detectable.
- **One consistency boundary over check-then-call**: confirmation and execution use the same catalog view so an activation race cannot silently change semantics.
- **Milestone graph over one rigid approval sequence**: lenders and products vary, but authoritative events and ownership boundaries remain explicit and auditable.
- **Conditions operations over full origination replacement**: the initial product coordinates evidence and conditions while existing authorized systems retain disclosures, formal decisions, notices, closing, and funding.

### Verification

```text
git diff --check
  passed

top-level charter section sequence check
  sections 1 through 30 present in order

Markdown code-fence balance check
  PROJECT_CHARTER.md: 34 fence markers
  DEVELOPMENT_LOG.md: 12 fence markers

current implementation and target-state language inspection
  one-shot MVP gaps are explicit; new confirmation and lifecycle capabilities are planned

policy-confirmation invariant inspection
  every evaluation and re-evaluation requires a request-bound receipt;
  missing, stale, reused, mismatched, or ambiguous confirmation fails closed

company, personal identity, and private-instruction phrase search
  no matches

date-prefixed development-log heading search
  no matches
```

No application test was required because this feature changes architecture and audit documentation only. Application code was read to establish current behavior, not modified.

### Security, compliance, and operational boundaries

- Clients and models cannot provide or select a policy confirmation receipt.
- A confirmation failure stops evaluation and creates review work rather than falling back to an older or guessed policy.
- Formal credit action, consumer notices, and policy interpretation remain authorized human or downstream-system responsibilities.
- The receipt is an internal audit control, not a regulator-prescribed form or a claim of legal compliance.
- Public launch remains synthetic-only.

### Known gaps

- The current `evaluateLoan` code still uses hard-coded thresholds and legacy formal-sounding decision labels.
- `PolicyEvaluationService`, policy receipts, lifecycle milestones, durable conditions, and downstream decision-status ingestion are not implemented yet.
- The review establishes a defensible high-level production lifecycle, not a complete fifty-state legal and operational requirements matrix.
- Product-specific, jurisdiction-specific, channel-specific, and organization-specific workflows still require authorized domain and compliance review.

### Next safe step

Preserve the M1 and M2 sequence. In M3, make the first policy acceptance test prove that direct evaluation without confirmation is impossible, two consecutive evaluations produce two receipts even when the snapshot is unchanged, and a policy activation concurrent with evaluation yields one internally consistent audited result.

## M0-007: Efficient policy binding and provider-ready parity

### Status

Target architecture revised and locally validated. Policy bindings, scope generations, promotion manifests, production adapters, and provider certification remain planned implementation work.

This entry supersedes M0-006's per-evaluation receipt design. M0-006 remains unchanged as an append-only record of the earlier decision and the reason it was revisited.

### Acceptance criterion

Every evaluation and re-evaluation must validate that its immutable policy snapshot is still applicable without requiring a full policy resolution or a new audit artifact when nothing relevant changed. The simulator path must also share the domain workflow, canonical capability contracts, and deployable artifact required by authorized sandbox and production providers, while real credentials and data remain disabled until separately approved.

### Problem

The per-evaluation receipt design in M0-006 was safe but unnecessarily expensive. It required a distinct receipt for every new evaluation even when the approved policy scope, policy-relevant case facts, time boundary, and source coverage were unchanged. It also made zero receipt reuse appear to be a quality metric, even though safe reuse after deterministic validation is both more efficient and equally auditable.

The previous synthetic-staging language also did not fully define what it means for simulated development to be ready for real providers. A simulator-only workflow can hide real authentication, schema, webhook, latency, rate-limit, and failure behavior. Conversely, requiring provider-specific business workflows would make each live integration a redesign instead of a controlled configuration promotion.

### Implementation

- Replaced request-bound `PolicyConfirmationReceipt` with a server-owned `CasePolicyBinding` and per-evaluation validation observation.
- Added scoped policy generations so an approved change invalidates only bindings in affected tenant, jurisdiction, product, overlay, and lifecycle scopes rather than every case globally.
- Added a policy-relevant facts hash, trusted validation time, scheduled revalidation boundary, invalidation state, and source-coverage freshness predicates.
- Defined a fast path that performs one indexed authoritative generation read plus hash and time comparisons; full applicability resolution runs only when a validity predicate fails.
- Required validation and evaluation to share a database snapshot or equivalent consistency boundary to prevent an unrecorded time-of-check/time-of-use race.
- Made the evaluation row the audit record for binding ID, observed generation, validation time, outcome, and evaluator version instead of writing a duplicate receipt.
- Changed the quality invariants to `100%` binding-validation coverage and `0` accepted invalid or stale bindings while explicitly allowing safe reuse.
- Added simulator, authorized-sandbox, and production-BYOC modes behind one `ProviderAdapter` capability contract and canonical finding model.
- Required the domain, policy, workflow, and Agent layers to remain independent of provider brand and operating mode.
- Added provider promotion manifests containing reviewed scope, adapter version, endpoint allowlist, secret references, consent controls, budgets, certification evidence, and an attributable enablement state.
- Added reusable contract tests, provider-specific certification, canary routing, kill-switch, rollback, and real-data approval gates.
- Separated synthetic-launch-ready, provider-integration-ready, and production-approved status so passing local fixtures cannot imply approval for real consumer data.
- Updated the current-state audit to state that existing simulators do not yet implement or pass the target adapter contract.
- Added FAPI 2.0 compatibility where a provider or customer ecosystem requires a high-security OAuth profile, without making it a universal integration requirement.

### Affected files

- `docs/PROJECT_CHARTER.md`
- `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Scoped generation over a global catalog revision**: unrelated policy releases do not invalidate every active case, while affected scopes still fail the fast-path check immediately.
- **Validated binding reuse over one new receipt per evaluation**: every execution checks current applicability, but unchanged state does not trigger duplicate resolution or persistence.
- **Authoritative indexed read over cache authority**: Redis and process caches may reduce latency, but material state transitions use the transactional policy-generation record for correctness.
- **Control plane plus data plane over source access in the evaluation path**: reviewed policy publication and source monitoring update snapshots and generations asynchronously; evaluation performs deterministic validation against approved state.
- **Same contracts and artifact over provider-specific forks**: simulator, sandbox, and production modes differ inside adapters, credentials, and reviewed configuration rather than core business logic.
- **Certification over assumed sandbox parity**: a provider sandbox is useful integration evidence but cannot prove production authentication, data distribution, rate limits, callbacks, or operational behavior.
- **Promotion manifest over an unrestricted environment flag**: live routing requires an exact tenant, provider, capability, product, jurisdiction, environment, credential, and approval match.

### Verification

```text
git diff --check
  passed

top-level charter section sequence check
  sections 1 through 30 present in order

Markdown code-fence balance check
  PROJECT_CHARTER.md: 36 fence markers
  DEVELOPMENT_LOG.md: 14 fence markers

obsolete receipt language inspection
  no active charter references to PolicyConfirmationReceipt or zero-reuse gates

company, personal identity, and private-instruction phrase search
  no matches

date-prefixed development-log heading search
  no matches
```

No application test was required because this feature changes architecture and audit documentation only. The revised capabilities are explicitly marked planned rather than implemented.

### Security, compliance, and operational boundaries

- Clients, models, and adapters cannot supply, select, extend, or bypass a policy binding.
- A scope-generation mismatch, relevant-facts mismatch, expired boundary, invalidation, withdrawal, incomplete coverage, or stale source fails closed to refresh or human review.
- Production endpoints, credentials, and real data remain disabled by default and are not included in public fixtures, local development, or shared staging.
- Provider-integration-ready describes code and certification evidence; production-approved remains a scoped organizational authorization for a specific data flow.
- Provider access and model access are independently governed, minimized, attributable, and revocable.

### Known gaps

- `CasePolicyBinding`, scoped generations, invalidation events, and the guarded evaluation service are not implemented in application code.
- Existing simulator services do not implement the target `ProviderAdapter` contract or canonical finding schemas.
- No authorized provider sandbox, production credential, certification report, promotion manifest, or real-data approval exists in the repository.
- Simulator behavior cannot validate every provider-specific production variance; controlled certification and canary evidence remain mandatory.
- Production approval still depends on customer contracts and authorized legal, compliance, privacy, security, and operations owners outside the public codebase.

### Next safe step

Continue with the planned M1 and M2 vertical slices. In M3, implement scoped generations, policy-relevant fact hashing, an immutable binding, the guarded fast path, invalidation, race tests, and fail-closed refresh. In M4, first migrate every simulator to the shared adapter contract and contract suite, then demonstrate configuration-only activation against an authorized sandbox before making any provider-integration-ready claim.

## M0-008: Business-invariant and external-effect audit

### Status

Target architecture audited and revised; application implementation remains planned. The review found correctness gaps in policy invalidation, evaluation reproducibility, provider retry and fallback, provider-readiness claims, production activation governance, and derived-data disposition.

This entry narrows M0-007's single composite scope-generation and configuration-only language. The reusable policy-binding fast path remains, but it now validates a complete dependency vector. Configuration-only activation applies only to an adapter, capability, version, and schema profile already implemented and certified in the promoted artifact.

### Acceptance criterion

The target architecture must not allow a policy dependency to change without invalidating an affected binding; combine mutable inputs in one evaluation; repeat an ambiguous external effect; reuse authorization across an unapproved provider fallback; activate production through one mutable flag or one person's approval; claim readiness for an undeveloped adapter; or delete a primary record while silently retaining derived consumer data.

### Research and architecture audit

- Reviewed the active policy-binding, provider adapter, routing, promotion, data, privacy, reliability, testing, launch-gate, risk, roadmap, and ADR sections.
- Confirmed that the prior single composite scope generation did not explicitly capture parent policy layers, empty scopes that later gain a rule, jurisdiction hierarchy changes, resolver releases, or relevant-fact selector changes.
- Confirmed that a policy binding alone did not freeze case, consent, evidence, calculation, normalization, evaluator, and optional model versions used by one evaluation.
- Confirmed that generic idempotency, retry, cancellation, and fallback language did not distinguish a failure before dispatch from an unknown outcome after dispatch.
- Confirmed that an idempotency key expresses one logical intent but cannot prove an external provider honored that key.
- Confirmed that the prior routing rules could allow a different provider to be selected without creating a new provider-scoped authorization and duplicate-impact decision.
- Confirmed that the promotion manifest mixed desired configuration with a mutable enabled state and did not encode immutable versioning, artifact and schema identity, approval expiry, self-approval rejection, dual activation, or concurrent-change protection.
- Confirmed that provider-integration readiness needed to be scoped to a named provider, capability, adapter version, schema profile, and sandbox rather than expressed as one repository-wide boolean.
- Confirmed that generic deletion language did not explicitly traverse normalized findings, search indexes, caches, prompts, evaluation artifacts, objects, and backup expiry.
- Used the current CFPB advisory opinion as a source for consumer-specific permissible-purpose boundaries, the IETF HTTPAPI idempotency draft for retry uncertainty and key/fingerprint behavior, and NIST SP 800-53 for separation-of-duties and dual-authorization design inputs.

### Findings and implementation

1. **Incomplete policy invalidation**
   - Replaced one composite scope generation with a bounded `PolicyDependencyRef` vector covering catalog, full jurisdiction ancestry, product, program, tenant, lifecycle, source coverage, and resolver dependencies.
   - Required dependency keys to exist even for empty scopes so a newly introduced overlay invalidates affected bindings.
   - Added dependency-key-set hashing, canonical dependency digesting, and relevant-fact selector versioning to binding validation.
   - Kept consent and provider authorization outside the policy-binding lifecycle so an authorization change blocks execution without forcing unrelated policy resolution.
   - Preserved the efficient fast path as one bounded indexed query plus canonical hash and time comparisons.

2. **Mixed-version evaluation inputs**
   - Added an immutable `EvaluationInputManifest` with exact case, authorization, consent, evidence, adapter normalization, calculation, policy binding, evaluator, and optional model and prompt references.
   - Required transactional manifest assembly after policy, authorization, consent, evidence freshness, contradiction, and completeness checks.
   - Prohibited mutable latest-value reads after manifest creation.
   - Required compare-and-swap writes so an older evaluation cannot overwrite a newer case version.

3. **Unsafe retry, cancellation, and fallback**
   - Added provider effect classes for read-only, reusable lookup, cost-bearing, consumer-impacting, and irreversible operations.
   - Added a durable `ProviderOperationIntent` persisted before dispatch with a request fingerprint, stable idempotency key, scoped authorization, effect class, and explicit unknown-outcome states.
   - Required post-dispatch timeouts to enter reconciliation instead of automatically creating a new order.
   - Required verified provider status, callback, or attributable review before resolving ambiguous outcomes.
   - Treated fallback as a new external effect with provider-specific reauthorization, permissible-purpose, data-scope, cost, freshness, and duplicate-impact checks.
   - Prohibited automatic cross-provider fallback for material effects unless certified semantics and an approved policy prove it safe.

4. **Overbroad provider-readiness claim**
   - Clarified that a new provider, capability, schema profile, or materially changed adapter can require code and a newly certified artifact.
   - Limited configuration-only switching to already implemented and certified adapter tuples.
   - Scoped provider-integration-ready and production-approved evidence to adapter version and schema profile as well as provider, capability, tenant, product, jurisdiction, and environment.

5. **Mutable or single-actor production activation**
   - Replaced an `enabled` flag with immutable versioned promotion manifests and separate append-only certification, approval, revocation, and activation records.
   - Bound activation to manifest content hash, adapter artifact digest, schema profile, approval validity, credential reference, environment, and expected previous activation version.
   - Added separated proposer, certifier, approver, and activator duties; prohibited self-approval; and required two-person control for enablement and re-enablement.
   - Preserved immediate attributable emergency disable as a fail-safe action.

6. **Incomplete deletion and legal-hold semantics**
   - Added lineage-aware data-disposition tasks and explicit scoped legal holds.
   - Required disposition to traverse source documents, evidence, normalized findings, indexes, caches, prompts, evaluation artifacts, object storage, and backup expiry.
   - Required verification records to distinguish deleted, anonymized, validly held, and backup-expiry-pending data without retaining the removed content itself.

- Expanded the data model, security and privacy controls, threat scenarios, reliability rules, SLOs, telemetry, tests, release metrics, milestones, launch gates, risks, ADR backlog, and official reference baseline for these invariants.

### Affected files

- `docs/PROJECT_CHARTER.md`
- `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Dependency vector over one scope counter**: one indexed query remains efficient while preventing missed invalidation across composed layers and future overlays.
- **Versioned fact selector over an unversioned hash**: changing which fields influence policy must invalidate a binding even when the old selected values did not change.
- **Independent policy and authorization lifecycles over coupled expiry**: policy applicability can be reused while evaluation-manifest creation and external dispatch still fail closed on expired or revoked authority.
- **Immutable input manifest over broad transaction duration**: long-running evaluation cannot hold a database transaction open, so it freezes references and uses optimistic writes instead.
- **Unknown outcome over assumed failure**: transport failure does not prove business failure after dispatch.
- **Intent plus provider reconciliation over platform idempotency alone**: external exactly-once behavior cannot be inferred when a provider does not guarantee the same idempotency scope and retention.
- **Reauthorization over inherited fallback consent**: authority for one provider and purpose is not silently transferable to another provider or effect.
- **Append-only governance records over mutable manifest status**: certification, approval, revocation, and activation evolve without rewriting the reviewed configuration.
- **Dual enablement and unilateral disable over symmetric approval**: production entry requires stronger control, while emergency shutdown remains immediately available.
- **Scoped readiness over repository-wide readiness**: evidence for one adapter cannot validate every provider or capability.
- **Lineage-aware disposition over row deletion**: consumer data can survive in derived stores even after its primary row is gone.

### Verification

```text
git diff --check
  passed

top-level charter section sequence check
  sections 1 through 30 present in order

Markdown code-fence balance check
  PROJECT_CHARTER.md: 40 fence markers
  DEVELOPMENT_LOG.md: 16 fence markers

obsolete policy-generation and unsafe provider-language inspection
  no active charter references to the superseded single-generation fields,
  mutable enable flag, or unscoped configuration-only roadmap language

company, personal identity, and private-instruction phrase search
  no matches

date-prefixed development-log heading search
  no matches
```

No application test is required for this documentation-only architecture audit. None of the newly specified controls are represented as implemented, tested, deployed, provider-certified, or production-approved.

### Security, compliance, and operational boundaries

- The platform does not infer consumer-report authority from a tenant-wide switch, disclaimer, prior provider grant, or model output.
- A consumer-specific permissible-purpose decision remains an authorized business and compliance responsibility; the architecture only enforces and records the supplied scope.
- Idempotency and reconciliation reduce duplicate risk but do not claim universal exactly-once behavior across third-party systems.
- A full audit replay may become unavailable after authorized deletion; retained metadata cannot be used as an excuse to preserve prohibited content.
- NIST and IETF materials are engineering baselines, not claims of certification or final legal requirements.

### Known gaps

- Policy dependency generations, relevant-fact selector releases, immutable input manifests, and compare-and-swap condition writes do not exist in application code.
- Provider effect descriptors, authorization grants, operation intents, reconciliation workflows, immutable promotion manifests, certification records, approval records, and activation records do not exist in application code.
- No provider's idempotency, cancellation, fallback, pricing, consumer impact, status lookup, or callback semantics have been certified.
- No data-lineage deletion graph, legal-hold workflow, backup-expiry verifier, or deletion report exists.
- Actual permissible-purpose, consent, retention, legal-hold, and approval rules remain scoped organizational decisions requiring authorized owners.

### Next safe step

Keep M1 as the supported runtime baseline and M2 as the durable synthetic conditions slice. In M2, establish aggregate versioning, idempotency fingerprint rejection, immutable evidence versions, and optimistic writes. In M3, implement dependency-vector policy bindings and immutable evaluation input manifests. In M4, implement the provider intent state machine and reconciliation against simulators before any authorized sandbox. In M5, implement scoped grants, immutable activation governance, lineage-aware deletion, and negative authorization tests.

## M0-009: Product-authority, communication, and Agent-budget consistency

### Status

Three cross-section specification conflicts were independently identified, reproduced against the active charter, and corrected. The product-authority, protected-communication, and Agent-budget controls remain target architecture rather than implemented application behavior.

### Acceptance criterion

The charter must express one enforceable answer to each of the following questions:

- Can provider certification or a launch phase enable the platform to move funds, commit rate locks, perform settlement or funding, or deliver loans to capital markets?
- Can configured policy approve a protected borrower- or third-party-facing communication without a person approving the exact message?
- Where and how are duration and cost budgets represented and authoritatively enforced when Agent state already exposes step, token, and provider-call budgets?

No deferred-capability paragraph, provider gate, tool-table row, engineering principle, runtime state field, or launch gate may contradict those answers.

### Findings

1. **Product identity versus deferred funds and closing scope**
   - The executive summary unconditionally said the platform does not move money.
   - The non-goals limited the same exclusion to the public launch.
   - The deferred-capability section grouped rate locks, legal disclosures, closing, settlement, and capital delivery with capabilities that could later enter through provider gates.
   - Provider certification establishes scoped technical and organizational readiness for an allowed adapter; it cannot itself grant lender, settlement, funds-transfer, rate-lock, disclosure, servicing, or capital-delivery authority.

2. **Protected communication versus configured policy approval**
   - The authority order required human approval for protected communication.
   - The `send_information_request` tool allowed human or configured-policy approval without defining which path applied to which content.
   - The engineering principle governing externally communicated outcomes was also broad enough to conflict with any automated routine message.

3. **Agent budget promise versus runtime state**
   - Safety controls promised step, duration, token, provider-call, and cost budgets.
   - Mandatory review included time and provider-cost exhaustion.
   - Agent state exposed only step, provider-call, and token counters, with no deadline, remaining duration, cost amount, currency, or authoritative ledger version.

### Implementation

#### Structural product-authority boundary

- Made the no-funds boundary structural for the current charter rather than public-launch-specific.
- Prohibited accepting, holding, controlling, initiating, approving, settling, disbursing, or transmitting funds or value.
- Prohibited binding rate locks, payment and settlement instructions, funding authority, capital delivery, formal credit decisions, clear-to-close, legal disclosures and notices, and servicing payment movement.
- Allowed read-only authoritative status ingestion, evidence reconciliation, and non-monetary task coordination in closing, funding, post-close, and servicing lifecycle areas.
- Split deferred launch capabilities from structurally excluded capability classes.
- Required capability registries, Agent tool registries, promotion-manifest validation, and production routing to reject excluded command classes even when an adapter and credentials exist.
- Clarified that Sections 11.8 and 22.6 certify an already allowed provider capability and cannot override product identity.
- Required any future boundary change to begin with a replacement charter, activity-specific legal and licensing analysis, accountable owners, funds-flow and threat models, and new implementation and launch gates.

#### Communication authority

- Defined protected communication by material meaning rather than tool name alone, including decisions, eligibility, approval status, incompleteness, adverse action, consumer rights, regulated deadlines, disclosures, rates or terms, waivers, exceptions, collection positions, settlement instructions, and other consequential outcomes.
- Required a human reviewer to approve the exact rendered protected message, recipient, channel, locale, attachments, authoritative sender, and validity interval before delivery through the platform.
- Kept formal notices outside product scope with the lender or authorized downstream system.
- Defined a narrow routine operational class for version-pinned tenant-approved templates that request or acknowledge ordinary evidence without protected meaning or regulated deadlines.
- Required allowlisted recipient relationships, channels, locales, variables, attachments, and purposes for routine delivery.
- Made free-form material text, render drift, negative or ambiguous implication, unsupported locale, or classification uncertainty fail closed to protected review.
- Moved classification and template enforcement into deterministic server-side guards that the Agent cannot supply or downgrade.
- Clarified that signed machine webhooks publish only authorized integration events and cannot carry borrower-facing protected communication content.
- Updated engineering principles, tool approvals, mandatory review triggers, safety controls, data entities, events, threats, reliability behavior, tests, metrics, roadmap, launch gates, risks, and ADRs to use the same classification.

#### Duration and cost budgets

- Added `remainingDurationBudgetMs`, `runStartedAt`, and `runDeadlineAt` to the Agent state contract.
- Added `budgetCurrency`, `remainingCostBudgetMinorUnits`, and `budgetLedgerVersion` alongside renamed `remainingProviderCallBudget`.
- Defined state budget fields as server-issued observations rather than model authority.
- Required duration to be recomputed from trusted time and the absolute deadline at every graph step and tool boundary.
- Required step, token, provider-call, and cost usage and reservations to use authoritative versioned run, workflow, and tenant budget ledgers.
- Defined durable wait separately from bounded Agent runtime and prohibited retry, replay, cancellation, restart, or resume from resetting cumulative usage.
- Required atomic conservative cost reservation for in-flight and outcome-unknown provider operations until reconciliation.
- Made ledger conflict, reservation failure, deadline expiry, or negative remaining budget stop further tool execution and route safely.
- Added budget ledgers, reservation entities, events, threats, reliability controls, tests, telemetry, metrics, roadmap evidence, launch gates, and risks.

### Affected files

- `docs/PROJECT_CHARTER.md`
- `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Structural exclusion over launch-only exclusion**: an adapter readiness gate cannot accidentally become funds-flow or lending authority.
- **Read-only lifecycle integration over total closing blindness**: the platform may remain operationally useful by observing authoritative events and coordinating non-monetary work without executing protected financial actions.
- **Replacement charter over feature flag**: a future product-identity change must be explicit, separately governed, and reviewable rather than inherited from today's provider architecture.
- **Meaning-based communication class over tool-name classification**: the same delivery tool can carry routine or protected meaning, so rendered content and context determine the approval path.
- **Exact-render human approval over generic case approval**: changing recipient, wording, locale, attachment, channel, sender, or validity can change communication risk and invalidates approval reuse.
- **Narrow template policy over all-human messaging**: routine evidence logistics can remain efficient without letting policy automation send consequential messages.
- **Trusted absolute deadline over a model-decremented timer**: wall-clock enforcement cannot depend on Agent cooperation and remains correct across graph steps.
- **Authoritative ledger and reservation over state-only counters**: concurrent tools and uncertain provider cost require atomic accounting outside the model state snapshot.
- **Hierarchical cumulative budgets over per-run reset**: a new bounded run after durable wait may receive a new deadline, but it cannot erase workflow or tenant usage.
- **Conservative unknown-cost reservation over optimistic spend**: unresolved provider outcomes must not free budget that may already have been consumed.

### Verification

```text
git diff --check
  passed

top-level charter section sequence check
  sections 1 through 30 present in order

Markdown code-fence balance check
  PROJECT_CHARTER.md: 40 fence markers
  DEVELOPMENT_LOG.md: 18 fence markers

funds-boundary, communication-authority, and Agent-budget consistency searches
  structural exclusion, exact protected approval, routine-template boundary,
  trusted duration, and authoritative cost-ledger terms are present;
  superseded launch-only funds, ambiguous communication approval,
  and incomplete Agent-state terms are absent

company, personal identity, and private-instruction phrase search
  no matches

date-prefixed development-log heading search
  no matches
```

No application test is required for this documentation-only consistency correction. The new registries, message guards, deadlines, ledgers, reservations, denial controls, tests, and operations surfaces are not represented as implemented, verified, deployed, or legally approved.

### Security, compliance, and operational boundaries

- The structural exclusions are product choices under this charter, not a legal conclusion that every observed or coordinated workflow is exempt from licensing or regulation.
- FinCEN materials identify money-transmission analysis as fact- and circumstance-specific; the public charter therefore avoids claiming that provider certification determines regulatory status.
- Current Regulation B notification requirements inform the conservative protected-communication class but do not make this architecture a complete notice or jurisdictional compliance program.
- Human approval of a protected draft does not bring a formal notice into scope when the charter assigns that notice to an authorized lender or downstream system.
- Budget controls constrain Agent execution but do not replace provider contract limits, tenant budgets, accounting, or human operational oversight.

### Known gaps

- No capability denylist, manifest validation, runtime router rule, or Agent tool check implements the structural financial-action exclusions yet.
- No communication classifier, immutable template, exact-render hash, protected-message approval, or guarded delivery workflow exists in application code.
- No trusted Agent deadline, budget ledger, atomic reservation, currency normalization, unknown-cost reserve, or ledger-conflict test exists in application code.
- Activity-specific product, licensing, communication, and funds-flow review still requires authorized legal, compliance, operations, and business owners before any real-data deployment.

### Next safe step

Preserve M1 as the supported runtime foundation. In M2, introduce the versioned budget-ledger schema and optimistic reservation primitive without adding real costs or communications. In M3, add trusted Agent deadlines and a synthetic routine-versus-protected communication classifier with exact-render review tests. In M4, enforce the structural capability denylist across simulator registration, promotion validation, routing, and Agent tool exposure before any authorized sandbox integration.

## M0-010: Consent-revocation state and provider-authorization granularity audit

### Status

Two cross-section specification gaps were identified, reproduced against the active charter, and corrected. The revoked-consent lifecycle and the provider-authorization field refinement remain target architecture rather than implemented application behavior.

### Acceptance criterion

The charter must express one enforceable answer to each of the following questions:

- Is consent revocation, which is legally distinct from simple expiration or absence, representable anywhere in the Agent's runtime state or mandatory-review triggers?
- Does the charter's repeated claim that provider authorization is "field-bound" match the only authorization structure it defines?

No Agent-state contract, mandatory-review list, data entity, event, or authorization description may contradict those answers.

### Findings

1. **Missing consent-revocation state**
   - Section 6.3's Authority order places consent above every other control, but `LendingOperationsAgentState.consentStatus` only distinguished `VALID`, `MISSING`, and `EXPIRED`.
   - A borrower who affirmatively withdraws consent mid-case had no distinct representable state, even though `ProviderAuthorizationGrant` already models `revokedAt` for the adjacent concept of grant revocation.
   - Mandatory review triggers listed lower-priority conditions (for example, provider results outside the normalized contract) but never named consent revocation.
   - Neither the `consent_records` entity description nor the event catalog distinguished revocation from ordinary expiration.

2. **"Field-bound" authorization versus the only defined authorization structure**
   - Section 11.5's prose and Section 16.2 both asserted "field-"/"field-level" authorization granularity for provider access.
   - `ProviderAuthorizationGrant`, the only structure defined for this purpose, exposed `permittedDataClasses: string[]` — a data-class list, not an addressable field list — and the Section 14.1 entity description already (correctly) said "data-," not "field-."
   - Grant revalidation before dispatch was not explicitly required to reconfirm that the grant's referenced consent records remained unrevoked.

### Implementation

- Added `'REVOKED'` to `consentStatus`, added a mandatory-review trigger for mid-case consent revocation and its effect on already-collected evidence and dependent provider grants, and added a `consent.revoked` event.
- Added a Section 14.2 data rule stating that revocation stops new processing immediately, invalidates dependent provider authorization grants, and opens a data-disposition review, distinguishing it from an ordinary missing- or stale-consent condition.
- Extended the `consent_records` entity description to name revocation evidence explicitly.
- Added a Section 16.4 threat scenario for revoked consent being read back as merely missing or expired while a dependent grant or in-flight processing stays active.
- Added `permittedFields?: string[]` to `ProviderAuthorizationGrant` as an optional narrowing of `permittedDataClasses`, used only when a capability's contract exposes field-addressable data; class-level scope remains the enforced floor otherwise.
- Reworded Section 11.5 and the Section 14.1 entity description to "data-class-, optionally field-, and time-bound," removing the unqualified "field-bound" claim that outran the schema.
- Required authorization-grant revalidation to reconfirm every referenced consent record is still granted and unrevoked, failing closed on a stale, mismatched, expired, or revoked reference.

### Affected files

- `docs/PROJECT_CHARTER.md`
- `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Add a `REVOKED` state over overloading `EXPIRED`**: revocation is an affirmative borrower action with distinct legal consequences (potential retroactive deletion obligations) that a passive time-based expiry state cannot represent.
- **Class-level authorization as the enforced floor, with optional field narrowing, over silently weakening the "field-level" promise**: the charter's existing engineering style resolves this kind of gap by adding precision rather than by lowering a stated privacy control, and Section 16.1/16.2 already use "field authorization" for the separate, unaffected concept of internal RBAC.
- **Revalidation checks the consent reference, not just the grant's own expiry**: a grant issued while consent was valid must not keep dispatching after that consent is later revoked; the grant's own `expiresAt`/`revokedAt` fields do not by themselves guarantee this without an explicit cross-check requirement.

### Verification

```text
git diff --check
  passed

top-level charter section sequence check
  sections 1 through 30 present in order

Markdown code-fence balance check
  PROJECT_CHARTER.md: 40 fence markers

consent-revocation and field-granularity consistency search
  REVOKED consent state, mandatory review trigger, consent.revoked event,
  data-disposition linkage, permittedFields refinement, and data-class-bound
  wording are present; unqualified "field-bound"/"field-level" claims for
  provider authorization are absent

company, personal identity, and private-instruction phrase search
  no matches

date-prefixed development-log heading search
  no matches
```

No application test is required for this documentation-only consistency correction. The revised consent-revocation and field-refinement controls are not represented as implemented, verified, deployed, or legally approved.

### Security, compliance, and operational boundaries

- Consent revocation handling is a charter-level design commitment, not a claim that any deletion, disposition, or downstream notification is currently implemented.
- The optional field-level authorization refinement depends on a provider capability actually exposing field-addressable contracts; its absence is not a compliance gap, since class-level scope remains the enforced boundary either way.

### Known gaps

- No consent-revocation propagation, dependent-grant invalidation, or disposition-review trigger exists in application code.
- No provider capability in the current simulator set exposes field-addressable contracts, so `permittedFields` remains unused until a real capability contract defines addressable fields.
- Activity-specific consent, privacy, and retention review still requires authorized legal, compliance, and privacy owners before any real-data deployment.

### Next safe step

Preserve the M1–M4 sequence already recorded. In M2, include `REVOKED` in the initial consent-status domain model and schema from the start rather than retrofitting it later. In M5, implement consent-revocation propagation to dependent provider authorization grants and the data-disposition workflow alongside the other tenant-trust-boundary controls.

## M1-001: Startup environment validation and environment-aware GraphQL exposure

### Status

Implemented and locally verified. First application-code slice of Milestone 1 (supported runtime and security baseline).

### Acceptance criterion

The application must refuse to start with a single, complete list of every missing or malformed required environment variable, instead of failing later as an opaque database or server error. `NODE_ENV` must be a closed, validated enum so a typo cannot silently leave a production-only safety check (GraphQL introspection/playground, TypeORM schema auto-synchronization) disabled in a production deploy.

### Problem

`AppModule` read `DATABASE_URL` directly into TypeORM with no presence or shape check — a missing value would only surface as a low-level `pg` connection error at runtime. `NODE_ENV` was compared against the raw string `'production'` in two places with no validation, so a misspelled value (for example `Production`) would silently leave schema auto-synchronization enabled. `main.ts` read `PORT` directly from `process.env` instead of the validated config. The GraphQL module unconditionally enabled `playground` and `introspection` in every environment — the code comment said this was "for demo purposes," but the charter (Section 16.1) requires both disabled outside development, and this was already called out as in-scope for M1 in Section 29.

### Implementation

- Added `src/config/env.validation.ts`: an `EnvironmentVariables` class-validator schema (`NODE_ENV` as a closed `NodeEnvironment` enum defaulting to `development`; `DATABASE_URL` required and checked for a `postgres://`/`postgresql://` scheme; `PORT` optional, integer, `1`-`65535`, defaulting to `3000`) and a `validateEnvironment` function that collects every validation failure into one thrown error instead of stopping at the first.
- Wired `validate: validateEnvironment` into `ConfigModule.forRoot(...)` in `app.module.ts`, so an invalid environment fails Nest's module compilation before any HTTP listener or database connection is attempted.
- Converted `GraphQLModule.forRoot` to `forRootAsync`, gating `playground` and `introspection` on the validated `NODE_ENV` being `development`.
- Changed the TypeORM `synchronize`/`logging` factory to compare against the validated `NodeEnvironment` enum instead of a raw string literal.
- Updated `main.ts` to read `PORT` and `NODE_ENV` through `ConfigService` instead of `process.env` directly, and to only log the GraphQL Playground URL when it is actually enabled.
- Documented the new validation rules and defaults inline in `.env.example`.

### Affected files

- `src/config/env.validation.ts` (new)
- `src/config/env.validation.spec.ts` (new)
- `src/app.module.ts`
- `src/main.ts`
- `.env.example`
- `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **`class-validator`/`class-transformer` over adding Joi**: both are already dependencies used for GraphQL input DTOs elsewhere in the codebase (`src/loan/loan.model.ts`); reusing the same validation library avoids adding a new production dependency for an equivalent capability.
- **A `validate` function over `validationSchema`**: `@nestjs/config`'s `validate` hook returns a typed object that `ConfigService.get()` prefers over raw `process.env` reads (confirmed by reading the installed `@nestjs/config` source), which lets `configService.get<NodeEnvironment>('NODE_ENV')` return the validated enum rather than a string that call sites would need to re-parse.
- **Only three variables declared in the schema, not every `.env` key**: `class-transformer`'s `plainToInstance` (without `excludeExtraneousValues`) retains extraneous source properties on the returned object, and `@nestjs/config` merges that object back onto `process.env` rather than replacing it — confirmed by reading `config.module.js`'s `assignVariablesToProcess` call. This means `AgentService`'s existing `DECISION_PROVIDER`/`OLLAMA_*` reads continue to work unchanged; only the variables this slice cares about (`DATABASE_URL`, `NODE_ENV`, `PORT`) needed schema entries.
- **Left `AgentService`'s own `DECISION_PROVIDER` validation untouched**: it already throws a clear error on an invalid value; folding it into the new global validator would touch working, already-tested Agent code for no behavioral gain, outside this slice's acceptance criterion.

### Verification

```text
npm run lint
  passed, no errors

npm run build
  passed

npm test -- --runInBand --no-cache --silent
  9 suites passed
  74 tests passed (8 new, in src/config/env.validation.spec.ts)

npm run test:e2e
  1 suite failed, 4 tests failed — TypeError: request is not a function
  Reproduced against the pre-existing code (git stash) with an identical
  failure: not caused by this change. Root cause appears to be
  `import * as request from 'supertest'` in test/loan.e2e-spec.ts under the
  e2e transformer's `esModuleInterop: true`, which does not make a CJS
  callable export directly invocable via a namespace import. Left unfixed
  here — out of scope for this slice's acceptance criterion — and tracked
  below.
```

### Security, privacy, cost, and compatibility

- No new dependency was added; both validation libraries were already in `package.json`.
- Fail-fast startup validation reduces the chance of a misconfigured `NODE_ENV` reaching a running production process with schema auto-sync or GraphQL introspection unintentionally enabled.
- No behavior changed for `DECISION_PROVIDER`, `OLLAMA_*`, `DEMO_MODE`, or `ANTHROPIC_API_KEY` — verified by an explicit regression test asserting they pass through `validateEnvironment` untouched.

### Known gaps

- `test/loan.e2e-spec.ts` cannot currently run to completion due to the pre-existing supertest import issue described above; e2e coverage for this slice was therefore obtained by full unit coverage of `validateEnvironment` plus a clean `nest build`, not a live end-to-end request.
- No Postgres instance was running in this environment, so the env-validation change was not exercised against a real database connection failure/success path, only against the validator in isolation.
- Node.js/NestJS/Express/Apollo major-version upgrades (the first item in Section 29's M1 list) are deferred to their own slice — bumping those together with this change would have mixed an unrelated, higher-risk, harder-to-revert upgrade into one commit.

### Next safe step

Fix the `test/loan.e2e-spec.ts` supertest import as its own small M1 slice so e2e evidence is available again, then proceed to the explicit initial TypeORM migration and `synchronize: false` production default (Section 29, item 4).

## M1-002: Fix broken supertest import in the e2e suite

### Status

Implemented and locally verified.

### Acceptance criterion

`npm run test:e2e` must execute its HTTP assertions instead of failing with `TypeError: request is not a function` before making a request.

### Problem

`test/loan.e2e-spec.ts` imported supertest as `import * as request from 'supertest'`. Supertest's CommonJS export is the request function itself, with no `.default` property and no `__esModule` marker. Under the e2e transformer's `esModuleInterop: true` (`test/jest-ts-transformer.cjs`), a namespace import (`import * as X`) of a plain CJS function export is wrapped into a plain object by TypeScript's `__importStar` helper rather than resolving to the callable function, so every `request(app.getHttpServer())` call in the suite threw `TypeError: request is not a function` before any assertion ran. Reproduced identically against the pre-existing code via `git stash`, confirming this predates the M1-001 slice and is not a regression from it.

### Implementation

- Changed the import to `import request from 'supertest'` (a default import), which correctly resolves to the callable function through the same `esModuleInterop` helper (`__importDefault`, which wraps a non-`__esModule` export as `{ default: <export> }`).
- Added a short comment above the import recording why a namespace import doesn't work here, since the failure mode is non-obvious from the syntax alone.

### Affected files

- `test/loan.e2e-spec.ts`
- `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Default import over changing the transformer's `esModuleInterop` setting**: the failure is in how the specific import statement interacts with an already-correct interop setting, not a problem with the setting itself; changing the transformer would risk affecting every other test file.
- **Fix in place over rewriting to `require('supertest')`**: the codebase otherwise uses ES module import syntax throughout `test/` and `src/`; a default import is the idiomatic, minimal fix and matches supertest's own documented usage.

### Verification

```text
npm run test:e2e
  1 suite passed, 4 tests passed (previously: 1 suite failed, 4 tests failed)

npm run lint
  passed, no errors

npm run build
  passed

npm test -- --runInBand --no-cache --silent
  9 suites passed, 74 tests passed (unchanged from M1-001)
```

Running against the repository's own `.env`, a real PostgreSQL instance was reachable, so this run also exercised the M1-001 environment-validation and TypeORM `synchronize`/`logging` behavior against a live database connection for the first time, closing that slice's previously recorded "not exercised against a real database" gap.

### Security, privacy, cost, and compatibility

- Test-only change; no production code path affected.
- No new dependency added.

### Known gaps

- `test/tsconfig.json` reports a pre-existing `rootDir` diagnostic (`src/app.module.ts` is outside `test/`'s configured `rootDir` despite being included via `../src/**/*.ts`) in editor/`tsc` type-checking. It does not affect `npm run test:e2e` (which transpiles per-file via `ts.transpileModule`, bypassing `rootDir` checks) and predates this change; left unfixed as out of scope for this slice.

### Next safe step

Proceed to the explicit initial TypeORM migration and `synchronize: false` production default (Section 29, item 4).

## M1-003: Explicit initial TypeORM migration and CLI tooling

### Status

Implemented and locally verified against a real Postgres instance (both the migration itself and an automated test of it). Local development behavior is unchanged.

### Acceptance criterion

The repository must contain an explicit, reviewable migration that reproduces the schema `LoanApplication` + `synchronize: true` currently produces, plus the CLI tooling to generate/run/revert future migrations, so any environment running with `synchronize` disabled (already the case for `NODE_ENV=production` since M1-001) has a concrete way to create and evolve its schema.

### Problem

The only entity, `LoanApplication`, had no corresponding migration — the schema existed solely as whatever `synchronize: true` happened to produce on each developer's machine. Nothing in the repository could create the `loan_applications` table (or its two Postgres enum types) in an environment where auto-sync is off, which is already the production default. There was also no `DataSource` the TypeORM CLI could load, since `TypeOrmModule.forRootAsync`'s config lives inside a Nest factory function that needs `ConfigService`, unavailable outside the DI container.

### Implementation

- Added `src/database/data-source.ts`: a standalone `DataSource` (single default export, as the TypeORM CLI requires) that reads `DATABASE_URL` directly via `dotenv` — already a transitive dependency of both `@nestjs/config` and `typeorm` — for use by the CLI only.
- Added `migration:generate` / `migration:create` / `migration:run` / `migration:revert` / `typeorm` scripts to `package.json`, using the bundled `typeorm-ts-node-commonjs` binary so migrations can be authored and run directly against `.ts` source without a separate compile step.
- Generated `src/database/migrations/1786804717435-InitialSchema.ts` by diffing the current entities against an empty database, then hand-verified its `up()`/`down()` against a disposable scratch database created on the same Postgres server (never the real `mortgage_agent` database): `up()` produces exactly the `loan_applications` table and its two enum types with the same columns, types, defaults, and primary key `synchronize: true` currently creates; `down()` cleanly drops the table and both enum types.
- Added `src/database/migrations/initial-schema.migration.spec.ts`, an automated integration test (same "skip without `DATABASE_URL`" convention as `test/loan.e2e-spec.ts`) that creates its own disposable database, runs the migration, asserts the resulting columns/types/primary key via `information_schema`/`pg_type`, reverts it, asserts the database is empty again, and always drops the disposable database in `afterAll`.
- Documented the migration commands and the unchanged local dev flow in `README.md`, and added the previously-undocumented `NODE_ENV`/`PORT` rows to the environment variable table.

### Affected files

- `src/database/data-source.ts` (new)
- `src/database/migrations/1786804717435-InitialSchema.ts` (new, generated)
- `src/database/migrations/initial-schema.migration.spec.ts` (new)
- `package.json`
- `README.md`
- `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **A whole disposable database for the migration test, not just a dedicated schema**: an isolated-schema attempt was tried first and failed — TypeORM's Postgres migration generator hardcodes an explicit `"public".` qualifier on `CREATE TYPE` statements for enum columns, so an isolated schema within the *same* database still collided with the real application's already-existing `loan_applications_*_enum` types. A separate database has its own independent `public` schema, so the generated migration's hardcoded qualifier is correct there.
- **Explicit `npm run migration:run` over `migrationsRun: true` at boot**: auto-running migrations from application bootstrap risks concurrent migration attempts if multiple instances start together during a deploy; an explicit, single, ordered CLI step (run before the new instances start) is the safer default until the deploy pipeline itself owns that ordering (M7).
- **Left `synchronize` policy unchanged (`development`/`test`/`staging` still sync, `production` does not)**: this slice's acceptance criterion, per Section 29 item 4, was adding the explicit migration and confirming the production-safe default already set in M1-001 — not changing which environments use which strategy. The existing local dev database (already schema-synced) was intentionally left untouched; the migration exists for any fresh database, starting with production.
- **Generated, then hand-verified, over hand-written from scratch**: letting TypeORM diff the entity against an empty database avoids a manually-authored migration silently drifting from what `synchronize` actually produces; the follow-up automated test exists specifically to catch that drift on every future entity change.

### Verification

```text
npm run lint / npm run build
  both passed

npm test -- --runInBand --no-cache --silent
  10 suites passed, 76 tests passed (2 new, in initial-schema.migration.spec.ts)

npm run test:e2e
  1 suite passed, 4 tests passed

Manual migration round-trip against a disposable scratch database
(mortgage_agent_migration_scratch, created and dropped on the same
Postgres server as the real mortgage_agent database, which was never
modified):
  migration:run    -> loan_applications table + 2 enum types created,
                       columns/types/defaults/PK match the entity exactly
  migration:revert -> table and both enum types dropped, database empty

Automated test run against DATABASE_URL, then re-run with DATABASE_URL
unset to confirm the skip path:
  with DATABASE_URL:    2 tests passed
  without DATABASE_URL: 2 tests skipped (no false failure)

Post-run check (`psql ... \l`)
  only the pre-existing mortgage_agent database remains; no scratch
  database left behind by either the manual verification or the
  automated test's own cleanup
```

### Security, privacy, cost, and compatibility

- No new production dependency was added; `dotenv` was already a transitive dependency of both `@nestjs/config` and `typeorm`.
- All verification against a real database used a disposable, immediately-dropped scratch database on the existing local Postgres server; the real `mortgage_agent` database and its data were never read, written, or dropped.
- The migration contains only schema DDL — no data, no credentials, no synthetic fixtures.

### Known gaps

- The real local `mortgage_agent` database (already schema-synced from prior `synchronize: true` runs) does not have this migration's bookkeeping row in a `typeorm_migrations` table; it was intentionally left alone rather than force-reconciled, since local dev continues to rely on auto-sync under the unchanged policy. A production or staging database, which starts from `synchronize: false`, will apply this migration cleanly from empty.
- No CI pipeline exists yet to run `migration:run` automatically against a fresh database on every change (M7 — CI/CD).
- `docker-compose.yml`'s `app` service still starts with `NODE_ENV: development`, so it continues to rely on auto-sync rather than exercising the migration path; wiring an explicit migration step into the Docker/deploy flow is deferred until a production-shaped environment definition exists (M7).

### Next safe step

Continue Section 29's M1 list: liveness/readiness endpoints, graceful shutdown, secure headers, CORS allowlist, rate limiting, and request body limits (item 5), then record the consolidated clean-install/build/lint/test/migration/Docker/dependency evidence (item 6) that closes out Milestone 1.

## M1-004: Lightweight CI (lint, build, unit, e2e) on every push

### Status

Implemented and locally verified (YAML syntax and every underlying script verified locally; the workflow itself only executes on GitHub's runners, which this environment cannot invoke directly).

### Acceptance criterion

Every push and pull request must automatically run lint, build, the unit suite, and the e2e suite against a real Postgres — with no `--fix` silently rewriting a violation instead of failing the run — without waiting for M7's full deployment pipeline.

### Problem

The repository had no `.github/workflows`, so nothing ran automatically on push. Both a pre-existing broken e2e test (fixed in M1-002) and a charter-consistency gap fixed in an earlier documentation session went unnoticed until manually discovered — exactly the class of regression basic CI catches immediately. The full CI/CD pipeline is correctly scoped to M7 (it depends on Terraform/OpenTofu environments that do not exist yet), but build/lint/test automation does not depend on any of that and is cheap to add now.

### Implementation

- Added `.github/workflows/ci.yml`: a single `build-and-test` job that checks out, sets up Node 22 (matching the currently installed runtime and `@types/node`; not yet the charter's target Node 24 LTS, which is deferred to its own runtime-upgrade slice), runs `npm ci`, then `lint:check`, `build`, the unit suite (`--ci --runInBand`), and `test:e2e`.
- Added a `postgres:16-alpine` service container to the workflow, mirroring `docker-compose.yml`'s image, database name, user, and password exactly, with the same `pg_isready` health check — so e2e actually runs in CI instead of soft-skipping for lack of a database, and the unit-test step also exercises the M1-003 migration integration test rather than skipping it.
- Added `lint:check` (plain `eslint`, no `--fix`) to `package.json`, kept alongside the existing `lint` (with `--fix`, for local developer convenience) — running the `--fix` variant in CI would let a violation pass by silently rewriting the file mid-run instead of failing the job.

### Affected files

- `.github/workflows/ci.yml` (new)
- `package.json`

### Decisions and alternatives

- **Trigger on every push and every pull request, not just `main`**: the project currently has one active development branch and no branch-protection or release-train discipline yet (that is M5/M7 scope); running on every push surfaces a regression at the point it is introduced rather than only at merge time.
- **A real Postgres service container over skipping e2e/migration tests in CI**: a soft-skip is the right fallback for a local machine that may not have Postgres running, but CI should always have it and should always exercise the full suite — a CI run that quietly skips the tests that matter most would defeat the purpose.
- **Node 22 over Node 24 in the workflow**: the workflow should match what the repository is actually built and tested against today; bumping it will be one line changed alongside the (still deferred) Node/NestJS/Express runtime-upgrade slice, not before it.
- **Single job over a matrix**: no current requirement (multiple Node versions, multiple OSes) justifies the added complexity yet.
- **No CI badge or branch-protection change in this slice**: neither was part of the acceptance criterion; branch protection in particular is a repository-settings change with broader consequences than a workflow file and deserves an explicit decision of its own.

### Verification

```text
YAML syntax check (js-yaml)
  passed

npm run lint:check
  passed, no errors (no files rewritten — confirms the CI step would fail
  on a real violation instead of masking it)

npm run build
  passed

npm test -- --runInBand --no-cache --silent
  10 suites passed, 76 tests passed

npm run test:e2e
  1 suite passed, 4 tests passed
```

The workflow file's own execution was not observed running on GitHub's infrastructure from this environment — only its constituent commands and YAML validity were checked locally, each against the same real local Postgres instance used throughout M1-001 through M1-003. First-run evidence from an actual GitHub Actions execution is a known gap below.

### Security, privacy, cost, and compatibility

- The Postgres service container uses the same non-secret local-development credentials already committed in `docker-compose.yml`; nothing sensitive is introduced.
- No deployment credentials, cloud provider access, or OIDC configuration is included — this workflow only builds and tests, matching Section 19.3's environment list (`local`/`test`), not `staging`/`production`.
- `DECISION_PROVIDER=rules` is pinned for the CI job, so no model runtime or credential is required to run the suite, consistent with the "no-paid-model default execution" principle.

### Known gaps

- Not yet observed running on GitHub's actual runners from within this session; first real execution should be checked after this commit is pushed.
- No status badge added to `README.md`.
- No branch-protection rule requires this workflow to pass before merge yet — that is a repository-settings decision, not a code change, and was left for the user to configure explicitly.
- Node version in the workflow will need to move to 24 LTS alongside the still-deferred Node/NestJS/Express/Apollo runtime-upgrade slice (Section 29, item 1).

### Next safe step

Continue Section 29's M1 list, item 5: liveness/readiness endpoints, graceful shutdown, secure headers, CORS allowlist, rate limiting, and request body limits.

## M1-005: Health endpoints, graceful shutdown, secure headers, CORS, rate limiting, body limits

### Status

Implemented, unit-tested, and manually smoke-tested against a real running instance (see Verification — the e2e suite bootstraps the Nest module directly and does not exercise `main.ts`, so this slice could not be trusted from automated tests alone).

### Acceptance criterion

Section 29, item 5: add liveness/readiness endpoints, graceful shutdown, secure headers, a CORS allowlist, rate limiting, and explicit request-body limits, as one hardened-runtime baseline.

### Implementation

- **Health**: `src/health/health.controller.ts` — `GET /health/live` (process up, no dependency check) and `GET /health/ready` (runs `SELECT 1` through the injected `DataSource`; `503` with a generic body on failure so internal connection errors aren't leaked to an unauthenticated caller). `@SkipThrottle()` on the controller so infra polling can't be rate-limited into reporting a false-unhealthy instance.
- **Graceful shutdown**: `app.enableShutdownHooks()` in `main.ts`, so SIGTERM/SIGINT run Nest's `onModuleDestroy`/`beforeApplicationShutdown` hooks (closing the TypeORM connection pool) instead of the process dying with connections open.
- **Secure headers**: `helmet()`, with `contentSecurityPolicy` disabled only in development — the GraphQL Playground loads assets from external CDNs that the default CSP blocks, and the playground is the only browser-rendered surface that exists before the operations console (Section 8.6).
- **CORS allowlist**: `src/config/cors.ts#resolveCorsOrigin` — an explicit `CORS_ALLOWED_ORIGINS` always wins; unset, development allows any `http://localhost:<port>` (convenience for a local frontend dev server or the playground) and every other environment fails closed (no cross-origin access) until configured.
- **Rate limiting**: `@nestjs/throttler`, configured via `RATE_LIMIT_TTL_MS`/`RATE_LIMIT_MAX` (defaults `60000`/`100`), bound globally via `APP_GUARD`. Discovered that the default `ThrottlerGuard` cannot track GraphQL requests at all (see Failures below) and added `src/common/gql-throttler.guard.ts` plus a `context: ({ req, res }) => ({ req, res })` factory on `GraphQLModule` to fix it.
- **Request body limits**: `app.useBodyParser('json' | 'urlencoded', { limit: '1mb' })` in `main.ts`, replacing Express's implicit default with an explicit, documented one — no endpoint currently accepts file uploads.
- Added `CORS_ALLOWED_ORIGINS`, `RATE_LIMIT_TTL_MS`, `RATE_LIMIT_MAX` to `src/config/env.validation.ts`, and documented all of the above in `README.md`/`.env.example`.

### Affected files

- `src/health/health.controller.ts`, `src/health/health.controller.spec.ts`, `src/health/health.module.ts` (new)
- `src/common/gql-throttler.guard.ts`, `src/common/gql-throttler.guard.spec.ts` (new)
- `src/config/cors.ts`, `src/config/cors.spec.ts` (new)
- `src/config/env.validation.ts`
- `src/app.module.ts`, `src/main.ts`
- `package.json`, `package-lock.json` (added `helmet`, `@nestjs/throttler`)
- `README.md`, `.env.example`, `docs/DEVELOPMENT_LOG.md`

### Failures and resolution

- **GraphQL requests were silently never rate-limited.** First manual test (`{ __typename }` repeated past the configured limit) never triggered a `ThrottlerException`. Root cause turned out to be twofold:
  1. `__typename` is a meta-field resolved by `graphql-js` itself without invoking any `@Resolver()` method, so it never enters Nest's guard pipeline at all — a testing-methodology mistake, not a code bug. Re-tested against the real `health` query (an actual `@Query()` resolver method) and confirmed requests 1-3 succeeded and request 4 correctly threw `ThrottlerException`.
  2. Independently real: the base `ThrottlerGuard.getRequestResponse()` reads `context.switchToHttp()`, which does not populate the way a GraphQL resolver's arguments do. Fixed by `GqlThrottlerGuard` (`getRequestResponse` overridden to pull `req`/`res` from `GqlExecutionContext`) plus wiring `GraphQLModule`'s `context` factory to expose them — confirmed via `@nestjs/throttler`'s own documented GraphQL recipe, not guessed.
  Added debug logging temporarily to confirm exactly where the guard was and wasn't being invoked before writing the fix; removed before commit.
- **`npm run build` silently produced no `dist/` output while still reporting success**, discovered while trying to run the built app for this slice's smoke test. Root cause and fix recorded separately as M1-006 below (independent of this slice's acceptance criterion, but found while verifying it).

### Decisions and alternatives

- **Hand-rolled health controller over `@nestjs/terminus`**: the app has exactly one dependency to check (Postgres); a ~30-line controller is simpler to read and maintain than adopting Terminus's indicator abstraction for a single check. Revisit if/when more dependency health checks are needed.
- **`@nestjs/throttler` over hand-rolled rate limiting**: unlike health checks, correct distributed-safe rate limiting (windowing, per-key tracking) is not trivial to hand-roll well; using the framework's own official module is the better minimalism call here.
- **CSP disabled only in development, not helmet entirely**: production has the playground disabled (M1-001) and no other browser-rendered surface yet, so it gets helmet's full strict defaults; only the dev-only playground needs the carve-out.
- **CORS default fails closed outside development**: no browser frontend exists yet (Section 8.6 console is Planned); guessing at allowed origins would be worse than requiring explicit configuration once one exists.
- **One flat 1 MB body limit over per-route tuning**: every current route is a small GraphQL operation; per-route limits (e.g., for a future document-upload endpoint) belong with that endpoint's own slice.
- **Manual HTTP smoke test over trusting the e2e suite for this slice**: `test/loan.e2e-spec.ts` calls `moduleRef.createNestApplication()` directly and only adds a `ValidationPipe` — none of `main.ts`'s helmet/CORS/body-limit/shutdown-hook/rate-limit wiring runs under it. Automated coverage here is the unit tests for each piece in isolation (`cors.spec.ts`, `gql-throttler.guard.spec.ts`, `health.controller.spec.ts`); end-to-end behavior was verified by actually starting `dist/main.js` and hitting it, which is recorded below rather than left as an unverified claim.

### Verification

```text
npm run lint / npm run build
  both passed

npm test -- --runInBand --no-cache --silent
  13 suites passed, 86 tests passed (10 new: health, cors, gql-throttler-guard)

npm run test:e2e
  1 suite passed, 4 tests passed (unchanged — confirms this slice didn't
  break the existing GraphQL flow, not that the new middleware works)

Manual smoke test against `node dist/main.js` (NODE_ENV=development, real
local Postgres):
  GET /health/live            -> 200 {"status":"ok"}
  GET /health/ready            -> 200 {"status":"ok"}
  helmet headers present       -> Strict-Transport-Security, X-Content-Type-Options,
                                   X-Frame-Options, etc.; Content-Security-Policy
                                   correctly absent in development
  CORS preflight, allowed origin (http://localhost:5173)
                                -> Access-Control-Allow-Origin echoed back
  CORS preflight, other origin (https://evil.example.com)
                                -> no Access-Control-Allow-Origin header (blocked)
  POST /graphql with a 2 MB body -> 413 Payload Too Large
  POST /graphql with a small query -> 200, unaffected
  Rate limiting (RATE_LIMIT_MAX=3, RATE_LIMIT_TTL_MS=60000), against the
  real `health` GraphQL query:
    requests 1-3 -> 200 {"data":{"health":"ok"}}
    request 4-5  -> 200 with a GraphQL-level ThrottlerException error
                    (GraphQL-over-HTTP convention: errors surface in the
                    response body, not the HTTP status, confirmed by
                    checking the status code directly: 200)
  SIGTERM graceful shutdown    -> process exited within 1s, no hang
```

### Security, privacy, cost, and compatibility

- `helmet` and `@nestjs/throttler` were checked against `npm audit`; neither introduces a new vulnerability. `npm audit` does report 33 pre-existing vulnerabilities elsewhere in the dependency tree (mostly `@nestjs/cli`'s Angular-devkit toolchain and transitive `express`/`body-parser`/`multer`/`lodash`/`ws` issues) — pre-existing, not introduced by this slice, and tracked as a known gap rather than silently fixed here (dependency remediation is its own acceptance criterion, "patched dependencies and lockfile review," Section 29).
- The `/health/ready` failure response is intentionally generic (`{"status":"error","reason":"database unreachable"}`) — health endpoints are typically unauthenticated and internet-reachable, so the real error message and stack are logged server-side only, never returned to the caller.
- CORS fails closed (no cross-origin access) in every environment except development unless explicitly configured — consistent with the charter's least-privilege default.

### Known gaps

- GraphQL query-complexity/depth limiting (also mentioned in Section 15.3) is a separate, GraphQL-specific concern not part of Section 29's item 5 list; deferred to a later slice.
- `npm audit`'s 33 pre-existing vulnerabilities are unaddressed; Section 29's "patched dependencies and lockfile review" item covers that as its own acceptance criterion.
- Rate-limit storage is `@nestjs/throttler`'s default in-memory store — fine for a single instance, but will need a shared store (e.g., Redis) before running more than one instance behind a load balancer (M7/production scaling).
- No automated test exercises `main.ts`'s bootstrap wiring directly (helmet/CORS/body-limit/shutdown-hook application) — only its constituent pieces in isolation plus one manual smoke-test run. An e2e harness that boots through `main.ts`/`bootstrap()` itself, rather than a bare `createNestApplication()`, would close this gap; left for a future testing-infrastructure slice rather than expanding this one further.

### Next safe step

Fix the `nest build` incremental-cache issue found while smoke-testing this slice (recorded as its own follow-up entry), then record the consolidated clean-install/build/lint/test/migration/Docker/dependency evidence (Section 29, item 6) that closes out Milestone 1.

## M1-006: Fix silent no-op `nest build` from a stale incremental cache

### Status

Implemented and verified.

### Acceptance criterion

`npm run build` must never report success while leaving `dist/` empty or stale.

### Problem

Discovered while smoke-testing M1-005: `npm run build` reported success (exit `0`, no errors) but `dist/` did not exist. `nest-cli.json` sets `deleteOutDir: true`, which wipes `dist/` before every build; `tsconfig.build.json` (extending the base `tsconfig.json`, which sets `"incremental": true`) writes its `.tsbuildinfo` cache outside `dist/`, where the wipe doesn't touch it. With a stale cache present and `dist/` freshly emptied, `tsc` incorrectly concluded no output needed to be (re)written. Reproduced deterministically: build once, then build again immediately with no source changes — the second build always came back empty.

### Implementation

- Set `"incremental": false` in `tsconfig.build.json`, scoped to the build config only (the base `tsconfig.json` used by `ts-node`/Jest is untouched, so local dev/test iteration speed is unaffected).

### Affected files

- `tsconfig.build.json`
- `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Disable incremental compilation for the build over relocating the cache into `dist/`**: pointing `tsBuildInfoFile` inside `dist/` would also fix the immediate symptom, but leaves the underlying fragility (an output directory that gets wiped out from under a cache that's supposed to describe it) in place for any future change to `deleteOutDir`/`outDir`. Turning off incremental for the one config that's paired with `deleteOutDir: true` removes the failure mode outright, at a build-speed cost that's negligible at this project's current size.
- **Left `.gitignore`'s existing `*.tsbuildinfo` entry as-is**: already correctly excluded, confirmed via `git ls-files`; this was a local-environment footgun, not a risk to what CI checks out.

### Verification

```text
Reproduction, before the fix:
  rm -rf dist && npm run build  -> dist/main.js present (build 1, fresh)
  npm run build again           -> dist/ empty (build 2, bug reproduced)

After the fix:
  rm -rf dist tsconfig.build.tsbuildinfo && npm run build
    -> dist/main.js present
  npm run build again immediately
    -> dist/main.js still present
  no tsconfig.build.tsbuildinfo file reappears

npm run lint / npm test / npm run test:e2e
  all still passing (unaffected — this change only affects the build config)
```

### Known gaps

- None specific to this fix; the underlying `deleteOutDir`-plus-incremental interaction is a general TypeScript/Nest CLI footgun worth remembering if incremental builds are reconsidered later (e.g., for build-speed reasons at larger scale).

### Next safe step

Record the consolidated clean-install/build/lint/test/migration/Docker/dependency evidence (Section 29, item 6) that closes Milestone 1.

## M1-007: Resolve markdown lint problems (IDE-reported, 200+)

### Status

Implemented and verified.

### Acceptance criterion

The editor's markdown-lint diagnostics for `README.md` and `docs/*.md` must drop to zero without renaming any of `docs/DEVELOPMENT_LOG.md`'s intentionally repeated per-entry section headings and without hand-reformatting dozens of charter tables.

### Problem

The editor's Problems panel reported 200+ markdown lint findings. Running `markdownlint-cli2` (no repo config present, so its stricter-than-the-editor defaults) against `docs/*.md` and `README.md` showed the full breakdown: 917 `MD013` (line-length — not part of the 200+, since the editor's own defaults don't flag it), 141 `MD024` (duplicate heading), 60 `MD060` (inconsistent table-separator-row spacing), 2 `MD040` (fenced code block missing a language), 1 `MD034` (bare URL). Excluding `MD013`, the remaining 204 matched the reported count closely.

Almost all of the `MD024` findings were a false-positive pattern, not a real problem: `docs/DEVELOPMENT_LOG.md` intentionally repeats the same subsection headings (`### Status`, `### Implementation`, ...) under every milestone entry — that structure is the journal format itself (Section 26). Default `MD024` flags any duplicate heading text anywhere in the document, regardless of which parent it's under.

### Implementation

- Added `.markdownlint.jsonc`: `MD024` set to `siblings_only` (only flags a duplicate heading against true siblings under the same parent, not against every other entry in an append-only journal) and `MD013` disabled (prose-heavy architecture/journal docs intentionally use long lines).
- Ran `markdownlint-cli2 --fix`, which mechanically normalized all 60 `MD060` table-separator rows (`|---|---|` → `| --- | --- |`, matching the padding already used by every table's header/data rows) and fixed the one `MD034` bare URL (wrapped in `<...>`). Reviewed the resulting diff before keeping it: every changed line in `docs/PROJECT_CHARTER.md` and `README.md` is a table-separator row or the one URL — no prose, code, or table content changed.
- Manually added a language hint (`text`) to the two `MD040`-flagged fenced code blocks in `README.md` (the ASCII architecture diagram and the demo CLI output) — not auto-fixable, since the tool can't infer an appropriate language for a plain-text block.

### Affected files

- `.markdownlint.jsonc` (new)
- `docs/PROJECT_CHARTER.md`, `README.md`
- `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Config fix (`siblings_only`) over renaming headings**: `docs/DEVELOPMENT_LOG.md`'s repeated per-entry headings are the documented journal structure (Section 26), not a mistake; the lint rule's default assumption (a normal document has each heading once) doesn't fit an append-only journal, so the config was wrong for this file, not the file.
- **`--fix` plus a reviewed diff over leaving `MD060` unaddressed**: unlike `MD024`, the table-separator spacing inconsistency was a real, mechanical formatting defect (separator rows didn't match their own table's header/data row padding), consistently fixable without touching any actual content — worth actually fixing rather than just silencing the rule.
- **Disabled `MD013` rather than reformatting to 80 columns**: this is an architecture/journal document with intentionally long single-sentence lines carrying precise technical qualifications; hard-wrapping at 80 columns would hurt readability and diff-ability far more than it would help, and the editor's own defaults already don't enforce it.

### Verification

```text
npx markdownlint-cli2 "docs/*.md" "README.md" "*.md"
  before: 1121 issues (917 MD013, 141 MD024, 60 MD060, 2 MD040, 1 MD034)
  after config + --fix + manual MD040 fixes: 0 issues

npx markdownlint-cli2 "**/*.md" (whole repo, excluding node_modules/dist)
  0 issues in 3 files

git diff docs/PROJECT_CHARTER.md / README.md (manual review before commit)
  every changed line is a table-separator row, the one bare URL, or a
  code-fence language tag — no prose, table content, or code changed

npm run build / npm test -- --runInBand --no-cache --silent / npm run test:e2e
  all unaffected: dist/main.js present, 13 suites / 86 tests passed,
  4/4 e2e passed
```

### Known gaps

- None. This was a documentation/tooling hygiene fix with no application behavior involved.

### Next safe step

Record the consolidated clean-install/build/lint/test/migration/Docker/dependency evidence (Section 29, item 6) that closes Milestone 1.
