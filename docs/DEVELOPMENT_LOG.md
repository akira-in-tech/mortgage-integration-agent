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

## M1-008: Resolve remaining editor TypeScript problems (15)

### Status

Implemented and verified.

### Acceptance criterion

The editor's TypeScript diagnostics for `tsconfig.json` and `test/tsconfig.json` must drop to zero.

### Problem

Two distinct, unrelated issues, both pre-existing and both noted as known gaps in earlier entries (M1-002, M1-005) without being fixed:

1. **`test/tsconfig.json`: 14 `TS6059` errors, one per file under `src/`.** Its `rootDir` was set to `.` (i.e. `test/`), but `include` also pulls in `../src/**/*.ts` (needed so the language service can resolve `test/loan.e2e-spec.ts`'s `import { AppModule } from '../src/app.module'` with full type information, not just ambient types). `rootDir` must be the common ancestor of every file TypeScript includes in the program; `test/` alone isn't an ancestor of `../src/`, so every src file was flagged.
2. **`tsconfig.json`: 1 deprecation warning on `baseUrl`.** `baseUrl` is being removed in a future TypeScript release (the diagnostic links `aka.ms/ts6`); a repo-wide search confirmed no import in `src/` or `test/` is a bare, non-relative, non-package specifier that depends on it — every import is either relative (`./`, `../`) or a real package. It was dead configuration.

### Implementation

- `test/tsconfig.json`: changed `rootDir` from `.` to `..` (the actual common ancestor of `test/` and `../src`), with a comment explaining why it must cover both and that nothing actually emits through this config (jest transforms test files with its own transformer; `tsc -p test/tsconfig.json` is never invoked by any script or CI step — confirmed by grep before changing it).
- `tsconfig.json`: removed the unused `baseUrl` line.

### Affected files

- `test/tsconfig.json`
- `tsconfig.json`

### Decisions and alternatives

- **Fix `rootDir` over narrowing `include`**: dropping `../src/**/*.ts` from `include` would also silence the error, but would degrade the editor's type-checking of `test/loan.e2e-spec.ts`'s imports back to ambient/`.d.ts`-only information — the include pattern is there on purpose.
- **Delete `baseUrl` over bumping `ignoreDeprecations`**: `ignoreDeprecations: "5.0"` already present in the file doesn't cover this (newer) deprecation boundary, and since nothing depends on `baseUrl`, suppressing the warning would just be deferring dead-config removal rather than doing it — confirmed unused via a repo-wide import search before removing, not assumed.

### Verification

```text
npx tsc --noEmit -p tsconfig.json       -> exit 0, no diagnostics
npx tsc --noEmit -p test/tsconfig.json  -> exit 0, no diagnostics (was 14-16 TS6059 errors)

npm run build                            -> dist/main.js present
npm run lint:check                       -> passed
npm test -- --runInBand --no-cache --silent
                                          -> 13 suites passed, 86 tests passed
npm run test:e2e                         -> 1 suite passed, 4 tests passed
```

### Known gaps

- None.

### Next safe step

Record the consolidated clean-install/build/lint/test/migration/Docker/dependency evidence (Section 29, item 6) that closes Milestone 1.

## M1-009: Runtime upgrade (Node 24, NestJS 11, Express 5, Apollo Server 5, TypeScript 6, Jest 30) — closes Milestone 1

### Status

Implemented and verified against real infrastructure (real Postgres, real Docker daemon — not assumed). This completes every remaining item in Section 20's M1 scope; the milestone status table is updated to `Implemented` in this entry.

### Acceptance criterion

Section 29, item 1 and the remaining M1 scope items not yet covered by M1-001 through M1-008: upgrade Node.js and the NestJS/Express/Apollo/GraphQL/TypeScript/Jest runtime to the charter's targets with compatibility evidence, patch dependencies, and record the consolidated clean-install/build/lint/unit/e2e/migration/Docker/vulnerability evidence with exact versions.

### Problem

The runtime upgrade was deliberately deferred across M1-001 through M1-008 (recorded each time as a known gap) because bundling a Node/NestJS/Express major-version jump with unrelated hardening work would have violated the one-coherent-commit principle and made failures hard to isolate. With the rest of M1 complete, this was the only remaining scope item, plus one discovered while checking it: `npm install` reported `@apollo/server@4.13.0`'s end-of-life date (January 26, 2026) had already passed as of today, which made the Apollo Server v5 upgrade (already the charter's target) more than a routine "compatible packages" bump — it closed a real, current EOL exposure.

### Research before touching anything

- Tested Node 24.19.0 (installed via `nvm`, without changing the shell's default) against the **unmodified** dependency set first: clean install, build, lint, 13 suites / 86 unit tests, and e2e all passed with zero changes required — confirmed the Node major bump itself was not the risk.
- Checked every relevant package's declared peer dependencies before changing `package.json`, rather than upgrading and discovering conflicts after the fact: `@nestjs/typeorm@11`'s peer range (`^0.3.0 || ^1.0.0-dev`) confirmed TypeORM could stay on the patched `0.3.x` line the charter explicitly wants to preserve, rather than the unplanned `typeorm@1.x` that `npm view typeorm version` surfaces as latest. `@nestjs/graphql@13`/`@apollo/server@5` both peer on `graphql@^16.11.x`, not the also-available `graphql@17` — confirmed the correct target was the latest **16.x**, not a further unplanned major. `@typescript-eslint@8.67.0`'s peer range (`typescript: >=4.8.4 <6.1.0`) confirmed `typescript@6.0.3` (latest stable `6.x`, `7.x` already released separately) is precisely the version the toolchain supports today — validating the charter's existing "TypeScript 6 bridge, TypeScript 7 compatibility-gated" language rather than assuming enough time had passed to move to 7.

### Implementation

- Installed Node 24.19.0 via `nvm` (additive; did not change the shell's default Node version) and added `"engines": { "node": ">=24.0.0" }` to `package.json`.
- Upgraded, with exact resolved versions recorded below.
- `npm install` surfaced a missing peer at runtime (not caught by static peer-dep review): `@nestjs/apollo@13` under Express requires the separate `@as-integrations/express5` package for Apollo Server v5's Express integration; e2e failed with a clear `PackageLoader` error until it was installed.
- Re-ran the full M1-005 manual smoke test (health endpoints, helmet headers, CORS allow/block, 2 MB body rejection, GraphQL rate limiting via the real `health` resolver, SIGTERM graceful shutdown) against the upgraded stack — all identical to the pre-upgrade results, confirming none of that slice's custom wiring (especially `GqlThrottlerGuard`'s dependence on Apollo's context shape) broke across the Apollo v4→v5 jump.
- Built and ran the actual Docker image (`docker build`, then `docker compose up`) against a real Postgres container — not merely `docker build` — and confirmed the GraphQL `health` query and `/health/live` both respond correctly from inside the container. Torn down and the ad-hoc image tag removed afterward.
- Fixed two lines flagged by the newer Prettier's updated union-type formatting (`src/agent/agent.service.ts`, `src/integrations/plaid/plaid.types.ts`) — formatting only, no logic change.
- Bumped `Dockerfile`'s base image and `.github/workflows/ci.yml`'s `actions/setup-node` to Node 24.
- Updated `README.md`'s prerequisites and tech-stack table (NestJS 11, TypeScript 6, Node 24+).
- Updated the Section 20 milestone table: M1 status to `Implemented`.

### Exact resolved versions (Section 29 item 6: "current compatibility decisions recorded with exact versions")

```text
node                          24.19.0 (LTS "Krypton")
npm                           11.17.0

@nestjs/core                  11.2.1
@nestjs/common                11.2.1
@nestjs/platform-express      11.2.1
@nestjs/config                4.0.4
@nestjs/graphql                13.4.4
@nestjs/apollo                 13.4.4
@nestjs/typeorm                11.0.3
@nestjs/throttler               6.5.0   (unchanged — already NestJS-11-compatible)
@nestjs/testing / cli / schematics   11.2.1 / 11.0.24 / 11.1.0
@apollo/server                 5.5.1   (transitive via @nestjs/apollo; not a direct import)
@as-integrations/express5      1.1.2   (new — required by @nestjs/apollo 13 + Express 5)
graphql                         16.14.2 (latest 16.x — not the also-available graphql 17)
express                         5.2.1   (transitive via @nestjs/platform-express)
typescript                      6.0.3   (latest stable 6.x; 7.x exists but typescript-eslint caps at <6.1.0)
jest                             30.4.2
@types/jest                      30.0.0
@types/node                      24.13.3
@types/express                   5.0.6
typeorm                          0.3.31  (patched within 0.3.x — not the unplanned typeorm 1.x)
pg                                8.23.0
rxjs                               7.8.2
eslint                              9.39.5 (patched within 9.x — not the also-available eslint 10)
@typescript-eslint/*                8.67.0
prettier                            3.9.6
supertest                            7.2.2
```

### Affected files

- `package.json`, `package-lock.json`
- `Dockerfile`, `.github/workflows/ci.yml`
- `src/agent/agent.service.ts`, `src/integrations/plaid/plaid.types.ts` (formatting only)
- `README.md`, `docs/PROJECT_CHARTER.md` (Version 2.6 → 2.7, M1 status to Implemented)
- `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **One batched upgrade over piecemeal package-by-package bumps**: NestJS 11 + `@nestjs/graphql` 13 + `@nestjs/apollo` 13 + Apollo Server 5 + GraphQL 16.11+ are a mutually-interlocking peer-dependency set (confirmed by reading every peer range before changing anything) — installing them one at a time would pass through broken intermediate states with no independent value, unlike the smaller slices earlier in M1.
- **`graphql@16.11+` over the available `graphql@17`, and `typeorm@0.3.31` over the available `typeorm@1.x`**: both are cases where `npm view <pkg> version` alone would have suggested a further major jump neither the charter nor any peer dependency actually calls for; verified via peer ranges before deciding, not assumed from "latest" being available.
- **`typescript@6.0.3` over `7.0.2`**: matches the charter's explicit existing decision and re-confirms it against current toolchain support (`typescript-eslint`'s `<6.1.0` cap) rather than re-litigating it from scratch.
- **`nvm`-installed Node, default version left unchanged**: upgrading the *project's* required Node version shouldn't silently change what `node`/`npm` resolve to in the user's other shells or projects; `engines` in `package.json` documents the requirement instead.
- **Real Docker Compose run over `docker build` alone**: M1's exit evidence explicitly lists "Docker" as its own checked item; a build that only proves the image compiles doesn't prove the container actually serves a request against a real database, which is the thing that would actually break silently.

### Verification

```text
npm ci (clean install from the regenerated lockfile)     -> 0 vulnerabilities
npm run build                                             -> dist/main.js present
npm run lint:check                                        -> passed
npx tsc --noEmit -p tsconfig.json                          -> 0 diagnostics
npx tsc --noEmit -p test/tsconfig.json                      -> 0 diagnostics
npm test -- --runInBand --no-cache --silent                -> 13 suites passed, 86 tests passed
npm run test:e2e                                             -> 1 suite passed, 4 tests passed
npm audit                                                     -> found 0 vulnerabilities (was 33: 3 low,
                                                                  20 moderate, 10 high, all pre-existing —
                                                                  resolved as a byproduct of upgrading their
                                                                  outdated transitive sources, primarily
                                                                  @nestjs/cli's Angular-devkit toolchain and
                                                                  old express/body-parser/multer)

docker build -t mortgage-integration-agent:m1-verify .     -> succeeded, 0 vulnerabilities reported
                                                                inside the image build
docker compose up -d --build                                -> app + postgres containers healthy
  POST /graphql {query:"query{health}"}                      -> 200 {"data":{"health":"ok"}}
  GET /health/live                                             -> 200
docker compose down                                          -> torn down; ad-hoc image tag removed

Manual smoke test against `node dist/main.js` (repeat of M1-005's
protocol, against the upgraded stack):
  helmet headers present, CSP absent in development (unchanged)
  CORS: localhost origin allowed, arbitrary origin blocked (unchanged)
  2 MB POST /graphql body -> 413 (unchanged)
  Rate limiting (RATE_LIMIT_MAX=3) against the real `health` resolver:
    requests 1-3 -> 200, request 4 -> GraphQL ThrottlerException (unchanged)
  SIGTERM -> process exited within 1s (unchanged)
```

### Security, privacy, cost, and compatibility

- `npm audit` moved from 33 pre-existing vulnerabilities (3 low, 20 moderate, 10 high) to 0, as a direct effect of this upgrade rather than a separate remediation pass — closes the "patched dependencies and lockfile review" M1 scope item.
- Apollo Server v4's already-passed EOL date (January 26, 2026) is no longer an exposure; the project now runs the actively supported Apollo Server v5.
- No production credential, cloud access, or real consumer data was involved; all verification used synthetic fixtures and local/Docker-local infrastructure.

### Known gaps

- `docker-compose.yml`'s `app` service still starts with `NODE_ENV: development` (unchanged from M1-003's known gap) — schema auto-sync, not the M1-003 migration path, is what actually created the schema in the Docker Compose smoke test above. A production-shaped Docker Compose profile (or the eventual M7 staging environment) should exercise `NODE_ENV=production` plus `npm run migration:run` explicitly.
- `npm audit`'s clean result reflects this moment's advisory database; it is not a standing guarantee and should be re-checked periodically, not treated as permanently closed.
- `@apollo/server-plugin-landing-page-graphql-playground` (an internal dependency `@nestjs/apollo` still ships for legacy playground support) declares a peer of `@apollo/server@^4.0.0` against the now-installed `@apollo/server@5.5.1`; npm resolves this with a peer override and it does not affect anything this project uses (the app doesn't reference that plugin directly, and the playground continued to work correctly in the manual smoke test) — noted here in case a future `npm install` warning about it looks unfamiliar.

### Next safe step

Milestone 1 is complete (Section 20 status table updated to `Implemented`). Begin Milestone 2: tenant-keyed case, evidence, condition, audit, workflow, and idempotency schema; REST workflow-start and status endpoints; API and worker process boundaries; Temporal workflow, activities, signals, retry classification, and replay tests; transactional outbox and signed status event foundation; deterministic synthetic discrepancy scenario (Section 20, M2 scope).

## M2-001: Tenant-keyed case, evidence, and condition schema

### Status

Implemented and verified against a real Postgres instance. First slice of Milestone 2; M2 as a whole (Temporal workflow, REST endpoints, API/worker process split, transactional outbox, replay tests) remains in progress — the Section 20 milestone table is not updated to `Implemented` until the full M2 scope and exit evidence exist.

### Acceptance criterion

The repository must contain a tenant-keyed case, evidence, and condition schema using the charter's target vocabulary (Section 6.1 case statuses, Section 6.2 condition statuses) — as new, additive entities and a verified migration, coexisting with the legacy `LoanApplication`/`evaluateLoan` one-shot path rather than replacing it in place (Section 3: the legacy vocabulary is migrated deliberately, not dropped as a side effect).

### Implementation

- Added five entities in `src/database/entities/`: `Tenant`, `LoanCase` (the aggregate root — tenant-scoped, optimistic-concurrency `version` column, unique `(tenantId, idempotencyKey)` for case-creation idempotency per Section 15.3), `EvidenceFact` (typed, source-attributed, JSONB `value`), `LoanCondition` (Section 6.2 status enum, nullable `policySnapshotId` since the M3 policy engine that produces it doesn't exist yet), and `ConditionTransition` (append-only actor-attributed history).
- Registered all five in `DatabaseModule` alongside the existing `LoanApplication`.
- Generated and verified a second migration, `CaseEvidenceConditionSchema`, on top of the existing `InitialSchema` one from M1-003.
- Rewrote the migration test (`initial-schema.migration.spec.ts` → `schema-migrations.spec.ts`) to test the full cumulative migration sequence rather than one migration in isolation — see Failures below for why a one-file-per-migration structure doesn't hold up.

### Failures and resolution

Three distinct problems, each found by actually running the migration workflow end-to-end rather than trusting the generator output:

1. **`migration:generate` failed to type-check `initial-schema.migration.spec.ts`.** `src/database/data-source.ts`'s `migrations` glob (`*.{ts,js}`) matched every `.ts` file in the migrations directory, including the M1-003 spec file. This didn't surface in M1-003 because the spec didn't exist yet when that migration was generated; generating a *second* migration exposed it. `ts-node`'s program loading for the CLI tried to type-check the spec file (which needs Jest's ambient globals) as part of loading the DataSource and failed. Fixed by changing the glob to `[0-9]*.{ts,js}`, matching TypeORM's own `<timestamp>-Name.ts` migration-file naming convention, which excludes any hand-written spec file by construction. Applied the same fix to the spec file's own (separate) migrations glob for consistency.
2. **The first generation attempt produced a migration that duplicated `loan_applications`.** Generated against a fully empty scratch database, so the diff saw every entity — including the untouched `LoanApplication` — as new. The correct workflow is to apply the *existing* migration to the scratch database first, then generate the next one against that now-partially-migrated state so the diff contains only what's actually new. Deleted the incorrect migration file and regenerated correctly; verified the resulting file only creates the five new tables.
3. **The migration failed on a fresh database with `function uuid_generate_v4() does not exist`.** The new entities use `@PrimaryGeneratedColumn('uuid')`, which needs the Postgres `uuid-ossp` extension; TypeORM's Postgres driver only auto-creates that extension when it discovers a `uuid`-typed column via loaded entity metadata at connect time. The migration test's `DataSource` only declared `migrations`, not `entities` (unlike the real CLI's `data-source.ts`, which declares both) — so the auto-extension step never ran for that connection. Fixed by declaring `entities` in the test's `DataSource` too, matching the real CLI config.

Also confirmed, not just assumed: after running the full unit and e2e suite against the real local `mortgage_agent` database, `\dt` showed all five new tables were auto-created there via `synchronize: true` (unchanged `development` policy from M1-001/M1-003) — expected, and no existing `loan_applications` rows were affected.

### Affected files

- `src/database/entities/tenant.entity.ts`, `loan-case.entity.ts`, `evidence-fact.entity.ts`, `loan-condition.entity.ts`, `condition-transition.entity.ts` (new)
- `src/database/database.module.ts`
- `src/database/data-source.ts`
- `src/database/migrations/1786808947275-CaseEvidenceConditionSchema.ts` (new, generated)
- `src/database/migrations/schema-migrations.spec.ts` (renamed and rewritten from `initial-schema.migration.spec.ts`)
- `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Additive new schema over modifying `LoanApplication` in place**: the charter (Section 3) treats the legacy vocabulary migration as its own deliberate, evidence-backed step, not something to fold silently into an unrelated schema slice.
- **Cumulative migration test over one spec file per migration**: `DataSource.runMigrations()`/`undoLastMigration()` operate on the whole pending/applied sequence, not a single named migration, so per-migration test isolation isn't available without much more custom machinery; a test that grows its assertions as migrations accumulate matches how the underlying API actually behaves.
- **`policySnapshotId` nullable now, tightened later**: Section 6.2 requires every satisfied/waived/escalated condition to carry a policy snapshot reference, but nothing in the repository produces one until M3 — modeling it as required today would make the column meaningless (always null) rather than enforced.
- **JSONB `value` on `EvidenceFact` over per-fact-type columns**: only one real fact-type shape exists in the repository today (the synthetic Plaid/credit/document payloads already used by `LoanApplication.rawIntegrationData`); normalizing into typed columns before a second shape exists to compare against would be guessing at a schema instead of deriving one.

### Verification

```text
npm run build / npm run lint:check          -> both passed

Migration round-trip against a disposable scratch database
(mortgage_agent_migration_scratch, created and dropped on the same
Postgres server as the real mortgage_agent database, which was never
directly modified by migration commands):
  migration:run (InitialSchema, then CaseEvidenceConditionSchema)
    -> tenants, loan_cases, evidence_facts, loan_conditions,
       condition_transitions created alongside the untouched
       loan_applications; columns, enum types, and 4 foreign keys
       match the entities exactly
  migration:revert x2 (reverse order)
    -> first revert leaves only loan_applications; second revert
       leaves the database empty, no orphaned enum types

npm test -- --runInBand --no-cache --silent
  13 suites passed, 87 tests passed (1 new net: schema-migrations.spec.ts
  has 3 tests, replacing the 2-test initial-schema.migration.spec.ts)

npm run test:e2e
  1 suite passed, 4 tests passed — also incidentally confirmed
  synchronize:true auto-created the 5 new tables in the real local
  mortgage_agent database (expected development-mode behavior;
  existing loan_applications rows unaffected)
```

### Security, privacy, cost, and compatibility

- Schema-only change; no new runtime dependency, no data migration, no behavior change to the existing `evaluateLoan` path.
- All verification against a real database used a disposable, immediately-dropped scratch database; the real `mortgage_agent` database was only ever touched by the app's own existing `synchronize: true` development behavior, never by a migration command run directly against it.

### Known gaps

- No service, resolver, or REST endpoint reads or writes these entities yet — this slice is schema only, by design, matching the M1-003 precedent of generating and verifying a migration before any business logic depends on it.
- `Tenant`/tenant-scoping here is a column and a foreign key, not enforcement — RBAC, row-level security, and tenant-context middleware remain M5 scope (Section 14.2 already notes service-layer authorization as primary, RLS as defense in depth).
- No case/condition domain service exists yet to actually transition a `LoanCase`/`LoanCondition` through its status machine; `ConditionTransition` rows are not yet written by anything.
- Next M2 slices: Temporal workflow/activities/signals for the durable case lifecycle, REST workflow-start and status endpoints, the API/worker process boundary, and a transactional outbox — per Section 20's M2 scope, in that rough order since the workflow needs the schema this slice provides and the REST layer needs the workflow.

### Next safe step

Stand up Temporal for local development (add to `docker-compose.yml`, add the TypeScript SDK) and implement the first durable workflow: create a case, wait for evidence, resume, reach a readiness state — the M2 user-visible outcome.

## M2-002: Fix enum triplication and split env-validation strategy

### Status

Implemented and verified. Prompted by a direct architecture review requested mid-session (not tied to a specific charter milestone item), covering two concrete findings against the real, running code.

### Acceptance criterion

There must be exactly one definition of the loan-type and loan-decision vocabularies shared by the GraphQL layer, the legacy `LoanApplication` entity, and the new M2-001 `LoanCase` entity — not three independently maintained copies bridged by unsafe casts. Every environment variable the application reads must be validated in exactly one place (`src/config/env.validation.ts`), not partly there and partly re-validated ad hoc inside a service constructor.

### Findings

1. **Loan type had three parallel enum definitions**: `LoanType` in `loan.model.ts` (GraphQL), `LoanTypeEntity` in `loan-application.entity.ts` (TypeORM), and `CaseLoanType` in `loan-case.entity.ts` (TypeORM, added this session in M2-001) — same four values, three independent declarations. `loan.service.ts` bridged the first two with `input.loanType as unknown as LoanTypeEntity`, a cast that defeats type-checking: if the enums' values ever drifted, TypeScript would not catch it.
2. **Loan decision status had the same problem**: `LoanDecisionStatus` (GraphQL) and `LoanDecisionEntity` (TypeORM) were separately declared, bridged with the same `as unknown as X` pattern in `loan.service.ts`.
3. **`DECISION_PROVIDER`/`OLLAMA_BASE_URL`/`OLLAMA_MODEL`/`OLLAMA_TIMEOUT_MS` were validated inside `AgentService`'s constructor** (manual parsing, trimming, `throw new Error(...)`), independently of the M1-001 centralized `env.validation.ts` DTO that validates every other environment variable. Two different validation mechanisms coexisted for no functional reason.

### Implementation

- Added `src/database/enums/loan-type.enum.ts` and `loan-decision.enum.ts` — single canonical `LoanType` and `LoanDecisionStatus` enums.
- `loan.model.ts` now imports and re-exports them (GraphQL `registerEnumType` is wiring, not ownership); `loan-application.entity.ts` and `loan-case.entity.ts` both import them directly, replacing `LoanTypeEntity`/`LoanDecisionEntity`/`CaseLoanType`.
- `loan.service.ts`'s two `as unknown as X` casts are gone — the types are now identical, so plain assignment type-checks correctly (verified: removing the casts produced zero compiler errors).
- `agent.types.ts`'s `UnderwritingDecision` is now `Exclude<LoanDecisionStatus, LoanDecisionStatus.PENDING>` — a narrower view of the same shared vocabulary (the agent never returns `PENDING`) rather than a fourth independent type. Updated `agent.service.ts`'s three literal decision returns and its JSON-response validation to use `LoanDecisionStatus` members instead of raw string literals.
- Added `DecisionProvider` enum and `DECISION_PROVIDER`/`OLLAMA_BASE_URL`/`OLLAMA_MODEL`/`OLLAMA_TIMEOUT_MS` fields to `EnvironmentVariables` in `env.validation.ts`, including the case-insensitive trim and trailing-slash-strip transforms `AgentService` used to do itself.
- `AgentService`'s constructor now just reads `this.configService.get('DECISION_PROVIDER', DecisionProvider.Rules)` etc. — no parsing, no throwing, no `readPositiveIntegerConfig` helper (deleted, now dead code).

### Failures and resolution

- Removing `AgentService`'s own `DECISION_PROVIDER` validation removed the specific behavior a unit test (`'rejects an unsupported provider'`) was checking — that test asserted the *constructor* throws, which is no longer where that validation happens. Deleted it from `agent.service.spec.ts` and added equivalent (and additional: malformed URL, non-positive timeout) coverage to `env.validation.spec.ts`, where the behavior now actually lives, rather than leaving the safety net untested or leaving a now-false assertion in place.
- The existing mocks in `agent.service.spec.ts` (`get: jest.fn((key) => ...)`) didn't implement `ConfigService.get(key, defaultValue)`'s two-argument fallback contract — they ignored whatever default `AgentService` passed and returned `undefined` for unmocked keys. This didn't matter while `AgentService` did its own `?? fallback` logic, but does now that it relies on the real default-parameter behavior. Updated every mock to accept and return `defaultValue` for unmatched keys, which also made the `'defaults to rules mode when DECISION_PROVIDER is not configured'` test a more accurate test of the actual mechanism instead of an artifact of the old code path.
- One existing `env.validation.spec.ts` test (`'preserves unrelated environment variables untouched'`) used `DECISION_PROVIDER`/`OLLAMA_MODEL` as its "unrelated" example — accurate when written, no longer accurate now that those became real schema fields. Renamed and switched it to genuinely unrelated variables (`ANTHROPIC_API_KEY`, `DEMO_MODE`) so the test still tests what its name says.

### Affected files

- `src/database/enums/loan-type.enum.ts`, `loan-decision.enum.ts` (new)
- `src/loan/loan.model.ts`, `loan.service.ts`
- `src/database/entities/loan-application.entity.ts`, `loan-case.entity.ts`
- `src/agent/agent.types.ts`, `agent.service.ts`, `agent.service.spec.ts`
- `src/config/env.validation.ts`, `env.validation.spec.ts`

### Decisions and alternatives

- **Shared enums live under `src/database/enums/`, not `src/loan/`**: `src/loan/loan.service.ts` already imports domain types from `src/database/entities/`, so this keeps the existing dependency direction (API layer depends on the lower/persistence layer) instead of introducing a new one where entities would import from the GraphQL module.
- **`UnderwritingDecision` as `Exclude<LoanDecisionStatus, PENDING>`, not a fourth copy**: preserves a real, valuable type-level guarantee (the agent can never claim `PENDING`, a state that only makes sense before evaluation) while still eliminating the redundant duplication of the other three values.
- **Confirmed empirically, not assumed, that the enum rename caused zero schema drift**: renaming a TS enum identifier doesn't change the Postgres type name TypeORM generates (that's derived from table/column name). Verified by applying both existing migrations to a scratch database and running `migration:generate` again — "No changes in database schema were found." No new migration was needed for this refactor.
- **Deleted the redundant test rather than keeping a duplicate assertion in two places**: `AgentService` no longer performs this validation, so a test asserting it does would either need to be fake (mocking around the real behavior) or misleading (implying a safety net that no longer exists at that layer).

### Verification

```text
npm run build / npm run lint:check     -> both passed
npm test -- --runInBand --no-cache --silent
  13 suites passed, 91 tests passed (net +4: -1 removed from
  agent.service.spec.ts, +5 added to env.validation.spec.ts)
npm run test:e2e                        -> 1 suite passed, 4 tests passed

grep -rl "LoanTypeEntity|LoanDecisionEntity|CaseLoanType" src test
  -> no matches (fully removed, not just unused)

Schema-drift check: applied both existing migrations to a disposable
scratch database, then ran migration:generate again
  -> "No changes in database schema were found" (confirms the enum
     rename is purely a TypeScript-level refactor)

Manual boot test against the real built app (node dist/main.js):
  default config          -> starts normally, logs the RULES warning
  DECISION_PROVIDER=nonsense -> fails immediately at bootstrap with
    "Invalid environment configuration: - DECISION_PROVIDER must be
    either "rules" or "ollama"", thrown from env.validation.js via
    ConfigModule.forRoot — confirms validation now happens centrally
    at startup, not deep inside AgentService's constructor
```

### Security, privacy, cost, and compatibility

- No behavior change for a correctly-configured deployment — every default value (`rules`, `http://127.0.0.1:11434`, `qwen3.5:9b`, `60000`) is unchanged from what `AgentService` used to hard-code.
- An invalid `DECISION_PROVIDER`/`OLLAMA_*` value now fails at the same bootstrap point as every other misconfiguration (before any HTTP listener or database connection), rather than at first-request time when Nest instantiates `AgentService` — a strictly earlier, clearer failure.

### Known gaps

- `AgentService` itself remains a single ~470-line class mixing HTTP client, prompt construction, JSON-schema definition, response parsing, and the deterministic rules engine — a separate, larger decomposition (already tracked as a known M3 direction: `AgentRuntime` port, deterministic policy engine, bounded Agent execution) and out of scope for this consistency-focused slice.
- The M2-001 `LoanCase`/`EvidenceFact`/`LoanCondition` schema remains unconnected to any service — unaffected by this slice, still pending the Temporal workflow work.

### Next safe step

Stand up Temporal for local development and implement the first durable workflow (unchanged from before this slice — M2's next step). Separately, consider decomposing `AgentService` into an HTTP/model client, a prompt/response layer, and the rules engine as its own dedicated slice given its size and mixed responsibilities.

## M2-003: Split AgentService into orchestrator + two decisioning services

### Status

Implemented and verified, including through real NestJS dependency injection (not only mocked unit tests). Closes the last of the four architecture-review findings from this session (M2-002 covered the other two; the fourth — the M2-001 schema being unconnected to any service — is not a defect, it correctly waits on the Temporal workflow slice).

### Acceptance criterion

`AgentService` must no longer mix HTTP client logic, prompt construction, JSON-schema definition, response parsing, and the deterministic rules engine in one class. Each concern must be independently unit-testable without needing to go through `AgentService`'s orchestration layer, and `AgentService` itself must be reducible to fan-out + provider dispatch + result assembly.

### Finding

`AgentService` was a single ~470-line class doing five distinct things: parallel integration fan-out, deterministic threshold-based decisioning, Ollama HTTP client management, prompt/schema construction, and model-response parsing/validation. Testing any one of these required going through the others (e.g., every rules-engine threshold test also mocked and exercised the integration fan-out), and the class's size made it the highest-risk file in the repository for any future change — exactly the file the charter's own M3 direction (separate `AgentRuntime`, deterministic policy engine, and bounded Agent execution) already says should eventually be split apart.

### Implementation

- Extracted `RulesUnderwriterService` (`src/agent/rules-underwriter.service.ts`): the deterministic threshold engine (`runRulesUnderwriter`/`getLoanThresholds`), moved verbatim. It has no constructor dependencies — a pure, synchronous, directly-instantiable class.
- Extracted `OllamaUnderwriterService` (`src/agent/ollama-underwriter.service.ts`): the Ollama HTTP client, prompt/schema construction, and response parsing (`invokeOllamaUnderwriter`/`parseModelResponse`), moved verbatim. Reads `OLLAMA_BASE_URL`/`OLLAMA_MODEL`/`OLLAMA_TIMEOUT_MS` from the centralized validated config (M2-002) itself now, rather than being handed pre-resolved values. Exposes `endpoint`/`modelName` getters so `AgentService` can still log which model/endpoint is active without holding those values itself.
- `AgentService` is now ~95 lines: fan out to Plaid/Credit/Document, pick `rulesUnderwriter.evaluate()` or `ollamaUnderwriter.evaluate()` based on `DECISION_PROVIDER`, assemble the result (confidence clamping, `incomeVerified` derivation, raw-payload storage — the parts that are genuinely orchestration, not decisioning).
- Registered both new services as providers in `AgentModule`.

### Test reorganization

Split `agent.service.spec.ts`'s ~600 lines into three focused files rather than keeping one large spec that exercises everything through the orchestrator:

- `rules-underwriter.service.spec.ts`: all 16 threshold tests (APPROVED/CONDITIONAL/DENIED), now calling `service.evaluate(context)` directly with no mocking at all, since the service has no dependencies — simpler and faster than the previous version, which had to mock three integration services just to reach the rules logic.
- `ollama-underwriter.service.spec.ts`: all 6 Ollama HTTP/parsing test groups, now calling `service.evaluate(context)` directly against a mocked `httpClient`, without needing `AgentService` or its integration mocks at all.
- `agent.service.spec.ts`: now tests only orchestration — provider dispatch (added two new tests making the dispatch behavior explicit, since it used to only be exercised implicitly by which HTTP calls happened), `incomeVerified` derivation, confidence clamping, and the integration fan-out — against mocked `RulesUnderwriterService`/`OllamaUnderwriterService`.

### Affected files

- `src/agent/rules-underwriter.service.ts`, `rules-underwriter.service.spec.ts` (new)
- `src/agent/ollama-underwriter.service.ts`, `ollama-underwriter.service.spec.ts` (new)
- `src/agent/agent.service.ts`, `agent.service.spec.ts` (rewritten)
- `src/agent/agent.module.ts`
- `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Two services, not a generic `DecisionProvider` interface with two implementations**: an interface would add an abstraction with exactly two members and no third implementation planned in this slice; `AgentService`'s ternary dispatch is already the simplest expression of "pick one of two."
- **`endpoint`/`modelName` getters on `OllamaUnderwriterService` rather than moving the startup log into its constructor**: NestJS constructs every registered provider regardless of which `DECISION_PROVIDER` is active, so logging "Local model provider active" from `OllamaUnderwriterService`'s own constructor would log it on every boot, even in rules mode — a regression from the current conditional behavior. The conditional logic has to stay where the actual provider selection happens.
- **Verified through real DI, not just mocks**: unit tests mock the collaborators, which would not have caught a wiring mistake in `agent.module.ts` (e.g., forgetting to register a provider) or a mismatch between what `AgentService` expects from `OllamaUnderwriterService` and what it actually exposes. Booted the real built app in both `rules` and `ollama` mode and confirmed the log line correctly read `model`/`endpoint` from the actually-injected service, not a mock.

### Verification

```text
npm run build / npm run lint:check   -> both passed
npm test -- --runInBand --no-cache --silent
  15 suites passed, 95 tests passed (13→15 suites: 2 new; net +4 tests:
  all threshold/Ollama tests moved 1:1, 2 new explicit dispatch tests added)
npm run test:e2e                      -> 1 suite passed, 4 tests passed
  (exercises the real AgentModule DI graph, not mocks — confirms the
  provider registration is correct)

Manual boot test against node dist/main.js:
  DECISION_PROVIDER unset (rules default)
    -> "*** RULES PROVIDER ACTIVE ***" logged, as before
  DECISION_PROVIDER=ollama OLLAMA_MODEL=qwen3.5:4b
    -> "Local model provider active [model=qwen3.5:4b,
       endpoint=http://127.0.0.1:11434]" — confirms AgentService reads
       these values from the real injected OllamaUnderwriterService,
       not a hand-wired mock
```

### Security, privacy, cost, and compatibility

- Pure refactor — no behavior, prompt content, threshold values, or validation logic changed; every moved code block is verbatim.
- No new dependency.

### Known gaps

- None specific to this slice. The broader M3 direction (a real `AgentRuntime` port, tool registry, budgets) is unaffected — this slice only cleans up the current one-shot decisioning path's internal structure, it does not build toward M3 itself.

### Next safe step

Stand up Temporal for local development and implement the first durable M2 workflow — the architecture-review findings from this session are now fully addressed, so M2 continues from where M2-001 left off.

## M2-004: Durable case-conditions Temporal workflow

### Status

Implemented and verified: automated tests (workflow control flow and activities against a real database) pass, and the hardest guarantee — that a worker crash or restart loses no acknowledged work while a case is durably waiting — was additionally verified by hand against a real Temporal server before the automated test that codifies the same proof was written. Closes M2's "Temporal workflow, activities, signals, retry classification, and replay tests" scope item.

### Acceptance criterion

A synthetic loan case must be able to enter a durable condition workflow, collect evidence via activities, optionally open a condition and wait — indefinitely, and correctly, across a worker process restart — for a `resolveCondition` signal, then reach `READY_FOR_UNDERWRITING`. The wait must be Temporal's own durable state, not in-process memory: no worker running at all must not lose or drop a signal sent during that gap.

### Problem

The M2-001 schema (`LoanCase`, `EvidenceFact`, `LoanCondition`, `ConditionTransition`) existed but nothing executed against it — cases could be persisted but never actually moved through evidence collection, condition evaluation, or condition resolution. Doing this with plain NestJS request/response code would mean either blocking an HTTP request for however long a human reviewer takes to resolve a condition (unbounded, sometimes days), or hand-rolling a polling/resume mechanism (a queue plus a status column plus a cron sweep) that reimplements what a durable-execution engine already does correctly, including the specific hard part: surviving a process crash mid-wait without losing the eventual signal.

### Implementation

- `src/workflows/case-conditions.signals.ts` — `resolveConditionSignal`, a `defineSignal<[ResolveConditionSignalPayload]>` carrying `actorId`, `resolution: 'SATISFIED' | 'WAIVED'`, and an optional `reason`. `CASE_CONDITIONS_TASK_QUEUE` is the single shared task queue name used by the client, the worker, and the tests.
- `src/workflows/case-conditions.activities.ts` — `createCaseConditionsActivities(deps)`, a plain factory function (not a NestJS-injected class — see Decisions) taking `{ dataSource, plaidService, creditService, documentService }` and returning the seven activities: `markCollectingEvidence`, `fetchIncomeEvidence`/`fetchCreditEvidence`/`fetchDocumentEvidence` (each persists an `EvidenceFact` row and returns the simulator's data), `evaluateConditions` (applies `hasSyntheticDiscrepancy()` — `derogatoryMarks >= 1 || debtToIncomeRatio > 0.4 || !allDocumentsValid` — and either marks the case ready or opens a `LoanCondition` with status `OPEN`), `resolveCondition` (updates the condition's status and appends an attributed `ConditionTransition` row — actor, reason, from/to status), and `markReadyForUnderwriting`.
- `src/workflows/case-conditions.workflow.ts` — `caseConditionsWorkflow`, the actual durable function: registers the signal handler, calls `markCollectingEvidence`, fans out the three evidence-fetch activities via `Promise.all`, calls `evaluateConditions`, and returns immediately if no condition opened. Otherwise it durably waits with `await condition(() => resolution !== undefined)` — Temporal persists this suspension server-side — then calls `resolveCondition` and `markReadyForUnderwriting` using whatever the signal handler captured, and returns the final status plus condition id.
- `src/workflows/case-conditions.types.ts` — `CaseConditionsWorkflowInput`/`Result`, imported by both the workflow and its callers.
- `src/workflows/temporal-client.service.ts` — `TemporalClientService`, a NestJS `OnModuleDestroy` service wrapping a `@temporalio/client` `Client`: `startCaseConditionsWorkflow`, `resolveCondition` (delivers the signal to a running workflow handle), `getWorkflowStatus`. Not yet called from any REST/GraphQL entry point — see Known gaps.
- `src/workflows/temporal.module.ts` — registers and exports `TemporalClientService` for the API process.
- `src/worker.module.ts` / `src/worker.ts` — a second, minimal Nest application context (`NestFactory.createApplicationContext`, not `create` — no HTTP listener) that builds the real `CaseConditionsActivities` from the app's actual `DataSource`/integration services, connects a `NativeConnection` to Temporal, and runs a `Worker` polling `CASE_CONDITIONS_TASK_QUEUE`. `src/database/typeorm-options.factory.ts` extracts the `TypeOrmModule.forRootAsync` options object so `app.module.ts` and `worker.module.ts` share one definition instead of two copies that could drift.
- `src/config/env.validation.ts` — added `TEMPORAL_ADDRESS` (default `localhost:7233`) and `TEMPORAL_NAMESPACE` (default `default`), validated the same way as every other environment variable, with matching `env.validation.spec.ts` coverage (defaults, explicit values, rejects an empty `TEMPORAL_ADDRESS`).
- `docker-compose.yml` — added a `temporal` service (`temporalio/auto-setup:1.29.7`, pointed at the existing `postgres` service's `temporal`/`temporal_visibility` databases — it never touches `mortgage_agent`) and a `worker` service (`node dist/worker`); `app` now depends on `temporal` and gets `TEMPORAL_ADDRESS=temporal:7233`.
- `.env.example` — documented `TEMPORAL_ADDRESS`/`TEMPORAL_NAMESPACE`.
- `.github/workflows/ci.yml` — runs a real `temporalio/auto-setup` container (via `docker run`, not `services:`, since it must start after and target the `postgres` service — see Decisions) and polls its port before the test step, so the Temporal-gated suites actually execute in CI instead of skipping.
- `README.md` — new "Temporal worker" section explaining the API/worker process split, plus the new environment variables and the Temporal-gated test convention.
- `package.json` — added `@temporalio/{client,worker,workflow,activity,common}` (runtime) and `@temporalio/testing` (dev), and `start:worker`/`start:worker:dev` scripts.

### Failures and resolution

- **Workflow sandbox risk, caught before it broke anything**: `case-conditions.workflow.ts` initially imported `CaseStatus` from `loan-case.entity.ts` for convenience (the entity already exported it). Temporal bundles workflow code into an isolated, deterministic sandbox and rejects modules with side effects or non-deterministic behavior at load time — and `loan-case.entity.ts` pulls in TypeORM's decorator machinery. Rather than wait for that to surface as a runtime bundling failure, extracted `CaseStatus` into a standalone `src/database/enums/case-status.enum.ts` with no other imports, re-exported from the entity file for the existing call sites, and confirmed via webpack's bundle analysis output that the workflow bundle now contains only the enum file, not the entity.
- **`env.validation.spec.ts` coupling from M2-002 surfaced again here**: no new instance of the same problem, but the same test suite was extended in place (three new tests for `TEMPORAL_ADDRESS`/`TEMPORAL_NAMESPACE`) rather than adding a second validation mechanism, consistent with that earlier decision.
- **Local Temporal server setup**: `brew install temporal` failed on an unrelated, pre-existing permission problem under `/usr/local/share/man/man8` on this machine. Did not use `sudo` to force past a system-level permission issue outside this task's scope; used a disposable Docker Compose stack (`temporalio/auto-setup` + a scratch Postgres) in the scratchpad directory for manual verification instead, torn down after use.

### Manual restart-survival verification (before the automated test)

Performed by hand against the scratchpad Temporal server, in this order, before writing `case-conditions.workflow.spec.ts`'s equivalent automated test:

1. Started a worker (`ts-node src/worker.ts`) and started a workflow for a synthetic case with a `DISCREPANT_CREDIT`-shaped evidence set (forces `hasOpenCondition: true`).
2. Confirmed via `temporal workflow describe` / the case's Postgres row that the workflow reached the durable wait and the case was `CONDITIONS_OPEN`.
3. Killed the worker process entirely (`Ctrl+C`) — zero workers running.
4. Sent the `resolveCondition` signal from a separate script while still zero workers were running; confirmed Temporal accepted and persisted it server-side (no worker needed to be listening to receive it).
5. Started a new, independent worker process.
6. Confirmed the new worker picked up the pending signal, ran `resolveCondition`/`markReadyForUnderwriting`, and the case reached `READY_FOR_UNDERWRITING` — with `markCollectingEvidence` and the fetch activities *not* re-executed (confirmed via their log lines appearing only once, from the first worker), i.e. Temporal replayed the prior history rather than re-running completed work.

This sequence is what `case-conditions.workflow.spec.ts`'s `'loses no acknowledged work across a worker restart while durably waiting'` test automates.

### Affected files

- `src/workflows/case-conditions.signals.ts`, `case-conditions.types.ts`, `case-conditions.activities.ts`, `case-conditions.workflow.ts`, `temporal-client.service.ts`, `temporal.module.ts` (all new)
- `src/workflows/case-conditions.workflow.spec.ts`, `case-conditions.activities.spec.ts` (new)
- `src/database/enums/case-status.enum.ts` (new); `src/database/entities/loan-case.entity.ts` (re-exports it)
- `src/database/typeorm-options.factory.ts` (new); `src/app.module.ts` (uses it, imports `TemporalModule`)
- `src/worker.module.ts`, `src/worker.ts` (new)
- `src/config/env.validation.ts`, `env.validation.spec.ts`
- `docker-compose.yml`, `.env.example`, `.github/workflows/ci.yml`, `README.md`, `package.json`

### Decisions and alternatives

- **Activities as a plain factory function, not a NestJS-injected class**: Temporal's worker constructs activities from a plain object of functions handed to `Worker.create()` — there is no Nest DI container inside a Temporal worker's activity execution path by default. Wrapping every activity call in `moduleRef.get()` lookups would add indirection with no benefit over closing over the already-constructed `dataSource`/integration services once, at worker startup, which is what `createCaseConditionsActivities(deps)` does.
- **Second Nest application context for the worker, not one process doing both**: `NestFactory.createApplicationContext(WorkerModule)` builds only the providers the worker actually needs (config, TypeORM, the three integration services) with no HTTP listener, guard, or resolver in the graph — keeping the worker's dependency surface minimal and its failure domain separate from the API process's. `WorkerModule` intentionally does not import `AgentModule`, `LoanModule`, or `TemporalModule` (the client side) since the worker never starts or signals workflows, only executes them.
- **`CaseStatus` extracted to its own file instead of loosening the sandbox**: Temporal's sandbox restriction is a correctness guarantee (workflow code must replay deterministically), not an inconvenience to route around; `workflowsPath`-level sandbox exceptions exist but would have papered over the actual coupling problem (a workflow depending on entity/ORM code) rather than fixing it.
- **CI runs Temporal via `docker run`, not GitHub Actions' `services:` block**: `services:` containers all start in parallel with no dependency ordering between them, but `temporalio/auto-setup` needs the `postgres` service already accepting connections to run its own schema migration on first boot. Starting it as a manual step after `postgres`'s health check has already gated earlier steps, then polling its gRPC port, gets the same effect without inventing a wait-for-postgres mechanism inside a `services:` container that doesn't support one.
- **Retry policy (`initialInterval: 1s`, `backoffCoefficient: 2`, `maximumAttempts: 3`) is Temporal's standard activity retry, not custom classification logic**: this slice's activities either succeed or throw (no distinct "retryable vs. terminal" error taxonomy exists yet in the simulator services they call) — attempting retry-reason classification now would be speculative for failure modes that don't exist yet in this codebase. Revisit once a real, non-simulated provider integration introduces errors worth distinguishing (e.g., rate limits vs. malformed input).

### Verification

```text
npm run build / npm run lint:check   -> both passed

DATABASE_URL=... TEMPORAL_ADDRESS=localhost:7233 npm test -- --runInBand --no-cache --silent
  17 suites passed, 108 tests passed (15->17 suites, +2 new:
  case-conditions.workflow.spec.ts, case-conditions.activities.spec.ts;
  net +13 tests over M2-003's 95)
  - case-conditions.workflow.spec.ts (4 tests, against a real Temporal
    server via TestWorkflowEnvironment.createFromExistingServer, mocked
    activities): straight-through completion with no open condition;
    durable wait -> signal -> completion; the restart-survival test
    described above, automated; duplicate-signal delivery does not
    double-resolve a condition.
  - case-conditions.activities.spec.ts (6 tests, against a real
    Postgres database, real activities, mocked integration services):
    each activity's effect on LoanCase/EvidenceFact/LoanCondition/
    ConditionTransition rows, including the attributed transition
    record (actor, reason, from/to status) on resolution.

DATABASE_URL=... TEMPORAL_ADDRESS=localhost:7233 npm run test:e2e
  -> 1 suite passed, 4 tests passed (unaffected by this slice; run
     with TEMPORAL_ADDRESS set to confirm AppModule still boots
     correctly with TemporalModule wired in)

Manual end-to-end restart-survival verification: see above, performed
against a disposable scratchpad Temporal + Postgres Docker stack
(torn down after use), independently of the automated suite.

Webpack workflow-bundle inspection: confirmed the compiled workflow
bundle Temporal loads into its sandbox includes only
case-status.enum.ts, not loan-case.entity.ts or any TypeORM module.
```

### Security, privacy, cost, and compatibility

- No new externally-reachable surface: `TemporalClientService` is not yet called from any REST/GraphQL resolver (see Known gaps), so this slice adds no new attack surface to the API process itself.
- The worker process holds the same database credentials and integration-service access the API process already has — no new credential or scope was introduced, but it is a second process that now needs the same secrets, which operationally matters for secret-distribution/rotation once this leaves local development.
- `ConditionTransition` rows (already part of the M2-001 schema) capture `actorId`/`reason` for every resolution, giving the same reviewer-attribution audit trail the charter's Section 6.3 human-in-the-loop requirement expects — this slice is what actually populates that table for the first time.
- No paid service added; Temporal's OSS server runs locally via Docker, same cost profile as the existing Postgres dependency.

### Known gaps

- `TemporalClientService.startCaseConditionsWorkflow`/`resolveCondition` exist but are not called from any REST or GraphQL entry point yet — a case cannot currently be moved into this workflow except by calling the service directly (as the tests and manual verification do). This is explicitly still-pending M2 scope ("REST workflow-start and status endpoints"), not a defect in this slice.
- Retry behavior uses Temporal's default activity retry policy uniformly; there is no failure-classification logic distinguishing retryable from terminal errors (see Decisions) because no real provider integration in this codebase currently produces that distinction.
- No transactional outbox or signed status events yet (separate M2 scope item, not started).
- `LoanCondition`'s `ConditionStatus` enum remains defined in `loan-condition.entity.ts` rather than extracted like `CaseStatus`, since no workflow or activity code imports it directly (activities run outside the sandbox, so this is safe as-is, not an oversight).

### Next safe step

Wire `TemporalClientService` into a REST or GraphQL entry point so a real case can start this workflow and receive the `resolveCondition` signal from outside a test — the workflow itself is complete and proven, but currently unreachable from outside this codebase's own test suite.

## M2-005: REST case, workflow-start, and status endpoints

### Status

Implemented and verified against a real database and a real Temporal server (no mocks) via a dedicated e2e suite, plus fast unit coverage for the service/controller logic. Closes M2's "REST workflow-start and status endpoints" scope item and M2-004's Known-gaps/Next-safe-step item (`TemporalClientService` was built but unreachable from outside this codebase's own tests).

### Acceptance criterion

An external caller must be able to, over plain HTTP: create a case, start its durable conditions workflow, read that workflow's current status, and resolve an open condition as a reviewer — with a duplicate case-creation request or a duplicate workflow-start request producing no duplicate domain effect (M2 exit evidence).

### Problem

`TemporalClientService` (M2-004) could start and signal the workflow, but nothing called it — a case could only enter this workflow by writing a test or a one-off script against the service directly. There was also no REST endpoint of any kind creating a `LoanCase` row; the M2-001 schema had no entry point at all.

### Implementation

- `src/cases/cases.controller.ts` — `CasesController` at `v1/loan-cases` (Section 15.1's full target path prefix, narrowed to the endpoints this slice actually implements):
  - `POST /v1/loan-cases` — requires an `Idempotency-Key` header (400 if missing/blank); delegates to `CasesService.createCase`.
  - `GET /v1/loan-cases/:caseId` — 404 via `ParseUUIDPipe` rejecting a malformed id, or `CasesService.getCase` for a well-formed but unknown one.
  - `POST /v1/loan-cases/:caseId/workflow-runs` — 202, starts the workflow.
  - `GET /v1/loan-cases/:caseId/workflow-runs/:runId` — 200 with `{ workflowId, runId, status }`.
  - `POST /v1/loan-cases/:caseId/reviews` — 202, maps to Section 15.1's reviewer-decision endpoint; the only implemented review action is resolving the case's open condition.
- `src/cases/cases.service.ts` — `CasesService` owns the case-idempotency logic and Temporal-error-to-HTTP-exception mapping (`WorkflowNotFoundError` -> `NotFoundException`), keeping `TemporalClientService` itself a plain, REST-agnostic wrapper (Section 12.1's API/worker boundary comment already established this — this slice is the API side actually using it).
- `src/cases/dto/create-case.dto.ts`, `resolve-condition.dto.ts` — class-validator DTOs, validated by the existing global `ValidationPipe` (`whitelist`/`forbidNonWhitelisted`/`transform`, already wired in `main.ts`; no new pipe needed).
- `src/workflows/temporal-client.service.ts` — extended, not replaced:
  - `startCaseConditionsWorkflow` now catches `WorkflowExecutionAlreadyStartedError` (thrown when a workflow with that id is already running) and returns the existing execution's `{ workflowId, runId }` instead of surfacing an error — this is what makes `POST .../workflow-runs` safely retriable.
  - `getWorkflowStatus` now accepts an optional `runId` (matching the REST path's `.../workflow-runs/{runId}` shape) and returns a structured `{ workflowId, runId, status }` instead of a bare status string.
- `test/cases.e2e-spec.ts` — real-infrastructure suite (gated on `DATABASE_URL` + `TEMPORAL_ADDRESS`, same skip-if-unreachable convention as every other integration suite this session): seeds a real `Tenant` row, exercises every route above through `supertest` against the real `AppModule`, and specifically proves the two duplicate-command scenarios required by M2's exit evidence (repeated `Idempotency-Key` -> one case row; repeated `POST .../workflow-runs` -> same `runId`, not a second execution). Cleans up its own tenant/case rows and terminates any workflow it started, in `afterAll` — nothing in this suite runs a worker, so without an explicit `terminate()` those executions would sit `RUNNING` on the Temporal server indefinitely.
- `src/cases/cases.service.spec.ts`, `cases.controller.spec.ts` — fast unit coverage (mocked repositories/`TemporalClientService`) for the same logic, following this codebase's established two-tier pattern (e.g. `case-conditions.activities.spec.ts` for real-infra proof, `rules-underwriter.service.spec.ts` for fast logic coverage).
- `test/jest-e2e.json` — `testRegex` widened from matching only `loan.e2e-spec.ts` to any `*.e2e-spec.ts` file, so this new suite (and any future one) actually runs under `npm run test:e2e` instead of being silently ignored by a regex that named one specific file.

### Failures and resolution

- **`GqlThrottlerGuard` crashed every REST request with `TypeError: Cannot read properties of undefined (reading 'header')`, caught by the new e2e suite, not by anything existing**: the guard is wired globally via `APP_GUARD` (see M1-005), so it runs on every route, but it unconditionally treated every execution context as GraphQL (`GqlExecutionContext.create(context).getContext()`), which does not return `{req, res}` for a plain HTTP context. This had been invisible until now because the only REST controller before this slice was `HealthController`, which is `@SkipThrottle()`'d and so never reached the guard's request-reading logic at all. Fixed by branching on `context.getType() === 'graphql'` and falling back to `context.switchToHttp()` otherwise; added a unit test for the REST-context path so this specific regression (a guard that only works for the one context type it happened to be tested against) can't reappear silently on the next new REST controller.

### Affected files

- `src/cases/cases.controller.ts`, `cases.service.ts`, `dto/create-case.dto.ts`, `dto/resolve-condition.dto.ts`, `cases.module.ts` (all new)
- `src/cases/cases.controller.spec.ts`, `cases.service.spec.ts` (new)
- `test/cases.e2e-spec.ts` (new); `test/jest-e2e.json`
- `src/workflows/temporal-client.service.ts`
- `src/common/gql-throttler.guard.ts`, `gql-throttler.guard.spec.ts`
- `src/app.module.ts`
- `README.md`

### Decisions and alternatives

- **Idempotency via the existing `(tenantId, idempotencyKey)` unique constraint, not new fingerprint/header middleware**: Section 15.3's full target idempotency contract (canonical request fingerprints, changed-payload rejection, documented retention) is real future scope, not something this narrow slice's exit evidence asks for ("duplicate command ... produce no duplicate domain effect" — nothing about fingerprinting a changed payload under the same key). `CasesService.createCase` checks for an existing row up front and also catches the Postgres `23505` unique-violation on a concurrent race, so the guarantee holds even under simultaneous duplicate requests, not just sequential retries.
- **Workflow-start idempotency lives in `TemporalClientService`, not `CasesService`**: `WorkflowExecutionAlreadyStartedError` is Temporal's own signal that a workflow for this id is already running: catching it exactly where the Temporal client call happens (rather than, e.g., checking case status first in `CasesService` and hoping it doesn't race) means the guarantee holds regardless of what triggered the second start attempt — a client retry, a REST caller's own retry logic, or two REST requests arriving concurrently.
- **REST, not GraphQL, for this slice**: the charter (Section 12.1, 15.1/15.2) assigns partner-facing case/workflow operations to REST and reserves GraphQL for operations-console queries (case lists, timelines, review queues) — this slice is the former, so it follows the charter's own division rather than adding it to the existing `LoanResolver`'s GraphQL surface.
- **No tenant-creation endpoint added**: `Tenant` has no lifecycle of its own defined anywhere in the charter yet (multi-tenant onboarding and RBAC/RLS are explicitly M5 scope — see the entity's own comment), so inventing one now would be scope creep ahead of its actual design. Tests and local use seed a `Tenant` row directly.
- **`GqlThrottlerGuard` fixed in place, not worked around in `CasesController`**: an `@SkipThrottle()` escape hatch on every new REST controller would have hidden the fact that rate limiting silently didn't apply to any of them; fixing the guard to correctly handle both context types is what the guard was already supposed to do per its own class comment ("works... for plain REST controllers such as /health" — true only because `/health` opts out, which the comment did not make clear was load-bearing).

### Verification

```text
npm run build / npm run lint:check   -> both passed

DATABASE_URL=... TEMPORAL_ADDRESS=localhost:7233 npm test -- --runInBand --no-cache --silent
  19 suites passed, 129 tests passed (17->19 suites, +2 new:
  cases.service.spec.ts [12 tests], cases.controller.spec.ts [8 tests];
  net +21 tests over M2-004's 108, includes the new
  gql-throttler.guard.spec.ts REST-context regression test)

DATABASE_URL=... TEMPORAL_ADDRESS=localhost:7233 npm run test:e2e
  -> 2 suites passed, 13 tests passed (1->2 suites: new
     test/cases.e2e-spec.ts, 9 tests, against a real Temporal server
     and a real Postgres database)
  cases.e2e-spec.ts covers: missing Idempotency-Key -> 400; repeated
  idempotency key -> one row, not two; unknown tenant -> 404; unknown
  case id -> 404; GET reflects what was created; workflow-runs started
  twice for the same case -> identical runId (idempotent, no second
  execution); GET workflow-runs/{runId} reflects real Temporal status;
  unknown workflow run -> 404; resolving a condition with no running
  workflow -> 404.

Manual: confirmed via direct DB query and `docker ps` that the e2e
suite's afterAll left no leftover tenant/case rows and no leftover
Temporal containers — the suite's own cleanup (row deletes + explicit
workflow termination) was verified to actually run, not just written.
```

### Security, privacy, cost, and compatibility

- No authentication or tenant-scoped authorization exists on these endpoints yet — `tenantId` is caller-supplied with no verification that the caller is entitled to act for that tenant. Acceptable for this slice (no real data, no deployment target yet) but a hard blocker before any non-local exposure; tracked under M5 (tenant trust boundary), not silently deferred.
- `POST /v1/loan-cases/:caseId/reviews` accepts `actorId` as a plain string with no verification the caller is who they claim — the charter's Section 6.3 "human reviewers approve... and record overrides" requirement needs real reviewer identity (from auth) once auth exists; today `ConditionTransition.actorId` records whatever the caller sent.
- No new external dependency; no new cost.
- `GqlThrottlerGuard`'s fix restores rate-limiting protection for every REST route going forward (it was previously accepting the crash — a 500 — as an accidental de facto block, not real protection; now it correctly rate-limits instead of erroring).

### Known gaps

- No auth/tenant-authorization layer (see above; M5 scope).
- No RFC 9457 problem-details error format, request/trace ids, pagination, or the rest of Section 15.3's full API-standards list — this slice's errors are Nest's default JSON exception shape.
- `GET /v1/loan-cases/:caseId` does not include the case's conditions, evidence, or workflow status inline (Section 15.1 lists those as separate endpoints — `.../conditions`, `.../evidence` — not yet built).
- No tenant-creation endpoint (see Decisions).
- Transactional outbox and signed status events (remaining M2 scope item) not started.

### Next safe step

Transactional outbox and signed status events — the last unimplemented item in M2's scope list — so workflow state changes (`workflow_run.started`, `condition.opened`, `condition.satisfied`, etc. from Section 15.4's event catalog) become durable, ordered, externally-deliverable events instead of only being inspectable by directly querying Postgres or Temporal.

## M2-006: Transactional outbox and signed status event foundation — closes Milestone 2

### Status

Implemented and verified, including a full hands-on pass through the real REST API and a real worker (not just automated tests): created a case, started its workflow, watched every expected event land with a valid signature at each step, resolved its condition, and confirmed the terminal events. Closes the "transactional outbox and signed status event foundation" scope item. This does **not** close Milestone 2 outright: the charter's M2 scope list (Section 20) also names "retry classification" as a distinct item, which remains deliberately deferred (same reasoning as M2-004's Known gaps — the simulator services have no distinct transient-vs-terminal error taxonomy to classify yet) and is unaffected by this slice. See Known gaps.

### Acceptance criterion

Every domain state change this codebase makes that other systems will eventually need to know about must be recorded as a durable, HMAC-signed event in the same database transaction as the change itself — so a committed state change and its event can never diverge, and the event's authenticity can be verified independently of trusting whoever stores or forwards it later.

### Problem

Case, evidence, and condition state changes were only ever visible by directly querying Postgres or Temporal's own workflow history. Nothing recorded *that a change happened* as a first-class, independently inspectable fact — which is what M4's webhook delivery, and any future audit or integration consumer, needs to build on. Two of the six activities in `case-conditions.activities.ts` also had a real, separate atomicity gap this work needed to fix before an outbox write could honestly be called "transactional": `evaluateConditions`'s discrepancy branch did a `LoanCondition` insert and a `LoanCase` status update as two independent, non-atomic statements (a crash between them would leave a condition with no case status update reflecting it), and `resolveCondition` had the same gap between its condition-status update and its `ConditionTransition` insert.

### Implementation

- `src/database/entities/outbox-event.entity.ts` — `OutboxEvent`: `tenantId`, `caseId`, `eventType`, `payload` (jsonb), `signature`, `createdAt`, `publishedAt` (nullable, stays null in this slice — no dispatcher exists yet, that's M4). Deliberately has no foreign key to `loan_cases`: an event log should survive changes to the aggregate's own lifecycle, unlike `evidence_facts`/`loan_conditions`, which correctly cascade-delete with their case.
- `src/database/outbox/outbox-signer.ts` — `signOutboxPayload`/`verifyOutboxSignature`, HMAC-SHA256 over a *canonicalized* (recursively key-sorted) serialization of the payload. The canonicalization is load-bearing, not defensive style: Postgres jsonb does not preserve object key order, so a signature computed from `JSON.stringify(payload)` at write time would not reliably match one recomputed from `JSON.stringify(reloadedPayload)` after a real round-trip through the database — verified empirically (see Verification) rather than assumed.
- `src/database/outbox/outbox-writer.ts` — `writeOutboxEvent(manager, secret, input)`: plain TypeORM, takes the `EntityManager` from an already-open transaction. Not a NestJS provider on purpose — it needs to work both from `src/workflows/case-conditions.activities.ts` (plain functions outside Nest's DI container, per M2-004's design) and from Nest-injected services (`CasesService`).
- `src/database/outbox/outbox-event-types.ts` — `OutboxEventType` constants for the subset of Section 15.4's catalog this codebase can honestly emit today: `loan_case.created`, `workflow_run.started`/`waiting_for_review`/`completed`, `evidence.updated`, `condition.opened`/`satisfied`/`waived`. Not emitted (see Known gaps): `workflow_run.waiting_for_information`, `workflow_run.failed`, `condition.escalated`, `review.completed` — nothing in this codebase produces those states yet.
- `src/workflows/case-conditions.activities.ts` — every activity now wraps its domain write(s) and outbox event(s) in one `dataSource.transaction()`. This is also where the two pre-existing atomicity gaps got fixed, as a direct consequence of doing the outbox correctly rather than as separate cleanup: `evaluateConditions`'s condition-insert + case-status-update, and `resolveCondition`'s condition-status-update + transition-insert, are now each one transaction. `evaluateConditions`'s discrepancy branch writes two events in the same transaction (`condition.opened` and `workflow_run.waiting_for_review`) since both are true simultaneously the moment a condition opens.
- `src/cases/cases.service.ts` — `createCase` now runs inside `dataSource.transaction()`, writing the `LoanCase` row and its `loan_case.created` event together; the existing idempotency logic (pre-check plus unique-violation catch) is unchanged, just now wraps a transaction instead of a single `save()`.
- `src/config/env.validation.ts` — `OUTBOX_SIGNING_SECRET`, validated (`@MinLength(16)`) with a documented dev-only default, same pattern as every other config value in this file.
- `src/database/migrations/1786817290551-OutboxEvents.ts` — generated against a scratch database with both prior migrations applied (established discipline); creates `outbox_events` and its `(tenantId, caseId)` index.
- `src/database/migrations/schema-migrations.spec.ts` — extended: `outbox_events` added to the post-migration table list, and a new revert-order test inserted first (since `undoLastMigration()` reverts most-recent-first).
- `src/worker.ts` — unrelated bugfix found while doing the manual end-to-end proof below (see Failures and resolution).
- `docs/PROJECT_CHARTER.md` — added `condition.waived` to the Section 15.4 event catalog (a real gap: the catalog had `condition.satisfied` but no counterpart for a reviewer *waiving* rather than the borrower *satisfying* a condition — only visible once something needed to emit the event for real); version 2.7 -> 2.8. Milestone table (Section 3) M2 status left as `Planned` — see Known gaps.

### Failures and resolution

- **`npm run start:worker:dev` was already broken, unrelated to this slice, discovered only because this slice's manual verification needed a real running worker for the first time since M2-004's own manual check**: `src/worker.ts` built `workflowsPath` as `join(__dirname, 'workflows', 'case-conditions.workflow.js')` — a hardcoded `.js` extension that only exists under the compiled `dist/` output. Running via `ts-node` directly (`start:worker:dev`, against `src/`) threw `ENOENT` immediately, since only the `.ts` file exists there. `npm run start:worker` (the compiled path, `node dist/worker`) was unaffected, which is presumably why this went uncaught: nothing in the automated test suite exercises `src/worker.ts`'s own entrypoint (`case-conditions.workflow.spec.ts` bypasses it entirely with its own `require.resolve('./case-conditions.workflow')`). Fixed by switching to that same `require.resolve` pattern, which correctly finds `.ts` under ts-node and `.js` under the compiled build.
- **First signature-canonicalization design was wrong until checked against a real database**: the initial version of `outbox-signer.ts` used a plain `JSON.stringify(payload)`. Before trusting it, ran `case-conditions.activities.spec.ts`'s `verifyOutboxSignature` assertions against a real Postgres `jsonb` column (not an in-memory object) — this is exactly the kind of case where an in-memory unit test would have passed while the real round-trip could plausibly fail depending on jsonb's internal key ordering, so canonicalization (recursively sorting object keys before serializing) was designed in from the start rather than discovered as a bug later; the empirical round-trip check confirms it actually holds, not just that the code looks right.

### Affected files

- `src/database/entities/outbox-event.entity.ts` (new)
- `src/database/outbox/outbox-signer.ts`, `outbox-signer.spec.ts`, `outbox-writer.ts`, `outbox-event-types.ts` (all new)
- `src/database/migrations/1786817290551-OutboxEvents.ts` (new); `schema-migrations.spec.ts`
- `src/database/database.module.ts`
- `src/workflows/case-conditions.activities.ts`, `case-conditions.activities.spec.ts`
- `src/cases/cases.service.ts`, `cases.service.spec.ts`
- `src/config/env.validation.ts`, `env.validation.spec.ts`
- `src/worker.ts`
- `docs/PROJECT_CHARTER.md`, `README.md`

### Decisions and alternatives

- **A global `OUTBOX_SIGNING_SECRET`, not a per-endpoint secret**: the full target design (Section 14.1's `webhook_endpoints.secretRef`) signs each webhook delivery with the *destination's own* secret, but that table doesn't exist yet (M4 scope) — there is no destination to have a secret. A single foundation-level secret proves the signing mechanism end-to-end now (every event is tamper-evident from the moment it's committed) without inventing per-endpoint infrastructure ahead of the feature that needs it; M4's dispatcher swaps the secret source, not the signing mechanism itself.
- **`OutboxEvent` has no foreign key to `loan_cases`**: every other case-scoped table (`evidence_facts`, `loan_conditions`) intentionally cascade-deletes with its case, because they're live business state owned by the case. An event log is different — it should outlive whatever happens to the case row it describes (matching how `audit_events`, Section 14.1, is described as append-only history, not case-owned state), so a future case-deletion or archival path can't silently take its own event history down with it.
- **Wrapping every activity write in `dataSource.transaction()` rather than adding a lighter-weight "just don't lose the outbox row" mechanism**: a true transactional outbox requires the state change and the event to be atomic, not merely both-attempted; the two pre-existing non-atomic multi-statement activities (see Problem) meant this slice had to introduce real transaction boundaries regardless, so extending that same boundary to include the outbox write was the direct, non-speculative way to do it — not an unrelated refactor bundled in.
- **Manual end-to-end verification through the real REST API + a real worker, not just the automated suites**: the automated tests (activities spec, service spec) each verify one layer in isolation with some collaborators mocked. The one thing neither proves is that the whole chain — REST request, DB transaction, Temporal signal, a second activity's transaction — produces the *right sequence* of events for a real case as it actually moves through every state. Running the real API and worker together and reading back all nine events against a synthetic discrepant case (matching the exact production code path) is the same standard of proof M2-004 used for the restart-survival guarantee.

### Verification

```text
npm run build / npm run lint:check   -> both passed

DATABASE_URL=... TEMPORAL_ADDRESS=localhost:7233 npm test -- --runInBand --no-cache --silent
  20 suites passed, 139 tests passed (19->20 suites, +1 new:
  outbox-signer.spec.ts [6 tests]; net +10 tests over M2-005's 129:
  +6 outbox-signer, +3 env.validation OUTBOX_SIGNING_SECRET coverage,
  +1 schema-migrations revert-order test)
  - case-conditions.activities.spec.ts: all 6 tests now also assert the
    correct outbox event(s) were written, including one that round-trips
    a real signature through a real jsonb column and independently
    verifies it (see Failures and resolution).
  - schema-migrations.spec.ts: outbox_events created/reverted correctly
    in the full cumulative migration sequence, in isolation from
    case/evidence/condition and loan_applications tables.

DATABASE_URL=... TEMPORAL_ADDRESS=localhost:7233 npm run test:e2e
  -> 2 suites passed, 13 tests passed (unchanged from M2-005 — this
     slice added no new e2e-suite-level behavior beyond what the
     manual end-to-end check below covers more thoroughly)

Manual end-to-end proof (real API process + real worker process,
scratchpad Temporal + the real dev Postgres database):
  1. Seeded a tenant directly, POSTed a case -> outbox has exactly one
     loan_case.created event, signature verifies.
  2. POSTed .../workflow-runs -> the real worker picks it up; polled
     the outbox and watched, in order: workflow_run.started,
     evidence.updated x3 (INCOME/CREDIT/DOCUMENT), then — because this
     run's synthetic data happened to be discrepant — condition.opened
     and workflow_run.waiting_for_review together (same transaction,
     confirmed by identical timestamps down to the same commit).
     Case status: CONDITIONS_OPEN.
  3. POSTed .../reviews (SATISFIED) -> condition.satisfied then
     workflow_run.completed. Case status: READY_FOR_UNDERWRITING.
  4. Independently recomputed and verified all 9 events' signatures
     against the values actually stored in Postgres (not the in-memory
     values from step 1-3) using OUTBOX_SIGNING_SECRET's default —
     every one verified; confirmed a wrong secret fails verification.
  5. Confirmed workflow bundle (webpack output) still includes only
     case-status.enum.ts, not any entity file — the M2-004 sandbox fix
     is unaffected by this slice's changes.
  Cleaned up the synthetic tenant/case/condition/outbox rows, the
  worker/API processes, and the scratchpad Temporal stack afterward.
```

### Security, privacy, cost, and compatibility

- `OUTBOX_SIGNING_SECRET`'s default is explicitly dev-only (documented in both `env.validation.ts` and `.env.example`); this slice has no deployment target yet, so there is nothing consuming these signatures in a security-relevant way today — the mechanism is proven correct, but a real deployment must set its own secret before the signatures mean anything.
- Outbox payloads currently include borrower-identifying fields (`borrowerId`, `requestedAmount`) in plaintext JSONB — acceptable for synthetic data with no deployment target, but the charter's data rules (Section 14.2: "Logs contain identifiers, classifications, and hashes instead of full borrower data") will need this revisited once a real dispatcher (M4) sends these events somewhere external.
- No new external dependency; the outbox table adds write volume proportional to case activity but no new cost driver (same Postgres instance).

### Known gaps

- No dispatcher: `publishedAt` stays `null` forever in this slice. Nothing reads `outbox_events` and delivers it anywhere — that is explicitly M4 scope (`webhook_endpoints`, `webhook_deliveries`, retries, replay protection).
- Four catalog event types are not emitted because nothing in this codebase produces the states they describe yet: `workflow_run.waiting_for_information` (no separate borrower-information wait state exists, only the reviewer wait), `workflow_run.failed` (no failure-classification path — same reasoning M2-004 used to defer retry classification), `condition.escalated` (no escalation path built), `review.completed` (no `review_tasks` table or formal review-task lifecycle exists; `condition.satisfied`/`condition.waived` are the accurate events for what actually happens today).
- **M2's "retry classification" scope item remains unimplemented** (not new to this slice — first identified as a gap in M2-004, restated as a deliberate decision there): Temporal's default uniform retry policy is used everywhere; there is no logic distinguishing retryable from terminal failures because the simulator services this codebase calls don't yet produce a failure taxonomy worth classifying. This is the one remaining item keeping M2 as a whole from being closeable — everything else in Section 20's M2 scope list is now built.
- Outbox payload contents are not yet privacy-reviewed for the plaintext-borrower-data concern noted above.

### Next safe step

M2's only remaining scope item is retry classification, and it is currently blocked on not having a real failure taxonomy to classify (no non-synthetic provider integration exists yet — that's M4 scope). Two honest paths forward: (a) treat M2 as closeable now with retry classification explicitly re-scoped into M4 alongside the real provider gateway that would finally give it something real to classify, or (b) build a synthetic failure taxonomy now purely to close M2 on paper. (a) reflects what's actually true about this codebase; (b) would be scope invented to satisfy a checklist. Recommend (a), but this is a call for the user, not one to make silently — ask before touching the milestone table. Once resolved, proceed to M3 ("Policy and Agent vertical slice") per the user's earlier direction to continue through M3-M7.

## M2-007: Synthetic retry classification — closes Milestone 2

### Status

Implemented and verified, including a hands-on run through the real REST API and a real worker for both classifications: a terminal-failure case reached `MANUAL_REVIEW` after exactly one attempt per activity; a transient-failure case retried three times each (matching the workflow's configured policy) before reaching the same state. The user explicitly chose option (b) from M2-006's Next-safe-step decision — build a synthetic failure taxonomy now — over the recommended (a) (defer to M4). This closes M2's last open scope item; Milestone 2 ("Durable loan case, evidence, and condition workflow") is now `Implemented` in the charter's milestone table (Section 3).

### Acceptance criterion

`case-conditions.activities.ts`'s evidence-fetch activities must classify provider failures into at least two categories — retryable and non-retryable — and Temporal's actual retry behavior must observably differ between them (a retryable failure consumes the configured retry budget; a non-retryable one does not), with an unrecoverable failure of either kind routing the case to a reviewable terminal state rather than crashing the workflow.

### Problem

No real provider integration exists in this codebase to observe genuine failure modes from (rate limits, malformed responses, timeouts) — every provider call today is one of three in-process simulators that always succeed. M2-004 and M2-006 both deferred retry classification for exactly this reason: building a taxonomy for failures that can't happen yet would be speculative. The user's direction changed that trade-off — closing M2 now was judged more valuable than waiting for M4's real provider gateway to supply genuine failure modes to classify.

### Implementation

- `src/integrations/synthetic-provider-failures.ts` — deterministic fault injection, mirroring `hasSyntheticDiscrepancy`'s pattern: a `borrowerId` prefix (`SYNTHETIC-TRANSIENT-FAILURE-` / `SYNTHETIC-TERMINAL-FAILURE-`) triggers `SyntheticProviderTimeoutError` / `SyntheticProviderRejectionError`. Deliberately provider-agnostic and Temporal-unaware — it only simulates what a raw provider failure looks like, shared by all three simulators, which are also used by the older `evaluateLoan` GraphQL path via `AgentService` and must keep working unmodified for callers that never pass a synthetic-prefixed id.
- `src/integrations/plaid/plaid.service.ts`, `credit/credit.service.ts`, `document/document.service.ts` — each calls `maybeThrowSyntheticProviderFailure(borrowerId, providerName)` before generating data.
- `src/workflows/case-conditions.activities.ts` — `callProviderWithRetryClassification(fn, providerName)`: the actual classification intelligence, kept here rather than in the simulators because activities are where provider outcomes get interpreted and normalized (Section 12.2). Catches `SyntheticProviderRejectionError`/`SyntheticProviderTimeoutError` and rethrows as `ApplicationFailure.nonRetryable(...)` / `ApplicationFailure.retryable(...)` (from `@temporalio/activity`) — `nonRetryable()` forces Temporal to stop after one attempt regardless of the workflow's retry policy. An unrecognized error is rethrown unchanged rather than guessed at. Wraps all three fetch activities' provider calls.
- `src/workflows/case-conditions.activities.ts` — new `markManualReview` activity: transactionally sets `CaseStatus.MANUAL_REVIEW` and writes a `workflow_run.failed` outbox event with the failure reason, same transactional-outbox pattern as every other activity (M2-006).
- `src/workflows/case-conditions.workflow.ts` — the evidence-fetch `Promise.all` is now wrapped in try/catch; an unrecoverable rejection (retries exhausted, or an immediate non-retryable failure) calls `markManualReview` and returns `{ finalStatus: CaseStatus.MANUAL_REVIEW }` instead of letting the workflow fail outright — mirrors Section 9.5's Agent-loop "budget or runtime failure: route to manual review" pattern, applied here at the workflow level.
- `src/database/outbox/outbox-event-types.ts` — added `WorkflowRunFailed` (`workflow_run.failed`), the last Section 15.4 event this codebase now has a real producer for among the ones M2-006 called out as not yet emitted.
- `docs/PROJECT_CHARTER.md` — Milestone table (Section 3): M2 `Planned` -> `Implemented`. Version 2.8 -> 2.9.

### Failures and resolution

- None specific to this slice — build, lint, and every automated suite passed on first full run after implementation. The one thing worth recording as a design check rather than a failure: initially considered having the *simulators* count attempts (via `@temporalio/activity`'s `Context.current().info.attempt`) so a transient failure could succeed on, say, the 3rd try. Rejected before writing it: `Context.current()` is only valid inside a real Temporal activity execution, and these simulators are shared with the plain NestJS `evaluateLoan` path (via `AgentService`), which never runs inside one — calling it unconditionally would have broken that path for any borrowerId, not just synthetic-failure ones. The simpler, safer design (simulators always fail consistently for a given synthetic borrowerId; Temporal's own retry engine is what actually varies) avoids the problem entirely and is what's implemented.

### Affected files

- `src/integrations/synthetic-provider-failures.ts` (new)
- `src/integrations/plaid/plaid.service.ts`, `plaid.service.spec.ts`
- `src/integrations/credit/credit.service.ts`, `credit.service.spec.ts`
- `src/integrations/document/document.service.ts`, `document.service.spec.ts`
- `src/workflows/case-conditions.activities.ts`, `case-conditions.activities.spec.ts`
- `src/workflows/case-conditions.workflow.ts`, `case-conditions.workflow.spec.ts`
- `src/database/outbox/outbox-event-types.ts`
- `docs/PROJECT_CHARTER.md`, `README.md`

### Decisions and alternatives

- **Classification via `ApplicationFailure.nonRetryable()`/`.retryable()` thrown from the activity, not a `nonRetryableErrorTypes` list on the workflow's `proxyActivities` retry policy**: the SDK docs are explicit that `nonRetryable()` forces no-retry "even if type is not listed in RetryPolicy.nonRetryableErrorTypes" — classifying at the throw site keeps the decision co-located with the code that actually knows why the call failed, rather than requiring the workflow to maintain a name-matching list in sync with every error type an activity might ever throw.
- **One shared `borrowerId` prefix triggers failure in all three simulators simultaneously, not one flag per provider**: the workflow's three fetch activities already run via a single `Promise.all` over the same `borrowerId` — a synthetic case marked for failure-testing failing across all evidence sources at once is the simpler, still-realistic scenario, and per-provider flags would need a request shape change (separate synthetic ids per evidence type) for no proven testing benefit yet.
- **Workflow catches the `Promise.all` rejection and returns a result, rather than letting Temporal mark the workflow `Failed`**: `MANUAL_REVIEW` is an existing, planned `CaseStatus` value, not an error state — a human can still act on a case in this state, so treating it as a graceful business outcome (a normal workflow completion) rather than an infrastructure failure matches how the rest of this codebase already treats "needs a human" states (`CONDITIONS_OPEN` durably waits for a reviewer the same way).
- **Closing M2 now, per explicit user direction, over the initially recommended defer-to-M4 path**: recorded here because the earlier entry (M2-006) explicitly laid out both options and a recommendation — this entry is the record of which one was actually chosen and why the trade-off changed (the user's own priority, not new technical information).

### Verification

```text
npm run build / npm run lint:check   -> both passed

DATABASE_URL=... TEMPORAL_ADDRESS=localhost:7233 npm test -- --runInBand --no-cache --silent
  20 suites passed, 151 tests passed (net +12 over M2-006's 139, no new
  suites — all added to existing spec files):
  - plaid/credit/document .service.spec.ts: +2 tests each (6 total) —
    each simulator throws the correct synthetic error class for its
    trigger prefix.
  - case-conditions.activities.spec.ts: +4 tests — markManualReview's
    DB/outbox effect; real PlaidService/CreditService/DocumentService
    (not mocks) prove the full chain throws a correctly-shaped
    ApplicationFailure for both synthetic failure kinds; an
    unrecognized error is left unclassified.
  - case-conditions.workflow.spec.ts: +2 tests, against a real Temporal
    server — a retryable mock activity is called exactly 3 times
    (matching maximumAttempts) before the workflow returns
    MANUAL_REVIEW; a non-retryable one is called exactly once.

DATABASE_URL=... TEMPORAL_ADDRESS=localhost:7233 npm run test:e2e
  -> 2 suites passed, 13 tests passed (unchanged — no REST-layer
     behavior changed in this slice)

Manual end-to-end proof (real API + real worker process, scratchpad
Temporal + the real dev Postgres database):
  Terminal case (SYNTHETIC-TERMINAL-FAILURE- borrowerId): POSTed case
  and workflow-runs; worker log shows all three fetch activities
  failing at attempt: 1 (no retries wasted); case reached
  MANUAL_REVIEW; outbox has loan_case.created, workflow_run.started,
  workflow_run.failed, all independently signature-verified.
  Transient case (SYNTHETIC-TRANSIENT-FAILURE- borrowerId): same
  sequence, worker log shows attempt: 1, 2, 3 for each fetch activity
  (exponential backoff, matching the 1s/2s/4s-capped policy) before
  the workflow gave up and reached MANUAL_REVIEW; outbox events
  verified the same way.
  Cleaned up synthetic tenant/case/outbox rows, both processes, and
  the scratchpad Temporal stack afterward.
```

### Security, privacy, cost, and compatibility

- No new externally-reachable behavior: the synthetic-failure trigger is a `borrowerId` string prefix, reachable the same way any other borrowerId is (via `POST /v1/loan-cases`) — no new endpoint or capability, and no realistic borrowerId would collide with the reserved prefixes.
- `markManualReview`'s outbox payload includes the raw error's `String(error)` as `reason` — currently always a synthetic, non-borrower-identifying message (`ActivityFailure: Activity task failed` at the workflow layer, per Temporal's own wrapping); worth re-checking once real provider errors exist, in case a real provider ever echoes request data back in an error message.
- No new dependency; `ApplicationFailure` is already part of the installed `@temporalio/activity` package.

### Known gaps

- Still synthetic: this proves the retry-classification *mechanism* works correctly, not that its classification (which failures are "transient" vs "terminal") matches how a real Plaid/credit-bureau/IDP vendor's errors actually behave — that mapping is real M4 work once real adapters exist.
- The richer target retry model (Section 11.5: `OUTCOME_UNKNOWN` reconciliation, pre-dispatch vs. post-dispatch failure, cost-bearing/consumer-impacting effect classes, cross-provider fallback authorization) is unaddressed — that is explicitly M4 (provider gateway) scope, not something this M2 vertical slice's activities were ever meant to carry.
- `workflow_run.failed`'s `reason` payload is Temporal's own wrapped error string, not a structured classification (e.g. `{ activityType, failureType, attempts }`) — sufficient for this slice's proof, but a real operations console (M6) would likely want more structure.

### Next safe step

M2 is closed. Begin M3 ("Policy and Agent vertical slice") per the user's earlier direction to continue through M3-M7: policy source registry, jurisdiction catalog, the policy DSL parser/validator/evaluator, and the `AgentRuntime` port with a LangGraph.js v1 adapter.

## M3-001: Jurisdiction and policy-source-registry schema

### Status

Implemented and verified. This is the first of many M3 slices — M3's own scope list (Section 20) is, by a wide margin, the largest of any milestone in this charter (bitemporal policy resolution with dependency-vector invalidation, immutable evaluation manifests, an `AgentRuntime`/LangGraph.js port, budget ledgers, communication classification, reviewer interrupt/resume). Attempting it in one slice would repeat the mistake M2 avoided by going M2-001 through M2-007; this entry only closes the schema foundation, mirroring how M2-001 was schema-only before any workflow executed against it. Milestone table (Section 3) stays `Planned` — nowhere close to closeable yet.

### Acceptance criterion

The platform must be able to durably represent, with real provenance, an authorized jurisdiction hierarchy and a versioned, immutable policy rule with typed applicability — concretely: persist the charter's own Section 10.7 example rule (`synthetic-income-discrepancy-review`) through a full chain from jurisdiction to source to source revision to policy version to applicability scope, and read it back unchanged.

### Implementation

- `src/database/enums/jurisdiction.enum.ts` — `JurisdictionLevel` (FEDERAL/STATE/LOCAL), `JurisdictionCoverageStatus` (COVERED/PARTIAL/NOT_COVERED, defaulting to NOT_COVERED — Section 10.6: coverage is an explicit, reviewed fact, never an implicit default).
- `src/database/enums/policy-source.enum.ts` — `PolicySourceRetrievalMode` (SYNTHETIC/MANUAL/CONNECTOR; only SYNTHETIC is actually used yet, per Section 10.6's "initial launch uses curated synthetic policy sources").
- `src/database/enums/policy-version.enum.ts` — `PolicyReleaseStatus` (DRAFT/PROPOSED/RELEASED/SUPERSEDED/WITHDRAWN/CORRECTED), matching Section 10.2's lifecycle verbs.
- `src/database/entities/jurisdiction.entity.ts` — `Jurisdiction`, keyed by its stable code (e.g. `"US-CA"`) rather than a generated uuid, with a self-referencing `parentCode` for the hierarchy (Section 10.1: "jurisdiction codes and jurisdiction level").
- `src/database/entities/policy-source.entity.ts` — `PolicySource`: authorized source registry (owner, jurisdiction, retrieval mode, freshness objective).
- `src/database/entities/policy-source-revision.entity.ts` — `PolicySourceRevision`: immutable retrieved-content record, bitemporal (`publishedAt` = source's own valid time, `recordedAt` = platform system time).
- `src/database/entities/policy-version.entity.ts` — `PolicyVersion`: the immutable versioned DSL rule itself, unique on `(ruleId, version)`, with `supersedesVersionId` giving a correction an explicit relationship back to the record it replaces rather than mutating it (Section 10.8: "Policy identifiers and released versions are immutable").
- `src/database/entities/policy-applicability.entity.ts` — `PolicyApplicability`: typed scope (jurisdiction, product, program, lifecycle event, transition rule) for one policy version.
- All five enums placed in `src/database/enums/`, not inline in entity files, proactively — not because anything imports them into a Temporal-sandboxed workflow yet, but because M2-004's sandbox surprise (an inline enum pulling in TypeORM decorator machinery when a workflow needed it) showed that retrofitting this split later is exactly the kind of thing worth not having to redo.
- `src/database/migrations/1786825196434-PolicySchema.ts` — generated against a scratch database with all four prior migrations applied (established discipline).
- `src/database/migrations/schema-migrations.spec.ts` — extended: 5 new tables and 5 new foreign keys (self-referencing `jurisdictions.parentCode`, plus the `policy_sources -> jurisdictions -> policy_source_revisions -> policy_versions -> policy_applicability` chain) added to the post-migration assertions; a new revert-order test inserted first.
- `src/database/entities/policy-schema.spec.ts` — new integration test: persists the literal Section 10.7 example DSL through the full chain (federal jurisdiction, CA jurisdiction as its child, a synthetic policy source, a source revision, a RELEASED policy version carrying that exact DSL as its jsonb payload, and its applicability row), then re-reads everything through fresh queries — not the in-memory objects just created — and confirms the `(ruleId, version)` uniqueness constraint actually rejects a duplicate.

### Affected files

- `src/database/enums/jurisdiction.enum.ts`, `policy-source.enum.ts`, `policy-version.enum.ts` (new)
- `src/database/entities/jurisdiction.entity.ts`, `policy-source.entity.ts`, `policy-source-revision.entity.ts`, `policy-version.entity.ts`, `policy-applicability.entity.ts` (new)
- `src/database/entities/policy-schema.spec.ts` (new)
- `src/database/migrations/1786825196434-PolicySchema.ts` (new); `schema-migrations.spec.ts`
- `src/database/database.module.ts`

### Decisions and alternatives

- **No `tenant_id` on any of these five tables**: Section 10.1 describes the policy catalog as composable across federal, state/local, product/program, *and* tenant operating-policy layers — implying the catalog itself (at least its federal/state/product layers) is shared platform infrastructure that different tenants' cases draw from, not partitioned per tenant. The charter's own Section 10.7 example carries no tenant reference. A tenant-scoped "tenant operating policy" layer is real, deferred scope (part of the not-yet-built `policy_packs` composability), not an oversight.
- **`PolicyApplicability` kept as a separate table, one row per policy version, not inline columns on `PolicyVersion`**: the target resolver (Section 10.3) matches a case's context against jurisdiction/product/program/lifecycle-event dimensions independently; keeping applicability separate now costs nothing and avoids having to split it out later once the resolver needs to query across it directly (`IDX_policy_applicability_lookup` on `(jurisdictionCode, productCode, lifecycleEvent)` already anticipates that access pattern).
- **`Jurisdiction.code` as primary key, not a generated uuid**: jurisdiction codes are the stable, human-meaningful identifiers every other policy record's applicability metadata references (`"US-CA"` in the Section 10.7 example) — a surrogate uuid would just be an extra join for no benefit, and codes are exactly the kind of small, curated reference data where a natural key is appropriate.
- **This slice stops at schema — no DSL parser, validator, evaluator, or resolver**: those are each substantial, independently testable pieces (Section 20: "policy DSL parser, validator, evaluator, immutable versions, and golden tests" is its own scope line, separate from the registry/catalog line this slice closes). Building them against a schema that doesn't exist yet, or building the schema without proving it can hold the real example DSL, would each be the wrong order.

### Verification

```text
npm run build / npm run lint:check   -> both passed

DATABASE_URL=... TEMPORAL_ADDRESS=localhost:7233 npm test -- --runInBand --no-cache --silent
  21 suites passed, 153 tests passed (20->21 suites, +1 new:
  policy-schema.spec.ts; net +2 tests over M2-007's 151: the new
  provenance-chain test, and schema-migrations.spec.ts's new revert-
  order test)

DATABASE_URL=... TEMPORAL_ADDRESS=localhost:7233 npm run test:e2e
  -> 2 suites passed, 13 tests passed (unchanged — no REST-layer
     behavior touched in this slice)

Confirmed via direct query that policy-schema.spec.ts's afterAll left
no leftover jurisdiction/policy rows in the real dev database.

Migration apply/revert both verified against a disposable scratch
database via schema-migrations.spec.ts, same discipline as every
prior migration this session.
```

### Security, privacy, cost, and compatibility

- No new externally-reachable surface — these tables have no REST/GraphQL entry point yet, only direct repository access proven by the integration test.
- No borrower or tenant data in this schema at all — jurisdiction/policy content is regulatory/reference data, not personal data, so none of the retention/deletion-lineage rules (Section 14.2) apply to it the way they do to evidence or documents.
- No new dependency; no new cost.

### Known gaps

- No DSL parser/validator/evaluator — `PolicyVersion.dsl` is opaque jsonb from this schema's point of view; nothing yet checks it's well-formed beyond being valid JSON.
- No applicability resolver (Section 10.3), no `CasePolicySnapshot`, no policy-binding validation guard (Section 10.4), no evaluation input manifest (Section 10.5) — the entire "deterministic applicability resolution" and "efficient mandatory validation" machinery is unbuilt.
- No REST/GraphQL surface for managing policy sources, revisions, or versions — everything in this slice is reachable only via direct repository/entity access, same as `LoanCase` was after M2-001 before the workflow and REST layers arrived in later slices.
- No connection yet between this schema and the M2 case-conditions workflow's `hasSyntheticDiscrepancy` rule — that rule remains its own hardcoded logic, not yet expressed as a policy version row. Wiring the two together is real future work, not assumed done.

### Next safe step

Policy DSL parser and validator: a pure, framework-agnostic module that turns the Section 10.7 YAML/JSON shape into a validated in-memory structure (schema, types, unit/reference checks) with golden tests — the next named M3 scope line, and a natural next step now that the schema exists to eventually persist validated output into.

## M3-002: Policy DSL parser, validator, and evaluator

### Status

Implemented and verified with golden tests. Closes the "policy DSL parser, validator, evaluator, immutable versions, and golden tests" scope line's parser/validator/evaluator portion (immutable versions were already closed by M3-001's schema). Pure TypeScript, no database or Temporal dependency — fast, deterministic, framework-agnostic.

### Acceptance criterion

The platform must be able to parse the charter's own Section 10.7 example DSL document into a typed, validated structure — rejecting a malformed document with every problem listed at once, not just the first — and deterministically evaluate it against a fact context to the correct matched/not-matched outcome, including the same input always producing the same result (Section 20 M3 exit evidence: "repeated versioned inputs produce the same policy result").

### Implementation

- `src/policy/dsl/policy-rule.types.ts` — `PolicyRuleDocument`, `PolicyRuleApplicability`, `PolicyRuleCondition` (a discriminated union with one member so far, `DifferencePercentCondition` — matching the one operator the charter's DSL example actually shows; adding a second is an additive union member, not a rewrite), `PolicyFactContext`, `PolicyEvaluationOutcome`.
- `src/policy/dsl/policy-rule-parser.ts` — `parsePolicyRule(raw: unknown): PolicyRuleDocument`. Validates and normalizes the DSL's snake_case source shape (`lifecycle_events`, `effective_from`, `greater_than`, etc.) into the camelCase internal type. Collects every validation issue before throwing `PolicyDslValidationError` (same "list every problem at once" discipline as `env.validation.ts`), rather than stopping at the first bad field.
- `src/policy/dsl/policy-rule-evaluator.ts` — `evaluatePolicyRule(rule, context): PolicyEvaluationOutcome`. Resolves `left`/`right` fact paths (e.g. `"application.monthly_income"`) by plain object navigation, not `eval`/`Function()` — policy content is authored/reviewed data, not trusted code (Section 9.7's "no arbitrary... code execution" applies here too, not just to the Agent). Computes `difference_percent` as `abs(right - left) / abs(left) * 100`, matched when strictly greater than the rule's threshold.
- `src/policy/dsl/policy-rule-parser.spec.ts`, `policy-rule-evaluator.spec.ts` — golden tests using the literal Section 10.7 example, plus malformed-input and edge-case coverage (missing/non-numeric facts, zero-denominator, exact-threshold boundary).

### Affected files

- `src/policy/dsl/policy-rule.types.ts`, `policy-rule-parser.ts`, `policy-rule-evaluator.ts` (all new)
- `src/policy/dsl/policy-rule-parser.spec.ts`, `policy-rule-evaluator.spec.ts` (new)

### Decisions and alternatives

- **`difference_percent` uses absolute difference, not signed**: the charter's example (`left: application.monthly_income, right: evidence.verified_monthly_income, greater_than: 10`) doesn't specify the formula, and "the borrower's stated income differs from verified income" is a discrepancy worth reviewing whether they over- or under-stated it — a signed-only check would miss half the real cases this rule exists to catch. Recorded here as a judgment call, not implied by the charter text.
- **Exactly one condition operator supported (`difference_percent`), modeled as a union rather than a hardcoded single shape**: the charter gives no second example to generalize from, so inventing more operators now would be speculative (violates "no abstractions beyond what's needed"). The union type and the parser's operator-key dispatch are the minimal honest shape of "a DSL with one operator today, room for a second tomorrow" — not a pre-built plugin registry with nothing plugged into it.
- **Fact-path resolution by plain object navigation, not a real expression-evaluation library**: the DSL's `left`/`right` are simple dot-paths (`"application.monthly_income"`), not arbitrary expressions — a general expression engine would be more machinery than this shape needs, and would reopen exactly the "arbitrary code execution over untrusted content" risk Section 9.7 is written to close off.
- **Missing or non-numeric facts, and a zero left-hand value, both resolve to `matched: false` with an explanatory reason, not a thrown error**: an inconclusive evaluation isn't the same failure mode as a malformed rule (which does throw, at parse time). Section 10.8's "fails closed" spirit means an ambiguous evaluation should not silently match and create a condition — returning a non-match with a clear reason keeps the caller (a future policy-evaluation service) able to distinguish "this case doesn't need the condition" from "this rule couldn't be evaluated," which is a real distinction the not-yet-built resolver will need.
- **This slice evaluates one rule in isolation — no resolver, no snapshot, no binding guard**: Section 10.3's applicability resolver (selecting *which* released rule(s) apply to a case) is separate, larger scope with its own bitemporal and dependency-generation machinery; building it before the DSL it resolves against actually exists and is testable would be the wrong order.

### Verification

```text
npm run build / npm run lint:check   -> both passed
npx jest src/policy --no-coverage
  2 suites passed, 16 tests passed (parser: 9, evaluator: 7)
  No database or Temporal dependency — pure unit tests, always run.
```

### Security, privacy, cost, and compatibility

- No new externally-reachable surface — this module has no REST/GraphQL entry point yet.
- Deliberately avoids `eval`/`Function()`/any dynamic-code-execution path for evaluating policy content, since policy rules may eventually be authored or ingested from less-trusted sources (Section 10.6's future connectors) — the fact-path-navigation design means a malicious or malformed rule string can produce a validation error or a non-match, never code execution.
- No new dependency; no new cost.

### Known gaps

- No connection to `PolicyVersion.dsl` yet — nothing reads a persisted `PolicyVersion` row, parses its `dsl` jsonb, and evaluates it; this module works against a raw object handed to it directly, proven only by the golden tests' inline fixtures.
- No applicability resolver (Section 10.3), so nothing yet selects which policy version(s) apply to a given case.
- No connection to the M2 case-conditions workflow's `hasSyntheticDiscrepancy` — that hardcoded rule remains unreplaced (same gap noted in M3-001).
- Only one condition operator exists; the charter's own policy invariants (Section 10.8: "units, money, ratios, dates, and rounding behavior are explicit") imply richer operators will eventually be needed (e.g. absolute thresholds, ratio comparisons) — not built until a real second example motivates them.

### Next safe step

Wire `PolicyVersion.dsl` to this parser/evaluator: a small service that loads a released `PolicyVersion` row, parses it once, and evaluates it against a fact context — the first real integration between the M3-001 schema and this slice's pure logic, and a necessary building block before the applicability resolver (Section 10.3) can select *which* version to load in the first place.

## M3-003: Policy applicability resolver

### Status

Implemented and verified. A real, but deliberately simplified, implementation of Section 10.3's applicability resolver — closes the "bitemporal applicability resolver" portion of that M3 scope line (the "immutable case policy snapshots" portion is not yet built — this returns its result in-memory, nothing is persisted as a storable snapshot yet). First real consumer of both the M3-001 schema and the M3-002 DSL parser together.

### Acceptance criterion

Given a jurisdiction, product, lifecycle event, and a point in time, the platform must select every released, currently-effective policy version that applies — and fail closed to a distinct `REVIEW_REQUIRED` outcome (never silently guess) when jurisdiction coverage is missing/incomplete or when two released versions of the same rule are simultaneously effective, matching Section 10.3: "the system never asks the model to guess."

### Implementation

- `src/policy/policy-resolution.types.ts` — `PolicyResolutionContext` (jurisdiction/product/lifecycle-event/asOf — a simplified stand-in for Section 10.3's much larger interface), `ResolvedPolicyVersionRef`, `PolicyResolutionResult` (`RESOLVED` | `REVIEW_REQUIRED`, matching versions, unresolved reasons).
- `src/policy/policy-applicability-resolver.service.ts` — `PolicyApplicabilityResolverService.resolve(context)`:
  1. Looks up the jurisdiction; anything other than `COVERED` fails closed to `REVIEW_REQUIRED` (Section 10.6: "If declared jurisdiction coverage is incomplete ... validation stops and routes to review").
  2. Finds `PolicyApplicability` rows matching jurisdiction/product/lifecycle-event exactly.
  3. Filters to `PolicyVersion` rows that are `RELEASED` and whose `[effectiveFrom, effectiveTo)` window covers `asOf`.
  4. Groups survivors by `ruleId`; more than one simultaneously-effective released version of the *same* rule is an unresolved precedence conflict — `REVIEW_REQUIRED`, not "pick the newest" (Section 10.3: "overlapping versions ... produces REVIEW_REQUIRED").
  5. Otherwise `RESOLVED`, with each matched version's `dsl` parsed via M3-002's `parsePolicyRule` before being returned — a resolved reference always carries an already-validated rule, not raw jsonb.
- `src/policy/policy.module.ts` — new `PolicyModule`, registers the five M3-001 entities via `TypeOrmModule.forFeature` and exports the resolver service; wired into `AppModule` directly (same pattern as `IntegrationsModule`/`AgentModule` — a module providing services with no controller of its own yet).
- `src/policy/policy-applicability-resolver.service.spec.ts` — real-database integration tests (gated on `DATABASE_URL`, same convention as every other DB-backed suite): single match resolves correctly with a parsed rule; an unrelated lifecycle event resolves to zero matches without being `REVIEW_REQUIRED` (a real "no applicable rules" outcome is not a failure); future-`effectiveFrom`, past-`effectiveTo`, and `DRAFT` versions are all correctly excluded; two overlapping released versions of the same rule and an uncovered/partially-covered jurisdiction both fail closed to `REVIEW_REQUIRED`.

### Affected files

- `src/policy/policy-resolution.types.ts`, `policy-applicability-resolver.service.ts`, `policy.module.ts` (all new)
- `src/policy/policy-applicability-resolver.service.spec.ts` (new)
- `src/app.module.ts`

### Decisions and alternatives

- **Exact jurisdiction-code match only, no ancestry walk**: Section 10.1 describes jurisdiction ancestry (a case in `US-CA` should also pick up a `US`-level federal rule) as part of the full target resolver. Implementing that correctly needs the jurisdiction hierarchy to be walked and reasoned about per-rule, which is real additional scope on top of what this slice proves (the effective-window and overlap-detection logic). Recorded as a Known gap, not silently skipped — a resolver that only matches exact jurisdiction codes will under-match relative to the target design, never over-match, so it fails closed in the same spirit even while incomplete.
- **In-memory result, no persisted `CasePolicySnapshot`**: Section 10.3's snapshot is immutable, storable, and referenced by later binding-validation logic (Section 10.4) — building persistence for it before anything needs to read a stored snapshot back would be speculative. This slice's `PolicyResolutionResult` is the right shape to eventually wrap in a persisted snapshot, not a dead end.
- **Overlap detection groups by `ruleId`, not by applicability row**: two *different* rules both applying to the same case at once is normal and expected (Section 10.3's snapshot holds an array of versions) — the ambiguity that must fail closed is specifically two versions *of the same rule* disagreeing about which one is in effect right now.
- **`PolicyApplicabilityResolverService` is a real `@Injectable()` NestJS service (DI, `@InjectRepository`), not a plain factory function**: unlike `case-conditions.activities.ts`'s activities (which deliberately avoid Nest DI because they run inside a Temporal worker with no DI container), this resolver has no such constraint yet — nothing in this slice runs it from inside a workflow/activity — so it follows the same DI pattern as `PlaidService`/`CasesService`. If a future slice needs to call it from an activity, that activity would receive it the same way `case-conditions.activities.ts` already receives `PlaidService` et al.: constructed once and passed in as a dependency, not re-architected.

### Verification

```text
npm run build / npm run lint:check   -> both passed

DATABASE_URL=... TEMPORAL_ADDRESS=localhost:7233 npm test -- --runInBand --no-cache --silent
  24 suites passed, 177 tests passed (23->24 suites, +1 new:
  policy-applicability-resolver.service.spec.ts [8 tests]; net +8
  tests over M3-002's 169)

DATABASE_URL=... TEMPORAL_ADDRESS=localhost:7233 npm run test:e2e
  -> 2 suites passed, 13 tests passed — confirms AppModule still boots
     correctly with PolicyModule wired in (unaffected otherwise, no
     REST/GraphQL surface added)

Confirmed via direct query that the resolver spec's afterAll left no
leftover jurisdiction/policy rows in the real dev database.
```

### Security, privacy, cost, and compatibility

- No new externally-reachable surface — `PolicyApplicabilityResolverService` has no REST/GraphQL entry point yet, reachable only via direct injection/construction (proven by the integration test).
- No borrower or tenant data involved — same reasoning as M3-001.
- No new dependency; no new cost.

### Known gaps

- No jurisdiction-ancestry walk (see Decisions) — a rule scoped to a parent jurisdiction (e.g. federal `US`) will not be picked up for a case in a child jurisdiction (e.g. `US-CA`) yet.
- No grandfathering/transition-rule evaluation — `PolicyApplicability.transitionRule` and `PolicyVersion.supersedesVersionId` are persisted but nothing reads them to decide `CURRENT` vs `GRANDFATHERED` treatment for an open case (Section 10.3's `applicabilityDecision` field).
- No dependency-generation fast-path validation (Section 10.4) — every call to `resolve()` does full resolution; there is no bounded "is my existing binding still valid" check yet, and therefore nothing to invalidate on policy activation either.
- No persisted `CasePolicySnapshot` — the result is returned in-memory only, so nothing yet stores which snapshot a case's evaluation was bound to.
- Still no connection to the M2 case-conditions workflow's `hasSyntheticDiscrepancy` (same gap carried from M3-001/M3-002).

### Next safe step

Two roughly-equal-sized options going into the next slice: (a) build the immutable `CasePolicySnapshot` persistence and the Section 10.4 binding-validation guard on top of this resolver, or (b) wire this resolver + the M3-002 evaluator into the M2 case-conditions workflow, replacing `hasSyntheticDiscrepancy` with a real policy-driven decision — the latter proves the whole M2-M3 integration end-to-end sooner and is probably higher-value before investing further in policy-internal machinery nothing outside this module exercises yet.

## M3-004: Wire the policy engine into the M2 workflow, replacing the synthetic discrepancy rule

### Status

Implemented and verified, including a full hands-on run through the real REST API and a real worker: a case with a genuine income discrepancy opened a condition whose code, description, and reasoning trace all came from the charter's own Section 10.7 example rule (not a hardcoded string); a case with matching stated/verified income went straight to `READY_FOR_UNDERWRITING`; an unrecognized jurisdiction was rejected by the REST layer before ever reaching the workflow. Chosen directly by the user over the recommended alternative (persisting `CasePolicySnapshot`/binding-guard machinery before anything outside the policy module used it) — real user direction: "design should match the charter, and match reality," i.e. make the M2 workflow actually run on the charter's own canonical policy example rather than continuing to defer that integration.

### Acceptance criterion

The M2 case-conditions workflow's decision to open a condition must be made by the M3 policy engine (resolver + evaluator), not the M2-launch `hasSyntheticDiscrepancy` stand-in — using the charter's own Section 10.7 example rule as real, seeded, evaluable policy content, reachable end-to-end from a real REST request through a real Temporal worker.

### Problem (carried over from M3-003's status update)

The charter's own canonical DSL example (Section 10.7) compares a borrower's *stated* income against *verified* income — a fact pair that didn't exist anywhere in the M2 schema (`LoanCase` had no stated-income field, and no jurisdiction concept at all). `hasSyntheticDiscrepancy`'s actual gate was credit/document thresholds, unrelated to the charter's own flagship example. Wiring the two together honestly required adding real schema, not reshaping the DSL example to fit what already existed.

### Implementation

- `src/database/entities/loan-case.entity.ts` — two new columns: `statedMonthlyIncome` (decimal, the borrower's declared figure — Section 10.7's `application.monthly_income`) and `jurisdictionCode` (varchar, FK to `jurisdictions.code`, `RESTRICT`). A real mortgage application collects both; this schema had neither.
- `src/database/migrations/1786910916794-LoanCaseIncomeAndJurisdiction.ts` — the schema migration (generated, verified apply/revert against a scratch database, same discipline as every prior migration).
- `src/database/migrations/1786910931703-SeedIncomeDiscrepancyPolicy.ts` — a hand-written **data** migration (not generated — no entity diff produces seed rows) inserting: `US` (FEDERAL) and `US-CA` (STATE, child of `US`, both `COVERED`); a `SYNTHETIC` policy source scoped to `US-CA`; a source revision; a `RELEASED` `PolicyVersion` carrying the Section 10.7 DSL verbatim except for one deliberate change (see Decisions); and its `PolicyApplicability` row (`US-CA` / `CONVENTIONAL_MORTGAGE` / `UNDERWRITING_REVIEW`). Reproducible and revertible the same way schema migrations already are — Section 10.6 frames exactly this ("curated synthetic policy sources") as real, shippable reference data, not a one-off script.
- `src/policy/product-code.ts` — `loanTypeToProductCode`: explicit mapping from M2's `LoanType` enum (`"CONVENTIONAL"`) to the DSL's product vocabulary (`"CONVENTIONAL_MORTGAGE"`, Section 10.7's own literal) — the two are the same concept in different namespaces, not the same string, so the mapping is a named function, not an assumption.
- `src/workflows/case-conditions.activities.ts` — `evaluateConditions` rewritten: loads the case's `jurisdictionCode`/`loanType`/`statedMonthlyIncome`, calls `PolicyApplicabilityResolverService.resolve(...)`, builds a `PolicyFactContext` from `statedMonthlyIncome` and the fetched `income.monthlyIncome`, evaluates every resolved version, and opens a condition using the **matched rule's own** `outcome.condition` as the code and the evaluator's own reason string as the description — never a hardcoded string, unlike the old `'SYNTHETIC_DISCREPANCY_REVIEW'`. A `REVIEW_REQUIRED` resolution returns that outcome directly rather than writing case state itself (the caller — the workflow — decides what to do with it). `hasSyntheticDiscrepancy` and its credit/document-threshold logic are deleted, not kept as a fallback.
- `src/workflows/case-conditions.workflow.ts` — `evaluateConditions`'s result is now a 3-way `outcome` (`'READY' | 'CONDITION_OPENED' | 'REVIEW_REQUIRED'`) instead of a `hasOpenCondition` boolean. `REVIEW_REQUIRED` calls `markManualReview` (M2-007's escape hatch, now with a second real trigger besides retry exhaustion) and returns `MANUAL_REVIEW` — deliberately *not* the durable-wait/condition flow, since an unresolved policy binding is a system-level ambiguity, not a specific resolvable business condition. Credit and document evidence are still fetched and recorded (audit value), just no longer consulted by the decision itself.
- `src/cases/dto/create-case.dto.ts`, `cases.service.ts`, `cases.module.ts` — `CreateCaseDto` gains `statedMonthlyIncome`/`jurisdictionCode`; `CasesService.createCase` validates the jurisdiction exists (404, not a raw FK-violation 500) before attempting the insert, and persists both fields transactionally with the rest of the case row (unchanged transactional-outbox pattern from M2-006).
- `src/worker.module.ts`, `worker.ts` — the worker process now also resolves `PolicyApplicabilityResolverService` via `PolicyModule` and passes it into the activities factory, the same established pattern as `PlaidService` et al. (M3-003's own stated design, now actually used).
- Test updates across `case-conditions.activities.spec.ts`, `case-conditions.workflow.spec.ts`, `cases.service.spec.ts`, `test/cases.e2e-spec.ts`, `schema-migrations.spec.ts`, and `database/entities/policy-schema.spec.ts` (the last two needed fixing only because the new seed data now permanently occupies the `synthetic-income-discrepancy-review` / `1.0.0` identity and the `US-CA`/varchar(20) space their fixtures previously assumed were free — see Failures below).

### Failures and resolution

- **Leftover test debris found in the real dev database before this slice's schema migration could safely add `NOT NULL` columns**: `loan_cases` had 6 orphaned rows from an "Activities Spec Tenant" whose `afterAll` cleanup apparently didn't complete on some earlier run this session (evidence/outbox rows for it were already gone, case/tenant rows were not — consistent with a run that was interrupted partway through cleanup, e.g. a killed docker-compose stack, rather than a code defect in the cleanup logic itself). Cleaned up manually before proceeding; not otherwise investigated further since it's an artifact of this session's own iteration, not a reproducible bug.
- **The new `LoanCase.jurisdictionCode` FK made one already-written test unrunnable as designed**: a test meant to prove `PolicyApplicabilityResolverService` fails closed for "jurisdiction has no coverage" tried to create a `LoanCase` referencing a jurisdiction code that was never seeded — but the new FK constraint (added in this same slice) now makes that impossible; a case can only ever reference a jurisdiction that already exists in the catalog. Fixed by seeding a real jurisdiction row with `coverageStatus: NOT_COVERED` instead of using a nonexistent code — a more realistic scenario anyway (a jurisdiction can be catalogued but not yet reviewed for coverage), and one the FK constraint does *not* prevent.
- **Two existing test fixtures collided with the newly-seeded permanent data**: `database/entities/policy-schema.spec.ts` used the exact `ruleId`/`version` pair (`synthetic-income-discrepancy-review` / `1.0.0`) the seed migration now permanently owns, hitting `UQ_policy_versions_rule_version`; a resolver test's synthetic jurisdiction code exceeded the (real, correct) `varchar(20)` limit once lengthened to avoid an unrelated collision. Both are test-identity conflicts introduced by this slice's own seed data, not defects in the schema — renamed the test fixtures to be obviously test-scoped and within the real column-length constraint.

### Affected files

- `src/database/entities/loan-case.entity.ts`
- `src/database/migrations/1786910916794-LoanCaseIncomeAndJurisdiction.ts`, `1786910931703-SeedIncomeDiscrepancyPolicy.ts` (new); `schema-migrations.spec.ts`
- `src/database/entities/policy-schema.spec.ts` (test-fixture rename only)
- `src/policy/product-code.ts` (new)
- `src/workflows/case-conditions.activities.ts`, `case-conditions.activities.spec.ts`
- `src/workflows/case-conditions.workflow.ts`, `case-conditions.workflow.spec.ts`
- `src/cases/dto/create-case.dto.ts`, `cases.service.ts`, `cases.service.spec.ts`, `cases.module.ts`
- `src/worker.module.ts`, `worker.ts`
- `test/cases.e2e-spec.ts`
- `README.md`

### Decisions and alternatives

- **Seeded `effective_from` is 2025-01-01, not the charter's literal 2027-01-01**: Section 10.7's own example is dated in what is, relative to this project's actual timeline, the future. Seeding that exact date would make the rule correctly-modeled but permanently inert in the running system until 2027 — nothing could ever prove the wiring works end-to-end against a live `asOf = now()` evaluation. The DSL's operator, fact paths, and 10% threshold are otherwise identical to the charter's text; only the date was adjusted, and why is recorded in the migration file's own comment, not left for a future reader to puzzle out.
- **`hasSyntheticDiscrepancy` deleted outright, not kept as a fallback or a second policy rule**: it was always documented (M2-004) as "a deliberately simple, deterministic stand-in for the real policy engine that M3 introduces" — keeping it running in parallel once that engine exists would mean two independent, potentially-disagreeing sources of truth for the same decision. Its credit/document-threshold logic could return later as its own DSL rule (the resolver already supports multiple simultaneously-applicable rules), but that's new work with its own DSL operators, not a reason to keep the old hardcoded path alive today.
- **`REVIEW_REQUIRED` routes to `MANUAL_REVIEW`, not the `CONDITIONS_OPEN`/durable-wait flow**: the DSL's own `outcome.route: "MANUAL_REVIEW"` field could be read as directly selecting a `CaseStatus`, but `outcome.condition` also exists and is what M2's proven, tested `LoanCondition`/`resolveCondition`-signal flow already expects for "a specific resolvable business condition was found." Reserving `MANUAL_REVIEW` for cases where the *system* can't determine applicable policy (no coverage, overlapping versions) — as opposed to a condition the *policy itself* identified — keeps the two failure modes distinguishable, matching how M2-007 already used `MANUAL_REVIEW` for a different system-level failure (exhausted activity retries). This is an interpretation choice the charter doesn't fully specify; recorded here as a judgment call, not an obvious reading.
- **Jurisdiction validated in `CasesService` before the transaction, not left to the FK to reject**: an FK-violation surfaces as a generic Postgres error that would otherwise need its own error-code detection (like the existing unique-violation handling) to turn into a clean 404 — validating up front is simpler and gives a clearer error message (`"Jurisdiction {code} not found"` vs. a raw constraint-name string).

### Verification

```text
npm run build / npm run lint:check   -> both passed

DATABASE_URL=... TEMPORAL_ADDRESS=localhost:7233 npm test -- --runInBand --no-cache --silent
  24 suites passed, 182 tests passed (net +5 over M3-003's 177, no new
  suites: jurisdiction-not-found and REVIEW_REQUIRED coverage added to
  cases.service.spec.ts and case-conditions.activities.spec.ts, plus a
  REVIEW_REQUIRED-routes-to-MANUAL_REVIEW test added to
  case-conditions.workflow.spec.ts)

DATABASE_URL=... TEMPORAL_ADDRESS=localhost:7233 npm run test:e2e
  -> 2 suites passed, 13 tests passed

Manual end-to-end proof (real API + real worker process, scratchpad
Temporal + the real dev Postgres database):
  1. POSTed a case with statedMonthlyIncome=25000 for a borrowerId whose
     deterministic simulated Plaid income is 20023 (19.91% difference,
     over the seeded rule's 10% threshold) and jurisdictionCode=US-CA.
     Started its workflow; the real worker resolved the seeded policy,
     evaluated it, and opened a condition with code
     VERIFY_INCOME_DISCREPANCY and description
     "difference_percent(application.monthly_income=25000,
     evidence.verified_monthly_income=20023) = 19.91% > 10%" — both
     values traced directly to the resolved rule, not hardcoded.
     Confirmed the condition.opened outbox event's payload references
     the real policyVersionId/ruleId. case status: CONDITIONS_OPEN.
  2. POSTed a resolution (SATISFIED) -> case status:
     READY_FOR_UNDERWRITING.
  3. POSTed a second case for the same borrower with
     statedMonthlyIncome=20023 (0% difference) -> workflow completed
     straight through with zero conditions opened, case status:
     READY_FOR_UNDERWRITING directly.
  4. POSTed a case with an unrecognized jurisdictionCode -> 404 from
     the REST layer, confirming the case was never created and the
     workflow was never reachable for it.
  5. Independently re-verified every outbox event's signature from
     both cases against what Postgres actually stored — all valid.
  Cleaned up synthetic tenant/case/outbox rows, both processes, and
  the scratchpad Temporal stack afterward.
```

### Security, privacy, cost, and compatibility

- `statedMonthlyIncome` is borrower-provided financial data, stored in plaintext on `loan_cases` — same treatment (and same gap) already noted for outbox payloads in M2-006: acceptable for synthetic data with no deployment target, revisit before any real exposure.
- Jurisdiction validation closes a real gap that would otherwise have surfaced as an unhandled 500 on a foreign-key violation — a small but genuine hardening, not just a schema formality.
- No new dependency; no new cost.

### Known gaps

- Credit/document-based conditions (the old `hasSyntheticDiscrepancy` behavior) have no policy-rule equivalent yet — a case with severe derogatory marks or invalid documents but *matching* income no longer opens any condition. This is a real, deliberate scope reduction (see Decisions), not an oversight, but worth flagging plainly: this slice narrows what M2's workflow catches until credit/document rules exist as their own DSL content.
- Still no `CasePolicySnapshot` persistence, binding-validation guard, or dependency-generation invalidation (M3-003's carried-forward gaps) — this slice proved the resolver and evaluator work correctly *in* the workflow, it didn't add the bitemporal machinery around them.
- The seed migration's policy content lives only in `US-CA` — a case in any other jurisdiction (even a covered one, if seeded later) has no applicable rule and always completes straight through, which is a true "no matching policy" `RESOLVED` outcome, not a bug, but worth knowing when testing with other jurisdiction codes.

### Next safe step

Ask whether to continue toward `CasePolicySnapshot`/binding-guard persistence (Section 10.4) next, or pivot to the `AgentRuntime` port and LangGraph.js v1 adapter (Section 9) — both are substantial, independent pieces of M3's remaining scope, and this integration slice was the natural forcing function for the policy side; the Agent side hasn't been started at all yet.

## M3-005: CasePolicySnapshot persistence and the PolicyEvaluationService binding guard

### Status

Implemented and verified, including a hands-on run through the real REST API and a real worker confirming a live evaluation persists a real `CasePolicySnapshot` and `CasePolicyBinding`, correctly cross-referenced from the `condition.opened` outbox event. Closes the "unavoidable `PolicyEvaluationService` binding-validation guard" M3 scope line — with one deliberate, documented simplification (see Decisions): this implements the guard's correctness/audit contract, not yet its target performance mechanism. Chosen over the Agent-runtime alternative because the charter's own `evaluate_policy`/`create_condition` Agent tools (Section 9.4) require "mandatory policy-binding validation" as something the Agent cannot bypass — building the Agent side first would mean building it against a guard that didn't yet exist.

### Acceptance criterion

Every policy evaluation for a case must go through an unavoidable guard, never the raw resolver directly, and must produce: an immutable, queryable record of what was resolved and when (`CasePolicySnapshot`); a reusable case-to-snapshot binding that a later evaluation can trust without re-deriving from scratch when nothing has changed (`CasePolicyBinding`); and correct invalidation when the underlying resolution genuinely changes or becomes unresolvable.

### Implementation

- `src/database/entities/case-policy-snapshot.entity.ts` — `CasePolicySnapshot`: immutable, one row per distinct resolution outcome (`resolutionStatus`, the matched `versions` with their policy version IDs and effective windows, `unresolvedReasons`, a `contextHash` digest, `resolverVersion`). Never updated in place.
- `src/database/entities/case-policy-binding.entity.ts` — `CasePolicyBinding`: one active (non-invalidated) row per case, pointing at the snapshot it's currently bound to, with `dependencyDigest`, `boundAt`, `revalidateAfter`, and `invalidatedAt`. A refresh invalidates the prior row rather than deleting it, preserving *why* a case's binding changed, not just that it did.
- `src/database/enums/policy-resolution-status.enum.ts` — `PolicyResolutionStatus` (RESOLVED/REVIEW_REQUIRED), the DB-typed counterpart to `PolicyResolutionResult.status`'s plain string union.
- `src/policy/policy-digest.ts` — `computeDigest`: a plain SHA-256 content fingerprint (not HMAC-signed like `outbox-signer.ts` — a digest only needs to detect change for one process talking to its own database, not cross a trust boundary). Reuses the same key-canonicalization approach as outbox signing, for the same reason (stable regardless of construction order).
- `src/policy/policy-evaluation.service.ts` — `PolicyEvaluationService.evaluate(tenantId, caseId, context)`: calls the resolver, computes a digest over the resolution's status/versions/reasons (with `versions` explicitly sorted by `policyVersionId` before hashing — see Failures), then: `REVIEW_REQUIRED` persists a snapshot recording why and invalidates any existing binding (nothing to bind to); otherwise, an existing non-invalidated binding whose digest matches and whose `revalidateAfter` hasn't passed is `REUSED` as-is; anything else is `REFRESHED` — a new snapshot and binding are persisted, and the prior binding (if any) is invalidated.
- `src/database/migrations/1786965356650-CasePolicySnapshotAndBinding.ts` — schema migration (generated, apply/revert verified against a scratch database).
- `src/policy/policy.module.ts` — registers the two new entities and `PolicyEvaluationService`, exported alongside the resolver.
- `src/workflows/case-conditions.activities.ts` — `evaluateConditions` now calls `policyEvaluationService.evaluate(...)` instead of the raw resolver; the `condition.opened` outbox event gains a `policySnapshotId` field, giving the audit trail a direct pointer from "a condition was opened" to "the exact snapshot that justified it."
- `src/worker.ts` — resolves `PolicyEvaluationService` (not the raw resolver) from the worker's DI container and passes it into the activities factory.
- `src/policy/policy-evaluation.service.spec.ts` (new), `policy-digest.spec.ts` (new) — real-database and pure-unit coverage respectively; `case-conditions.activities.spec.ts` updated to construct and pass the new service.

### Failures and resolution

- **A subtle digest-instability risk, caught before it caused spurious churn, not after**: `PolicyResolutionResult.versions` comes from a `Map` populated during resolver iteration — its array order isn't guaranteed stable across calls even when the underlying data hasn't changed (unlike jsonb key order, this isn't a storage-layer surprise, it's an iteration-order one, but the failure mode is the same: an unstable serialization breaks a digest comparison meant to detect real change). Fixed by explicitly sorting `versions` by `policyVersionId` before hashing, in the same place `computeDigest` is called — `computeDigest` itself deliberately stays array-order-sensitive as a general-purpose utility (Sorting is the caller's job, since only the caller knows which arrays are semantically order-independent); documented in both `policy-digest.ts`'s and `policy-evaluation.service.ts`'s comments so a future caller doesn't rediscover this the hard way.

### Affected files

- `src/database/entities/case-policy-snapshot.entity.ts`, `case-policy-binding.entity.ts` (new)
- `src/database/enums/policy-resolution-status.enum.ts` (new)
- `src/database/migrations/1786965356650-CasePolicySnapshotAndBinding.ts` (new); `schema-migrations.spec.ts`
- `src/database/database.module.ts`
- `src/policy/policy-digest.ts`, `policy-digest.spec.ts` (new)
- `src/policy/policy-evaluation.service.ts`, `policy-evaluation.service.spec.ts` (new)
- `src/policy/policy.module.ts`, `policy-resolution.types.ts`
- `src/workflows/case-conditions.activities.ts`, `case-conditions.activities.spec.ts`
- `src/worker.ts`
- `README.md`

### Decisions and alternatives

- **The guard always re-runs full resolution — the target design's fast indexed-generation-vector path is not implemented**: Section 10.4's actual mechanism (a bounded, indexed read of 8 dependency-generation keys, incremented atomically on policy activation) needs a `policy_dependency_generations` table and an activation write-path that increments it — neither exists, because nothing in this codebase can activate, withdraw, or supersede a policy version after the fact yet (the only policy content that exists is the one seed migration). Building the fast-path infrastructure before there's any real activation event to invalidate against would be speculative. What's implemented instead — always resolve, then compare a content digest to decide reuse-vs-refresh — delivers the same *correctness* contract (a case's evaluation is provably bound to an immutable snapshot; reuse only happens when nothing relevant changed) without the *performance* property (skip resolution entirely on the fast path). This is a real, named simplification, not a silent shortcut — Section 10.4 itself is flagged in the class-level comments of both `CasePolicyBinding` and `PolicyEvaluationService`.
- **`MAX_VALIDATION_INTERVAL_MS` (1 hour) is the only piece of `revalidateAfter`'s definition implemented**: Section 10.4 defines it as "the earliest known scheduled activation boundary, source-freshness deadline, or configured maximum validation interval" — the first two require infrastructure (scheduled activations, freshness tracking) this codebase doesn't have; the third is a plain constant, honestly implementable today.
- **One active binding per case, refresh invalidates rather than deletes**: matches `CasePolicyBinding`'s own `invalidatedAt` field in the charter's target interface, and preserves the same kind of "what changed and when" audit trail `ConditionTransition` already provides for conditions — deleting and recreating would lose that history for no benefit.
- **A digest, not a signature, for `dependencyDigest`/`contextHash`**: unlike outbox events (M2-006), which cross a trust boundary and need tamper-evidence, this digest only needs to answer "did the resolver's output change" for one process reading its own database — no secret, no HMAC, matching the general principle of not adding security machinery a threat model doesn't call for.

### Verification

```text
npm run build / npm run lint:check   -> both passed

DATABASE_URL=... TEMPORAL_ADDRESS=localhost:7233 npm test -- --runInBand --no-cache --silent
  26 suites passed, 193 tests passed (24->26 suites, +2 new:
  policy-digest.spec.ts [4 tests], policy-evaluation.service.spec.ts
  [6 tests]; net +11 tests over M3-004's 182)
  policy-evaluation.service.spec.ts covers: first evaluation creates a
  snapshot+binding (REFRESHED); an unchanged second evaluation reuses
  both (REUSED) without creating duplicate rows; a genuine policy
  change (a second applicable rule becomes available) produces a new
  snapshot+binding and invalidates the prior one; an expired
  revalidateAfter forces a refresh even with unchanged content;
  REVIEW_REQUIRED persists a snapshot but creates no binding; a
  previously-valid binding is invalidated if a later evaluation for
  the same case becomes REVIEW_REQUIRED.

DATABASE_URL=... TEMPORAL_ADDRESS=localhost:7233 npm run test:e2e
  -> 2 suites passed, 13 tests passed

Manual end-to-end proof (real API + real worker process, scratchpad
Temporal + the real dev Postgres database): created and started a
case with a genuine income discrepancy; confirmed a real
case_policy_snapshots row (RESOLVED, the matched rule's version and
window) and a real case_policy_bindings row (correct dependencyDigest,
boundAt, a revalidateAfter one hour out, invalidatedAt null) were
persisted, and that the condition.opened outbox event's payload
correctly references the snapshot's real id. Cleaned up synthetic
tenant/case/snapshot/binding rows, both processes, and the scratchpad
Temporal stack afterward.
```

### Security, privacy, cost, and compatibility

- No new externally-reachable surface — no REST/GraphQL entry point reads snapshots or bindings yet.
- `CasePolicySnapshot`/`CasePolicyBinding` contain no borrower data directly (policy version IDs, digests, timestamps) — the fact context they were evaluated against is not itself stored here (it lives in the case row and evidence facts already covered by M2's data-handling notes).
- No new dependency; no new cost.

### Known gaps

- No dependency-generation vector / fast-path validation (see Decisions) — every evaluation call does full resolution work, just not full snapshot/binding *persistence* when nothing changed.
- No scheduled-activation-boundary or source-freshness-deadline tracking feeding `revalidateAfter` — only the flat maximum-interval fallback exists.
- No REST/GraphQL surface exposing a case's policy snapshot/binding history for audit/review — the data is there, nothing reads it back yet.
- Still no `EvaluationInputManifest` (Section 10.5) — the next-larger piece of the policy-evaluation pipeline, referencing `policyBindingId` among other immutable evaluation inputs.

### Next safe step

M3's policy side now has schema, DSL engine, resolver, and binding guard all wired into the real M2 workflow — a coherent, closeable unit. The Agent side (Section 9: `AgentRuntime` port, LangGraph.js v1 adapter, registered tools, budgets) hasn't been started at all and is the largest remaining piece of M3. Recommend starting there next, or building `EvaluationInputManifest` first if continuing to deepen the policy pipeline is preferred — ask before choosing, since both are substantial, independent slices.

## M3-006: AgentRuntime port, LendingOperationsAgentState, and three real registered tools

### Status

Implemented and verified. The first slice of the Agent side of M3 (Section 9) — deliberately scoped to the port/state contract plus a small number of *genuinely implemented* tools, not the full sixteen-entry registered-tools table and not yet the LangGraph.js v1 adapter itself (see Decisions and Known gaps). Mirrors how M3-001 was schema-only before anything executed against it.

### Acceptance criterion

An `AgentRuntimePort` interface must exist, matching Section 9.2's runtime-separation contract (the workflow/activity layer depends on the port, never on a specific runtime implementation); `LendingOperationsAgentState` must be typed per Section 9.3; and at least a few of Section 9.4's registered tools must be real, independently tested units — not stubs — with at least one demonstrably wired into and used by production code, not left orphaned.

### Implementation

- `src/agent-runtime/agent-state.types.ts` — `LendingOperationsAgentState` (Section 9.3) and its constituent summary types (`EvidenceSummary`, `ConditionSummary`, `ProviderHealthSummary`, `ToolAttemptSummary`, `AgentAction`, `HumanReviewState`), typed as closely to the charter's interface as this codebase's actual data supports.
- `src/agent-runtime/agent-runtime.types.ts` — `AgentRuntimePort` (`run(input): Promise<AgentRunResult>`), `AgentRunInput`, `AgentRunBudget`, `AgentRunRoute` (`PROPOSED_ACTION | AWAITING_INFORMATION | INTERRUPTED_FOR_REVIEW | ROUTED_TO_MANUAL_REVIEW`, matching Section 9.5's Agent-loop outcomes). No implementation of this port exists yet — it's the contract a LangGraph.js adapter will satisfy next.
- `src/agent-runtime/agent-tool.types.ts` — `AgentTool<TArgs, TResult>` (Section 9.4's table columns, typed: `purpose`, `sideEffect`, `approvalBoundary`, `execute`), `buildToolRegistry` (throws on a duplicate tool name — an ambiguous registry is a bug to catch at construction, not a runtime concern), `invokeTool` (never throws; an unregistered tool name or a tool's own exception both come back as a `FAILURE` outcome — Section 20's M3 exit evidence: "unauthorized tools remain unreachable" starts with the registry never crashing the caller over one).
- `src/agent-runtime/tools/check-case-completeness.tool.ts` — Section 9.4's `check_case_completeness`: checks a case has at least one `EvidenceFact` of each type the M2 workflow's fetch activities produce. Real, correct, not yet called by production code (nothing in the deterministic M2 workflow needs to *ask* this — it always fetches all three unconditionally).
- `src/agent-runtime/tools/evaluate-policy.tool.ts` — Section 9.4's `evaluate_policy`: a thin wrapper around the already-built `PolicyEvaluationService` (M3-005), giving it the right tool metadata (`approvalBoundary: 'Mandatory policy-binding validation'`) without any path that bypasses the guard.
- `src/agent-runtime/tools/create-condition.tool.ts` — Section 9.4's `create_condition`: extracted verbatim from `case-conditions.activities.ts`'s inline condition-opening logic, which now calls this tool instead of duplicating it. In the process, this closes a real gap that's existed since M2-001: `LoanCondition.policySnapshotId` (a column whose own comment said "M3 will make it required... Section 6.2") is now actually populated on every condition created through this path — it wasn't before this slice.
- `src/workflows/case-conditions.activities.ts` — `evaluateConditions`'s condition-creation branch now calls `createConditionTool(...).execute(...)` instead of an inline transaction; behavior-preserving (all 11 existing tests passed unmodified), plus one new assertion proving `policySnapshotId` is populated.

### Affected files

- `src/agent-runtime/agent-state.types.ts`, `agent-runtime.types.ts`, `agent-tool.types.ts` (new)
- `src/agent-runtime/agent-tool.types.spec.ts` (new)
- `src/agent-runtime/tools/check-case-completeness.tool.ts`, `.spec.ts` (new)
- `src/agent-runtime/tools/evaluate-policy.tool.ts`, `.spec.ts` (new)
- `src/agent-runtime/tools/create-condition.tool.ts`, `.spec.ts` (new)
- `src/workflows/case-conditions.activities.ts`, `case-conditions.activities.spec.ts`

### Decisions and alternatives

- **Three tools implemented for real, not all sixteen stubbed**: Section 9.4's table has entries this codebase has no way to back with real logic yet (`inspect_documents` needs a document-processing capability that doesn't exist; `send_information_request`/`publish_case_update` need the communication-classification system, also unbuilt; `calculate_qualified_income`/`calculate_dti`/`calculate_ltv` need calculation logic never specified). Stubbing all sixteen would produce a registry that looks complete but isn't — exactly the kind of false completeness this project has consistently avoided. Building three real ones and naming the rest as gaps is the honest version of "the registered tools exist."
- **`create_condition` extracted into a real caller, not built as parallel/unused scaffolding**: a tool nothing calls is unproven — refactoring `case-conditions.activities.ts` to actually use it (rather than leaving the inline logic in place alongside an unused duplicate) is what makes this tool real evidence, not aspirational shape. This also surfaced and fixed the `policySnapshotId` gap, which the refactor would not have caught if the tool had been left uncalled.
- **`evaluate_policy` is a thin wrapper the M2 workflow does *not* use** (it still calls `PolicyEvaluationService` directly): the workflow's own call is a deterministic Temporal activity step, not an Agent decision — routing it through the tool layer would add indirection with no behavioral benefit. The tool exists for a future LangGraph.js adapter to call the identical guard through the same registry contract every other tool uses, not to replace the workflow's existing, correct direct call.
- **`invokeTool` never throws**: Section 20's M3 exit evidence explicitly requires "unauthorized tools remain unreachable" — a registry that could crash its caller on a bad tool name would itself be a reliability risk sitting right next to a security boundary. Both "tool doesn't exist" and "tool threw" come back as the same `FAILURE` shape, letting a future runtime implementation treat every tool-invocation failure uniformly.
- **No NestJS module/DI wiring for the tool registry**: nothing NestJS-DI-managed calls these tools yet (no controller/resolver), and their consumers so far (`case-conditions.activities.ts`) already follow the established "activities avoid heavy DI, receive plain constructed dependencies" pattern (M2-004). Adding a module now would be premature scaffolding for a consumer that doesn't exist.
- **A distinct `src/agent-runtime/` directory, not reused inside the existing `src/agent/`**: `src/agent/`'s `AgentService`/`RulesUnderwriterService`/`OllamaUnderwriterService` are the legacy one-shot `evaluateLoan` decisioning path, predating and unrelated to Section 9's stateful, bounded, tool-using Agent charter — a real naming collision (both are "the Agent") worth calling out explicitly rather than either renaming the legacy module (out of scope) or conflating two different systems under one directory.

### Verification

```text
npm run build / npm run lint:check   -> both passed

DATABASE_URL=... TEMPORAL_ADDRESS=localhost:7233 npm test -- --runInBand --no-cache --silent
  30 suites passed, 205 tests passed (26->30 suites, +4 new:
  agent-tool.types.spec.ts [4 tests], check-case-completeness.tool.spec.ts
  [3 tests], create-condition.tool.spec.ts [1 test],
  evaluate-policy.tool.spec.ts [3 tests]; net +12 tests over M3-005's
  193; case-conditions.activities.spec.ts's existing 11 tests all
  passed unmodified after the refactor, plus one new assertion)

DATABASE_URL=... TEMPORAL_ADDRESS=localhost:7233 npm run test:e2e
  -> 2 suites passed, 13 tests passed (unchanged)

Manual confirmation (real API + real worker, scratchpad Temporal + the
real dev database): started a case with a genuine income discrepancy
through the now-refactored path; confirmed the condition was created
correctly (code, CONDITIONS_OPEN status) and — the specific thing this
slice changed — policySnapshotId was actually populated on the
resulting loan_conditions row, not null.
```

### Security, privacy, cost, and compatibility

- No new externally-reachable surface — no controller/resolver invokes any tool yet.
- `create_condition`'s extraction is behavior-preserving except for the `policySnapshotId` fix, which is strictly additive (a previously-null column now has a real value) — no existing consumer reads that column in a way this could break.
- No new dependency; no new cost. (LangGraph.js is not yet a dependency — see Known gaps.)

### Known gaps

- No `AgentRuntimePort` implementation — the port is defined, nothing implements it. LangGraph.js (`@langchain/langgraph`, v1.4.x confirmed available) is not yet a project dependency.
- Only 3 of Section 9.4's 16 registered tools exist: `check_case_completeness`, `evaluate_policy`, `create_condition`. Not implemented: `inspect_documents`, `fetch_income_evidence`/`fetch_asset_evidence`/`fetch_credit_evidence`/`check_identity_consistency` (provider-submission tools — the M2 workflow's existing fetch activities do this work today, outside the tool-registry shape), `calculate_qualified_income`/`calculate_dti`/`calculate_ltv`, `compare_evidence` (no multi-source evidence model exists yet to compare against — a single-source-per-type case has nothing to conflict), `check_policy_change_impact`, `draft_information_request`/`send_information_request`, `escalate_to_reviewer`, `publish_case_update`.
- No budget ledger, trusted deadline enforcement, or reservation system (Section 9.3's `remainingStepBudget` et al. are typed but nothing computes or enforces them).
- No mandatory review-trigger logic (Section 9.6) or safety controls beyond what tool typing itself provides (Section 9.7).
- `AgentTool.execute` receives only `{ tenantId, caseId }`, not the full `LendingOperationsAgentState` — deliberately minimal for the three tools that exist today; a real runtime implementation may need to widen this once a tool genuinely needs run-level context (e.g. remaining budget) to decide its own behavior.

### Next safe step

Add `@langchain/langgraph` as a dependency and build a minimal, real `AgentRuntimePort` implementation using it — a graph with at least the three existing tools as nodes, proving the port contract against a real LangGraph.js v1 graph rather than leaving it unimplemented. Budgets, mandatory review triggers, and the remaining tools are all larger, separate pieces of Section 9 best tackled after the adapter itself is proven to work end-to-end with something small.

## M0-011: Field-level privacy-control phrasing residual audit

### Status

A five-point charter logic review was independently drafted against an earlier charter revision (v2.4) before this milestone's implementation work began. Re-run against the charter's current text (v2.9) before acting on it, four of the five originally-identified issues were found already resolved by the intervening M0-009 and M0-010 audits. One residual phrasing gap survived and is corrected here.

### Acceptance criterion

Every clause in the charter that describes provider-authorization or privacy-control granularity must use the same, schema-accurate vocabulary: `ProviderAuthorizationGrant`'s only defined scoping field is `permittedDataClasses`, with `permittedFields` as an optional narrowing used only when a capability contract exposes field-addressable data. No section may claim unqualified "field-level"/"field-bound" authorization as a blanket guarantee.

### Findings

Re-verified against the current charter text (not the stale draft) before any edit, per standing practice of checking a claim against present reality rather than a remembered or previously-drafted description:

1. **Structural funds-movement boundary (originally flagged)** — already resolved by M0-009. Section 2's product-boundary paragraph, Section 5.2's non-goals, Section 7.4/7.5's deferred-vs-structurally-excluded split, and Section 11.8's certification-boundary language are internally consistent: provider certification is scoped adapter readiness, never product-authority. No edit needed.
2. **Protected-communication approval boundary (originally flagged)** — already resolved by M0-009. Section 6.3's authority order, Section 6.4's protected/routine communication classes, and Section 9.4's `send_information_request` approval-boundary cell all now state the same rule: configured policy may only pre-approve a narrow, version-pinned routine template; every protected, uncertain, or modified message requires exact human approval. No edit needed.
3. **Agent duration/cost budget fields (originally flagged)** — already resolved by M0-009. Section 9.3's `LendingOperationsAgentState` carries `remainingDurationBudgetMs`, `budgetCurrency`, `remainingCostBudgetMinorUnits`, `budgetLedgerVersion`, `runStartedAt`, and `runDeadlineAt`, matching Section 9.7's promised budget classes and Section 9.6's exhaustion trigger. No edit needed.
4. **Field-level authorization granularity vs. schema (originally flagged)** — mostly resolved by M0-010, one residual instance found. M0-010 reworded Section 11.5's prose and `ProviderAuthorizationGrant` (adding `permittedFields?: string[]` as an optional narrowing of `permittedDataClasses`) and the Section 14.1 entity description, but its own implementation list never mentions Section 16.2 — and Section 16.2's privacy-controls bullet still read "data minimization and **field-level** access policy" unqualified, the exact overclaim M0-010 set out to remove. M0-010's own verification log claimed a whole-file search found "unqualified field-bound/field-level claims... absent," which was not accurate for Section 16.2 at the time it was written. Corrected in this entry: reworded to "data minimization and data-class-level access policy, narrowed to specific fields only where a capability's contract exposes field-addressable data," and Section 16.2's authorization-binding bullet now says "data-class-, optionally field-," matching Section 11.5's exact phrasing instead of the looser "data-bound."
5. **Consent-revocation state (originally flagged)** — already resolved by M0-010. `consentStatus` includes `'REVOKED'`, and Section 9.6's mandatory review triggers list mid-case consent revocation first. No edit needed.

### Implementation

- `docs/PROJECT_CHARTER.md` Section 16.2: reworded the authorization-binding bullet and the field-level-access bullet to match Section 11.5's already-corrected vocabulary.
- Charter version bumped 2.9 → 2.10.

### Affected files

- `docs/PROJECT_CHARTER.md`
- `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Re-verify against current file text before editing, rather than trust a previously-drafted finding list** — the draft review was accurate against v2.4 but stale against v2.9; four of its five points had already been fixed by two intervening audit rounds (M0-009, M0-010) that happened after the draft was written. Applying all five suggested edits blindly would have reintroduced already-resolved contradictions (for example, re-adding a "public launch" qualifier to the funds-movement non-goal) or produced redundant, conflicting phrasing next to text that had already been corrected more precisely.
- **One-line rewording over a schema change** — Section 16.2's gap was phrasing that had fallen out of sync with an already-correct schema and an already-correct sibling section (11.5), not a missing capability; the fix is vocabulary alignment, not new modeling.
- **Recorded as a new M0 entry rather than amending M0-010** — M0-010's own text and verification claim are now demonstrably inaccurate for Section 16.2; the honest record is a new entry noting the gap in the prior entry's verification, not a silent retroactive edit of M0-010 that would hide that the earlier verification step had a real blind spot (it searched, but not thoroughly enough to catch every instance).

### Verification

```text
grep -n "field-level|field-bound|field authorization|field-addressable" docs/PROJECT_CHARTER.md
  three matches: Section 11.5 (already correct — "optionally field-",
  "field-addressable"), Section 11.8 (correct — internal RBAC "field
  authorization," a distinct concept per M0-010's own decision note),
  Section 16.2 (was the unqualified overclaim; now reworded)

post-edit re-grep of the same pattern
  Section 16.2 no longer contains an unqualified "field-level" claim;
  its wording now matches Section 11.5's "data-class-, optionally
  field-" phrasing exactly

funds-movement, communication-approval, budget-field, and
consent-revocation cross-section re-read (Sections 2, 5.2, 6.3, 6.4,
7.4, 7.5, 9.3, 9.4, 9.6, 11.8)
  all internally consistent; no contradiction found
```

No application test is required for this documentation-only correction — no code changed.

### Security, privacy, cost, and compatibility

- No behavioral change; no application code touched. This is a documentation-precision correction to a target-state charter, not a change to any implemented control.
- The corrected phrasing does not loosen or tighten any actual privacy guarantee — the enforced boundary (`permittedDataClasses` as the floor, `permittedFields` as an optional narrowing) was already correctly defined in Section 11.5 and `ProviderAuthorizationGrant`; only Section 16.2's prose was out of step with it.

### Known gaps

- No `permittedFields`-aware access-control enforcement exists in application code yet (tracked since M0-010 — no current provider capability exposes field-addressable contracts).
- This entry only re-verified the five points from the earlier draft review plus a targeted whole-file grep for field-level/field-bound phrasing; it is not a full re-audit of all 30 charter sections. A prior verification step (M0-010's) already demonstrated that a targeted search can miss an instance, so a fuller reread would need a different method (e.g., grepping every privacy/authorization-adjacent section individually) to have materially higher confidence than this one.

### Next safe step

No charter follow-up is queued by this entry. Resume the M3 roadmap: add `@langchain/langgraph` as a dependency and build the `AgentRuntimePort` implementation, per M3-006's own next-safe-step note.

## M3-007: Real LangGraph.js v1 `AgentRuntimePort` implementation

### Status

Implemented and verified. `@langchain/langgraph` (v1.4.10) is now a real dependency, and `AgentRuntimePort` (M3-006) has its first implementation: a compiled LangGraph.js `StateGraph` orchestrating the three existing tools. Standalone — not wired into the M2 Temporal workflow, which continues to call `PolicyEvaluationService`/`createConditionTool` directly (see Decisions).

### Acceptance criterion

`AgentRuntimePort.run()` must be implemented by a real, compiled LangGraph.js v1 `StateGraph` (not a hand-rolled loop that merely satisfies the TypeScript interface), exercising the three existing tools (`check_case_completeness`, `evaluate_policy`, `create_condition`) through the same `buildToolRegistry`/`invokeTool` contract every tool already uses, and producing every `AgentRunRoute` the Agent loop (Section 9.5) actually reaches with today's tools: `AWAITING_INFORMATION` (missing evidence), `PROPOSED_ACTION` (ready, with or without a condition), and `ROUTED_TO_MANUAL_REVIEW` (policy review-required, disallowed tool, or budget/deadline exhaustion). `INTERRUPTED_FOR_REVIEW` is out of scope — no human-interrupt/resume flow exists yet (Known gaps).

### Implementation

- `npm install @langchain/langgraph@^1.4.10 @langchain/core@^1.1.48 zod@^4.2.0` — `zod` and `@langchain/core` are `@langchain/langgraph`'s declared peer dependencies.
- `src/agent-runtime/langgraph/lending-operations-agent-runtime.ts` — `createLendingOperationsAgentRuntime(deps)` returns an `AgentRuntimePort`. Internally: a `StateGraph` built from `Annotation.Root` (three nodes — `checkCompleteness`, `evaluatePolicy`, `resolveOutcome` — wired with `addConditionalEdges` that route to `END` the moment any node sets `route`, or continue otherwise), compiled and invoked fresh on every `run()` call. Each node:
  - Checks `budgetExceeded()` first (trusted-clock deadline check against `runDeadlineAt`, plus `remainingStepBudget <= 0`) and fails closed to `ROUTED_TO_MANUAL_REVIEW` without calling a tool if either is already exhausted.
  - Calls its tool through `invokeTool(registry, ...)`, where `registry` is built via `buildToolRegistry` from **only** the tools named in `input.allowedTools` — an unlisted tool is simply absent from the registry, so it fails the same tested "unregistered tool" path `agent-tool.types.spec.ts` already covers, rather than a second, independently-written allow-check that could drift from it.
  - Records every attempt in `agentState.attemptedTools` (Section 9.3), win or lose.
  - `checkCompleteness`: incomplete evidence → `AWAITING_INFORMATION`.
  - `evaluatePolicy`: loads the case's `jurisdictionCode`/`loanType` to build the tool's args (product code via the existing `loanTypeToProductCode`, lifecycle event via the newly shared `UNDERWRITING_REVIEW_LIFECYCLE_EVENT`); `REVIEW_REQUIRED` → `ROUTED_TO_MANUAL_REVIEW` with the resolver's own unresolved reasons as the review reason.
  - `resolveOutcome`: loads the case's `statedMonthlyIncome` and its latest `INCOME` evidence fact, runs the existing pure `evaluatePolicyRule` against each matched policy version, and — on a match — calls `create_condition` directly (its Section 9.4 approval boundary is "Validated binding and evaluation required," a structural guard already satisfied by this point, not a human-approval gate) before returning `PROPOSED_ACTION` with `proposedAction` recording what was created. No match → `PROPOSED_ACTION` with no `proposedAction` (ready, nothing to do).
- `src/agent-runtime/tools/evaluate-policy.tool.ts` — widened `EvaluatePolicyResult.matchedVersions` to include each version's parsed `rule: PolicyRuleDocument` (previously only `policyVersionId`/`ruleId`/`version` refs). `PolicyEvaluationService.evaluate()` already resolves this internally; the tool just wasn't surfacing it. Without this, the graph would have needed a second, duplicate resolution or a direct `PolicyEvaluationService` call that bypassed the tool layer — the DSL document itself isn't sensitive (tenant-authored, reviewed policy content, not a secret), so surfacing it is a safe widening, not a guard weakening.
- `src/policy/lifecycle-events.ts` (new) — `UNDERWRITING_REVIEW_LIFECYCLE_EVENT`, extracted from a private constant `case-conditions.activities.ts` already had, now shared with the new runtime so the two independent callers of `PolicyEvaluationService` can't drift to different lifecycle-event strings.
- `src/agent-runtime/langgraph/lending-operations-agent-runtime.spec.ts` (new) — real database, real seeded policy version (Section 10.7's example, isolated jurisdiction codes), real `graph.invoke()` calls. Seven cases: missing evidence → `AWAITING_INFORMATION`; matching income → `PROPOSED_ACTION` with no condition created; diverging income → `PROPOSED_ACTION` with a real `LoanCondition` row created and `policySnapshotId` populated, case moved to `CONDITIONS_OPEN`; uncovered jurisdiction → `ROUTED_TO_MANUAL_REVIEW` with the resolver's reason surfaced; a disallowed required tool → fails closed to `ROUTED_TO_MANUAL_REVIEW` without ever reaching the policy step; zero starting step budget → `ROUTED_TO_MANUAL_REVIEW` without invoking any tool; already-past deadline → same.

### Affected files

- `package.json`, `package-lock.json`
- `src/agent-runtime/langgraph/lending-operations-agent-runtime.ts`, `.spec.ts` (new)
- `src/agent-runtime/tools/evaluate-policy.tool.ts`, `.spec.ts`
- `src/policy/lifecycle-events.ts` (new)
- `src/workflows/case-conditions.activities.ts` (import-only change: shares the extracted lifecycle-event constant)
- `docs/DEVELOPMENT_LOG.md`, `README.md`

### Decisions and alternatives

- **`Annotation.Root` over a Zod state schema**: LangGraph.js v1 supports both; `Annotation.Root` needs no new modeling of `LendingOperationsAgentState` as a Zod schema (it already exists as a plain TS interface) and keeps the graph's state definition a thin wrapper (`agentState`, `route`, a `policyEvaluation` scratch field) rather than a parallel schema to keep in sync.
- **A fresh `StateGraph` built and compiled inside every `run()` call, not once at factory time**: each run's node closures need that run's own `input.allowedTools`/`runDeadlineAt`/tool-context — building the graph once and threading that through LangGraph's `config`/`Runtime` parameter would work too, but a fresh build is simpler, correct, and this is not a hot path (one Agent run per case-conditions cycle, not per request).
- **`allowedTools` enforced by registry membership, not a separate check**: reusing `invokeTool`'s already-tested "unregistered tool → FAILURE, never throws" behavior for two different reasons (tool doesn't exist vs. tool exists but isn't authorized for this run) means one code path to trust instead of two.
- **`create_condition` executed directly on a match, not staged as a proposal awaiting a separate approval step**: Section 9.4's approval boundary for this tool is "Validated binding and evaluation required" — a structural precondition (policy binding validated, rule matched), not "Human ... approval" the way `send_information_request`/protected communications require (Section 6.3/6.4/9.4). `case-conditions.activities.ts` already executes the identical tool call directly for the same reason; the Agent runtime does the same rather than inventing a different approval model for the same tool.
- **Standalone, not wired into `case-conditions.activities.ts`**: Section 9.2's runtime-separation diagram is explicit that the Temporal workflow, the bounded Agent run, and the deterministic policy engine are three separate layers — the workflow does not have to route a fully deterministic decision through an Agent run. Swapping the M2 workflow's `evaluateConditions` activity to call this runtime instead of the policy engine directly would be a real behavior change (different retry semantics, different failure surface under Temporal's activity model, a new step-budget/deadline concern layered onto Temporal's own timeout/retry policy) that deserves its own deliberate slice and justification, not a byproduct of proving the port works.
- **Only `remainingStepBudget` and the trusted deadline enforced, not token/cost/provider-call budgets**: those need the ledger/reservation system Section 9.3 describes, which doesn't exist yet (M3-006's Known gaps, unchanged). Enforcing the two dimensions that need no ledger is real, additive progress; claiming the rest would be false completeness.

### Verification

```text
npm install @langchain/langgraph @langchain/core zod
  20 packages added, 0 vulnerabilities

npm run build / npm run lint:check
  both passed

node -e "require('dist/agent-runtime/langgraph/lending-operations-agent-runtime.js')"
  loads cleanly under plain Node — no ESM/CJS interop failure between
  the compiled CommonJS output and @langchain/langgraph's package

scratch stack: docker compose (postgres 5433, temporal 7234) + migration:run
  all 8 migrations applied cleanly, including the M3 policy schema and
  seed migrations

DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache --silent
  31 suites passed, 212 tests passed (30->31 suites, 205->212 tests;
  +7 from lending-operations-agent-runtime.spec.ts, all real-database,
  real-graph-invocation cases)

DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
  2 suites passed, 13 tests passed (unchanged)

scratch stack torn down (docker compose down -v); no synthetic data
left in any persistent database
```

### Security, privacy, cost, and compatibility

- No new externally-reachable surface — this runtime has no controller/resolver caller yet.
- `evaluate_policy`'s widened result surfaces policy DSL content (not borrower data) to a caller that already receives the guard's pass/fail outcome; no new sensitive-data exposure.
- New dependencies (`@langchain/langgraph`, `@langchain/core`, `zod`) add real supply-chain surface — all three are widely-used, actively maintained packages already implied by the charter's own Section 9.2 ("LangGraph is an Agent runtime adapter"). No paid API or external network call is introduced; the graph runs entirely in-process against the same Postgres the rest of the app uses.
- `npm install` reported an unrelated pre-existing peer-dependency warning between `@apollo/server` and `@apollo/server-plugin-landing-page-graphql-playground` (present before this change) and an `EBADENGINE` warning for the local Node version (v22) against `package.json`'s `engines.node >=24` — both pre-existing environment conditions, unaffected by and unrelated to this slice.

### Known gaps

- Not wired into the M2 Temporal workflow — `case-conditions.activities.ts` is unchanged in behavior (only its lifecycle-event constant now comes from a shared file). Whether/how to route the workflow's decision through this runtime instead of calling the policy engine directly is an open, separate decision.
- No token, provider-call, or cost-ledger enforcement — only step count and trusted deadline are checked (M3-006's original Known gaps, narrowed but not closed).
- `INTERRUPTED_FOR_REVIEW` is never produced — no mandatory-review-trigger logic (Section 9.6) or human-interrupt/resume flow exists yet; today's three tools only ever reach `AWAITING_INFORMATION`, `PROPOSED_ACTION`, or `ROUTED_TO_MANUAL_REVIEW`.
- Only 3 of Section 9.4's 16 tools are wired into this graph, same as M3-006's own gap — the graph structure would need real nodes for any additional tool, not just a registry entry.
- No checkpointer/persistence configured on the compiled graph (`compile({ checkpointer: ... })` was left at its default) — a run is fully in-memory for its duration; nothing depends on LangGraph's own durability features, since Temporal (when this is eventually wired in) or the caller's own retry is the durability boundary Section 9.2 assigns to that layer.

### Next safe step

Decide whether/how `case-conditions.activities.ts`'s `evaluateConditions` should route through this runtime instead of calling `PolicyEvaluationService`/`createConditionTool` directly — and if so, design how Temporal's own retry/timeout semantics compose with the runtime's step/deadline budget rather than fighting it. Independently, Section 9.6's mandatory review triggers and a real token/cost budget ledger are the next pieces of Section 9 that would make `ROUTED_TO_MANUAL_REVIEW`/`INTERRUPTED_FOR_REVIEW` reflect the charter's actual safety requirements rather than only the two dimensions checked today.

## M3-008: Wire the LangGraph Agent runtime into the M2 workflow

### Status

Implemented and verified. `case-conditions.activities.ts`'s `evaluateConditions` now runs a bounded Agent run through `createLendingOperationsAgentRuntime` (M3-007) instead of calling `PolicyEvaluationService`/`createConditionTool` directly — the decision that opens a condition (or clears a case to `READY_FOR_UNDERWRITING`, or routes it to `MANUAL_REVIEW`) is now genuinely produced by the LangGraph.js graph. `case-conditions.workflow.ts` itself is unchanged in structure — it still calls a single `evaluateConditions` activity and interprets the same `EvaluateConditionsResult` shape.

### Acceptance criterion

The real M2 Temporal workflow, run through a real worker against a real database, must produce its condition-opening/ready/review-required decisions via the LangGraph runtime — not as a parallel, unused code path. Every existing workflow-level behavior (durable wait, signal-driven resolution, retry classification, replay-safety) must keep working unchanged, since none of that is specific to how `evaluateConditions` reaches its decision internally.

### Implementation

- `src/workflows/case-conditions.activities.ts`:
  - `evaluateConditions`'s body replaced: loads the case, builds a `LendingOperationsAgentState` (caseVersion from `LoanCase.version`, an already-existing optimistic-lock column; workflowStatus from the case's own status; consentStatus hardcoded `'VALID'`, same placeholder every other state construction in this codebase uses since no consent-tracking entity exists yet), and calls `agentRuntime.run(...)` with `allowedTools: ['check_case_completeness', 'evaluate_policy', 'create_condition']` and a budget/deadline bounded well inside the workflow's own 30s activity `startToCloseTimeout` (`AGENT_RUN_STEP_BUDGET = 10`, `AGENT_RUN_DURATION_BUDGET_MS = 20_000`).
  - The `AgentRunRoute` result is mapped back to the pre-existing `EvaluateConditionsResult` shape (`'READY' | 'CONDITION_OPENED' | 'REVIEW_REQUIRED'`) so the workflow needs no changes: `PROPOSED_ACTION` with a `create_condition` action → `CONDITION_OPENED`; `PROPOSED_ACTION` with no action → `READY` (the activity itself still performs the `READY_FOR_UNDERWRITING` write + `workflow_run.completed` outbox event, now factored into a shared `finalizeReadyForUnderwriting` helper also used by the `markReadyForUnderwriting` activity — deduplicating what were previously two near-identical inline blocks); `ROUTED_TO_MANUAL_REVIEW` → `REVIEW_REQUIRED`; `AWAITING_INFORMATION`/`INTERRUPTED_FOR_REVIEW` (neither reachable at this call site today) → `REVIEW_REQUIRED`, failing closed rather than treating an unrecognized route as readiness.
  - `EvaluateConditionsInput` changed from `{ tenantId, caseId, income }` to `{ tenantId, caseId, workflowRunId }` — the Agent run's `resolveOutcome` node reads evidence back from the database itself (the same `EvidenceFact` rows the workflow's fetch activities already recorded), so passing `income` through as a parameter is no longer meaningful; `workflowRunId` correlates the Agent run to its Temporal run for Section 9.3's `LendingOperationsAgentState.workflowRunId`.
  - `workflowRunId` is threaded in as an explicit parameter from the *workflow* (`workflowInfo().runId`, deterministic-safe to call from workflow code) rather than read via `activityInfo()` inside the activity — `@temporalio/activity`'s `Context.current()` throws `Activity context not initialized` when an activity function is invoked directly outside a real Temporal worker execution, which is exactly how `case-conditions.activities.spec.ts` calls every activity in this file. Threading the value in keeps `evaluateConditions` identically callable both ways.
  - Removed now-unused imports (`evaluatePolicyRule`, `PolicyFactContext`, `loanTypeToProductCode`, `UNDERWRITING_REVIEW_LIFECYCLE_EVENT`, `createConditionTool`) — all of that logic now lives inside the Agent runtime's nodes (M3-007).
- `src/workflows/case-conditions.workflow.ts`: fetches income/credit/document evidence the same as before (still needed for the audit trail and for `check_case_completeness` to find), but no longer destructures/passes `income` — just `await Promise.all([...])`. Calls `evaluateConditions` with `workflowRunId: workflowInfo().runId` instead of `income`.
- `src/workflows/case-conditions.activities.spec.ts`: added a `seedEvidence` helper (writes real `INCOME`/`CREDIT`/`DOCUMENT` `EvidenceFact` rows) and updated all four `evaluateConditions` call sites to seed evidence first and pass `workflowRunId` instead of `income` — the new implementation genuinely requires real evidence rows to exist (via `check_case_completeness`) rather than accepting income as a bare parameter, which is a real, correct behavioral tightening: it now matches how the workflow actually calls it in production.
- No changes needed to `case-conditions.workflow.spec.ts` — it mocks the whole `CaseConditionsActivities` interface and never asserts on `evaluateConditions`'s call arguments, only its mocked return value, so the activity's internal rewrite and input-shape change didn't require touching this suite.

### Affected files

- `src/workflows/case-conditions.activities.ts`
- `src/workflows/case-conditions.activities.spec.ts`
- `src/workflows/case-conditions.workflow.ts`
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Rewrite `evaluateConditions`'s internals, keep its name/signature shape and the workflow untouched** — the workflow only depends on `EvaluateConditionsResult`'s three-way outcome, never on how the activity gets there. Changing the activity's implementation without changing the workflow's call graph is the smallest change that satisfies "wire the runtime into the workflow": the workflow now runs on the LangGraph decision by construction, with zero workflow-level risk (no new activity call sequencing, no history-shape change, no replay-compatibility question).
- **`workflowRunId` passed in from the workflow, not read via `activityInfo()`** — this was the one real design fork in this slice. `activityInfo()`/`Context.current()` only works inside a live Temporal activity execution (real worker), and would have broken every direct-call test in `case-conditions.activities.spec.ts`, which is the established, deliberate testing pattern for this file (call activities as plain functions against a real database, no worker needed). `workflowInfo().runId` is available synchronously and deterministically in workflow code with no such restriction, and the workflow already has to call this activity anyway — passing the value through is strictly simpler than making the activity layer's correlation-id sourcing conditional on its caller.
- **`finalizeReadyForUnderwriting` extracted as a shared private helper** — the old code had two near-identical 12-line blocks (case's "no match" branch, and the separate `markReadyForUnderwriting` activity) doing the same status update + outbox write. Rewriting `evaluateConditions` anyway made this duplication newly visible; factoring it out is a same-scope cleanup of code already being touched, not a speculative abstraction.
- **The Agent run's own budget is fixed, small constants (10 steps, 20s), not derived from Temporal's configured retry/timeout policy** — Section 9.3's budget model is a run-level concept, and this activity performs exactly one bounded run per invocation. Deriving it dynamically from `proxyActivities`' `startToCloseTimeout` would require threading workflow-side configuration into the activity for no present benefit; a fixed constant with a comment stating the containment relationship (inner budget stays clearly inside the outer timeout) is honest and sufficient until there's a second caller with different needs.
- **Evidence-seeding tightening in the test suite treated as correct, not worked around** — some tests previously passed a bare `income` object without any `EvidenceFact` rows existing at all, which no longer reflects how `evaluateConditions` is actually invoked in production (always after the workflow's fetch activities have written evidence). Seeding real rows in the test, rather than finding a way to keep accepting a parameter the production code path no longer uses, keeps the test honest about what the activity now requires.

### Verification

```text
npm run build / npm run lint:check
  both passed, no manual fixes needed beyond eslint --fix's prettier
  formatting pass

scratch stack: docker compose (postgres 5433, temporal 7234) + migration:run
  all 8 migrations applied cleanly (fresh scratch database, independent
  of M3-007's)

DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache --silent
  31 suites passed, 212 tests passed (unchanged counts from M3-007 —
  this slice rewires an existing call path rather than adding new
  tests; case-conditions.activities.spec.ts's evaluateConditions tests
  now exercise the real LangGraph runtime instead of the old inline
  logic, and case-conditions.workflow.spec.ts's 7 tests — real Temporal
  worker, mocked activities — passed unchanged)

DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
  2 suites passed, 13 tests passed (unchanged)

Manual end-to-end proof (real REST API + real Temporal worker, scratch
Postgres/Temporal, a real tenant seeded directly):
  created a case (statedMonthlyIncome=25000, jurisdictionCode=US-CA),
  started its workflow-run. Worker log confirms the real sequence:
  evidence fetched -> check_case_completeness's EvidenceFact query ->
  evaluate_policy's resolver queries (Jurisdiction/PolicyApplicability/
  PolicyVersion/CasePolicyBinding) -> CasePolicySnapshot+CasePolicyBinding
  inserted (REFRESHED) -> resolveOutcome's own LoanCase+latest-INCOME-
  EvidenceFact query -> LoanCondition inserted with description
  "difference_percent(application.monthly_income=25000,
  evidence.verified_monthly_income=5218) = 79.13% > 10%" -> LoanCase
  status -> CONDITIONS_OPEN. GET confirmed policySnapshotId populated
  on the condition row. POST .../reviews (WAIVED) resumed the durable
  wait and drove the case to READY_FOR_UNDERWRITING, proving the
  signal/resume path is unaffected by the rewiring.
  All synthetic rows deleted afterward; scratch stack torn down.
```

### Security, privacy, cost, and compatibility

- No externally-visible API contract change — `POST .../workflow-runs` and `POST .../reviews` behave identically from a caller's perspective; only the internal decision path changed.
- No new outbox event types or schema changes; the exact same `condition.opened`/`workflow_run.completed`/`workflow_run.waiting_for_review` events are produced as before, now via `finalizeReadyForUnderwriting`/`createConditionTool` reached through the Agent runtime instead of inline code.
- The Agent run's budget (10 steps / 20s) sits strictly inside the workflow's existing 30s activity timeout, so this cannot introduce a new source of activity timeout under normal operation; if anything, an exhausted Agent-run budget now fails closed to `MANUAL_REVIEW` slightly earlier than Temporal's own timeout would have.

### Known gaps

- The Agent run's budget is currently unconditional constants, not derived from or reconciled with the workflow's actual configured retry policy — acceptable for a single caller today, called out explicitly as a design decision above rather than left implicit.
- Everything M3-007 already listed as a known gap (no token/cost/provider-call ledger enforcement, no `INTERRUPTED_FOR_REVIEW`/mandatory-review-trigger logic, only 3 of 16 registered tools) is unchanged by this slice — wiring the runtime in didn't add new capability to the runtime itself, only a new real caller.
- `caseVersion`/`workflowStatus`/`consentStatus` are populated once at the start of the Agent run and never re-read mid-run; a concurrent modification to the case during the (currently sub-second) run window would not be reflected in the Agent's state, though `create_condition`'s own transaction still operates on the case's current row at write time regardless.

### Next safe step

Section 9.6's mandatory review triggers and a real budget ledger remain the largest unbuilt pieces of Section 9 — building them would let this same wired-in runtime start producing `INTERRUPTED_FOR_REVIEW` and enforcing token/cost dimensions it currently only carries as unenforced state. Independently, `EvaluationInputManifest` (Section 10.5) is still the largest unbuilt piece of the policy side of M3.

## M3-009: Consent-status review trigger and compare-and-swap condition writes

### Status

Implemented and verified. Two of the three items queued after M3-008 (consent-status trigger, Section 10.5's compare-and-swap protection) are done; the third (a real token/cost/provider-call budget ledger) was deliberately not built this slice — see Decisions.

### Acceptance criterion

Of Section 9.6's twelve mandatory-review-trigger categories, every one that has real, checkable signal in this codebase today must actually gate the Agent run; every one that doesn't must be named as a known gap rather than faked. Separately, a condition-opening or case-readiness write driven by a stale evaluation (the case having changed since that evaluation's initial state was captured) must never silently commit — it must be detected and handled without a human needing to intervene for the routine case.

### Findings: honest scope of Section 9.6

Re-read against the current codebase state before writing anything, of the twelve triggers:

- **Reachable with real signal today**: unresolved jurisdiction/effective-date/transition-rule conflict (already implemented — `evaluate_policy`'s `REVIEW_REQUIRED` path); step/time budget exhaustion (already implemented — `budgetExceeded`); a tool's own execution failure (already implemented — `invokeTool`'s `FAILURE` outcome routes to review); **consent revoked/missing/expired mid-case** (field exists, was never checked — closed by this slice).
- **No backing signal exists in this codebase**: contradictory evidence (single-source-per-type model, nothing to contradict); evidence confidence threshold (no confidence field on `EvidenceFact`); malformed *model* output (no model call exists anywhere in this graph); every communication-related trigger (no communication system at all — Section 6.4's classifier is unbuilt); provider result outside the normalized contract (no contract/schema validation layer — that's M4/Section 11 scope); prompt-injection or tool-manipulation signal (there is no prompt for anything to inject into — this graph is deterministic tool orchestration, not model-driven); tenant risk policy category (no tenant configuration surface for this exists); manual waiver/override of a deterministic condition (this happens through `resolveCondition`, a separate human-driven activity outside the Agent run entirely — not something the run itself observes or gates).

Building stub checks for the second group would create the appearance of coverage the system cannot actually back — left as known gaps instead.

### Implementation

#### Consent-status trigger

- `src/agent-runtime/langgraph/lending-operations-agent-runtime.ts`: new `consentInvalid()` guard and `verifyConsent` graph node, wired as the graph's first step (before `checkCompleteness`), matching Section 9.5's Agent loop ("VERIFY TENANT, CONSENT, TRUSTED DEADLINE, AND AUTHORITATIVE BUDGET LEDGER" is explicitly the second loop step, before evidence inspection) and Section 6.3's authority order (consent is listed first of all controls). Any `consentStatus !== 'VALID'` routes to `ROUTED_TO_MANUAL_REVIEW` before any tool is invoked or any step budget consumed. `evaluateConditions` still always constructs `consentStatus: 'VALID'` (no consent-tracking entity exists to source anything else from), so this guard is inert in production today — its value is that it's now real, tested logic ready the moment a consent system exists, not a TODO comment.

#### Compare-and-swap condition/readiness writes (Section 10.5's core protection, honestly scoped)

- `LoanCase.version`'s own doc comment has said "Optimistic concurrency for compare-and-swap writes (Section 10.5, 17.1)" since the column was added — nothing actually checked it. Every existing write used `Repository.update(criteria, partial)`, which TypeORM does not version-guard the way `.save()` on a loaded entity would; a case's version was incrementing on every write, but nothing was ever rejected for having the wrong one.
- `src/agent-runtime/tools/create-condition.tool.ts`: `CreateConditionArgs` gains `expectedCaseVersion: number`. `execute()` now reads the case fresh inside its transaction and compares `.version` against `expectedCaseVersion` *before* writing anything; a mismatch returns `{ outcome: 'STALE_CASE_VERSION' }` (a typed, non-exceptional result — staleness is an expected outcome in a concurrent system, not a bug) with no condition row, no case mutation, and no outbox events. On a match, the actual `LoanCase` update additionally carries `version: expectedCaseVersion` in its `WHERE` criteria (closing the residual race between the read and the write within the same transaction); if that atomic update still affects zero rows — a true race within the transaction's own lifetime, not the routine case — it throws `StaleCaseVersionError` instead, rolling back the condition insert too.
- `CreateConditionResult` changed from a bare `{ conditionId }` to a discriminated union (`{ outcome: 'CREATED'; conditionId }` or `{ outcome: 'STALE_CASE_VERSION' }`).
- `src/agent-runtime/langgraph/lending-operations-agent-runtime.ts`: `resolveOutcomeNode` passes `expectedCaseVersion: state.agentState.caseVersion` (captured once, at the very start of the Agent run, in `LendingOperationsAgentState.caseVersion` — already existed since M3-006) and, on a `STALE_CASE_VERSION` result, throws `StaleCaseVersionError` rather than routing to `ROUTED_TO_MANUAL_REVIEW` — deliberately not treated as a tool failure, since routing a routine concurrency race to a human would be an unnecessary escalation for something the system can self-heal (see Decisions).
- `src/workflows/case-conditions.activities.ts`: `finalizeReadyForUnderwriting` (the "no condition needed, case ready" write, previously duplicated inline and factored out in M3-008) gains an optional `expectedCaseVersion` parameter using the identical check-in-`WHERE`-clause pattern; `evaluateConditions`'s own call to it now passes `initialState.caseVersion`. The plain `markReadyForUnderwriting` activity (called after a human resolves a condition via signal, not from an evaluation) keeps calling it without `expectedCaseVersion` — that write isn't driven by an aging evaluation snapshot, so CAS protection doesn't apply there.
- `src/workflows/case-conditions.workflow.ts`: `evaluateConditions`'s call is now wrapped in try/catch (mirroring the existing evidence-fetch block) — previously this activity had no realistic way to throw after Temporal's retries, so the workflow never needed to catch it; a `StaleCaseVersionError` surviving all retries now routes to `MANUAL_REVIEW` instead of crashing the whole workflow.

### Affected files

- `src/agent-runtime/langgraph/lending-operations-agent-runtime.ts`, `.spec.ts`
- `src/agent-runtime/tools/create-condition.tool.ts`, `.spec.ts`
- `src/workflows/case-conditions.activities.ts`
- `src/workflows/case-conditions.workflow.ts`, `.spec.ts`
- `docs/DEVELOPMENT_LOG.md`, `README.md`

### Decisions and alternatives

- **Token/cost/provider-call budget ledger: deliberately not built this slice.** No tool in this codebase makes a model call or a real outbound provider call — evidence is fetched by separate workflow activities before the Agent run ever starts, and all three registered tools are database-only. Every consumer of these budget dimensions is currently and permanently zero. Building the atomic, versioned, multi-level (run/workflow/tenant) reservation system Section 9.3 describes for dimensions with no real consumer would be exactly the kind of premature scaffolding this codebase has consistently avoided (M3-005 made the identical call for the policy-binding fast path: "no policy-activation write-path exists yet"). Documented as a known gap rather than stubbed.
- **A full `EvaluationInputManifest` struct was not built.** Roughly half its fields (`authorizationDecisionId`, `consentVersionRefs`, evidence `contentHash`/`adapterVersion`/`normalizationSchemaVersion`, `calculationRefs`) depend on subsystems that don't exist yet (authorization grants, evidence content-hashing, provider adapter versioning, a calculation subsystem). Fabricating placeholder values for those fields would misrepresent what's actually being tracked. Instead, this slice builds the specific protective *behavior* the manifest exists to guarantee for condition writes — the compare-and-swap semantics — using the `LoanCase.version` column that already exists for exactly this purpose. The full manifest struct remains a known gap.
- **Staleness is a typed tool result, not an exception, for the routine case.** The version mismatch is read and compared *before* any write is attempted, so it's cheap to detect and doesn't need transaction rollback semantics to signal — modeling it as `{ outcome: 'STALE_CASE_VERSION' }` keeps `create_condition.execute()`'s control flow honest (staleness is an expected, common outcome in a system with concurrent evaluations, not a programming error). The one place a real throw remains is the genuinely exceptional residual race inside the same transaction, which does need rollback.
- **A stale-version result is *not* routed to `ROUTED_TO_MANUAL_REVIEW`; it propagates and lets Temporal retry.** Section 10.5 itself prescribes the fix for staleness: "a concurrent... case mutation... requires a new evaluation manifest" — i.e., re-evaluate, not escalate to a human. `evaluateConditions` is already wrapped in `proxyActivities`' retry policy (3 attempts); letting the failure propagate naturally re-runs the whole evaluation against the case's current state, which is both simpler and more correct than manufacturing a special-case retry mechanism or asking a person to resolve what's fundamentally routine concurrency.
- **`markReadyForUnderwriting` (the post-signal-resolution activity) keeps its unconditional write.** CAS protection matters for writes driven by an evaluation's possibly-stale view of the case; this activity's write is driven by a human's just-delivered signal, not by data gathered earlier in a run — there's no "expected version" concept for it to check against without inventing one that doesn't correspond to anything real.

### Verification

```text
npm run build / npm run lint:check
  both passed, no manual fixes needed beyond eslint --fix's prettier pass

scratch stack: docker compose (postgres 5433, temporal 7234) + migration:run
  all 8 migrations applied cleanly (fresh scratch database)

DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache --silent
  31 suites passed, 216 tests passed (212 -> 216: +2 in
  lending-operations-agent-runtime.spec.ts [consent-invalid,
  stale-case-version], +1 in create-condition.tool.spec.ts
  [STALE_CASE_VERSION returns cleanly with zero writes], +1 in
  case-conditions.workflow.spec.ts [evaluateConditions rejecting routes
  to MANUAL_REVIEW])

DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
  2 suites passed, 13 tests passed (unchanged)

Manual smoke test (real REST API + real Temporal worker, scratch
Postgres/Temporal): created a case with a genuine income discrepancy,
started its workflow-run, confirmed the unchanged happy path still
produces CONDITIONS_OPEN with policySnapshotId populated and the case
version incrementing exactly as before (1 -> 2 -> 3) — proving the new
expectedCaseVersion check correctly passes on the non-racing path, not
just that it correctly rejects on the racing one (already covered by
the unit tests' mismatched-caseVersion technique, which simulates
staleness without needing genuine concurrent execution). All synthetic
rows deleted afterward; scratch stack torn down.
```

### Security, privacy, cost, and compatibility

- No externally-visible API contract change.
- The CAS check is strictly additive safety — it can only cause a write that would previously have silently succeeded against stale data to instead be rejected and retried; it cannot reject a write that was already going to succeed against current data.
- `verifyConsent`'s guard is inert today (production always constructs `consentStatus: 'VALID'`), so this introduces no behavior change for any current caller — its cost is one cheap in-memory check per run.

### Known gaps

- Section 9.6's eight remaining trigger categories (contradictory evidence, evidence confidence, malformed model output, every communication-related trigger, provider-contract conformance, prompt-injection signals, tenant risk policy, manual condition override) have no backing signal in this codebase and are not implemented — see Findings above for exactly why each one currently can't be honest.
- No token/cost/provider-call budget ledger — unchanged from M3-007/M3-008, and now explicitly re-affirmed as deliberately deferred rather than merely unaddressed.
- No full `EvaluationInputManifest` — only the compare-and-swap protection it exists to guarantee for condition/readiness writes is implemented, not the immutable-input-references struct itself (authorization, consent-version, evidence-hash, and calculation refs all remain unbuilt).
- `caseVersion` is still captured once at Agent-run start and never refreshed mid-run (unchanged from M3-008) — the new CAS check is what makes that acceptable: a stale observation is now caught at write time instead of silently producing an incorrect write.

### Next safe step

Nothing further is queued specifically by this slice. The two largest remaining pieces of Section 9/10 for M3 are unchanged from M3-008's own note: a real token/cost/provider-call budget ledger (deliberately deferred here, would need a genuine consumer — e.g. a model-based planning node or a real provider adapter — to be worth building), and the communication classification system (Section 6.4) that would make the communication-related Section 9.6 triggers implementable instead of permanently out of reach.

## M3-010: Reviewer interrupt and resume flow

### Status

Implemented and verified. `AgentRunRoute.INTERRUPTED_FOR_REVIEW` — typed since M3-006, never produced until now — is real: policy-applicability ambiguity interrupts the Agent run, the case durably waits in a genuinely new status (`WAITING_FOR_REVIEW`), and a reviewer signal resumes it by re-running the evaluation from scratch. First read against the charter's actual M3 exit-evidence list (Section 20) rather than working from memory, to scope this precisely rather than improvised.

### Acceptance criterion

Section 9.5's Agent loop distinguishes "ambiguity... interrupt for review" from "budget or runtime failure: route to manual review" — these must actually route differently, not both collapse into `MANUAL_REVIEW`. An interrupted case must durably wait (survives a worker restart, per the existing `resolveCondition` pattern) and, once a reviewer signals resumption, must re-run the evaluation — through the real REST API and a real Temporal worker, not just mocked activities.

### Implementation

#### Where "ambiguity" comes from, and where it doesn't

Of the two things that used to both route to `ROUTED_TO_MANUAL_REVIEW`, only policy-applicability ambiguity (`evaluate_policy`'s `REVIEW_REQUIRED` — uncovered jurisdiction or an overlapping released version conflict) is genuinely an "ambiguity" a reviewer can resolve and ask to retry. Consent invalid, budget/deadline exhaustion, and a tool's own failure are runtime failures per Section 9.5's own text, not ambiguities — those stay routed to manual review, unchanged.

- `src/agent-runtime/langgraph/lending-operations-agent-runtime.ts`: new `interruptForReview()` helper (parallel to `manualReview()`, setting `route: 'INTERRUPTED_FOR_REVIEW'` instead). `evaluatePolicyNode`'s `REVIEW_REQUIRED` branch now calls it instead of `manualReview()`. Nothing else in the graph changed — `budgetExceeded`, `consentInvalid`, and tool-`FAILURE` handling still route to manual review, matching the charter's own taxonomy exactly.

#### Interrupt is not a LangGraph-level suspension

Considered and rejected: using LangGraph's own `interrupt()`/checkpointer primitives to pause and resume mid-graph-execution. Section 9.2's runtime-separation design and Section 9.3's own text ("time spent durably waiting for information or review is governed by workflow timers and is not hidden Agent runtime... **resume may create a new server-authorized run deadline**") both say the long human-wait belongs to Temporal, not to a bounded Agent run — a run interrupts by *ending* (with `INTERRUPTED_FOR_REVIEW`), and resumption is a **new**, independent bounded run, not a magically-continued old one. This is architecturally simpler (no checkpointer, no cross-activity LangGraph state persistence to reason about) and matches how `resolveCondition`'s existing durable-wait-then-continue pattern already works at the workflow level.

- `src/workflows/case-conditions.signals.ts`: new `resumeInterruptedEvaluationSignal` (`{ actorId, note? }`) — carries no resolution data of its own, mirroring how a reviewer is expected to have already fixed the underlying ambiguity (activated jurisdiction coverage, resolved an overlapping policy version) through some means outside this workflow before signaling "try again."
- `src/database/enums/case-status.enum.ts`'s `WAITING_FOR_REVIEW` — defined since the schema's first migration, never once set by any code path — is now genuinely used, distinct from `MANUAL_REVIEW`'s "cannot proceed safely within the configured automation boundary" (its own Section 6.1 definition: "a protected or ambiguous action requires a person," exactly this case).
- `src/database/outbox/outbox-event-types.ts`: new `EvaluationInterrupted` (`evaluation.interrupted`) event — distinct from `WorkflowRunWaitingForReview` (waiting for a reviewer to resolve an *already-opened* condition); this fires before any condition exists.
- `src/workflows/case-conditions.activities.ts`: `EvaluateConditionsResult.outcome` gains `'INTERRUPTED'`, mapped from `AgentRunRoute.INTERRUPTED_FOR_REVIEW` (previously folded into the same fail-closed bucket as the never-reachable `AWAITING_INFORMATION`). New `markWaitingForReview` activity sets the case to `WAITING_FOR_REVIEW` and writes the new outbox event.
- `src/workflows/case-conditions.workflow.ts`: the evaluate-and-dispatch section is now a loop. On `INTERRUPTED`, it calls `markWaitingForReview`, durably waits (`condition()`) for `resumeInterruptedEvaluationSignal`, resets the local signal variable, and loops back to call `evaluateConditions` again — supporting any number of interrupt cycles, not just one. `REVIEW_REQUIRED` (now only reachable for genuine runtime failures) still routes straight to `MANUAL_REVIEW`, unchanged.
- `src/workflows/temporal-client.service.ts`: new `resumeInterruptedEvaluation()`, mirroring `resolveCondition()`'s shape and `WorkflowNotFoundError` contract.

#### REST surface: one endpoint, two review actions

Section 15.1's target contract lists exactly one review endpoint (`POST .../reviews`) — not a second URL per review type. `src/cases/dto/review.dto.ts` (replacing `resolve-condition.dto.ts`) generalizes the existing DTO into `ReviewDto` with a required `reviewType: 'CONDITION_RESOLUTION' | 'RESUME_EVALUATION'` discriminator; `resolution` is now conditionally required (`@ValidateIf`) only for `CONDITION_RESOLUTION`. `CasesController.resolveCondition` → `submitReview`; `CasesService.resolveCondition` → `submitReview`, dispatching to `TemporalClientService.resolveCondition` or `.resumeInterruptedEvaluation` by `reviewType`. This is a breaking change to the existing endpoint's request shape (every caller must now include `reviewType`) — acceptable since this API has no real external callers yet (still exit-evidence/demo scope per Section 7), and every existing caller in this repo (tests, e2e spec) was updated in the same slice.

### Affected files

- `src/agent-runtime/langgraph/lending-operations-agent-runtime.ts`, `.spec.ts`
- `src/workflows/case-conditions.signals.ts`, `.activities.ts`, `.activities.spec.ts`, `.workflow.ts`, `.workflow.spec.ts`, `temporal-client.service.ts`
- `src/database/outbox/outbox-event-types.ts`
- `src/cases/dto/review.dto.ts` (new, replaces `resolve-condition.dto.ts`), `cases.controller.ts`, `.controller.spec.ts`, `cases.service.ts`, `.service.spec.ts`
- `test/cases.e2e-spec.ts`
- `docs/DEVELOPMENT_LOG.md`, `README.md`

### Decisions and alternatives

- **Resume re-runs the whole evaluation; it does not accept reviewer-supplied override data.** The signal payload carries no resolution content — a reviewer is expected to fix the ambiguity itself (via direct data access; no dedicated "fix the ambiguity" API exists) and then say "try again." Building a genuine override mechanism (a reviewer directly forcing a specific policy binding despite unresolved ambiguity) would contradict Section 6.3's authority order ("the resolved, released case policy snapshot determine condition state") and is a materially larger, separate feature.
- **Unbounded interrupt cycles, no cap.** A case can interrupt, resume, and interrupt again indefinitely if the underlying ambiguity keeps recurring. This matches Temporal's standard durable-loop pattern (the workflow yields at every iteration via activity calls and `condition()`) and is arguably correct: a human should keep being asked until the ambiguity is actually resolved, not silently given up on after N tries.
- **`reviewType` is required, not defaulted, on the generalized endpoint.** A default-to-`CONDITION_RESOLUTION`-when-omitted design would have avoided touching every existing caller, but this codebase's own testing/e2e call sites are the only current callers (no real external contract to preserve yet), and an explicit, always-required discriminator is simpler to validate correctly than conditional-default logic layered on top of `@ValidateIf`.
- **`TemporalClientService.resolveCondition` keeps its name** (only the `CasesService`/`CasesController` layer's method was renamed to `submitReview`) — it's still a faithful, single-purpose signal-delivery wrapper; the *dispatch* between two review actions belongs one layer up, where the two DTOs' shapes actually diverge.

### Verification

```text
npm run build / npm run lint:check
  both passed, no manual fixes needed beyond eslint --fix's prettier pass

scratch stack: docker compose (postgres 5433, temporal 7234) + migration:run
  all 8 migrations applied cleanly (fresh scratch database)

DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache --silent
  31 suites passed, 221 tests passed (216 -> 221: +1 markWaitingForReview
  activity test, +2 workflow-level interrupt/resume tests [single cycle,
  multi-cycle], +2 CasesService RESUME_EVALUATION tests; several existing
  tests renamed/reframed in place without changing the count, since the
  scenario they exercise now produces INTERRUPTED instead of
  ROUTED_TO_MANUAL_REVIEW)

DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
  2 suites passed, 14 tests passed (13 -> 14: +1 RESUME_EVALUATION
  e2e acceptance test)

Manual end-to-end proof (real REST API + real Temporal worker, scratch
Postgres/Temporal): created a case in a real, freshly-seeded
NOT_COVERED jurisdiction; workflow interrupted, case reached
WAITING_FOR_REVIEW, evaluation.interrupted outbox event recorded with
the resolver's exact reason. Activated the jurisdiction's coverage
directly (simulating a reviewer's out-of-band fix), then
POST .../reviews with reviewType=RESUME_EVALUATION -> 202. Workflow
resumed, re-ran evaluateConditions against the now-fixed jurisdiction,
and the case reached READY_FOR_UNDERWRITING (no rule applies to this
jurisdiction, so no condition was needed) -- outbox trail confirmed
the full sequence: loan_case.created, workflow_run.started, 3x
evidence.updated, evaluation.interrupted, workflow_run.completed.
All synthetic rows deleted afterward; scratch stack torn down.
```

### Security, privacy, cost, and compatibility

- **Breaking REST change**: `POST .../reviews` now requires `reviewType` in the request body; a request in the old shape (no `reviewType`) is rejected by validation. No known external caller exists yet (Section 7's synthetic-launch scope) — the previous shape was itself already narrower than Section 15.1's target contract and explicitly not a stable public API.
- No new externally-reachable data — `resumeInterruptedEvaluationSignal`'s payload (`actorId`, optional `note`) is the same shape/sensitivity class as `resolveConditionSignal`'s.
- `WAITING_FOR_REVIEW` was already a modeled, migrated case-status value; using it doesn't touch the schema.

### Known gaps

- No dedicated API for a reviewer to actually *fix* an ambiguity (correct a case's jurisdiction, activate policy coverage, resolve an overlapping version) — this slice only provides the interrupt/resume *mechanism*; the fix itself still requires direct data access, same as this manual verification did.
- No timeout or escalation on an interrupted case sitting in `WAITING_FOR_REVIEW` indefinitely — a case can wait forever with no automatic re-routing to `MANUAL_REVIEW` if nobody ever resumes it.
- No audit trail correlating a specific `resumeInterruptedEvaluationSignal`'s `actorId`/`note` to the outbox event history beyond the signal delivery itself — the `note` is not currently persisted anywhere (not written to any table or outbox payload).
- Every other Section 9.6 trigger category not already covered (see M3-009's Findings) remains unimplemented for the same reasons as before — this slice only builds the interrupt/resume *mechanism* for the one category (`ambiguity`) that already had a real, honest trigger.

### Next safe step

The two items M3-009 already queued (token/cost/provider-call budget ledger, communication classification system) remain the largest unbuilt pieces of Section 9. Independently, a minimal "fix the ambiguity" surface (even just a jurisdiction-coverage-activation endpoint) would close the most visible gap this slice's own manual verification had to work around by hand.

## M3-011: Dependency-generation fast path, policy activation, and open-case impact assessment

### Status

Implemented and verified, closing the two largest remaining Section 10 items from M3's exit-evidence list: `PolicyEvaluationService`'s real fast path (Section 10.4 — `CasePolicyBinding`'s own doc comment has said "no dependency-generation table yet" since M3-005) and Section 10.6's open-case impact assessment. Two real bugs were found and fixed during verification, documented below rather than smoothed over.

### Acceptance criterion

`PolicyEvaluationService.evaluate()` must skip calling the resolver entirely when nothing in the policy catalog has changed since a case's binding was created (a real fast path, not always-resolve-then-compare). Activating or withdrawing a policy version must be a real, callable action — not just a status column nothing ever transitions — that bumps a real dependency-generation counter and produces a real, persisted dry-run impact assessment for every open case it could affect, per Section 10.6's diagram.

### Implementation

#### Dependency-generation fast path (Section 10.4)

- `PolicyCatalogGeneration` (new entity, single row, `id=1`): a global generation counter, deliberately coarsened from the target 8-key vector (catalog/jurisdiction/product/program/tenant/lifecycle/source-coverage/resolver) to one key. This can only ever over-invalidate (an unrelated jurisdiction's policy change bumps the counter every other case's binding also compares against) — never under-invalidate — so correctness holds even though the target's per-dependency precision doesn't.
- `CasePolicyBinding` gains `observedCatalogGeneration: number` (the generation observed when this binding was created or last confirmed) and `contextKey: string` (`` `${jurisdictionCode}|${productCode}|${lifecycleEvent}` ``, see Failures below for why this second field turned out to be required).
- `CasePolicySnapshot.versions` now stores each matched rule's parsed `PolicyRuleDocument`, not just id/version refs — needed so the fast path can reconstruct a full `PolicyResolutionResult` from the snapshot alone (`reconstructResolution()`), with zero `PolicyVersion` lookups, when reusing a binding.
- `PolicyEvaluationService.evaluate()` restructured: first checks `existingBinding.contextKey === currentContextKey && existingBinding.observedCatalogGeneration === currentGeneration && revalidateAfter > now` — if all three hold, returns `REUSED` immediately, no resolver call. Otherwise (generation moved, revalidateAfter expired, or context changed) it resolves for real; if the resolved digest is *still* identical to what's bound (generation moved elsewhere in the catalog but this case's own content didn't), the existing snapshot/binding is reused in place (observed generation and revalidateAfter refreshed, no duplicate snapshot row) rather than minting a new one — real, additional efficiency beyond just the fast path itself.

#### Policy activation and open-case impact assessment (Sections 10.2, 10.6)

- `PolicyActivationService` (new): `activate()` (DRAFT/PROPOSED → RELEASED) and `withdraw()` (RELEASED → WITHDRAWN), each in a transaction that also bumps `PolicyCatalogGeneration`, then triggers `PolicyChangeImpactService.assessImpact()`. Rejects an activation/withdrawal from an invalid starting status (`BadRequestException`). No proposal-approval workflow exists yet (Known gap — this service is the whole activation authority for now, no separate policy-author/policy-approver role distinction).
- `PolicyChangeImpactService` (new): given a changed `policyVersionId`, finds its `PolicyApplicability` triples, finds every open case matching each triple's jurisdiction/product that has an active `CasePolicyBinding`, dry-runs the resolver against that triple, and classifies each case as `NO_IMPACT` / `REQUIRES_REEVALUATION` / `AMBIGUOUS` (comparing the prior snapshot's resolved version-id set against the dry run's; `AMBIGUOUS` when the dry run itself comes back `REVIEW_REQUIRED`). Persists one `PolicyChangeImpactAssessment` row per case — advisory only, per Section 10.6 ("Impact assessment is advisory until an authorized reviewer approves the transition configuration"): it never touches the case's actual binding or snapshot, only records what the dry run found. A case's *next* real evaluation (already forced onto the slow path by the generation bump) is what actually applies any change.
- Known gap: no transition-rule/grandfathering evaluation — `PolicyRuleApplicability.transitionRule` exists and is parsed but nothing evaluates it, so Section 10.6's "future-effective" and "approved grandfathering" outcomes aren't distinguished from `NO_IMPACT`/`REQUIRES_REEVALUATION`.
- No REST/GraphQL surface calls `PolicyActivationService` yet — verified via real-database tests and direct construction, not through the live API (see Verification).

### Failures and resolution

Both found by the real-database test suite catching genuinely wrong behavior, not by inspection — exactly what running real tests before committing is for.

1. **Missing `contextKey` allowed the fast path to reuse a binding for the wrong context.** The first fast-path design only compared generation and `revalidateAfter`. `policy-evaluation.service.spec.ts`'s existing "invalidates an existing valid binding if a later evaluation becomes REVIEW_REQUIRED" test — which calls `evaluate()` a second time with a *different* `jurisdictionCode` for the same case, generation unchanged — caught this immediately: the fast path incorrectly returned the first jurisdiction's stale `REUSED` result instead of resolving the new, uncovered one to `REVIEW_REQUIRED`. Fixed by adding `contextKey` to `CasePolicyBinding` and requiring it to match before the fast path (or the slow path's reuse-in-place branch) applies.
2. **`bumpCatalogGeneration`'s raw `UPDATE ... RETURNING` query returned `undefined`.** `policy-activation.service.spec.ts`'s activation/withdrawal tests failed with `result.generation` being `undefined`. Rewritten to use `EntityManager.increment()` followed by a plain `findOneByOrFail()` inside the same transaction — TypeORM-native, no reliance on how a given driver version shapes a raw `RETURNING` result.

A third issue was a test-only bug, not a code bug: an early version of the new fast-path test called `jest.spyOn(...).mockRestore()` *before* asserting on the spy's call count — `mockRestore()` clears recorded calls as part of restoring the original implementation, so the assertion always saw zero calls regardless of actual behavior. Fixed by reordering (assert, then restore) in both new spy-based tests.

Verifying against real Postgres surfaced two of these three issues; only the `mockRestore()` ordering would have been generally reproducible against a mocked resolver too — the `contextKey` gap specifically needed a real second `evaluate()` call sequence to observe, and the `RETURNING` shape issue needed a real Postgres driver round trip.

### Affected files

- `src/database/entities/policy-catalog-generation.entity.ts`, `policy-change-impact-assessment.entity.ts` (new)
- `src/database/entities/case-policy-binding.entity.ts`, `case-policy-snapshot.entity.ts`
- `src/database/enums/policy-change-impact.enum.ts` (new)
- `src/database/database.module.ts`
- `src/database/migrations/1786985624010-PolicyCatalogGenerationAndChangeImpact.ts` (new), `schema-migrations.spec.ts`
- `src/policy/policy-evaluation.service.ts`, `.spec.ts`
- `src/policy/policy-change-impact.service.ts`, `policy-activation.service.ts`, `.spec.ts` (new)
- `src/policy/policy.module.ts`
- `src/workflows/case-conditions.activities.spec.ts`, `src/agent-runtime/langgraph/lending-operations-agent-runtime.spec.ts` (constructor-signature updates only, no behavior change)
- `docs/DEVELOPMENT_LOG.md`, `README.md`

### Decisions and alternatives

- **Global generation counter, not the target 8-key vector.** The full vector needs dimensions (tenant-scoped policy overlays, program-level policy, source-coverage tracking as a first-class signal) that don't exist as real, independent concepts in this codebase yet — building the full key now would mean most of its dimensions are permanently constant, i.e. decorative. A single global key is honestly coarser but genuinely correct (fail-safe direction: over-, never under-invalidate) and is real infrastructure a case's binding actually depends on today.
- **Snapshot stores the parsed rule, not just refs.** The alternative (fast path re-fetches `PolicyVersion` rows by id from the snapshot's refs) would still avoid the *resolver's* jurisdiction/coverage/overlap-detection work, but would trade that for N point-reads plus N re-parses on every fast-path hit. Storing the already-parsed rule makes the fast path a single query with no further I/O.
- **Reuse-in-place (not a new snapshot) when generation moved but content didn't.** The pre-M3-011 code always minted a new snapshot once past the initial reuse gate, simply because there was no second check after that point — not a deliberate choice. Since a snapshot's entire purpose is representing distinct resolved content, creating a byte-identical duplicate on every periodic revalidation would be pure bloat with no audit value; refreshing the existing row's generation/`revalidateAfter` in place is strictly more correct.
- **Impact assessment is fully advisory — no automatic binding invalidation.** Section 10.6 says impact assessment is advisory until an authorized reviewer approves the transition; automatically invalidating bindings the moment an assessment runs would go further than the charter's own model and remove the human decision point it explicitly wants there. The generation bump already guarantees the case's *next* real evaluation takes the slow path regardless — no case can silently keep using stale content forever.
- **No REST/GraphQL endpoint for activation in this slice.** `PolicyActivationService` is real, tested against a real database, and ready to be called — but Section 15.2 describes this as GraphQL operations-console scope ("policy releases," "activation governance"), a separate, substantial surface-building slice of its own, not a natural extension of what this slice is about (the evaluation-time mechanics).

### Verification

```text
npm run build / npm run lint:check
  both passed, no manual fixes needed beyond eslint --fix's prettier pass

migration:generate against a scratch DB with all prior migrations applied
  produced schema-only DDL; hand-added the singleton generation-row
  INSERT, DEFAULT '0'/DEFAULT '' for the two new case_policy_bindings
  columns (safe values for any pre-existing row — always forces the
  slow path, never an incorrect fast-path reuse), and the contextKey
  column added after the first bug was found

migration:run / migration:revert / migration:run cycle
  applied cleanly, reverted cleanly, re-applied cleanly against a
  disposable scratch database

DATABASE_URL=... npm test -t schema-migrations.spec.ts
  9/9 passed (cumulative apply + 8 per-migration revert steps)

DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache --silent
  32 suites passed, 227 tests passed (221 -> 227: +4
  policy-activation.service.spec.ts [activate, withdraw,
  REQUIRES_REEVALUATION, AMBIGUOUS, each against a real database with
  per-test jurisdiction isolation], +2 policy-evaluation.service.spec.ts
  [new spy-proven fast-path-skips-resolver test; the pre-existing
  revalidateAfter-expiry test renamed and its expectation corrected
  from REFRESHED to REUSED-in-place, reflecting the smarter behavior]
  — found and fixed the contextKey and RETURNING-shape bugs above
  before this count was reached

DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
  2 suites passed, 14 tests passed (unchanged)

Manual live check (real REST API + real Temporal worker, scratch
Postgres/Temporal already carrying residue from the automated suite's
own generation bumps): created and ran a case through the existing
M2/M3 flow, confirmed no regression, then inspected the resulting
case_policy_bindings row directly — observedCatalogGeneration=14 and
contextKey="US-CA|CONVENTIONAL_MORTGAGE|UNDERWRITING_REVIEW" exactly
matched the live policy_catalog_generation singleton and the request
context, proving the new columns are populated correctly by a real,
unmocked evaluate() call through the live system, not just in tests.
No REST surface exists yet for activation itself (see Decisions), so
that specific behavior's live-system evidence is the automated
real-database test suite, not a manual API call.
All synthetic rows deleted afterward; scratch stack torn down.
```

### Security, privacy, cost, and compatibility

- No externally-visible API contract change — nothing new is reachable via REST/GraphQL yet.
- The fast path is strictly an internal optimization; its failure mode (a bug causing an incorrect fast-path hit) was caught and fixed pre-commit by the real-database test suite, not shipped and discovered later.
- `PolicyActivationService.activate()`/`.withdraw()` are real, callable NestJS-DI-managed services with no authorization check of their own yet — anything that can resolve them from the DI container can activate or withdraw a policy version. Acceptable today only because nothing outside this codebase's own test suite can reach them (no controller/resolver exposes them) — a real access-control gap the moment a REST/GraphQL surface is added, called out explicitly rather than silently deferred.

### Known gaps

- No REST/GraphQL surface for `PolicyActivationService` — real and tested, not reachable from outside the process.
- No transition-rule/grandfathering evaluation in impact assessment (Section 10.6's "future-effective" and "approved grandfathering" dry-run outcomes aren't distinguished).
- No proposal-approval workflow or separate policy-author/policy-approver roles (Section 16.1) — `PolicyActivationService` is the sole activation authority.
- `PolicyChangeImpactAssessment` rows accumulate with no retention/archival policy.
- The generation counter's coarseness means a policy change anywhere forces a slow-path re-resolution for every open case everywhere on its next evaluation, even cases nowhere near the actual change — correct, but not maximally efficient; the target 8-key vector would scope this precisely.

### Next safe step

Communication classification (Section 6.4) and a real token/cost/provider-call budget ledger remain the two largest unbuilt pieces of Section 9. On the policy side, `EvaluationInputManifest`'s remaining honestly-buildable fields (Section 10.5 — `policyBindingId`, `observedPolicyDependencyDigest`, `evidenceRefs`, `manifestHash` are all now constructible from real data; `authorizationDecisionId`/`consentVersionRefs` still have no backing entity) are the next queued item.

## M3-012: Communication classification (Section 6.4)

### Status

Implemented and verified. Section 6.4's protected/routine classification is a real, deterministic, database-backed system — templates, rendering, classification, and exact-render approval binding — plus `draft_information_request`, the first of Section 9.4's communication tools to become real.

### Acceptance criterion

Given a communication draft, the system must classify it `ROUTINE` only when every one of Section 6.4's conditions holds (version-pinned approved template, no free-form text, no protected meaning, allowlisted recipient/channel/locale/variables/attachments, no case-decision change) and `PROTECTED` otherwise, recording the specific reason(s). Classification and template enforcement must be deterministic application-service guards outside the model (Section 6.4's own requirement) — no model call anywhere in the classification path. A `PROTECTED` message's approval must bind to its exact rendered content, not just its identity.

### Implementation

- `CommunicationTemplate` (new entity): version-pinned, tenant-scoped (`UNIQUE(tenantId, templateKey, version)`), immutable once created — a content change is a new version, the same discipline `PolicyVersion` already uses. `bodyTemplate` uses `{{variableName}}` placeholders; `allowedVariables`/`attachmentsAllowed`/`channel`/`locale`/`recipientRelationship` are the allowlist Section 6.4 requires; `status` (`DRAFT`/`APPROVED`/`RETIRED`) gates whether it can back a routine message at all.
- `src/communications/communication-render.ts`: pure `renderTemplate()` — exact placeholder substitution only, never free-form concatenation. A placeholder with no supplied value is left visibly unsubstituted (not blanked or dropped) so a reviewer can see exactly what's missing.
- `src/communications/communication-classifier.ts`: pure `classifyCommunication()` (input + template lookup result → classification), testable with no database. `ROUTINE` requires: no free-form content; a found, `APPROVED` template; matching channel/locale/recipient relationship; attachments within the template's allowance; every supplied variable declared by the template and every declared variable supplied; and no negative-implication keyword in any supplied variable *value* (a deliberately crude, explicit substring blocklist — real sentiment/NLP classification would itself be a model-based judgment, which Section 6.4 requires classification to stay outside of; documented as a known gap, not a claim of semantic understanding). Every failing condition accumulates its own reason rather than stopping at the first.
- `CommunicationMessage` (new entity): one row per draft, storing the classification, every reason, and the exact `renderedContent` + its `renderedContentHash` (sha256 via the existing `computeDigest()` from `policy-digest.ts` — reused rather than duplicated, since it's already a general-purpose, non-HMAC content fingerprint for one process talking to its own database).
- `CommunicationApproval` (new entity) + `CommunicationApprovalService`: records a human's approval bound to `message.renderedContentHash` at approval time — the exact-render binding Section 6.4 requires. Rejects approving a `ROUTINE` message (never needed this kind of approval) or an already-approved one. **Not** a registered Agent tool, deliberately: Section 6.4 says "the Agent cannot... supply an approval result."
- `src/agent-runtime/tools/draft-information-request.tool.ts`: Section 9.4's `draft_information_request` (`purpose: "Prepare a remediation request"`, `approvalBoundary: "No"`) — the fourth real registered tool. Calls `CommunicationMessageService.draft()`, returns the classification and its reasons. Not wired into the LangGraph runtime's graph (no current M2 workflow scenario needs the Agent to send a borrower-facing message — the condition-based flow only opens conditions and waits for reviewer resolution); registered and real, same status `check_case_completeness` had before something needed it.

### Affected files

- `src/database/entities/communication-template.entity.ts`, `communication-message.entity.ts`, `communication-approval.entity.ts` (new)
- `src/database/enums/communication.enum.ts` (new)
- `src/database/database.module.ts`
- `src/database/migrations/1786986804519-CommunicationClassification.ts` (new), `schema-migrations.spec.ts`
- `src/communications/communication-render.ts`, `communication-classifier.ts`, `.spec.ts`, `communication-message.service.ts`, `.spec.ts`, `communication-approval.service.ts`, `communications.module.ts` (new module)
- `src/agent-runtime/tools/draft-information-request.tool.ts`, `.spec.ts` (new)
- `src/app.module.ts`
- `docs/DEVELOPMENT_LOG.md`, `README.md`

### Decisions and alternatives

- **Negative-implication detection is a keyword blocklist over variable values, not a model.** Section 6.4 lists "negative or ambiguous implication" as one of several conditions that upgrade a message to `PROTECTED`, and Section 6.4's own closing sentence requires classification to be "deterministic application-service guards outside the model." A real semantic/sentiment classifier would itself be exactly the kind of model-based judgment that sentence excludes. A short, explicit, documented substring list is honest about being crude — it catches an obvious case (adverse language leaking into a variable) and nothing subtler.
- **Only caller-supplied variable *values* are scanned, never the template body.** The template body is human-pre-approved at template-approval time; re-scanning already-reviewed, immutable content on every message would be redundant and could produce a false `PROTECTED` result for content a human already signed off on.
- **`CommunicationApprovalService` is not a registered Agent tool.** Every other new capability in this codebase becomes a tool if the Agent could plausibly need it; this one deliberately does not, because Section 6.4 states the exclusion explicitly ("the Agent cannot... supply an approval result"), unlike the general default of "build it as a tool if there's a real use."
- **`draft_information_request` is real but not wired into the LangGraph graph.** Matches the precedent already set by `check_case_completeness` (M3-006): a real, tested, registered tool with no current production caller, because nothing in the M2 workflow's deterministic condition-only flow currently needs the Agent to draft outbound messages. Wiring it in would mean inventing a new trigger condition (when should the Agent decide to request more information via message rather than just opening a condition?) that isn't yet a real, needed behavior.
- **No real delivery channel, and none faked.** `CommunicationMessage.status` stops at `DRAFTED`/`AWAITING_APPROVAL`/`APPROVED` — there is no `SENT`/`DELIVERED` status, because no code path could honestly reach one. Real message delivery is provider-integration scope (Section 11, M4), the same boundary real credit/income/document provider calls are already behind.

### Verification

```text
npm run build / npm run lint:check
  both passed, no manual fixes needed beyond eslint --fix's prettier pass

migration:generate against a scratch DB with all prior migrations applied
  produced schema-only DDL (three new tables, two new enums, two new FKs);
  also correctly detected and dropped the DEFAULT clauses M3-011's
  hand-written migration had added to case_policy_bindings columns
  that the entity itself never declared a default for — expected,
  harmless (existing rows keep their values; the ORM always sets both
  columns explicitly on every write anyway)

migration:run / migration:revert / migration:run cycle
  applied cleanly, reverted cleanly (dropping exactly the three new
  tables and two enums, restoring the two DEFAULT clauses), re-applied
  cleanly

DATABASE_URL=... npm test -t schema-migrations.spec.ts
  10/10 passed (cumulative apply + 9 per-migration revert steps)

DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache --silent
  35 suites passed, 249 tests passed (227 -> 249: +14
  communication-classifier.spec.ts [pure, no database — every Section
  6.4 condition tested individually plus one accumulates-every-reason
  case], +6 communication-message.service.spec.ts [real database:
  ROUTINE draft, PROTECTED-via-freeform draft, approval binds to the
  exact content hash, approving a ROUTINE message rejected, approving
  twice rejected], +3 draft-information-request.tool.spec.ts

DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
  2 suites passed, 14 tests passed (unchanged)
```

No manual live-API check this slice: nothing new is reachable via REST/GraphQL or wired into the live M2 workflow (same reasoning as `check_case_completeness`'s original M3-006 entry) — the real-database automated test suite is the verification evidence.

### Security, privacy, cost, and compatibility

- No externally-visible API contract change — nothing new is reachable via REST/GraphQL yet, and the new tool isn't wired into the live Agent graph.
- `renderedContent`/`renderedContentHash` are stored in plaintext in the database, same as every other case-related table in this codebase (no field-level encryption exists anywhere yet — a pre-existing, not newly-introduced, gap).
- No real message content is ever transmitted anywhere — this slice only drafts and classifies; nothing in this codebase can deliver a communication.

### Known gaps

- Negative-implication detection is a keyword heuristic over variable values, not semantic understanding (see Decisions) — deliberately, but still a real limitation: a negative implication phrased without any blocklisted substring would not be caught.
- No real communication channel/delivery — `CommunicationMessage` never leaves `DRAFTED`/`AWAITING_APPROVAL`/`APPROVED`.
- No template-authoring or template-approval REST/GraphQL surface — templates are seeded/approved directly at the repository level in tests; no admin workflow exists yet (same gap `PolicyActivationService` has, M3-011).
- `send_information_request`/`publish_case_update` (Section 9.4's other two communication tools) remain unbuilt — both need a real delivery channel to mean anything beyond what `draft_information_request` already provides.
- Section 9.6's communication-related mandatory review triggers (classification uncertainty, free-form material text, etc.) are now classifiable in principle, but nothing in the Agent runtime graph currently calls this classifier or routes on its result — the classification system exists and is real, but isn't yet a mandatory-review trigger source the way M3-009's consent check is.

### Next safe step

A real token/cost/provider-call budget ledger remains the largest unbuilt piece of Section 9, still deliberately deferred (no genuine consumer exists). Independently: evidence-backed explanations and the Agent run timeline (M3's own scope list), and the evaluation corpus + report command (Section 18.2), are the next queued items from this session's standing plan.

## M3-013: Evidence-backed explanations and Agent run timeline

### Status

Implemented and verified. Every `LendingOperationsAgentState` run the LangGraph runtime executes is now durably persisted (`agent_runs`/`tool_attempts`), and a new `CaseTimelineService` assembles a single chronological, evidence-backed account of a case from that data plus the existing `outbox_events` table.

### Acceptance criterion

Section 7.1's launch scenario step 17 ("display the full timeline...") and M3's own scope line ("evidence-backed explanations and Agent run timeline"): a case's timeline must be queryable end-to-end, combining every domain state change already recorded in `outbox_events` with every Agent run's route, proposed action, and tool-by-tool outcome — and every summary shown must be built from data this codebase already persisted (a condition's own DSL-evaluator reason string, a run's actual recorded tool outcomes), never a freshly generated or inferred narrative.

### Implementation

- `AgentRun`/`ToolAttempt` (new entities, `src/database/entities/agent-run.entity.ts`, `tool-attempt.entity.ts`) — one `AgentRun` row per `LendingOperationsAgentRuntime.run()` call (tenantId, caseId, workflowRunId, route, proposedActionTool/Arguments, reviewRequested/Reason, startedAt/completedAt), one `ToolAttempt` row per entry in the run's `attemptedTools` (toolName, outcome, detail, attemptedAt), FK `ON DELETE CASCADE` from `tool_attempts` to `agent_runs`.
- `lending-operations-agent-runtime.ts`: added `persistAgentRun()`, called from `run()` in one transaction after the graph completes — saves the `AgentRun` row, then every `ToolAttempt` row, using the real `workflowRunId` already threaded through the state (not `activityInfo()`, consistent with the session's established Temporal-context gotcha). This closes a real, previously undocumented gap: the Agent's own run history existed only in `LendingOperationsAgentState` in memory and was discarded after every `evaluateConditions` call — no Agent run was ever queryable after the fact.
- `CaseTimelineService` (new, `src/cases/case-timeline.service.ts`): `getTimeline(tenantId, caseId)` reads `outbox_events` + `agent_runs`/`tool_attempts` in parallel, merges and sorts by timestamp. `describeEvent()` enriches a `condition.opened` entry with the condition's own real `description` (the DSL evaluator's reason string, e.g. `difference_percent(...) = 11.88% > 10%`) rather than restating the raw event payload — this is the "evidence-backed explanation" M3's scope names: built from data already persisted for another reason, not a narrative generated for this purpose. `describeAgentRun()` summarizes a run's route and its tools' actual recorded outcomes.
- `CasesController`: new `GET /v1/loan-cases/:caseId/timeline`, delegating through `CasesService.getTimeline()` (which calls `getCase()` first for 404 + tenant scoping, then `CaseTimelineService`). Section 15.2 targets GraphQL for timeline queries, but no GraphQL case resolvers exist yet anywhere in this codebase — REST stands in, the same documented deviation pattern every other case endpoint in this controller already follows.
- `1786987516961-AgentRunTimeline.ts` (new migration): two tables, two enums (`agent_runs_route_enum`, `tool_attempts_outcome_enum`), one FK. Generated cleanly against a scratch DB with all prior migrations applied — no hand-editing needed.

### Affected files

- `src/database/entities/agent-run.entity.ts`, `tool-attempt.entity.ts` (new); `src/database/enums/agent-run.enum.ts` (new)
- `src/database/migrations/1786987516961-AgentRunTimeline.ts` (new), `schema-migrations.spec.ts`
- `src/agent-runtime/langgraph/lending-operations-agent-runtime.ts`, `.spec.ts`
- `src/cases/case-timeline.service.ts` (new), `cases.module.ts`, `cases.service.ts`, `.spec.ts`, `cases.controller.ts`, `.spec.ts`
- `src/workflows/case-conditions.activities.spec.ts` (registers the new entities and cleans them up, since this spec also exercises the LangGraph runtime)
- `docs/DEVELOPMENT_LOG.md`, `README.md`

### Decisions and alternatives

- **A new `agent_runs`/`tool_attempts` pair, not a generic append-only event log.** The codebase already has one general-purpose durable event mechanism (`outbox_events`), but that table's contract is specifically "signed, published domain events" — an Agent run's internal tool-by-tool trace is a different shape (nested attempts, no publish/signature semantics) and a different audience (operational/debugging, not integration). Overloading `outbox_events` for this would have meant either faking a signature for data nobody consumes downstream, or weakening the table's existing contract for every other consumer.
- **`CaseTimelineService` merges from existing tables rather than writing a new denormalized timeline table.** `outbox_events` already captures every domain state change durably; duplicating that into a second table would create a second source of truth that could drift. The merge-and-sort happens at read time, which is cheap at this data volume and keeps exactly one write path per fact.
- **Enrichment is narrow and explicit (one `if` for `condition.opened`), not a generic "look up related entity" mechanism.** Every other event type's summary is its raw `eventType` string. Building a general enrichment framework for a single current case would be speculative; the pattern is easy to extend the same way if a second event type needs it.
- **REST, not GraphQL, for the new endpoint** — matches the existing, already-documented deviation in this controller (Section 15.2's GraphQL target vs. the codebase's current REST-only case surface); tracked as a known gap, not silently substituted.

### Verification

```text
npm run build / npm run lint:check (after npm run lint --fix for the
generated migration's prettier formatting and a few spec-file spacing
issues)
  both passed clean

Scratch stack (m3013-verify, ports 5433/7234):
  migration:run — all migrations applied cleanly, including the new
  AgentRunTimeline migration, alongside every prior one

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache --silent
    35 suites passed, 253 tests passed (249 -> 253: +4, covering
    persistAgentRun's real-DB assertions in
    lending-operations-agent-runtime.spec.ts: a real AgentRun row with
    route=PROPOSED_ACTION and proposedActionTool=create_condition, and
    3 ordered ToolAttempt rows — check_case_completeness,
    evaluate_policy, create_condition, all SUCCESS)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    2 suites passed, 14 tests passed (unchanged)

  DATABASE_URL=... npm test -t schema-migrations.spec.ts
    11/11 passed (cumulative apply + 10 per-migration revert steps,
    including the new first revert test for AgentRunTimeline)

Manual live verification (real REST API + real Temporal worker against
the scratch stack):
  created a case (BORROWER-M3013, US-CA, statedMonthlyIncome=9000),
  started the workflow — the real Plaid/credit/document simulators
  returned monthlyIncome=10069, the real policy evaluator opened a
  VERIFY_INCOME_DISCREPANCY condition (11.88% > 10% threshold), and the
  real LangGraph runtime proposed and executed create_condition,
  persisting one AgentRun row and 3 ToolAttempt rows

  GET /v1/loan-cases/{caseId}/timeline returned all 6 domain events and
  the 1 Agent run in correct chronological order, with the
  condition.opened entry's summary correctly enriched with the
  condition's real description string — confirmed by inspecting the
  actual JSON response, not just the 200 status

  synthetic tenant/case/evidence/conditions/outbox/agent-run rows
  deleted afterward; scratch stack torn down (docker compose down -v)
```

### Security, privacy, cost, and compatibility

- No new externally-visible write surface — the new endpoint is read-only (`GET`).
- `proposedActionArguments`/`detail` are stored in plaintext `jsonb`/`text`, same as every other case-related table in this codebase (no field-level encryption exists anywhere yet — a pre-existing, not newly-introduced, gap).
- `tool_attempts` cascades on `agent_runs` delete — no orphaned trace rows possible after a future case-deletion/lineage-aware-deletion pass (Section 14.2) touches `agent_runs`.
- No new external dependency, no new provider call — this slice is pure persistence-and-read over data the runtime already computes.

### Known gaps

- No pagination on the timeline endpoint — every event and run for a case is returned in one response; acceptable at current synthetic data volumes, not yet load-tested for a long-lived case with many runs.
- No GraphQL surface (see Decisions) — REST only, consistent with every other case endpoint in this controller.
- Enrichment only covers `condition.opened`; every other event type's `summary` is still its raw `eventType` string. Extending this to other event types (e.g. `workflow_run.waiting_for_review`) is straightforward but not yet done — no current caller has asked for it.
- `AgentRun.completedAt` is set by `@CreateDateColumn` at INSERT time (i.e., when the run finished and was persisted), not by an explicit graph-completion timestamp threaded through the state — close enough for a single-transaction persist immediately after the graph resolves, but not a millisecond-exact measure of in-graph execution time.

### Next safe step

A real token/cost/provider-call budget ledger remains the largest unbuilt piece of Section 9, still deliberately deferred (no genuine consumer exists). Next queued: the evaluation corpus + report command (Section 18.2), and `EvaluationInputManifest`'s remaining honestly-buildable fields (Section 10.5 — `policyBindingId`, `observedPolicyDependencyDigest`, `evidenceRefs`, `manifestHash` are all now constructible from real data; `authorizationDecisionId`/`consentVersionRefs` still have no backing entity).

## M3-014: `EvaluationInputManifest` (Section 10.5)

### Status

Implemented and verified. `EvaluationInputManifest` — previously not built as any entity or interface, only referenced in comments — is now a real, immutable, database-backed audit record assembled from real data for every evaluation that goes on to justify a condition write, honestly scoped: fields with no backing subsystem stay null/empty rather than fabricated.

### Acceptance criterion

Requested via an ad-hoc M3-closure audit (charter Section 20, M3 scope bullet 5: "immutable evaluation input manifests and expected case-version writes") that found `EvaluationInputManifest` did not exist as any entity or TypeScript interface, despite `create-condition.tool.ts`'s own comment claiming to implement "the specific protective behavior the manifest exists to provide." A manifest must be persisted per evaluation, referencing exactly the real inputs that evaluation read (policy binding, dependency digest, evaluator version, the specific evidence facts used) — never inventing values for fields whose backing subsystem doesn't exist yet (authorization grants, consent versioning, calculations, model calls).

### Implementation

- `EvaluationInputManifest` (new entity, `src/database/entities/evaluation-input-manifest.entity.ts`): `caseVersion`, `policyBindingId`, `observedPolicyDependencyDigest`, `evaluatorVersion`, `evidenceRefs` (`{evidenceId, version, contentHash, validThrough}[]`) are all real, sourced from data this codebase already tracks. `authorizationDecisionId`/`modelAndPromptManifestId` are nullable and always null; `consentVersionRefs`/`calculationRefs` are always `[]` — no authorization-grant, consent-versioning, or calculation subsystem exists yet, and the M3 Agent graph makes no model calls at all, so there is nothing real to reference (the entity's own comment documents exactly why, matching the session's established refusal to fabricate `EvaluationInputManifest` fields with no backing data).
- `EvaluationManifestService` (new, `src/policy/evaluation-manifest.service.ts`): `assemble()` takes exactly the evidence facts a caller says it used (not a blanket "every fact on the case" query — the DSL evaluator in `resolveOutcomeNode` only ever reads the case's latest `INCOME` fact today, so that's exactly what's referenced), computes each fact's `contentHash` via the existing `computeDigest()` utility (already used for policy digests and communication content hashes — reused, not duplicated), computes an overall `manifestHash` the same way, and persists.
- `PolicyEvaluationService.RESOLVER_VERSION` exported (was a private module constant) and `EvaluatePolicyResult` gained `observedPolicyDependencyDigest` (sourced from `evaluation.binding?.dependencyDigest`) — both were already real values inside `PolicyEvaluationService`, just not previously surfaced to callers.
- `lending-operations-agent-runtime.ts`'s `resolveOutcomeNode`: right before calling `create_condition` (the same pairing Section 10.5's own text uses — "condition writes use compare-and-swap... requires a new evaluation manifest"), assembles the manifest and passes its `id` as the new `evaluationManifestId` arg to `create_condition`. The manifest is a durable audit record, not a new gate — `create-condition.tool.ts`'s existing `expectedCaseVersion` compare-and-swap (built in M3-010/M3-013's predecessor work) remains the actual enforcement.
- `LoanCondition.evaluationManifestId` (new nullable column, no FK — same pattern as the existing `policySnapshotId` column) references the manifest that justified that condition.

### Affected files

- `src/database/entities/evaluation-input-manifest.entity.ts` (new)
- `src/policy/evaluation-manifest.service.ts`, `.spec.ts` (new)
- `src/policy/policy-evaluation.service.ts`, `policy.module.ts`
- `src/agent-runtime/tools/evaluate-policy.tool.ts`, `.spec.ts`
- `src/agent-runtime/tools/create-condition.tool.ts`, `.spec.ts`
- `src/agent-runtime/langgraph/lending-operations-agent-runtime.ts`, `.spec.ts`
- `src/database/entities/loan-condition.entity.ts`
- `src/database/migrations/1786990484784-EvaluationInputManifest.ts` (new), `schema-migrations.spec.ts`
- `src/workflows/case-conditions.activities.ts`, `.spec.ts`
- `src/worker.ts`
- `docs/DEVELOPMENT_LOG.md`, `README.md`

### Decisions and alternatives

- **`evidenceRefs` scopes to exactly the evidence a caller says it used, not every fact on the case.** `EvaluationManifestService.assemble()` takes an `evidence: EvidenceFact[]` array rather than querying all facts for the case itself. `resolveOutcomeNode` today only reads the latest `INCOME` fact for its DSL evaluation — referencing every other fact on the case (credit, document) would overstate what the evaluation actually depended on. The pattern extends cleanly if a future rule reads more fact types: pass more facts in.
- **The manifest is assembled only when a matched rule is about to justify a condition write, not on every `evaluate_policy` call.** Section 10.5's own text pairs manifest assembly with condition writes specifically ("condition writes use compare-and-swap... requires a new evaluation manifest"); assembling one for every evaluation regardless of outcome would be scope beyond what the charter text actually asks for, and would persist manifests for evaluations that concluded "no condition needed" — audit noise with no corresponding decision to audit.
- **`authorizationDecisionId`/`consentVersionRefs`/`calculationRefs`/`modelAndPromptManifestId` stay null/empty rather than backfilled with placeholder or synthetic values.** This is the same principle applied throughout the session (`consentStatus`'s hardcoded `'VALID'` placeholder, the deliberately-unbuilt budget ledger): a field with no real backing subsystem gets an honest empty value and a comment explaining why, never a fabricated one that would misrepresent what was actually checked. `consentStatus` itself being a hardcoded placeholder is exactly why `consentVersionRefs` has nothing real to reference — there is no real *version* of a *hardcoded* consent status.
- **No FK constraint from `LoanCondition.evaluationManifestId` to `EvaluationInputManifest.id`.** Matches the existing `policySnapshotId` column's own precedent — both reference immutable, append-only, audit-purpose tables where a dangling reference from a hypothetical future deletion pass is an acceptable, already-accepted risk, not a new one this slice introduces.
- **The manifest itself is not a new enforcement gate.** `create-condition.tool.ts`'s `expectedCaseVersion` compare-and-swap already provides the actual protection Section 10.5 describes (built earlier, before this slice). This slice adds the durable, evidence-backed *record* of what an evaluation read — closing the "no full manifest struct" gap that create-condition.tool.ts's own comment had documented since M3-010 — without duplicating or replacing the existing enforcement.

### Verification

```text
npm run build / npm run lint:check (after npm run lint --fix for the
generated migration's prettier formatting)
  both passed clean

migration:generate against a scratch DB with all prior migrations
  applied — one new table (evaluation_input_manifests, no FKs) and one
  new nullable column (loan_conditions.evaluationManifestId), no
  hand-editing needed

migration:run / migration:revert / migration:run cycle
  applied cleanly, reverted cleanly (dropping exactly the new table,
  its index, and the new column — nothing else), re-applied cleanly

Scratch stack (m3014-verify, ports 5433/7234):
  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache --silent
    36 suites passed, 256 tests passed (253 -> 256: +3, covering
    evaluation-manifest.service.spec.ts's real-database assertions:
    evidenceRefs/manifestHash assembled correctly from real EvidenceFact
    rows, identical inputs produce an identical hash, different
    evidence content produces a different hash)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    2 suites passed, 14 tests passed (unchanged)

  DATABASE_URL=... npm test -t schema-migrations.spec.ts
    12/12 passed (cumulative apply + 11 per-migration revert steps,
    including the new first revert test for EvaluationInputManifest)

Manual live verification (real REST API + real Temporal worker):
  created a case (BORROWER-M3014, US-CA, statedMonthlyIncome=9000),
  started the workflow — the real evaluation opened a
  VERIFY_INCOME_DISCREPANCY condition with a real evaluationManifestId;
  queried evaluation_input_manifests directly and confirmed
  caseVersion=2, a real policyBindingId matching the case's actual
  CasePolicyBinding, a real 64-character observedPolicyDependencyDigest,
  evaluatorVersion="1.0.0", evidenceRefs referencing the case's actual
  INCOME EvidenceFact row (confirmed by a direct join query — the
  referenced evidenceId's real value matched what the manifest's
  contentHash was computed from), and authorizationDecisionId/
  consentVersionRefs/calculationRefs/modelAndPromptManifestId all
  honestly null/empty

  synthetic tenant/case/evidence/conditions/manifests/outbox/agent-run
  rows deleted afterward; scratch stack torn down (docker compose down -v)
```

### Security, privacy, cost, and compatibility

- No new externally-visible API surface — manifests are not yet exposed via REST/GraphQL, only persisted and internally referenced.
- `evidenceRefs`/`manifestHash` are plaintext in the database, same as every other case-related table in this codebase (no field-level encryption exists anywhere yet — pre-existing, not newly introduced).
- No new external dependency, no new provider call.

### Known gaps

- No REST/GraphQL endpoint exposes a manifest directly yet — it exists as an internal audit record, reachable only by direct database query or by following `LoanCondition.evaluationManifestId`.
- `authorizationDecisionId`, `consentVersionRefs`, `calculationRefs`, `modelAndPromptManifestId` remain null/empty until their backing subsystems (authorization grants, consent versioning, a calculation subsystem, Agent model calls) exist — tracked here, not silently assumed done.
- A manifest is only assembled on the path that leads to `create_condition`; an evaluation that concludes "no condition needed" produces no manifest (see Decisions) — if a future use case needs an audit trail for those evaluations too, this would need broadening.
- `evidenceRefs.adapterVersion`/`normalizationSchemaVersion` (named in the charter's own `EvaluationInputManifest` interface) are omitted entirely rather than included as always-null fields — no provider-adapter versioning subsystem exists yet (Section 11, M4 scope).

### Next safe step

Per the M3-closure audit that prompted this slice: a real token/cost/provider-call budget ledger, the remaining ~12 of Section 9.4's 16 registered tools, a real communication delivery channel, a "transition approval" workflow for future-effective policy versions, and the evaluation corpus + report command (Section 18.2) remain M3's largest open items — continuing down that list next.

## M3-015: `escalate_to_reviewer` tool (Section 9.4)

### Status

Implemented and verified. `escalate_to_reviewer` — "Pause and create review task" — is now a real, tested, registered Section 9.4 tool, giving the Agent an explicit way to request human review distinct from the LangGraph runtime's automatic ambiguity/failure routing.

### Acceptance criterion

Continuing the M3-closure audit's punch list (registered tools: only 4 of 16 existed). `escalate_to_reviewer` must be a real, CAS-protected case-status transition with a signed audit event — not a stub — usable by any future caller (a detector for one of Section 9.6's mandatory review triggers, or a human-configured policy) that decides a case needs a human before continuing.

### Implementation

- `src/agent-runtime/tools/escalate-to-reviewer.tool.ts` (new): CAS-protected on `expectedCaseVersion` (same discipline as `create_condition`, M3-010), transitions `LoanCase.status` to `WAITING_FOR_REVIEW` — reused deliberately rather than `MANUAL_REVIEW`, since `markWaitingForReview`'s own existing comment defines that status as "paused, can resume" (a reviewer resolves it and work continues), which is what an Agent-initiated escalation is, not `MANUAL_REVIEW`'s "cannot proceed safely" terminal meaning — and writes a new signed `case.escalated` outbox event.
- `OutboxEventType.CaseEscalated` (`'case.escalated'`, new) — distinct from the existing `EvaluationInterrupted` (`'evaluation.interrupted'`), which is specifically the runtime's own automatic ambiguity-interrupt path; this event is for an explicit tool invocation covering any of Section 9.6's broader trigger list.
- Not wired into the LangGraph graph — no current run scenario decides to escalate rather than follow its existing deterministic routing (verify consent → check completeness → evaluate policy → resolve outcome). Same status `check_case_completeness` had before M3-006 gave it a caller, and `draft_information_request` (M3-012) still has today: a real, independently tested, registered tool with no current graph caller.
- No new registered-tool wrapper for `check_policy_change_impact` this slice, despite being next on the audit's tool list: `PolicyChangeImpactService.assessImpact(policyVersionId)` operates catalog-wide (every case matching a policy version's applicability, across tenants), not per-case — the shape an `AgentTool<Args, Result>` (scoped to one `{tenantId, caseId}` context) expects. Wrapping it as-is would either silently ignore the tool-call's own case context or require a real case-scoped variant; forcing an ill-fitting wrapper together in the same slice as `escalate_to_reviewer` risked rushing a design that deserves its own slice.

### Affected files

- `src/agent-runtime/tools/escalate-to-reviewer.tool.ts`, `.spec.ts` (new)
- `src/database/outbox/outbox-event-types.ts`
- `docs/DEVELOPMENT_LOG.md`, `README.md`

### Decisions and alternatives

- **Reuses `WAITING_FOR_REVIEW`, not a new case status.** Introducing a third "paused" status (distinct from both `WAITING_FOR_REVIEW` and `MANUAL_REVIEW`) would let a future caller distinguish "the Agent explicitly escalated" from "the runtime detected policy ambiguity" at the case-status level — but nothing today reads case status to make that distinction (the outbox event type already carries it), so a new status would be unused surface, not real behavior.
- **CAS-protected the same way `create_condition` is**, rather than an unconditional update: an Agent tool acting on stale in-memory case state is exactly the race Section 10.5 exists to prevent, and this tool mutates case status just as directly as `create_condition` mutates it.

### Verification

```text
npm run build / npm run lint:check (after npm run lint --fix for spec
formatting)
  both passed clean

No new migration — OutboxEvent.eventType is a plain varchar column
(not a Postgres enum), and CaseStatus.WAITING_FOR_REVIEW already
existed — this slice adds no schema.

Scratch stack (m3015-verify, ports 5433/7234):
  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache --silent
    37 suites passed, 259 tests passed (256 -> 259: +3, covering
    escalate-to-reviewer.tool.spec.ts: tool metadata, a real
    WAITING_FOR_REVIEW transition with a real signed case.escalated
    event, and STALE_CASE_VERSION on a concurrent case mutation)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    2 suites passed, 14 tests passed (unchanged)

  DATABASE_URL=... npm test -t schema-migrations.spec.ts
    12/12 passed (sanity check — unchanged, no migration this slice)
```

No manual live-API check this slice: nothing new is reachable via REST/GraphQL, and the tool isn't wired into the live Agent graph (same reasoning as `draft_information_request`'s M3-012 entry) — the real-database automated test suite is the verification evidence.

### Security, privacy, cost, and compatibility

- No new externally-visible API surface.
- `reason` is stored in plaintext in the outbox event payload, same as every other case-related field in this codebase.
- No new external dependency, no new provider call.

### Known gaps

- Not wired into the LangGraph graph — real and tested, but no current run scenario invokes it (see Decisions/Implementation).
- No consumer yet reads `case.escalated` events or the `WAITING_FOR_REVIEW` transition this tool produces differently from an ambiguity-interrupt's `WAITING_FOR_REVIEW` transition — both currently look identical to any downstream reader that doesn't also inspect outbox event history.

### Next safe step

Continuing the M3-closure punch list: a properly case-scoped `check_policy_change_impact` tool variant (deferred this slice, see Decisions), the remaining ~11 Section 9.4 tools that need real backing subsystems before they can be honestly built, the budget ledger, a communication delivery channel, transition approval, and the evaluation corpus + report command.

## M3-016: `check_policy_change_impact` tool (Section 9.4)

### Status

Implemented and verified. `check_policy_change_impact` — "Compare an approved policy change with open cases" — is now the sixth real Section 9.4 tool, built on a new `PolicyChangeImpactService.assessImpactForCase()` method that finally gives the existing catalog-wide impact-assessment machinery (M3-011) a genuine per-case entry point.

### Acceptance criterion

Closes the specific gap M3-015 deferred: `PolicyChangeImpactService.assessImpact(policyVersionId)` only ever ran catalog-wide (every case an activation/withdrawal's applicability might affect), which doesn't fit an `AgentTool`'s `{tenantId, caseId}`-scoped contract — "does this policy change affect *my* case?" is a different, real question a case-scoped Agent run can ask on demand, independent of whether an activation/withdrawal ever triggered a scan.

### Implementation

- `PolicyChangeImpactService`: extracted the existing per-case dry-run-and-classify logic (previously inline in `assessImpact`'s loop) into a private `assessOneCase()` helper, reused by both the existing catalog-wide `assessImpact()` and a new public `assessImpactForCase(tenantId, caseId, policyVersionId)`. The new method derives the case's own applicability triple directly from the case itself (`jurisdictionCode`, `loanTypeToProductCode(loanType)`, the same `UNDERWRITING_REVIEW_LIFECYCLE_EVENT` constant `evaluatePolicyNode` already uses) rather than requiring a caller to already know it. Returns `null` when the case has no live binding to compare against — the same case `assessImpact`'s loop silently skips.
- `src/agent-runtime/tools/check-policy-change-impact.tool.ts` (new): thin wrapper, shapes `assessImpactForCase`'s result (or `null`) into the tool contract (`{assessed: true, impact, details, assessmentId}` or `{assessed: false, reason}`).
- Not wired into the LangGraph graph — same status as `draft_information_request`/`escalate_to_reviewer`: real and independently tested, no current run scenario calls it.

### Affected files

- `src/policy/policy-change-impact.service.ts`, `src/policy/policy-activation.service.spec.ts` (where `PolicyChangeImpactService` is already tested)
- `src/agent-runtime/tools/check-policy-change-impact.tool.ts`, `.spec.ts` (new)
- `docs/DEVELOPMENT_LOG.md`, `README.md`

### Decisions and alternatives

- **Refactored to a shared private `assessOneCase()` rather than duplicating the dry-run-and-classify logic.** `assessImpact`'s loop and the new per-case method now differ only in *how* they arrive at the applicability triple to assess (enumerated from `PolicyApplicability` rows vs. derived directly from one case) — the assessment logic itself (find binding, dry-run, classify, persist) has exactly one implementation, so the two paths can never silently drift apart.
- **No new database table** — reuses the existing `PolicyChangeImpactAssessment` table (M3-011); a per-case assessment is written the same way a catalog-wide scan's per-case assessment already was, just triggered on demand instead of after an activation/withdrawal.

### Verification

```text
npm run build / npm run lint:check (after npm run lint --fix for spec
formatting)
  both passed clean

No new migration — reuses the existing policy_change_impact_assessments
table and PolicyChangeImpactKind enum from M3-011.

Scratch stack (m3016-verify, ports 5433/7234):
  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache --silent
    38 suites passed, 264 tests passed (259 -> 264: +5 — 2 new
    real-database assessImpactForCase tests in
    policy-activation.service.spec.ts [REQUIRES_REEVALUATION for a
    directly-withdrawn version, null for a case with no live binding],
    +3 check-policy-change-impact.tool.spec.ts tests)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    2 suites passed, 14 tests passed (unchanged)
```

No manual live-API check this slice: nothing new is reachable via REST/GraphQL, and the tool isn't wired into the live Agent graph (same reasoning as M3-012/M3-015) — the real-database automated test suite is the verification evidence.

### Security, privacy, cost, and compatibility

- No new externally-visible API surface.
- No new external dependency, no new provider call.

### Known gaps

- Not wired into the LangGraph graph — real and tested, but no current run scenario invokes it.
- Like `assessImpact`, only distinguishes `NO_IMPACT`/`REQUIRES_REEVALUATION`/`AMBIGUOUS` — no transition-rule/grandfathering-aware outcome (Section 10.6's own documented gap, unchanged by this slice).

### Next safe step

Six of Section 9.4's sixteen tools are now real. The remaining ten (document inspection, four calculation tools, `send_information_request`, `publish_case_update`, `inspect_documents`, `check_identity_consistency`, `fetch_*_evidence`) each need a real backing subsystem (provider adapters, a calculation engine, or a communication delivery channel) that doesn't exist yet in this codebase — building them honestly means building those subsystems first, not wrapping them prematurely. Continuing the M3-closure punch list: the budget ledger, a communication delivery channel, transition approval, and the evaluation corpus + report command remain the largest open items.

## M3-017: Policy transition approval (Section 16.1)

### Status

Implemented and verified. `PolicyActivationService.activate()` now requires a real, independently-approved `PolicyTransitionApproval` before it will move a version to `RELEASED` — closing the gap that service's own comment has documented since M3-011 ("no separate policy-author/policy-approver role distinction yet, so this service itself is the whole activation authority").

### Acceptance criterion

Section 16.1: "separate policy-author and policy-approver roles, with independent approval for releases and transition logic." No formal OIDC/RBAC system exists anywhere in this codebase, so "roles" here means what this codebase can actually check today: a real, persisted approval record where the approving actor id must differ from the proposing actor id — self-approval rejected, no exceptions — required before activation can proceed, the same honest scoping `CommunicationApprovalService` (M3-012) already established for human approval without a real identity system.

### Implementation

- `PolicyTransitionApproval` (new entity): `policyVersionId`, `proposedBy`/`proposedAt`, `approvedBy`/`approvedAt` (both null until approved), `notes`. One row per proposal — never mutated except once, when `approve()` sets the two approval fields; a second proposal for the same version would be a new row (matching `PolicyVersion`'s own never-mutate-a-released-row discipline), though no code path currently creates a second proposal for the same version since `propose()` requires status `DRAFT` and `propose()` itself moves the version to `PROPOSED`.
- `PolicyTransitionApprovalService` (new): `propose(policyVersionId, proposedBy, notes?)` requires `DRAFT` status, flips it to `PROPOSED` (the existing, previously-unused `PolicyReleaseStatus.PROPOSED` value — `PolicyActivationService.activate()` already accepted `PROPOSED` as an activatable status without anything setting it). `approve(policyVersionId, approvedBy)` rejects self-approval and rejects when there's no pending proposal. `hasApprovedTransition(policyVersionId)` — the gate `PolicyActivationService.activate()` checks.
- `PolicyActivationService.activate()`: added a check for `hasApprovedTransition()` before the existing status check proceeds; throws `BadRequestException` with a message pointing at the propose/approve methods if missing. `withdraw()` is deliberately unchanged — Section 16.1's language and M3-011's original Known gap were both specifically about *activation*.

### Affected files

- `src/database/entities/policy-transition-approval.entity.ts` (new)
- `src/policy/policy-transition-approval.service.ts` (new)
- `src/policy/policy-activation.service.ts`, `.spec.ts`, `policy.module.ts`
- `src/database/migrations/1786992218898-PolicyTransitionApproval.ts` (new), `schema-migrations.spec.ts`
- `docs/DEVELOPMENT_LOG.md`, `README.md`

### Decisions and alternatives

- **No formal RBAC/OIDC — self-approval rejection is the whole enforcement mechanism.** Section 16.1's first bullet ("OIDC/OAuth 2.0 for people... service-layer RBAC") is entirely unbuilt in this codebase (confirmed by the README's own "No authentication or tenant-scoped access control exists yet"). Building a real roles system just to gate this one workflow would be exactly the kind of premature infrastructure this session has consistently avoided (see the deliberately-unbuilt budget ledger). Comparing two plain actor-id strings is honest about what it actually checks: *a different person approved this*, not *a person with the policy-approver role approved this* — the entity's own comment says so explicitly.
- **Reuses the existing, previously dead `PolicyReleaseStatus.PROPOSED` value** rather than adding a new status or a separate boolean flag — the schema already had a place for "author submitted this for release, not yet approved," nothing had ever set it.
- **`withdraw()` is not gated.** Broadening the same approval requirement to withdrawal was in scope for consideration, but Section 16.1's own language and the specific Known gap this closes are both about *activation*; gating withdrawal too is a real, separate design question (should an emergency withdrawal require the same two-person friction an activation does?) that deserves its own decision, not a default extension bundled into this slice.
- **`hasApprovedTransition` checks the single most recent proposal for a version, not "any approved proposal ever."** Since `propose()` requires `DRAFT` status and a version can only be `DRAFT` once (it moves to `PROPOSED` immediately), only one proposal per version exists in practice today — but writing the check as "most recent, must be approved" rather than "any approved row exists" keeps the invariant correct if a future change ever allows re-proposing (e.g., after some rejection flow this slice does not build).

### Verification

```text
npm run build / npm run lint:check (after npm run lint --fix for the
generated migration's prettier formatting)
  both passed clean

migration:generate against a scratch DB with all prior migrations
  applied — one new table, no FKs, no hand-editing needed

migration:run / migration:revert / migration:run cycle
  applied cleanly, reverted cleanly (dropping exactly the new table
  and its index), re-applied cleanly

Scratch stack (m3017-verify, ports 5433/7234):
  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache --silent
    38 suites passed, 269 tests passed (264 -> 269: +5, covering:
    activate() rejects with no approved proposal; the existing
    DRAFT-activation test now proposes+approves first; the AMBIGUOUS
    test's second activation now proposes+approves first; propose()
    moves DRAFT->PROPOSED and creates a pending approval, and rejects
    a second proposal on an already-PROPOSED version; approve()
    rejects self-approval and succeeds for a different actor;
    approve() rejects with no pending proposal)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    2 suites passed, 14 tests passed (unchanged)

  DATABASE_URL=... npm test -t schema-migrations.spec.ts
    13/13 passed (cumulative apply + 12 per-migration revert steps,
    including the new first revert test for PolicyTransitionApproval)
```

No manual live-API check this slice: `PolicyActivationService`/`PolicyTransitionApprovalService` have no REST/GraphQL surface (same as M3-011's original note — "Neither service has a REST/GraphQL surface yet") — the real-database automated test suite is the verification evidence.

### Security, privacy, cost, and compatibility

- **Behavior change for any existing caller of `PolicyActivationService.activate()`**: a version that was previously activatable directly from `DRAFT` now requires `propose()`+`approve()` first, or `activate()` throws `BadRequestException`. The only real call site in this codebase (`policy-activation.service.spec.ts`) was updated; no REST/GraphQL/CLI caller exists yet to be affected in production use, and the `SeedIncomeDiscrepancyPolicy` migration inserts its seed row directly as `RELEASED` (bypassing `PolicyActivationService` entirely), so it is unaffected.
- `proposedBy`/`approvedBy`/`notes` are stored in plaintext, same as every other actor-attribution field in this codebase (no field-level encryption exists anywhere yet).
- No new external dependency, no new provider call.

### Known gaps

- No real identity/RBAC system — `proposedBy`/`approvedBy` are trusted plain strings, not verified against an authenticated actor (see Decisions).
- `withdraw()` has no approval gate (see Decisions) — a deliberate, separate scope decision, not an oversight.
- No `reject()`/reset-to-DRAFT path — a `PROPOSED` version with no approval yet simply stays `PROPOSED` forever if never approved; there is no way to send it back to `DRAFT` for revision.
- No REST/GraphQL surface for proposing or approving — same gap `PolicyActivationService` itself already had.

### Next safe step

Continuing the M3-closure punch list: the budget ledger (still deliberately deferred — no genuine consumer exists for token/cost dimensions in an Agent graph that makes no model calls and incurs no real cost), a communication delivery channel, and the evaluation corpus + report command (Section 18.2) remain the largest open items. The full Section 18.2 corpus spec (150 cases, adversarial documents, prompt-injection fixtures, model-configs) is too large to build without fabrication against this codebase's current maturity — the next step there is deliberately scoping down to what's honestly buildable from data this codebase already produces, not attempting the full spec at once.

## M3-018: Communication delivery + `send_information_request` (Section 9.4)

### Status

Implemented and verified. `CommunicationDeliveryService` closes the gap `CommunicationMessageService`'s own comment has documented since M3-012 ("No delivery happens here or anywhere in this codebase yet") with a real simulated delivery channel — same honest status as `PlaidService`/`CreditService`/`DocumentService`, not a real email/SMS provider (Section 11, M4 scope) — and `send_information_request` becomes the seventh real Section 9.4 tool.

### Acceptance criterion

Section 9.4's `send_information_request` approval boundary: "Configured policy only for a version-pinned routine operational template; exact human approval is mandatory for protected, uncertain, or modified content." A message must reach a real `SENT` state through exactly two paths — `ROUTINE` classification (already policy-controlled at draft time, M3-012) or `PROTECTED` classification with a real `CommunicationApproval` bound to its exact rendered-content hash — and no other combination, structurally enforced, not just documented.

### Implementation

- `CommunicationMessageStatus.SENT` (new enum value) and two new nullable columns on `CommunicationMessage` — `deliveryReference`, `sentAt`.
- `CommunicationDeliverySimulator` (new, `src/communications/communication-delivery-simulator.ts`): mock delivery channel matching the existing `src/integrations/` simulator pattern — a deterministic synthetic confirmation id (sha256 of message id + content hash), not a real provider call.
- `CommunicationDeliveryService` (new): `deliver(communicationMessageId)` is the actual gate — ready to send only when `(ROUTINE && DRAFTED)` or `(PROTECTED && APPROVED)`; anything else (still `AWAITING_APPROVAL`, already `SENT`) returns a typed `NOT_READY` result rather than delivering. On success: calls the simulator, updates the message to `SENT` with `deliveryReference`/`sentAt`, and writes a new signed `communication.delivered` outbox event — deliberately *not* including `renderedContent` in the event payload (unlike, say, `condition.opened`'s full description), since a borrower-facing communication's actual content is more sensitive than an internal condition reason and the outbox event only needs to prove delivery happened, not replay what was sent.
- `send_information_request` (new Agent tool, `src/agent-runtime/tools/send-information-request.tool.ts`): a thin wrapper, same pattern as `evaluate_policy`. Not wired into the LangGraph graph — same status as `draft_information_request`/`escalate_to_reviewer`/`check_policy_change_impact`.
- `publish_case_update` (Section 9.4's other communication tool) remains unbuilt this slice — it needs a real webhook subscription/delivery/retry subsystem (Section 11, explicitly M4 scope), not a thin wrapper over something that already exists the way this slice's tool was.

### Affected files

- `src/database/enums/communication.enum.ts`, `src/database/entities/communication-message.entity.ts`
- `src/communications/communication-delivery-simulator.ts`, `.spec.ts` (new)
- `src/communications/communication-delivery.service.ts`, `.spec.ts` (new)
- `src/communications/communications.module.ts`
- `src/agent-runtime/tools/send-information-request.tool.ts`, `.spec.ts` (new)
- `src/database/outbox/outbox-event-types.ts`
- `src/database/migrations/1786992668781-CommunicationDelivery.ts` (new), `schema-migrations.spec.ts`
- `docs/DEVELOPMENT_LOG.md`, `README.md`

### Decisions and alternatives

- **A deterministic simulator, not a synthetic-failure-injectable one.** `PlaidService`/`CreditService`/`DocumentService` all support `maybeThrowSyntheticProviderFailure()` keyed on a magic `borrowerId` prefix; a delivery simulator has no natural equivalent input (a `communicationMessageId`, not a borrower id) to key synthetic failure injection on, and this slice's actual point is the *authorization gate* (is this message allowed to send), not provider-flakiness retry behavior — which is what M2's existing retry-classification tests already cover for the evidence-fetching simulators. Adding synthetic delivery failures here would be scope not asked for by this slice's acceptance criterion.
- **`renderedContent` deliberately excluded from the `communication.delivered` outbox payload.** Every other outbox event in this codebase includes full domain detail (e.g. `condition.opened`'s complete DSL-evaluator reason string) — a borrower-facing message's actual delivered text is a different sensitivity class, and the event's purpose (proving delivery happened, with a reference an operator could look up) doesn't need to duplicate it.
- **No delivery gate change to `CommunicationMessageService.draft()` itself** — `ROUTINE` messages still start at `DRAFTED`, exactly as M3-012 left them; this slice adds what happens *after* that state, not a new drafting behavior.

### Verification

```text
npm run build / npm run lint:check (after npm run lint --fix for the
generated migration's prettier formatting and spec-file formatting)
  both passed clean

migration:generate against a scratch DB with all prior migrations
  applied — two new nullable columns and one enum value added via
  TypeORM's standard rename-old/create-new/cast pattern for Postgres
  enum changes, no hand-editing needed

migration:run / migration:revert / migration:run cycle
  applied cleanly, reverted cleanly (dropping exactly the two new
  columns and restoring the enum without SENT), re-applied cleanly

Scratch stack (m3018-verify, ports 5433/7234):
  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache --silent
    41 suites passed, 280 tests passed (269 -> 280: +11, covering
    communication-delivery-simulator.spec.ts [3, deterministic
    reference generation], communication-delivery.service.spec.ts [4,
    real-database: ROUTINE/DRAFTED delivers, PROTECTED/APPROVED
    delivers, PROTECTED/AWAITING_APPROVAL reports NOT_READY without
    delivering, already-SENT reports NOT_READY without double-delivery
    or a duplicate outbox event], send-information-request.tool.spec.ts
    [3, delegation])

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    2 suites passed, 14 tests passed (unchanged)

  DATABASE_URL=... npm test -t schema-migrations.spec.ts
    14/14 passed (cumulative apply + 13 per-migration revert steps,
    including the new first revert test for CommunicationDelivery —
    no new table this migration, so the revert test checks the two
    dropped columns directly rather than a changed table list)
```

No manual live-API check this slice: nothing new is reachable via REST/GraphQL, and the tool isn't wired into the live Agent graph (same reasoning as M3-012/M3-015/M3-016) — the real-database automated test suite is the verification evidence.

### Security, privacy, cost, and compatibility

- No new externally-visible API surface.
- `renderedContent` itself was already stored in plaintext since M3-012 (a pre-existing, not newly-introduced gap); this slice's own new field, `deliveryReference`, is a synthetic simulator id, not a real provider secret or PII.
- No new external dependency, no real provider call — `CommunicationDeliverySimulator` never leaves the process.

### Known gaps

- Not wired into the LangGraph graph — real and tested, but no current run scenario invokes it.
- `publish_case_update` remains unbuilt — needs a real webhook subsystem (M4 scope).
- No synthetic delivery-failure injection (see Decisions) — a real channel's occasional transient failures aren't simulated, only the authorization gate is exercised.
- `deliveryReference` is a simulator artifact with no real-world meaning — a future real channel integration would need to replace it, not just relabel it.

### Next safe step

Seven of Section 9.4's sixteen tools are now real. Continuing the M3-closure punch list: the budget ledger (still deliberately deferred — no genuine consumer), and the evaluation corpus + report command (Section 18.2, deliberately scoped down from its full spec) remain the two largest open items.

## M3-019: Evaluation corpus + report command (Section 18.2)

### Status

Implemented and verified. `npm run evaluate` drives a real, 12-case corpus through the actual `case-conditions.activities.ts` functions (the same code the M2 Temporal workflow calls) against a real database, and writes a reproducible JSON report to `evaluation/reports/`. This closes the last scope-list item from M3's own charter text (Section 20: "initial release evaluation corpus and report command") that hadn't been started.

### Acceptance criterion

Section 18.2 names a `evaluation/` directory structure and a first-release target of "at least 150 synthetic cases across normal, boundary, contradiction, missing-data, provider-failure, and adversarial categories." Section 18.3 requires the report to record aggregate metrics and pin "model, prompt, policy, dataset, and code revisions... in every report." This codebase's actual maturity — one seeded synthetic policy rule, no document/model-facing surface, no contradiction detector — makes the full spec impossible to satisfy without fabricating either case count or category coverage. The bar this slice actually meets: every case that exists is real (drives real production code, asserts a real, previously-verified outcome), every category included has a genuine target to test against, and categories with no real target are omitted and explicitly documented rather than faked.

### Implementation

- `evaluation/cases/*.json` (12 new fixtures, one file per case): `normal` (4 — two income-matches, two discrepancies, including an overstatement case proving the DSL rule's `Math.abs()` symmetry), `boundary` (2 — 9.90% and 10.10% difference, precisely either side of the seeded rule's ">10%" threshold), `missing-data` (1 — an INCOME evidence fact that exists but is missing the field the rule reads), `policy-coverage` (1 — a jurisdiction that exists but was never reviewed for coverage), `provider-failure` (4 — transient and terminal synthetic failures across the income/credit/document fetch steps). Every numeric value was computed exactly against `PlaidService`'s real deterministic-per-`borrowerId` seed function, not chosen approximately — the boundary cases land at 9.900% and 10.098% difference precisely.
- `src/evaluation/types.ts`: fixture and report type definitions. `EvaluationCategory` deliberately omits `contradiction` and `adversarial` from Section 18.2's list — no contradiction detector exists (Section 9.6's own documented gap) and no document/model-facing surface exists for an adversarial input to target, so there is nothing real for either category to check.
- `src/evaluation/runner.ts`: `runCorpus()` calls `createCaseConditionsActivities()` — the exact factory `worker.ts` uses in production — and drives each fixture through `fetchIncomeEvidence`/`fetchCreditEvidence`/`fetchDocumentEvidence`/`evaluateConditions` directly (no Temporal needed, same pattern `case-conditions.activities.spec.ts` already established). `missing-data` fixtures insert a deliberately incomplete `EvidenceFact` instead of calling the real Plaid simulator; `provider-failure` fixtures call only the one fetch step expected to fail (a `SYNTHETIC-TRANSIENT-FAILURE-`/`SYNTHETIC-TERMINAL-FAILURE-` `borrowerId` prefix, the same real fault-injection mechanism `case-conditions.activities.spec.ts`'s retry-classification tests already use) and classify the resulting `ApplicationFailure`. `cleanupEvaluationRun()` deletes every row a run created, tenant-scoped, matching this session's established manual-verification cleanup discipline — so repeated `npm run evaluate` invocations never accumulate synthetic data.
- `src/evaluation/report.ts`: `buildReport()` computes per-category pass counts and condition precision/recall (defined literally: recall = of cases expecting `CONDITION_OPENED`, the fraction that got it; precision = of cases that actually got `CONDITION_OPENED`, the fraction that were expected to), pins the real git commit/branch (`git rev-parse`, soft-failing to `null` outside a git checkout rather than fabricating a revision) and the real released `PolicyVersion` ids from the database, and explicitly records `modelAndPromptRevisions: null` with a note explaining why — the M3 Agent graph makes no model calls, so there is nothing real to pin, and Section 18.3 requires this be *recorded*, not silently absent.
- `src/evaluation-report.ts`: the `npm run evaluate` entry point (`ts-node`, same pattern as `start:worker:dev`) — loads `.env` the same way `data-source.ts` does (outside Nest's DI container), runs the corpus, writes the report, prints a pass/fail summary, exits `1` if any case failed (CI-usable), and cleans up its own synthetic tenant/case data in a `finally` block regardless of outcome.

### Affected files

- `evaluation/cases/*.json` (12 new fixture files)
- `src/evaluation/types.ts`, `load-corpus.ts`, `runner.ts`, `runner.spec.ts`, `report.ts`, `report.spec.ts` (all new)
- `src/evaluation-report.ts` (new)
- `package.json` (new `evaluate` script)
- `.gitignore` (generated `evaluation/reports/*.json` excluded)
- `docs/DEVELOPMENT_LOG.md`, `README.md`

### Decisions and alternatives

- **12 precisely-designed cases, not 150.** Section 18.2's 150-case target assumes a mature policy catalog with many rules to generate meaningful variation across. This codebase has exactly one seeded synthetic rule (`synthetic-income-discrepancy-review`) — every one of 150 cases against that single rule would necessarily be a numeric variation on the same three real code paths (match / discrepancy / boundary), which is padding, not coverage. Twelve cases that each exercise a genuinely distinct, real code path (including two provider-failure paths and the missing-data fail-safe) is more honest evaluation evidence than 150 that don't.
- **`contradiction` and `adversarial` categories omitted, not faked.** Section 9.6 already documents "contradictory... evidence" as a mandatory review trigger with no real detector behind it yet; building a corpus fixture that asserts a passing result for a check that doesn't exist would be exactly the kind of fabrication this session has consistently refused. Same reasoning for `adversarial`/`prompt-injection`: no document-processing or model-facing surface exists in the M3 Agent for adversarial input to target.
- **The corpus runner calls the real activity functions, not a reimplementation.** `runCorpus()` imports and calls `createCaseConditionsActivities()` directly — the identical factory `worker.ts` wires into the real Temporal worker — rather than reimplementing policy-evaluation or Agent-routing logic for evaluation purposes. A corpus that tested a parallel reimplementation could pass while the real system behaved differently; this one cannot.
- **A genuine finding surfaced while building the `missing-data` fixture, not smoothed over**: the DSL evaluator's own "cannot evaluate: missing or non-numeric fact(s)" reason (`policy-rule-evaluator.ts`) is computed internally but never surfaced through `evaluateConditions`'s return value when nothing matches — a below-threshold difference and genuinely missing data both collapse to the identical `READY`/no-condition outcome with no distinguishing detail at that level. The fixture and its test still pass (the fail-safe behavior itself — no crash, no false-positive condition — is correct and verified), but the corpus's own `MISSING-DATA-001` description and `runner.spec.ts`'s test comment record this gap explicitly rather than asserting a "cannot evaluate" string that isn't actually there. Recorded here as a known gap, not fixed in this slice (fixing it would mean adding a distinct outcome/reason-surfacing path to `EvaluateConditionsResult`, a real behavior change beyond what "build the evaluation corpus" asked for).
- **Reports are gitignored, not committed.** A report is a snapshot tied to a specific run's timestamp, git commit, and database state — committing one would immediately go stale and misrepresent itself as current. The corpus (`evaluation/cases/`) is the durable, reviewable artifact; reports are regenerated on demand.

### Verification

```text
npm run build / npm run lint:check (after npm run lint --fix for spec
formatting)
  both passed clean

No new migration — this slice adds no schema, only application code
and JSON fixtures.

Scratch stack (m3019-verify, ports 5433/7234):
  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache --silent
    43 suites passed, 289 tests passed (280 -> 289: +9, covering
    runner.spec.ts [6, real-database: matched/discrepancy/boundary
    cases against the real seeded rule, the missing-data fail-safe,
    policy-coverage seeding the not-covered jurisdiction on demand,
    both provider-failure classifications, a deliberately-mismatched
    expectation correctly reported as failed rather than silently
    passing, and cleanupEvaluationRun's completeness] and report.spec.ts
    [3, precision/recall math, null-when-no-condition-cases, real
    released policy version ids from the database])

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    2 suites passed, 14 tests passed (unchanged)

  DATABASE_URL=... npm test -t schema-migrations.spec.ts
    14/14 passed (unchanged — no migration this slice)

  DATABASE_URL=... OUTBOX_SIGNING_SECRET=... npm run evaluate
    ran against the real scratch stack twice (once to catch a real bug
    — see below — once to confirm the fix): 12/12 cases passed,
    condition recall=1, condition precision=1, a real report JSON
    written with a real pinned git commit and real released
    PolicyVersion id, and confirmed via direct SQL query that the
    run's synthetic tenant/case/evidence rows were fully removed
    afterward
```

A real bug was caught and fixed during this slice's own verification, not after: the first `npm run evaluate` run left its synthetic `Tenant` row behind (`cleanupEvaluationRun` deletes every case-scoped table but never the tenant itself) — confirmed by a direct `SELECT count(*) FROM tenants WHERE name LIKE 'Evaluation report%'` returning 1 after a run. Fixed by adding an explicit tenant delete to `evaluation-report.ts`'s `finally` block (symmetric with who created it), then re-verified the count returns 0.

### Security, privacy, cost, and compatibility

- No new externally-visible API surface — `npm run evaluate` is a local/CI command, not a service endpoint.
- Every corpus fixture uses synthetic data only (Section 16.2: "no real consumer data in... evaluation corpora") — borrower ids like `EVAL-CASE-001` and `SYNTHETIC-TRANSIENT-FAILURE-income1`, never anything resembling a real identity.
- No new external dependency (`dotenv` was already a transitive dependency, used the same way `data-source.ts` already uses it) — no new provider call.
- The report JSON includes a real git commit hash — no secrets or credentials, just a revision pointer already visible in the repository's own history.

### Known gaps

- 12 cases, not Section 18.2's 150 — deliberately scoped to this codebase's actual maturity (see Decisions). Growing the corpus toward 150 needs more real policy rules to generate genuine variation against, not more numeric permutations of the one that exists.
- `contradiction` and `adversarial`/`prompt-injection` categories are not represented — no real detector or model-facing surface exists yet for either.
- `evaluateConditions`'s missing-data reason is not surfaced in its return value (see Decisions) — a real, corpus-discovered gap, not fixed here.
- No `model-configs/`, `documents/`, `expected-facts/`, or `policy-timelines/` subdirectories (Section 18.2's full structure) — no document-extraction or model-config subsystem exists to populate them honestly.
- The report command has no retention/comparison tooling yet (e.g., diffing two reports, tracking a metric trend release over release) — each run is a self-contained snapshot.

### Next safe step

This closes the last unstarted item from M3's own charter scope list. What remains open across the whole M3-closure punch list: a real token/cost/provider-call budget ledger (still deliberately deferred — no genuine consumer exists in an Agent graph that makes no model calls and incurs no real cost), and the ~9 remaining Section 9.4 tools that each need a real backing subsystem (provider adapters, a calculation engine, a webhook subsystem) not yet built. Both are M4-adjacent scope rather than something this session can honestly close incrementally the way the last several slices did.

## M3-020: Policy evaluation concurrency safety (Section 20 exit evidence H)

### Status

Implemented and verified. `CasePolicyBinding`'s own long-standing comment claimed "one row per case at a time," but nothing actually enforced it — two concurrent `PolicyEvaluationService.evaluate()` calls for the same case could each independently decide no active binding existed yet and both insert one. A real partial unique index now makes that impossible, and `evaluate()` recovers gracefully instead of crashing when it loses that race.

### Acceptance criterion

Section 20's exit evidence H: "a catalog activation racing with evaluation produces one internally consistent, auditable result." Requested directly by the user after an M3-closure audit found this untested. The bar: a real concurrency bug, if one existed, needed to be found and fixed — not just a test added that happens to pass by not actually exercising the race.

### Implementation

- `case_policy_bindings` gains a **partial unique index**, `IDX_case_policy_bindings_one_active` on `(tenantId, caseId) WHERE "invalidatedAt" IS NULL` — Postgres itself now rejects a second concurrent INSERT of an active binding for the same case, turning a silent data-integrity violation into a catchable, well-understood error.
- `PolicyEvaluationService.evaluate()`'s final "create a brand-new binding" branch (the only branch that ever inserts a *new* active-binding row — the fast path and the two reuse-in-place branches only ever read or update an existing row by id, which is inherently race-safe) now wraps its `.save()` in a try/catch: on a unique-violation, it re-reads the case's now-current active binding (the concurrent call that won the race) and returns a coherent `REUSED` result referencing it, rather than letting the error propagate. Both callers converge on the exact same winning snapshot/binding.
- `isUniqueViolation()` extracted from `CasesService.createCase()` (which already used this exact pattern for its idempotency-key race) into a shared `src/database/postgres-errors.ts` — one detection function for both call sites instead of a second copy drifting from the first.
- Two new real-database concurrency tests in `policy-evaluation.service.spec.ts`, added under a `describe('concurrency (exit evidence H)')` block:
  1. Two concurrent `evaluate()` calls for the same brand-new case converge on exactly one active binding, one `REFRESHED` + one `REUSED` outcome, both agreeing on the same binding/snapshot id.
  2. A concurrent catalog-generation bump (the exact atomic operation a real `PolicyActivationService.activate()` performs) racing with an in-flight evaluation still leaves exactly one active binding, and a follow-up evaluation stays consistent afterward.

### Affected files

- `src/database/entities/case-policy-binding.entity.ts` (new partial unique index)
- `src/database/migrations/1787015495259-CasePolicyBindingOneActiveIndex.ts` (new), `schema-migrations.spec.ts`
- `src/database/postgres-errors.ts` (new, extracted shared helper)
- `src/policy/policy-evaluation.service.ts`, `.spec.ts`
- `src/cases/cases.service.ts` (switched to the shared helper, no behavior change)
- `docs/DEVELOPMENT_LOG.md`, `README.md`

### Decisions and alternatives

- **A partial unique index, not a full transaction wrapping the whole `evaluate()` method.** The only step that can create a *second* active row is the final INSERT; every other step either only reads, or updates an *existing* row by id (idempotent under concurrent duplication — two concurrent updates to the same row with the same or equivalent values cause no corruption). Scoping the fix to exactly the one dangerous operation, backed by a real database constraint rather than an application-level lock, means the guarantee holds even against a caller this codebase doesn't control yet (a future second process, a retried Temporal activity attempt overlapping with itself, etc.) — a DB constraint is enforced regardless of which application code path attempts the write.
- **The concurrency test needed instrumentation to be a real test, not a hope.** An early version of test 1 simply fired two `Promise.all`-started `evaluate()` calls and asserted on the result — it passed even with the unique index temporarily dropped (proven by deliberately dropping it and re-running), because a fast local Postgres round-trip let one call's entire pipeline finish before the other's first read, so the "race" never actually happened. Fixed by using `jest.spyOn` to add a deliberate delay to whichever call's `resolver.resolve()` invocation happens second, guaranteeing genuine overlap. Verified in both directions: the test fails without the recovery-path fix (index dropped, or the catch block removed) and passes reliably (3 consecutive runs) with it — the standard this session holds every real-infra test to, applied here to a concurrency test specifically because concurrency tests are exactly the kind most likely to silently pass without testing anything.
- **Test 2 (activation race) needed no such instrumentation** — its assertions hold regardless of exact interleaving (both orderings of "generation bump" vs. "read current generation" are already safe per `PolicyCatalogGeneration`'s own "over-, never under-invalidating" design), so it's a real test of an already-safe design, not a race the fix needed to newly guard against.

### Verification

```text
npm run build / npm run lint:check (after npm run lint --fix for the
generated migration's prettier formatting)
  both passed clean

migration:generate against a scratch DB with all prior migrations
  applied — one new partial unique index, no hand-editing needed

migration:run / migration:revert / migration:run cycle
  applied cleanly, reverted cleanly (dropping exactly the new index),
  re-applied cleanly

Regression-detection verification (the concurrency test's own worth,
proven before trusting it):
  dropped IDX_case_policy_bindings_one_active manually, re-ran the new
  concurrency test alone -> it failed (two active bindings existed,
  the two calls' results disagreed) exactly as it should without the
  fix in place; restored the index, re-ran -> passed; re-ran 3 more
  times consecutively -> passed every time (not flaky)

Scratch stack (m3020-verify, ports 5443/7234 — moved off 5433 this
slice after a collision with an unrelated project's container on this
machine):
  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache --silent
    43 suites passed, 292 tests passed (289 -> 292: +3 — the two new
    concurrency tests plus one new schema-migrations.spec.ts revert test)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    2 suites passed, 14 tests passed (unchanged)

  DATABASE_URL=... npm test -t schema-migrations.spec.ts
    15/15 passed (cumulative apply + 14 per-migration revert steps,
    including the new first revert test for the unique index migration)
```

### Security, privacy, cost, and compatibility

- No new externally-visible API surface.
- No behavior change for the non-concurrent case (every existing sequential test still passes unmodified) — this only changes what happens under genuine concurrent access, which previously had no defined behavior at all.
- No new external dependency, no new provider call.

### Known gaps

- The fast-path read (`getCurrentGeneration()` + `existingBinding` lookup) and the eventual write are still not wrapped in one database transaction — this slice fixes the one place that could corrupt data (a duplicate active binding), not every theoretical interleaving. A narrower remaining case: two concurrent calls could both take the slow path, both compute the *same* digest, and both attempt the "reuse in place" `UPDATE` on the same existing binding — harmless (idempotent), but not literally atomic. Not fixed here because it cannot produce an inconsistent result, only a redundant identical write.
- This fixes evaluation-vs-evaluation and evaluation-vs-generation-bump races. A `PolicyActivationService.activate()` racing with *another* `activate()`/`withdraw()` call was not in scope for this slice (Section 20's exit evidence H names activation racing with *evaluation* specifically) and remains untested.

### Next safe step

Continuing the user-directed remaining M3 exit-evidence gaps: unifying mandatory-review-trigger routing (exit evidence B) is next, followed by extending `EvaluationInputManifest` assembly to every evaluation outcome, not only ones that open a condition (exit evidence F, currently partial).

## M3-021: Unified mandatory-review-trigger routing (Section 20 exit evidence B)

### Status

Implemented and verified. Every mandatory-review trigger this Agent runtime can detect now flows through one central classification table (`mandatory-review-triggers.ts`) instead of four independent inline decisions, and every persisted review record carries a queryable `reviewCategory` alongside its free-text reason.

### Acceptance criterion

Section 20's exit evidence B: "designated review cases always interrupt." Taken completely literally, this reads as contradicting Section 9.5's own Agent-loop text, which draws two deliberately different routes — "ambiguity or protected action: interrupt for review" (resumable) vs. "budget or runtime failure: route to manual review" (terminal). That charter tension is real and is documented here, not silently resolved one way. The acceptance bar this slice actually targets: make the classification that decides which route a trigger takes centralized, named, and auditable — not scattered across independent call sites with no shared vocabulary — which is the concrete, buildable problem underneath "unify... routing."

### Implementation

- `src/agent-runtime/mandatory-review-triggers.ts` (new): `MandatoryReviewCategory` (four values this codebase can currently detect — `POLICY_AMBIGUITY`, `CONSENT_INVALID`, `BUDGET_OR_DEADLINE_EXHAUSTED`, `TOOL_EXECUTION_FAILURE`), one `CATEGORY_ROUTES` table mapping each to Section 9.5's two routes, and `classifyMandatoryReviewTrigger(category, detail)` producing a `{category, route, reason}` triple — the reason string itself prefixed with the category (e.g. `[POLICY_AMBIGUITY] jurisdiction "US-ZZ" has no covered policy source`) so it's legible standalone, not only alongside a separate category field.
- `lending-operations-agent-runtime.ts`: `manualReview()`/`interruptForReview()` (two separate functions, each hardcoding its own route) replaced by one `routeMandatoryReview(agentState, trigger)` that dispatches purely on `trigger.route`. `consentInvalid()`/`budgetExceeded()` now return a classified `MandatoryReviewTrigger | undefined` instead of a bare string; every tool-failure call site and the policy-ambiguity branch now calls `classifyMandatoryReviewTrigger()` explicitly. No routing *behavior* changed — every trigger still takes the exact route it always did — only the *mechanism* deciding that route changed, from four independent inline decisions to one shared table.
- `HumanReviewState` gained `category?: MandatoryReviewCategory`; `AgentRun` gained a persisted `reviewCategory` column (mirrored as `ReviewCategoryStatus` in `database/enums/agent-run.enum.ts`, matching this codebase's established mirror-don't-import pattern for database entities referencing Agent-runtime types — see `AgentRunRouteStatus`/`ToolAttemptOutcome`'s own precedent). `CaseTimelineService` surfaces `reviewCategory` in its `AGENT_RUN` entries' `detail`, alongside the free-text `reviewReason` — confirmed end-to-end via a real, live case (see Verification).

### Affected files

- `src/agent-runtime/mandatory-review-triggers.ts`, `.spec.ts` (new)
- `src/agent-runtime/agent-state.types.ts`
- `src/agent-runtime/langgraph/lending-operations-agent-runtime.ts`, `.spec.ts`
- `src/database/entities/agent-run.entity.ts`, `src/database/enums/agent-run.enum.ts`
- `src/database/migrations/1787016391021-AgentRunReviewCategory.ts` (new), `schema-migrations.spec.ts`
- `src/cases/case-timeline.service.ts`
- `docs/DEVELOPMENT_LOG.md`, `README.md`

### Decisions and alternatives

- **Section 9.5's two-route distinction is preserved, not collapsed.** An earlier framing of this gap (this session's own M3-closure audit) described it as "only ambiguity interrupts; everything else routes to manual review" as if that were an inconsistency to fix toward more interrupting. Re-reading Section 9.5's own loop text closely, that two-route split is clearly the charter's intentional design (a substantive judgment call a reviewer resolves and retries, vs. a run-level failure that shouldn't just resume) — collapsing it would mean, for example, letting a budget-exhausted run "interrupt and resume" as if resuming were safe, which the charter never says. "Unifying routing" is implemented as unifying the *classification mechanism*, which is the real, concrete gap: no single place previously decided or recorded which category a trigger was, only which route it took.
- **`TOOL_EXECUTION_FAILURE` is labeled honestly as not a literal Section 9.6 category.** Section 9.6 lists "malformed model or tool output" (a *content* problem with an otherwise-successful call) — this Agent's actual tool failures are genuine execution exceptions, not malformed-but-successful results, and this Agent makes no model calls at all. Rather than force-fit these into a Section-9.6-named bucket that doesn't quite match, the category is named for what it actually is, with a comment explaining the mismatch.
- **Only the four currently-detectable triggers got real categories.** Section 9.6 lists twelve; the other eight (contradictory evidence, evidence-confidence thresholds, unsupported policy interpretation, manual waiver/override, protected-communication triggers, provider-result-outside-contract, prompt-injection signals, tenant-risk-policy categories) have no real detector anywhere in this codebase and were not given placeholder categories — consistent with this session's standing rule against fabricating coverage for a capability that doesn't exist yet.
- **No behavior change for any existing test or real run** — every trigger takes the exact same route (interrupt vs. manual review) it always did; only the classification path and the new persisted `reviewCategory` field are new. Verified by the fact every pre-existing test in `lending-operations-agent-runtime.spec.ts` still passes with only additive `category` assertions, not changed route expectations.

### Verification

```text
npm run build / npm run lint:check (after npm run lint --fix for the
generated migration's prettier formatting)
  both passed clean

migration:generate against a scratch DB with all prior migrations
  applied — one new nullable enum column on agent_runs, no
  hand-editing needed

migration:run / migration:revert / migration:run cycle
  applied cleanly, reverted cleanly (dropping exactly the new column
  and enum type), re-applied cleanly

Scratch stack (m3021-verify, ports 5443/7234):
  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache --silent
    44 suites passed, 298 tests passed (292 -> 298: +6 — 5 new
    mandatory-review-triggers.spec.ts tests [pure, exhaustively
    covering the classification table] and 1 new
    schema-migrations.spec.ts revert test); every one of the five
    existing manual-review/interrupt tests in
    lending-operations-agent-runtime.spec.ts still passes, now with
    additional category assertions

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    2 suites passed, 14 tests passed (unchanged)

  DATABASE_URL=... npm test -t schema-migrations.spec.ts
    16/16 passed (cumulative apply + 15 per-migration revert steps,
    including the new first revert test for this migration)

Manual live verification (real REST API + real Temporal worker):
  created a case in a jurisdiction that exists but was never reviewed
  for coverage, started the workflow — the real policy resolver
  correctly flagged it REVIEW_REQUIRED, the real Agent run routed to
  INTERRUPTED_FOR_REVIEW; GET .../timeline showed the real persisted
  AgentRun entry with reviewCategory: "POLICY_AMBIGUITY" and
  reviewReason: "[POLICY_AMBIGUITY] jurisdiction ... has no reviewed,
  covered policy source" — confirmed by inspecting the actual JSON
  response

  synthetic tenant/case/evidence/agent-run/jurisdiction rows deleted
  afterward; scratch stack torn down (docker compose down -v)
```

### Security, privacy, cost, and compatibility

- No new externally-visible API contract change beyond an additive field (`reviewCategory`) in an existing endpoint's response (`GET .../timeline`) — no existing consumer's parsing breaks.
- `reviewCategory` is a closed enum (four values), not free text — no new injection or unbounded-content surface.
- No new external dependency, no new provider call.

### Known gaps

- Only 4 of Section 9.6's 12 named triggers have real categories/detectors — the other 8 need real backing subsystems (contradiction detection, evidence-confidence scoring, a model-in-the-loop for "malformed model output" to even be possible, prompt-injection detection, etc.) that don't exist yet.
- The literal tension between exit evidence B's "always interrupt" and Section 9.5's own two-route text is documented here, not resolved at the charter level — a charter clarification (making Section 20 explicitly say "interrupt or route to manual review, per Section 9.5's own distinction") would close this more permanently than any code change can.

### Next safe step

Continuing the user-directed remaining M3 exit-evidence gaps: extending `EvaluationInputManifest` assembly to every evaluation outcome, not only ones that open a condition (exit evidence F, currently partial), is next.

## M3-022: Manifest on every evaluation, not only condition-opening ones (Section 20 exit evidence F)

### Status

Implemented and verified. `EvaluationInputManifest` is now assembled for every completed DSL evaluation in `resolveOutcomeNode` — a case whose evidence matches expectations, or whose loan product has no applicable policy at all, now gets a real, evidence-backed manifest exactly like a case that opens a condition does. Only one outcome remains unmanifested, deliberately: an evaluation that resolves `REVIEW_REQUIRED` (policy-applicability ambiguity), because no binding exists yet for a manifest to reference.

### Acceptance criterion

Section 20's exit evidence F: "every evaluation reads one immutable input manifest," reinforced by Section 18.3's release gate: "evaluations without a valid immutable input manifest accepted: 0." Before this slice, `EvaluationInputManifest` (M3-014) was only assembled immediately before a `create_condition` call — an evaluation that checked evidence and correctly found nothing worth flagging left no audit-backed record of what it read, only the narrower `expectedCaseVersion` compare-and-swap check.

### Implementation

- `resolveOutcomeNode` (`lending-operations-agent-runtime.ts`) restructured so manifest assembly happens for every completed DSL evaluation outcome, not only the one that leads to `create_condition`:
  - `evaluation.matchedVersions.length === 0` (a resolved, non-ambiguous "no policy applies to this product/jurisdiction/lifecycle" outcome — e.g. a loan product with no seeded rule) now assembles a manifest with empty `evidenceRefs` (nothing was read, since there was nothing to check) before returning `PROPOSED_ACTION` with no condition.
  - The case where matched policy versions exist but none of their DSL conditions actually matched the case's real evidence (a genuine "checked and it's fine" outcome) now assembles a manifest referencing the evidence that *was* read, in the same place the manifest used to be built only for the matched case — moved earlier so it covers both outcomes uniformly.
  - The already-existing condition-opening path is unchanged in effect (still references the same manifest via `evaluationManifestId`), just now shares the single assembly call site with the no-match path instead of duplicating it.
- The one deliberate exception: `evaluatePolicyNode`'s `REVIEW_REQUIRED` branch still assembles no manifest, because `PolicyEvaluationService` never creates a binding for an ambiguous resolution — `policyBindingId` (a required manifest field) would have nothing real to reference. Documented in both the branch's own comment and the entity's class comment, not silently left inconsistent.

### Affected files

- `src/agent-runtime/langgraph/lending-operations-agent-runtime.ts`, `.spec.ts`
- `src/database/entities/evaluation-input-manifest.entity.ts` (comment update only — no schema change)
- `docs/DEVELOPMENT_LOG.md`, `README.md`

### Decisions and alternatives

- **No schema change.** `EvaluationInputManifest`'s shape was already general enough (evidence-agnostic — `evidenceRefs` can legitimately be empty) to represent a "nothing applicable" or "checked, nothing matched" outcome; broadening *when* it's assembled needed no new columns.
- **`REVIEW_REQUIRED` evaluations stay unmanifested, not force-fit with a placeholder `policyBindingId`.** Consistent with this session's standing rule against fabricating a field with no real value to reference — an ambiguous resolution genuinely has no binding, so a manifest claiming one would misrepresent what was actually read.
- **The no-match manifest for `matchedVersions.length === 0` references zero evidence, not "every fact on the case."** Matches M3-014's own established scoping principle (`evidenceRefs` reflects exactly what the evaluation actually read) — since no rule needed checking, nothing was read, and the manifest says so honestly rather than padding it with unrelated facts.

### Verification

```text
npm run build / npm run lint:check
  both passed clean, no fixes needed

No new migration — this slice adds no schema, only application code
and doc-comment updates.

Scratch stack (m3022-verify, ports 5443/7234):
  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache --silent
    44 suites passed, 299 tests passed (298 -> 299: +1 new test proving
    a real manifest with empty evidenceRefs is assembled when no
    policy version is applicable at all [a case with an unseeded loan
    product], plus a strengthened assertion on the existing
    "income matches evidence, no condition" test now also verifying a
    real evidence-backed manifest was assembled there too)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    2 suites passed, 14 tests passed (unchanged)

  DATABASE_URL=... npm test -t schema-migrations.spec.ts
    16/16 passed (unchanged — no migration this slice)

Manual live verification (real REST API + real Temporal worker):
  created a case whose stated income closely matches the real Plaid
  simulator's verified income for its borrowerId (4.9% difference,
  below the seeded rule's 10% threshold) — the case reached
  READY_FOR_UNDERWRITING with zero conditions opened, and a direct SQL
  query confirmed a real evaluation_input_manifests row exists for it,
  referencing the real policyBindingId and the real INCOME
  EvidenceFact actually read, with no LoanCondition owning it

  synthetic tenant/case/evidence rows deleted afterward; scratch stack
  torn down (docker compose down -v)
```

### Security, privacy, cost, and compatibility

- No new externally-visible API surface — manifests remain internal audit records, not yet exposed via REST/GraphQL (unchanged from M3-014).
- No new external dependency, no new provider call. Slightly more write volume per Agent run (one manifest row per evaluation instead of only per condition), acceptable at this codebase's synthetic data volumes.

### Known gaps

- `REVIEW_REQUIRED` evaluations remain unmanifested (see Decisions) — if a future policy-approval workflow needs an audit trail for ambiguous resolutions too, this would need a schema change (a nullable `policyBindingId`) that this slice deliberately didn't make.
- Still no REST/GraphQL endpoint exposes a manifest directly — reachable only by direct database query, same gap M3-014 already had.

### Next safe step

With H, B, and F all closed this session, the user-directed M3 exit-evidence punch list is complete. What remains open across the broader M3-closure effort: a real token/cost/provider-call budget ledger (still deliberately deferred — no genuine consumer exists), and the ~9 remaining Section 9.4 tools needing real backing subsystems (provider adapters, a calculation engine, a webhook subsystem) — both M4-adjacent scope, not something to close incrementally the way this session's slices did.

## M4-001: Provider platform foundations — registry, authorization grants, operation intents, and the first real adapter (Section 20 M4)

### Status

Implemented and verified. Section 11's provider platform now exists as real, tested code: a capability-contract interface (`ProviderAdapter`), a registry adapters `register()`/`resolve()` against, a time-bound `ProviderAuthorizationService` that revalidates and fails closed, and a `ProviderOperationIntentService` that persists one row per real dispatch attempt through its full state machine. Exactly one capability — income — is migrated onto this pipeline (`PlaidIncomeAdapter`, wrapping the existing `PlaidService` simulator unchanged); credit and document still call their simulators directly, unchanged from M2/M3, and are deliberately left that way for M4-002 to prove the registry pattern generalizes rather than migrating everything in one slice.

### Acceptance criterion

Section 20's M4 exit evidence's first bullet: "a new simulator adapter is added without domain or Agent changes." Section 11.5's own requirements: authorization is "case-, borrower-, provider-, capability-, purpose-, data-class-, optionally field-, and time-bound," revalidated "immediately before every external request," failing closed on "a stale, mismatched, expired, or revoked reference"; and "the platform persists the operation intent before dispatch," with an ambiguous outcome becoming `OUTCOME_UNKNOWN` rather than silently retried as if nothing happened.

### Implementation

- `src/provider-platform/types.ts` — the full type layer: `ProviderCapability` (INCOME/ASSET/CREDIT/IDENTITY/DOCUMENT — only INCOME has a real adapter), `ProviderMode` (only `SIMULATOR` is ever implemented), `ProviderEffectClass`, `ProviderOperationIntentState`, and the `ProviderAdapter<TRequest,TReceipt,TFinding>` contract (`submit`/`normalize`/`healthCheck`, with `poll`/`cancel` declared optional for a future asynchronous adapter that doesn't exist yet).
- `ProviderRegistryService` (`provider-registry.service.ts`) — `register()`/`resolve()`/`listRegistered()` keyed on capability+mode; `resolve()` throws on no match, `register()` throws on a duplicate. Deliberately dumb: Section 11.6's health/cost/fallback-order routing refinement has no real data to optimize over yet, since only one adapter is ever registered per capability today.
- `ProviderAuthorizationService` (`provider-authorization.service.ts`) — `issue()` persists a `ProviderAuthorizationGrant` with a default 5-minute TTL; `revalidate()` re-reads the grant and checks tenant/case/provider/capability match, revocation, and expiry, returning a typed `{valid: false, reason}` rather than throwing, so the caller decides how to react; `revoke()` sets `revokedAt`.
- `ProviderOperationIntentService` (`provider-operation-intent.service.ts`) — `prepare()` persists a `PREPARED` intent with a sha256 request fingerprint and a fresh UUID idempotency key *before* any external call; `markDispatched/Succeeded/FailedFinal/OutcomeUnknown()` record the real terminal (or ambiguous) outcome once known. A Temporal retry of the enclosing activity calls `prepare()` again rather than reusing the failed row, so the state history of every real attempt stays intact.
- `dispatchProviderRequest()` (`dispatch-provider-request.ts`) — the generic dispatch pipeline every capability will eventually route through: resolve the adapter → issue a grant → persist the intent → revalidate the grant → dispatch → classify the outcome onto the intent (`SyntheticProviderRejectionError` → `FAILED_FINAL`, `SyntheticProviderTimeoutError` → `OUTCOME_UNKNOWN`) → normalize. Every current adapter is synchronous (`SynchronousProviderReceipt`), so this helper unwraps `receipt.payload` directly; a real asynchronous adapter would need a poll-until-terminal variant that doesn't exist yet.
- `PlaidIncomeAdapter` (`integrations/plaid/plaid-income.adapter.ts`) — wraps `PlaidService.getIncomeData()` unchanged; `submit()` only takes the one parameter it actually uses (`request`), following the same pattern `normalize()` in `types.ts` already set for an interface parameter no simulator adapter needs yet.
- `ProviderAdapterBootstrapService` (`integrations/provider-adapter-bootstrap.service.ts`) — an `OnModuleInit` hook that registers every real adapter this codebase has at process startup; the concrete proof of the exit-evidence bullet is that adding a capability means one adapter class plus one `register()` call here, never a change to the registry, the dispatch helper, or any workflow/Agent code that calls `resolve()`.
- `case-conditions.activities.ts`'s `fetchIncomeEvidence` now calls `dispatchProviderRequest()` instead of `plaidService.getIncomeData()` directly, still wrapped in the existing `callProviderWithRetryClassification` — retry classification behavior for `SYNTHETIC-TRANSIENT-FAILURE-`/`SYNTHETIC-TERMINAL-FAILURE-` borrowerIds is unchanged, now backed by real grant/intent rows instead of a bare simulator call. `plaidService` dropped entirely from `CaseConditionsActivitiesDeps` (unused once income routes through the registry) and every construction call site (`worker.ts`, `evaluation/runner.ts`, both spec files) updated to build/pass the three new provider-platform services instead.
- Two new tables via one migration (`1787031644483-ProviderPlatform.ts`): `provider_authorization_grants`, `provider_operation_intents`. Neither has a foreign key to the other or to `loan_cases` — same loose-coupling convention `EvaluationInputManifest` already established (a plain `uuid` reference, not a hard FK), so a grant or intent row outlives the case it referenced if the case is ever purged.

### Affected files

- `src/provider-platform/types.ts`, `provider-registry.service.ts` (+`.spec.ts`), `provider-authorization.service.ts` (+`.spec.ts`), `provider-operation-intent.service.ts` (+`.spec.ts`), `dispatch-provider-request.ts`, `provider-platform.module.ts`
- `src/database/entities/provider-authorization-grant.entity.ts`, `provider-operation-intent.entity.ts`
- `src/database/enums/provider-platform.enum.ts`
- `src/database/migrations/1787031644483-ProviderPlatform.ts`, `schema-migrations.spec.ts`
- `src/integrations/plaid/plaid-income.adapter.ts` (+`.spec.ts`), `provider-adapter-bootstrap.service.ts`, `integrations.module.ts`
- `src/workflows/case-conditions.activities.ts`, `.spec.ts`
- `src/worker.ts`, `src/evaluation/runner.ts`, `src/evaluation/runner.spec.ts`, `src/evaluation-report.ts`
- `docs/DEVELOPMENT_LOG.md`, `README.md`

### Decisions and alternatives

- **Only income migrated this slice, not credit and document too.** Migrating all three in one slice would have made it impossible to tell whether the registry pattern actually generalizes cleanly or whether the first adapter just happened to fit — M4-002 migrating credit/document with *no* change to the registry, dispatch helper, or authorization/intent services is the real proof of the exit-evidence bullet, not just three adapters existing.
- **Promotion manifests, certification records, and two-person approval (Section 11.4/11.8) not built.** Every current adapter is `SIMULATOR`-mode; there is no second real provider mode to promote *to* yet, so a promotion-manifest schema would have no real transition to record — same reasoning already applied to the deliberately-deferred budget ledger. `ProviderMode` still names `AUTHORIZED_SANDBOX`/`PRODUCTION_BYOC` as vocabulary (Section 11.1 names all three), never as a claim this codebase can talk to a real provider.
- **`ProviderAuthorizationGrant.consentRecordIds` stays always-empty, `permissiblePurposeDecisionId` and `permittedFields` stay always-null.** No consent-record, permissible-purpose, or field-addressable-capability subsystem exists yet — the same honest-null pattern `EvaluationInputManifest` established (M3-014), not a fabricated value for a field this codebase can't back.
- **No reconciliation worker.** `RECONCILING` is declared in the state enum (matching the charter's full vocabulary) but nothing transitions an intent into it — an `OUTCOME_UNKNOWN` intent stays `OUTCOME_UNKNOWN` until a future reconciliation mechanism exists. Documented as a known gap, not silently unreachable.
- **An unrecognized (non-synthetic) error from `submit()` leaves its intent in `DISPATCHED` forever.** `dispatchProviderRequest()` only classifies the two synthetic failure types onto the intent before rethrowing; a genuinely unexpected error (a real bug, not a simulated provider failure) propagates unchanged so `callProviderWithRetryClassification`'s existing unclassified-error behavior is preserved exactly, at the cost of that one intent row never reaching a terminal state. Acceptable for a `SIMULATOR`-only codebase where "unrecognized error" today only ever means a real bug in the adapter code, not a real provider being weird.

### Verification

```text
npm run build / npm run lint:check
  both passed clean (two minor issues introduced during the slice —
  three unused ProviderAdapter.submit() params in PlaidIncomeAdapter,
  two prettier formatting diffs in new spec files — fixed before this
  entry, not left for a future slice)

Migration (scratch throwaway Postgres, then the m4001-verify stack):
  migration:run applies ProviderPlatform1787031644483 cleanly from
  the prior HEAD (AgentRunReviewCategory) on both a from-scratch
  database and one already carrying every prior migration

  DATABASE_URL=... npx jest schema-migrations.spec.ts --runInBand
    17/17 passed (16 -> 17: +1 new revert test proving the provider
    platform migration's two new tables disappear cleanly and no
    other table is touched)

Scratch stack (m4001-verify, ports 5443/7234):
  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache --silent
    47 suites passed (1 skipped, pre-existing/unrelated), 310 tests
    passed (10 skipped, pre-existing/unrelated) — +4 new suites / +20
    new tests this slice (provider-registry, plaid-income.adapter,
    provider-authorization.service, provider-operation-intent.service)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    2 suites passed, 14 tests passed (unchanged — full app bootstrap
    including ProviderPlatformModule/ProviderAdapterBootstrapService
    now exercised on every e2e run)

Manual live verification (real REST API + real Temporal worker):
  created a case (income discrepancy scenario, same as prior slices'
  verification) and started its workflow — the worker log and a
  direct SQL query both confirmed a real provider_authorization_grants
  row (INCOME, plaid-simulator, purposeCode=UNDERWRITING_EVIDENCE,
  permittedDataClasses=["INCOME"]) and a real provider_operation_intents
  row that transitioned PREPARED -> DISPATCHED -> SUCCEEDED, correctly
  linked via authorizationGrantId; the case reached the same
  VERIFY_INCOME_DISCREPANCY outcome as before this slice, proving the
  new pipeline didn't change evaluation behavior, only how the income
  call is dispatched and audited

  created a second case with a SYNTHETIC-TRANSIENT-FAILURE- borrowerId
  and confirmed via direct SQL that each of the workflow's three retry
  attempts persisted its own intent row, all correctly landing on
  OUTCOME_UNKNOWN rather than a stale DISPATCHED or a fabricated
  SUCCEEDED

  synthetic tenant/case/grant/intent rows removed with the scratch
  stack teardown (docker compose down -v); no synthetic data persists
```

### Security, privacy, cost, and compatibility

- `revalidate()` fails closed by construction — a grant that doesn't exist, doesn't match, is expired, or is revoked returns `{valid: false}` and the caller (`dispatchProviderRequest`) marks the intent `FAILED_FINAL` and throws, never dispatching. No path silently proceeds without a matching grant.
- Grants are short-lived (5-minute default TTL) and scoped to one case/provider/capability — not a standing credential a compromised process could replay against a different case.
- No new externally-visible API surface — grants and intents are internal audit/enforcement records, not yet exposed via REST/GraphQL.
- Slightly more write volume per income fetch (one grant insert, one intent insert, one-to-two intent updates, versus the prior bare simulator call) — acceptable at this codebase's synthetic data volumes, same tradeoff M3-014's manifest and M3-021's review-category persistence already made.
- No new external dependency — `PlaidIncomeAdapter` wraps the existing in-process simulator, nothing crosses a real network boundary yet.

### Known gaps

- Credit and document capabilities still call their simulators directly, bypassing the registry entirely — M4-002 scope, tracked so the exit-evidence bullet ("a new simulator adapter is added without domain or Agent changes") gets proven against a second capability, not just asserted from one.
- Promotion manifests, certification records, two-person production-activation approval (Section 11.4/11.8), and the `AUTHORIZED_SANDBOX`/`PRODUCTION_BYOC` modes themselves remain unbuilt — no second real provider mode exists to promote to yet.
- No reconciliation worker ever moves an intent into `RECONCILING`; an `OUTCOME_UNKNOWN` intent has no automatic resolution path today.
- `ProviderAuthorizationGrant.permittedFields` (field-level authorization) and `consentRecordIds`/`permissiblePurposeDecisionId` stay structurally present but always null/empty — no consent-record or permissible-purpose subsystem exists to populate them.
- No REST/GraphQL surface exposes grants or intents directly — reachable only by direct database query, the same gap `EvaluationInputManifest` and `AgentRun` had at their own introduction.
- ASSET and IDENTITY capabilities are named in `ProviderCapability` but have no registered adapter of any kind.

### Next safe step

M4-002: migrate credit and document onto the same `ProviderAdapter`/registry/dispatch pipeline income now uses, with the explicit goal of touching only `integrations/` (new adapter classes) and the bootstrap service's `register()` calls — any change needed to `ProviderRegistryService`, `dispatch-provider-request.ts`, or `case-conditions.activities.ts` beyond swapping the dispatch call site would mean the pattern doesn't actually generalize yet.

## M4-002: Credit and document capabilities migrated onto the provider platform (Section 20 M4 exit evidence, first bullet)

### Status

Implemented and verified. All three evidence-fetch activities (`fetchIncomeEvidence`, `fetchCreditEvidence`, `fetchDocumentEvidence`) now dispatch through the same `dispatchProviderRequest()` pipeline M4-001 built for income alone. `CreditReportAdapter` and `DocumentVerificationAdapter` wrap the existing `CreditService`/`DocumentService` simulators unchanged, mirroring `PlaidIncomeAdapter` exactly. As predicted in M4-001's "Next safe step," this slice touched only `src/integrations/` (two new adapter classes) and `ProviderAdapterBootstrapService`'s `register()` calls — `ProviderRegistryService`, `dispatch-provider-request.ts`, `ProviderAuthorizationService`, and `ProviderOperationIntentService` are byte-for-byte unchanged from M4-001, which is the actual proof that the pattern generalizes rather than an assertion about it.

### Acceptance criterion

Section 20's M4 exit evidence, first bullet: "a new simulator adapter is added without domain or Agent changes." M4-001 proved this once, with one capability; this slice proves it a second and third time in the same commit, which is the real test — a pattern that only works for its first user isn't a pattern.

### Implementation

- `CreditReportAdapter` (`integrations/credit/credit-report.adapter.ts`) — wraps `CreditService.getCreditData()` unchanged; `providerId='credit-bureau-simulator'`, `capability=CREDIT`, same `REUSABLE_LOOKUP`/`PROHIBITED`-fallback operation profile as the income adapter (a credit pull is idempotently re-runnable, same as an income lookup, so the same profile applies honestly, not by default).
- `DocumentVerificationAdapter` (`integrations/document/document-verification.adapter.ts`) — wraps `DocumentService.verifyDocuments()` unchanged; `providerId='document-verification-simulator'`, `capability=DOCUMENT`, same operation profile.
- `ProviderAdapterBootstrapService` — two more constructor-injected adapters, two more `register()` calls in `onModuleInit()`. Nothing else in the file changed.
- `case-conditions.activities.ts` — `fetchCreditEvidence`/`fetchDocumentEvidence` now call `dispatchProviderRequest()` with `ProviderCapability.CREDIT`/`DOCUMENT` respectively, exactly mirroring `fetchIncomeEvidence`'s M4-001 shape (`purposeCode: 'UNDERWRITING_EVIDENCE'`, `permittedDataClasses: ['CREDIT']`/`['DOCUMENT']`), still wrapped in the same `callProviderWithRetryClassification` — retry classification behavior for `SYNTHETIC-TRANSIENT-FAILURE-`/`SYNTHETIC-TERMINAL-FAILURE-` borrowerIds on credit/document is unchanged, now backed by real grant/intent rows the same way income's already was. `creditService`/`documentService` dropped from `CaseConditionsActivitiesDeps` (unused once both route through the registry) and every construction call site (`worker.ts`, `evaluation/runner.ts`, `evaluation-report.ts`, both spec files) updated the same way M4-001 already updated them for `plaidService`.
- No schema change, no new migration — both new adapters reuse the exact `provider_authorization_grants`/`provider_operation_intents` tables M4-001 created; only their `capability` column value differs.

### Affected files

- `src/integrations/credit/credit-report.adapter.ts` (+`.spec.ts`), `src/integrations/document/document-verification.adapter.ts` (+`.spec.ts`)
- `src/integrations/provider-adapter-bootstrap.service.ts`, `integrations.module.ts`
- `src/workflows/case-conditions.activities.ts`, `.spec.ts`
- `src/worker.ts`, `src/evaluation/runner.ts`, `src/evaluation/runner.spec.ts`, `src/evaluation-report.ts`
- `docs/DEVELOPMENT_LOG.md`, `README.md`

### Decisions and alternatives

- **Both capabilities migrated in one slice, not split into M4-002/M4-003.** Once the second migration (credit) came out identical in shape to the first, doing document in the same slice cost nothing extra and gave a stronger proof (three for three, not two for two) that no capability-specific wrinkle was hiding in the pattern.
- **`registryFor()` in `case-conditions.activities.spec.ts` generalized to accept all three services with mock defaults, rather than three separate per-capability helpers.** Most existing tests only ever cared about income; requiring every call site to explicitly construct unused credit/document mocks (as M4-001 briefly did) would have been noise. A test that does care (the real-simulator `describe` block) still passes its own real services through the same helper.
- **Same `REUSABLE_LOOKUP`/`PROHIBITED` operation profile for all three adapters.** Not copied by inattention — a credit pull and a document verification are, like an income lookup, read-only-in-effect and safely re-runnable (Temporal's own retry already assumes this), and none of the three has a real fallback provider to fall back to, so `PROHIBITED` is the honest answer for all three, not just income's.

### Verification

```text
npm run build / npm run lint:check
  both passed clean (two prettier formatting diffs in the two new
  adapter spec files, fixed before this entry)

No new migration — reuses M4-001's two tables unchanged; verified by
running migration:run from empty on the m4002-verify scratch stack and
seeing no new migration execute beyond ProviderPlatform1787031644483.

Scratch stack (m4002-verify, ports 5443/7234, brought up fresh — not
reused from M4-001's session):
  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache --silent
    50 suites passed, 330 tests passed (47 -> 50 suites, 310 -> 330
    tests: +2 new suites / +10 new tests, credit-report.adapter.spec.ts
    and document-verification.adapter.spec.ts, mirroring
    plaid-income.adapter.spec.ts exactly)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    2 suites passed, 14 tests passed (unchanged)

  DATABASE_URL=... npx jest schema-migrations.spec.ts --runInBand
    17/17 passed (unchanged — no migration this slice)

Manual live verification (real REST API + real Temporal worker):
  created a case and started its workflow — a direct SQL query
  confirmed three real provider_authorization_grants rows (INCOME,
  CREDIT, DOCUMENT, each with its own correct providerId and
  permittedDataClasses) and three real provider_operation_intents
  rows, all three reaching SUCCEEDED; the case's evidence_facts table
  showed all three facts with the correct sourceIdentifier per
  capability, and the case reached CONDITIONS_OPEN — the same outcome
  this exact scenario reached in M4-001's own live verification,
  confirming the migration changed only how credit/document are
  dispatched and audited, not what they return or what the case
  decides

  synthetic tenant/case data removed with the scratch stack teardown
  (docker compose down -v)
```

### Security, privacy, cost, and compatibility

- Same fail-closed `revalidate()` guarantee now covers credit and document dispatch, not only income — a mismatched, expired, or revoked grant blocks a credit pull or document verification exactly as it already blocked an income lookup.
- No new externally-visible API surface, no new external dependency — both adapters wrap already-existing in-process simulators.
- Modest additional write volume (two more grant/intent row pairs per case evaluation) — same acceptable tradeoff M4-001 already made for income.

### Known gaps

- Unchanged from M4-001: no reconciliation worker, no promotion manifest/certification/two-person-approval machinery, no field-level authorization, no REST/GraphQL surface for grants or intents, ASSET and IDENTITY capabilities still have no adapter.
- The older one-shot `evaluateLoan` path (`src/agent/agent.service.ts`) still calls `PlaidService`/`CreditService`/`DocumentService` directly, bypassing the registry entirely — unchanged and out of scope, since that path predates Section 9's Agent-runtime rewrite and isn't part of the case-conditions workflow this milestone is built around.

### Next safe step

With income, credit, and document all migrated, Section 20's M4 exit evidence's first bullet is now proven three times over in this codebase, not just asserted once. The remaining M4 exit-evidence bullets are all about a second real provider mode existing (authorized-sandbox parity, mode-change-through-configuration, promotion manifests) — none of them are buildable honestly without a real external provider relationship this codebase doesn't have, so M4's next honest increment is elsewhere in its scope list: REST/OpenAPI contract + generated TypeScript client + quickstart, or webhook subscriptions/delivery/retries on top of the existing signed outbox — both genuinely buildable today, unlike the promotion-manifest bullets.

## M4-003: OpenAPI contract, generated TypeScript client, and a runnable quickstart (Section 15.3, 20 M4 scope)

### Status

Implemented and verified. `CasesController` (the real M2/M3 REST surface — 6 endpoints) is now fully `@nestjs/swagger`-decorated with explicit, stable `operationId`s; `npm run generate:openapi` boots the real app and writes the resulting document to a checked-in `openapi/openapi.json`; `npm run generate:client` runs `openapi-typescript` against that file to produce a genuinely generated `client/generated/schema.d.ts`; `client/index.ts` is a thin `openapi-fetch` wrapper making every call fully typed against it; `client/quickstart.ts` (`npm run quickstart`) drives a real case through creation, workflow start, condition-opening, reviewer resolution, and completion using only that generated client against a real running API + Temporal worker — the concrete realization of the exit evidence's own words, "generated client completes the published quickstart."

### Acceptance criterion

Section 15.3: "checked and published OpenAPI artifact," "stable operation identifiers for SDK generation." Section 20's M4 exit evidence: "generated client completes the published quickstart."

### Implementation

- `@nestjs/swagger`, `openapi-fetch` (runtime deps) and `openapi-typescript` (devDependency, code-generator only) added. Explicit `@ApiProperty()`/`@ApiOperation()`/`@ApiResponse()`-family decorators throughout — no CLI-plugin auto-decoration (`nest-cli.json`'s `@nestjs/swagger` plugin), because that plugin only runs through the Nest compiler (`nest build`/`nest start`), not the plain `ts-node` execution this codebase's other scripts (`evaluation-report.ts`, and now `generate-openapi-spec.ts`) already use; explicit decorators work identically under either runner.
- `WorkflowRunStatus` (`cases.service.ts`) and `TimelineEntry` (`case-timeline.service.ts`) converted from `interface` to `class` — an interface has no runtime representation for `@nestjs/swagger` to introspect via `@ApiProperty()`. A new `StartWorkflowRunResult` class replaces `startWorkflow()`'s previously-inline `{ workflowId, runId }` return type for the same reason. All three are structurally unchanged — object literals still satisfy them, no constructor or `implements` clause added, no call site elsewhere needed updating.
- `LoanCase` (the entity) gained `@ApiProperty()` on every field the REST layer actually returns; its two lazy relations (`tenant?`, `jurisdiction?`, never populated by this controller's queries) were deliberately left undecorated so the generated schema doesn't claim a field this endpoint never actually returns.
- `CasesController`: every endpoint got an explicit `operationId` (`createCase`, `getCase`, `getCaseTimeline`, `startWorkflowRun`, `getWorkflowRun`, `submitReview`) rather than NestJS Swagger's route-derived default, which changes if a route path is ever refactored — Section 15.3's own "stable operation identifiers for SDK generation" requirement, taken literally.
- `src/openapi.config.ts` — one `buildOpenApiDocument(app)` function shared by `main.ts` (the live, dev-only `/api-docs` UI — same gating this codebase already applies to the GraphQL Playground, and for the identical stated reason: interactive documentation leaks the full surface to anyone who can reach it) and `src/generate-openapi-spec.ts` (writes the checked-in artifact). One function, one source of truth — the live UI and the checked-in file can never quietly diverge from each other.
- `client/index.ts` + `client/generated/schema.d.ts` (checked in, not gitignored — see Decisions) + `client/quickstart.ts`. The quickstart's poll loop doesn't gamble on whether the Plaid simulator's deterministic income for its borrowerId happens to trigger the seeded discrepancy rule: it watches the case's own status, and the moment it observes `CONDITIONS_OPEN`, submits a real `submitReview` call to resolve it — deterministic either way, and it exercises the review endpoint too, not just the happy path.
- `docs/QUICKSTART.md` — the "published quickstart" the exit evidence names.

### Affected files

- `src/openapi.config.ts`, `src/generate-openapi-spec.ts`, `src/main.ts`
- `src/cases/cases.controller.ts`, `cases.service.ts`, `case-timeline.service.ts`, `dto/create-case.dto.ts`, `dto/review.dto.ts`
- `src/database/entities/loan-case.entity.ts`
- `openapi/openapi.json` (generated, checked in), `client/index.ts`, `client/generated/schema.d.ts` (generated, checked in), `client/quickstart.ts`
- `package.json` (`@nestjs/swagger`, `openapi-fetch`, `openapi-typescript`, `overrides.openapi-typescript.typescript`, three new scripts), `eslint.config.js`, `tsconfig.build.json`
- `docs/QUICKSTART.md`, `docs/DEVELOPMENT_LOG.md`, `README.md`

### Decisions and alternatives

- **`openapi/openapi.json` and `client/generated/schema.d.ts` are checked in, unlike `src/schema.gql` (gitignored).** `schema.gql` regenerates automatically on every app start (`autoSchemaFile` in `app.module.ts`) so it's never stale; these two artifacts only regenerate on an explicit `npm run generate:*` step, so leaving them out of git would mean a fresh clone can't typecheck `client/` or serve `/api-docs-json`'s checked-in counterpart until someone remembers to run codegen — bad for exactly the "quickstart" experience this slice is building. Section 15.3's own "checked... OpenAPI artifact" language settles the first one explicitly; the generated client types followed the same reasoning for consistency.
- **No `@nestjs/swagger` CLI plugin, explicit decorators instead.** Considered and rejected: the plugin only transforms code through the Nest compiler, and this codebase's scripts (including the new `generate-openapi-spec.ts`) run via plain `ts-node` to match `evaluation-report.ts`'s existing convention — a plugin-dependent approach would silently produce a *different*, decorator-less schema depending on which runner generated it. Explicit decorators cost more lines but behave identically everywhere.
- **`openapi-typescript` + `openapi-fetch` over a full codegen tool (e.g. `openapi-typescript-codegen`).** For a 6-endpoint REST surface, a full generated service/model file tree is more machinery than the surface needs — matches this codebase's standing "no premature abstraction" rule. `openapi-typescript`'s output actually is fully generated (never hand-edited); `client/index.ts` is the one small hand-written file, a thin wrapper, not a duplicate of anything the generator already produces.
- **`npm install openapi-typescript --legacy-peer-deps` broke the app the first time (Errors and fixes below) — fixed via a targeted `package.json` `overrides` entry, not by leaving `--legacy-peer-deps` in place.** `--legacy-peer-deps` disables peer-dependency resolution for the *entire* install, not just the one package with the conflicting peer range; it silently pruned `@apollo/server` (an implicit, unlisted peer of `@nestjs/apollo`/`@apollo/server-plugin-landing-page-graphql-playground` that npm had been auto-installing) along with 27 other packages. The `overrides` entry (`openapi-typescript.typescript` pinned to `$typescript`, the root's own resolved version) satisfies just that one package's peer check without touching how npm resolves anything else.
- **Health endpoints (`/health/live`, `/health/ready`) left with NestJS Swagger's default, undecorated operationIds.** They're infra liveness/readiness probes, not part of the Section 15.1 partner API surface this slice's own OpenAPI description explicitly scopes to — not worth the same explicit-`operationId` treatment as the partner-facing endpoints.

### Verification

```text
npm run build / npm run lint:check
  both passed clean after fixing the @apollo/server regression (below)
  and a handful of prettier formatting diffs in the new controller/
  client files

No new migration — this slice adds no schema.

Scratch stack (m4003-verify, ports 5443/7234, fresh):
  DATABASE_URL=... npm run migration:run
    applies cleanly from empty, same 16 migrations as M4-002, nothing new

  DATABASE_URL=... npm run generate:openapi
    writes openapi/openapi.json — 8 paths (6 loan-cases + 2 health),
    6 named schemas (CreateCaseDto, LoanCase, TimelineEntry,
    StartWorkflowRunResult, WorkflowRunStatus, ReviewDto)

  npm run generate:client
    writes client/generated/schema.d.ts (433 lines) from that file

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache --silent
    50 suites passed, 330 tests passed (unchanged from M4-002 — this
    slice added no new src/ tests, only client/ tooling)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    2 suites passed, 14 tests passed (unchanged)

  DATABASE_URL=... npx jest schema-migrations.spec.ts --runInBand
    17/17 passed (unchanged)

Manual live verification (real REST API + real Temporal worker):
  confirmed GET /api-docs-json serves the same 8-path document in a
  running dev-mode server

  ran `npm run quickstart` against that real server end to end:
  seeded a tenant, created a case, started its workflow, watched it
  reach CONDITIONS_OPEN, submitted a real submitReview call, watched
  the workflow reach Temporal status COMPLETED and the case reach
  READY_FOR_UNDERWRITING, and printed a real 10-entry timeline —
  "Quickstart completed successfully." with exit code 0
```

### Errors and fixes

- **`npm install -D openapi-typescript --legacy-peer-deps` silently removed `@apollo/server` and 27 other packages, breaking `AppModule` (`Cannot find module '@apollo/server'`).** Caught immediately by running `npm run generate:openapi` right after the install — the app failed to boot. Root cause and fix are in Decisions above (`package.json` `overrides` instead of `--legacy-peer-deps`). Verified fixed: `rm -rf node_modules && npm install` restored `@apollo/server`, `npm run build` passed, and the full test suite (330 tests) passed clean afterward — this was caught and fixed before anything broken was ever committed.

### Security, privacy, cost, and compatibility

- The interactive `/api-docs` UI is gated to `NODE_ENV=development` only, identical reasoning and identical gate to the existing GraphQL Playground (charter 16.1). The checked-in `openapi/openapi.json` is a static file, not a live introspection endpoint — publishing it is the point (Section 15.3).
- No new externally-visible *behavior* — every endpoint's actual logic is byte-for-byte unchanged; this slice only adds documentation/typing/tooling around the existing six routes.
- `client/quickstart.ts` creates real (visibly synthetic) tenant/case/evidence/condition/agent-run/outbox rows against whatever database it's pointed at — intentional (a quickstart is meant to leave a browsable result behind), documented in `docs/QUICKSTART.md`, and only ever run by a developer against their own local/scratch environment.

### Known gaps

- Only `CasesController`'s 6 endpoints are documented — the rest of Section 15.1's target partner API (consents, documents, conditions/evidence listing, policy snapshots, provider operations, audit export, webhook endpoints) doesn't exist in this codebase yet, so it isn't represented in the OpenAPI artifact either. The artifact's own `description` field says this explicitly rather than silently looking complete. **Partially closed by normal development, confirmed at M5-030**: every real controller built since this slice (`WebhookEndpointsController`/`WebhookDeliveriesController` at M4-004, `CommunicationMessagesController` at M5-022) was written *with* `@ApiTags`/`@ApiOperation` decoration from the start, not left undocumented — `npm run generate:openapi` covers 100% of this codebase's real routes today (14 documented operations across 4 controllers, confirmed via a real regeneration producing zero diff against the checked-in artifact). What's still true: consents, documents, policy snapshots, provider operations, and audit export still have no REST surface at all — an OpenAPI *documentation* gap this specific bullet named, but really a "these routes were never built" gap, the same category as M4-007/M5-029's own "no admin RBAC surface" finding.
- No RFC 9457 problem-details error format, no request/trace identifiers on responses, no pagination, no rate-limit headers, no API version/deprecation policy, no contract tests for backward compatibility — all named in Section 15.3, none built yet.
- No authentication on this REST surface at all (unchanged, long-standing gap since M2). **Closed by M5-001 through M5-024** — every real route has required a real credential (`TenantAuthGuard`: machine `api_clients` or OIDC) since M5-001, and this bullet was never updated to say so.
- A Python generated client (Section 15.1: "may follow after the OpenAPI contract stabilizes") is explicitly out of scope — not attempted.

### Next safe step

M4-004: webhook subscriptions, delivery retries, history, and replay protection — the other genuinely-buildable-today M4 scope item, building on the existing signed `outbox_events` foundation (M2) the same way this slice built on the existing `CasesController`.

## M4-004: Webhook subscriptions, delivery retries, history, and replay protection (Section 20 M4 scope; Section 14.1's `webhook_endpoints`/`webhook_deliveries`)

### Status

Implemented and verified. `outbox_events` (M2's transactional outbox, dispatcher-less until now) finally has a real dispatcher: `WebhookDispatchService` polls unpublished events, fans each out to a `WebhookDelivery` row per active, subscribed `WebhookEndpoint`, and attempts every due delivery with a real signed HTTP POST — retrying failed attempts with exponential backoff up to a 5-attempt budget before giving up. `POST /v1/webhook-endpoints` and `GET /v1/webhook-deliveries/{deliveryId}` (Section 15.1's exact two webhook routes) are real, OpenAPI-documented endpoints. Every attempt carries a timestamped, HMAC-signed, stable delivery id (`X-Webhook-Id`/`X-Webhook-Timestamp`/`X-Webhook-Signature`) — genuine replay protection, not a name for something unenforced.

### Acceptance criterion

Section 20's M4 scope: "webhook subscriptions, delivery retries, history, and replay protection." Section 14.1: `webhook_endpoints` — "Destination, secret reference, subscriptions, and state"; `webhook_deliveries` — "Signed attempt history and replay state." Section 15.3: "timestamped HMAC webhook signatures and replay protection," "stable event identifiers across retries."

### Implementation

- `WebhookEndpoint`/`WebhookDelivery` entities (`src/database/entities/`), `WebhookEndpointStatus`/`WebhookDeliveryStatus` enums, one migration (`1787042560459-WebhookPlatform.ts`). `WebhookDelivery` is one row per (outbox event, endpoint) pair — a logical delivery, not a single attempt — with a real `attempts: WebhookDeliveryAttempt[]` jsonb column accumulating every physical attempt (Section 14.1's "attempt history," not just a rolling last-attempt summary). Real foreign keys to both `webhook_endpoints` and `outbox_events` (`ON DELETE CASCADE`) — unlike the provider-platform tables (M4-001), this is a genuine parent/child ownership relationship, the same reasoning `tool_attempts -> agent_runs` already used.
- `webhook-signer.ts` — `signWebhookDelivery`/`verifyWebhookSignature`, the "id.timestamp.body" HMAC scheme (Stripe/GitHub's own prior art). Deliberately not a reuse of `outbox-signer.ts`'s `signOutboxPayload`: that one canonicalizes a `Record<string, unknown>` because it has to survive a round trip through Postgres jsonb (which reorders keys); this one signs the literal JSON string about to go out on the wire, so there's no reordering to canonicalize away. Binding the delivery id and timestamp into the signature (not just the body) is what makes this genuinely replay-resistant — a captured request can't be replayed later (timestamp no longer matches "now") or have its body spliced onto a different delivery.
- `WebhookEndpointService` — `create()` (generates a real `randomBytes(32)` secret, returned once), `findActiveForTenantAndEventType()`, `findByIdOrFail()`.
- `WebhookDispatchService` — `dispatchPendingEvents({ now? })`: sweeps unpublished outbox events in batches of 50, creates delivery rows for every currently-subscribed active endpoint, marks each event published (meaning "handed to the webhook subsystem," the outbox pattern's standard meaning — not "delivered to everyone"), then attempts every due delivery (fresh, or past its backoff window) with a real `fetch()` POST, a 10s timeout via `AbortController`, and up to 5 attempts before `FAILED_FINAL`. The injectable `now` clock (same pattern as `webhook-signer.ts`'s `verifyWebhookSignature`) lets tests simulate a backoff window elapsing without a real wall-clock wait, without making production's actual backoff intervals artificially short.
- `WebhookEndpointsController`/`WebhookDeliveriesController` — the charter's exact two routes, `@nestjs/swagger`-decorated the same way M4-003 decorated `CasesController` (explicit `operationId`s, `@ApiProperty()` throughout).
- `worker.ts` gained a `setInterval`-driven poll loop (`WEBHOOK_DISPATCH_INTERVAL_MS`, default 5000ms, new validated env var) calling `dispatchPendingEvents()` — Section 12.1's Worker service scope names "webhook delivery" explicitly. Not a Temporal workflow/activity: a `WebhookDelivery` row already *is* the durable record of what's attempted and what's still due, so a crash between polls loses nothing — the next poll just picks it back up. (Section 12.2's own architecture diagram draws "Outbox dispatcher" as hanging off the API service rather than the Worker service, which reads as mildly in tension with 12.1's prose — noted here rather than silently resolved, same discipline as prior charter-tension notes this session; the prose's explicit "webhook delivery" listing under Worker service is what this slice followed.)

### Affected files

- `src/database/entities/webhook-endpoint.entity.ts`, `webhook-delivery.entity.ts`
- `src/database/enums/webhook.enum.ts`
- `src/database/migrations/1787042560459-WebhookPlatform.ts`, `schema-migrations.spec.ts`
- `src/webhooks/webhook-signer.ts` (+`.spec.ts`), `webhook-endpoint.service.ts` (+`.spec.ts`), `webhook-delivery.service.ts`, `webhook-dispatch.service.ts` (+`.spec.ts`), `webhook-endpoints.controller.ts`, `webhook-deliveries.controller.ts`, `webhooks.module.ts`, `dto/create-webhook-endpoint.dto.ts`
- `src/app.module.ts`, `src/worker.module.ts`, `src/worker.ts`, `src/config/env.validation.ts`
- `src/openapi.config.ts` (added the `webhooks` tag)
- `openapi/openapi.json`, `client/generated/schema.d.ts` (regenerated — 10 paths now, up from 8)
- `test/webhooks.e2e-spec.ts`
- `docs/DEVELOPMENT_LOG.md`, `README.md`

### Decisions and alternatives

- **One `WebhookDelivery` row per (event, endpoint), with an in-place `attempts` array, not a separate parent-delivery + child-attempt-row schema.** A normalized two-table design was considered; given the actual data volumes at this codebase's scale, a jsonb array on the delivery row gives the exact same "signed attempt history" Section 14.1 asks for with one less table and no join required for `GET /v1/webhook-deliveries/{id}` to return the full history in one query.
- **A `setInterval` poll loop in `worker.ts`, not a new Temporal workflow.** Considered and rejected: Temporal's durable-execution guarantee exists to survive a crash mid-workflow, but a `WebhookDelivery` row already provides that durability for this specific job (its own `status`/`attempts`/`nextAttemptAt` fully describe what's left to do) — wrapping it in a workflow would duplicate state Temporal doesn't need to own, not add real safety.
- **No `@nestjs/schedule` dependency.** A single `setInterval` matches this codebase's "no premature abstraction" rule for one periodic job; a scheduling library earns its cost once there are multiple jobs needing cron-style expressions, retries-of-the-scheduler-itself, or distributed-lock coordination across multiple worker instances — none of which exist yet (this codebase runs exactly one worker process).
- **`WebhookDelivery`'s foreign keys are real (`ON DELETE CASCADE`), unlike the M4-001 provider-platform tables' deliberately-loose uuid references.** Different relationship shape: a `ProviderOperationIntent` referencing a `ProviderAuthorizationGrant` is a *citation* (the grant may need to outlive the intent for audit purposes even after a case is purged); a `WebhookDelivery` referencing its `WebhookEndpoint`/`OutboxEvent` is *ownership* — the same shape `tool_attempts -> agent_runs` already has a real FK for. Matching the existing precedent for each relationship's actual shape, not applying one convention uniformly regardless of fit.

### Errors and fixes

- **`@IsUrl({ require_tld: false })` alone did not reject the literal string `'not-a-url'` — it validated successfully.** Found by a deliberate negative-case e2e test failing ("expected 400, got 201"), not by accident. Root cause: `require_tld: false` alone (needed to allow `http://127.0.0.1:PORT/...` targets for local/test receivers) also relaxes `validator.js`'s scheme requirement enough to accept a bare word as a "hostname with no TLD." Fixed by adding `require_protocol: true` alongside it — `not-a-url` (no scheme) is correctly rejected, `http://127.0.0.1:54321/hook` (has a scheme, no TLD) still passes. Verified via a standalone script exercising `class-validator` directly against both inputs before and after the fix, then confirmed via the full e2e suite.
- **`npm install -D openapi-typescript --legacy-peer-deps` (M4-003) already established the `package.json` `overrides` fix this slice's `npm install` relied on** — no repeat of that incident; installing no new packages this slice (`@nestjs/swagger`, `openapi-fetch` already present) meant nothing new to conflict.
- **The dispatch tests' first run left the scratch database's `webhook_deliveries`/`webhook_endpoints` tables with residual rows, and a second run picked up a stale in-progress retry from the first run mid-suite.** `WebhookDispatchService.dispatchPendingEvents()` sweeps the *whole* table by design (every unpublished event, every due delivery, not scoped to one test) — a persistent scratch database without cleanup between test-suite invocations accumulates cross-run state, which a later run's assertions could pick up. Fixed by tracking every `tenantId` a test creates and deleting exactly those rows in `afterAll`; verified by running the suite twice in direct succession and confirming zero residual rows and identical results both times.

### Verification

```text
npm run build / npm run lint:check
  both passed clean after fixing the @IsUrl validation gap and a
  handful of prettier formatting diffs

Migration (m4003-verify scratch stack, reused from M4-003's own
session rather than torn down and rebuilt):
  migration:run applies WebhookPlatform1787042560459 cleanly on top
  of ProviderPlatform1787031644483

  DATABASE_URL=... npx jest schema-migrations.spec.ts --runInBand
    18/18 passed (17 -> 18: +1 new revert test proving the webhook
    platform migration's two new tables and two new foreign keys
    disappear cleanly and no other table is touched)

  DATABASE_URL=... npm test -- --runInBand --no-cache --silent
    53 suites passed, 346 tests passed (50 -> 53 suites, 330 -> 346
    tests: +3 new suites / +16 new tests — webhook-signer,
    webhook-endpoint.service, webhook-dispatch.service, the last one
    run twice in direct succession to prove the afterAll cleanup fix
    actually works, not just once)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    3 suites passed, 20 tests passed (2 -> 3 suites, 14 -> 20 tests:
    +1 new suite / +6 new tests, webhooks.e2e-spec.ts against the
    real, fully-bootstrapped AppModule — no Temporal server actually
    required for this one, since nothing in the webhooks surface
    touches TemporalClientService's lazy connection)

Manual live verification (real REST API + real Temporal worker, with
the new webhook dispatch loop running in the worker process, plus a
real standalone Node HTTP receiver script — not a test harness):
  registered a real webhook endpoint via POST /v1/webhook-endpoints
  subscribed to 4 event types; created a case and started its
  workflow; the live receiver genuinely received loan_case.created,
  condition.opened, and workflow_run.waiting_for_review (each with a
  real X-Webhook-Id/X-Webhook-Timestamp/X-Webhook-Signature) but never
  evidence.updated (correctly filtered — not a subscribed event type);
  independently recomputed the HMAC for one delivery using its
  endpoint's real returned secret and confirmed it matched the
  received X-Webhook-Signature byte-for-byte; submitted a real review
  via POST .../reviews and watched workflow_run.completed arrive at
  the receiver next; fetched that delivery via GET
  /v1/webhook-deliveries/{deliveryId} and confirmed it returned
  status=SUCCEEDED with a real one-entry attempts history matching
  what was actually sent

  processes stopped, scratch stack torn down (docker compose down -v)
```

### Security, privacy, cost, and compatibility

- Every delivery attempt is HMAC-signed with a per-endpoint secret and carries a timestamp bound into the signature — a receiver that implements the documented verification contract (`verifyWebhookSignature`, exported for exactly this purpose) can reject both tampered payloads and replayed old requests, not only the former.
- A webhook secret is returned exactly once, at endpoint creation, and never re-serialized on any other response this codebase has (there is no `GET`/`list` endpoint for `WebhookEndpoint` yet — Known gaps).
- No new externally-visible *behavior* on the existing six `CasesController` endpoints — this slice is purely additive.
- Real outbound HTTP calls now originate from the worker process (to whatever `targetUrl` a caller registers) — no allowlist, SSRF guard, or egress restriction exists yet (Known gap; the charter names SSRF-through-webhook-configuration explicitly as a threat-model concern for a later milestone).
- Bounded work per dispatch tick (`EVENT_BATCH_SIZE`/`DELIVERY_BATCH_SIZE` = 50) and a 10s per-attempt timeout — a slow or hanging receiver can't stall the whole dispatch loop indefinitely.

### Known gaps

- No SSRF/egress protection on `targetUrl` — a caller can currently register an endpoint pointing at an internal address. Named in the charter as a real threat-model item; not built this slice.
- No endpoint listing, update, disable, or delete REST surface — only `POST` (create) and the delivery `GET` exist, matching the charter's own Section 15.1 list exactly (it names only these two routes), but real operational use would need more.
- No per-tenant or global rate limit on outbound webhook calls.
- Retry backoff and the 5-attempt budget are fixed constants, not per-endpoint configurable.
- `publish_case_update` (Section 9.4's Agent tool, "deliver a signed machine webhook") still has no real backing — this slice built the delivery mechanism itself, not the Agent-tool integration point that would let a run trigger one directly rather than relying on the outbox's own domain-event triggers.
- No webhook inspector / sandbox scenario catalog (Section 20 M4 scope also names these) — out of this slice.

### Next safe step

Both of M4's genuinely-buildable-today scope items (REST/OpenAPI/client/quickstart, and webhooks) are now done. What remains in M4's scope list either needs a second real provider mode (promotion manifests, authorized-sandbox parity — not buildable honestly yet) or is its own separate vertical (webhook inspector/sandbox scenario catalog, `publish_case_update`'s Agent-tool wiring). The user has not yet directed which M5 or remaining-M4 increment to take next.

## M4-005: Asset and identity capability simulators (Section 7.2, Section 20 M4 scope: "income, asset, credit, identity, and document simulators")

### Status

Implemented and verified. `AssetService`/`IdentityService` (`src/integrations/asset/`, `src/integrations/identity/`) are two new deterministic simulators, matching the existing Plaid/Credit/Document simulators' shape exactly (opt-in synthetic-failure injection, a distinct deterministic hash-based seed per service, simulated latency). `AssetVerificationAdapter`/`IdentityVerificationAdapter` wrap them and are registered into `ProviderRegistryService` alongside the other three — all five capabilities Section 7.2 names now have a real `SIMULATOR` adapter. Deliberately *not* wired into `case-conditions.workflow.ts`'s evidence-fetch step or `check_case_completeness`'s required-fact-type list (see Decisions) — this slice closes the provider-platform-layer gap, not a workflow-integration gap that doesn't exist yet.

### Acceptance criterion

Section 20's M4 scope: "income, asset, credit, identity, and document simulators." Section 7.2 names five capabilities; before this slice only three had a real adapter.

### Implementation

- `AssetService.getAssetData(borrowerId)` — `liquidAssets`, `investmentAssets`, `accountCount`, `reserveMonths`, all borrowerId-seeded and deterministic, same shape as `CreditService`. A fifth distinct hash algorithm (rotate-and-xor) keeps its seed independent of the other four simulators' for the same borrowerId — each simulator already used a different one (additive-shift, djb2-variant, FNV-1a), so asset gets a fifth and identity a sixth.
- `IdentityService.verifyIdentity(borrowerId)` — `nameMatch`/`dateOfBirthMatch`/`ssnValid`/`addressMatch`/`fraudAlertPresent`/`identityVerified`, same boolean-checklist shape as `DocumentService`.
- `AssetVerificationAdapter`/`IdentityVerificationAdapter` — byte-for-byte the same structure as `CreditReportAdapter`/`DocumentVerificationAdapter` (M4-002): `REUSABLE_LOOKUP`/`PROHIBITED`-fallback operation profile, `submit()` delegates to the simulator and wraps as `COMPLETE`, `normalize()` is identity, `healthCheck()` always healthy.
- `ProviderAdapterBootstrapService` — two more constructor-injected adapters, two more `register()` calls. Nothing else in that file changed, same as M4-002's own proof.
- `dispatch-provider-request.spec.ts` (new) — this helper had no dedicated test since M4-001; its orchestration was only ever exercised indirectly through `case-conditions.activities.spec.ts`'s income/credit/document coverage, which doesn't apply to asset/identity since neither has a workflow call site. Tests the full grant-issue → intent-persist → revalidate → dispatch → classify cycle directly against real `AssetService`/`IdentityService` (including both synthetic failure prefixes), closing a real, pre-existing test-coverage gap for the dispatch helper itself, not just adding coverage for the two new capabilities.

### Affected files

- `src/integrations/asset/asset.types.ts`, `asset.service.ts`, `asset-verification.adapter.ts` (+`.spec.ts`)
- `src/integrations/identity/identity.types.ts`, `identity.service.ts`, `identity-verification.adapter.ts` (+`.spec.ts`)
- `src/integrations/provider-adapter-bootstrap.service.ts`, `integrations.module.ts`
- `src/provider-platform/dispatch-provider-request.spec.ts` (new)
- `docs/DEVELOPMENT_LOG.md`, `README.md`

### Decisions and alternatives

- **Not wired into `case-conditions.workflow.ts` or `check_case_completeness`'s `REQUIRED_FACT_TYPES`.** `EvidenceType.ASSET`/`IDENTITY` already existed in the schema (Section 7.2's target vocabulary, present since before this session), but `check_case_completeness`'s own class comment already scopes `REQUIRED_FACT_TYPES` explicitly to "each type the M2 case-conditions workflow's evidence-fetch activities produce" — not to everything `EvidenceType` could hold. The one seeded policy rule only ever reads income evidence; there is no real policy or Agent-tool consumer for asset/identity evidence yet. Fetching it into every case regardless (new activities, new outbox writes, new grant/intent rows nobody's downstream logic depends on) would be inert scaffolding, not a real integration — the same "don't build ahead of a real consumer" discipline this codebase has applied consistently (e.g. M3-022's evaluation-manifest scoping, the deferred budget ledger). This slice closes the provider-platform registry's own gap; workflow integration is a separate, not-yet-justified next step.
- **A fifth and sixth distinct deterministic hash algorithm, not reuse of an existing one.** Every existing simulator already deliberately uses a different hash so the same borrowerId doesn't happen to produce correlated results across capabilities (each service's own comment says so) — matching that established pattern rather than quietly breaking it for convenience.
- **`dispatch-provider-request.spec.ts` uses real `AssetService`/`IdentityService`, not mocks, including for the synthetic-failure paths.** Same "prefer real infra" discipline as `case-conditions.activities.spec.ts`'s own real-provider-simulator `describe` block (M2) — the synthetic failure injection is itself already a real, deterministic code path in the real simulator, not something that needs mocking to exercise.

### Verification

```text
npm run build / npm run lint:check
  both passed clean after a handful of prettier formatting diffs in
  the new adapter/service files

No new migration — this slice adds no schema (no new EvidenceType
usage, no new tables).

Scratch stack (m4005-verify, ports 5443/7234, fresh):
  DATABASE_URL=... npm run migration:run
    applies cleanly from empty, same 17 migrations as M4-004, nothing
    new

  DATABASE_URL=... npx jest asset-verification identity-verification dispatch-provider-request --runInBand
    3 suites passed, 15 tests passed (2 new adapter spec files x 5
    tests each, +1 new dispatch-provider-request spec x 5 tests)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache --silent
    56 suites passed, 361 tests passed (53 -> 56 suites, 346 -> 361
    tests: +3 new suites / +15 new tests)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    3 suites passed, 20 tests passed (unchanged)

  DATABASE_URL=... npx jest schema-migrations.spec.ts --runInBand
    18/18 passed (unchanged — no migration this slice)

Manual live verification (real API process boot):
  started the real API server against the scratch database and
  confirmed "Nest application successfully started" with no DI-
  resolution or duplicate-registration error — `ProviderAdapterBootstrapService`
  now constructor-injects and registers five real adapters, not three;
  a duplicate-capability registration would have thrown synchronously
  in onModuleInit() and crashed the boot, so a clean start is a real
  assertion, not just an absence of a compile error. No further live
  check was meaningful for this slice: since asset/identity are
  deliberately not wired into the workflow, there is no REST or
  Temporal entry point yet that would exercise them end to end (that
  is exactly the "Known gap" this slice's own Decisions section names,
  not an oversight in this verification).
```

### Security, privacy, cost, and compatibility

- No new externally-visible behavior — nothing outside `src/integrations/` and `src/provider-platform/`'s own test coverage calls either new adapter yet.
- No new external dependency — both are in-process simulators, same as the three they're modeled on.

### Known gaps

- Asset/identity evidence is not fetched by any real case, workflow, or Agent tool — the adapters exist and are registered, but nothing calls `dispatchProviderRequest()` for these two capabilities outside this slice's own tests. Wiring them in would need a real policy rule or Agent-tool consumer to justify it (Decisions above); none exists yet.
- Same known gaps M4-001/M4-002 already carry for every SIMULATOR-mode capability: no promotion manifest, no authorized-sandbox parity, no field-level authorization.

### Next safe step

All five Section 7.2 capabilities now have a real registered simulator adapter, closing that specific M4 scope bullet completely. The next M4-adjacent increment with a real consumer to justify it would be wiring `check_case_completeness`/a new policy rule to actually use asset or identity evidence — but that needs a product decision (what should an asset- or identity-driven condition even check?) this session hasn't been given. Absent that, the remaining open threads are M5 (authentication, tenant isolation/RLS — the biggest real gap this codebase currently has, since the REST API still has zero auth) or M4's separate sandbox/webhook-inspector/`publish_case_update` items. Not started; awaiting direction.

## M5-001: API-client authentication and tenant isolation at the API/service layers (Section 20 M5)

### Status

Implemented and verified. `ApiClient` (Section 20 M5's "scoped API-client authentication") is a real bearer credential — `{clientId}.{secret}`, scrypt-hashed at rest, bound to exactly one tenant — checked by `ApiKeyGuard` on every route under `/v1/loan-cases`, `/v1/webhook-endpoints`, and `/v1/webhook-deliveries`. The tenant a request acts as is now always the one the credential resolves to: `CreateCaseDto`/`CreateWebhookEndpointDto` no longer have a `tenantId` field at all, and every case/delivery lookup is scoped to the caller's own tenant, 404ing on a cross-tenant match exactly like it would on a nonexistent id. Full OIDC/FAPI 2.0, RBAC roles, consent enforcement, and PostgreSQL row-level security (all also named in Section 20 M5) are deliberately not attempted — this slice closes the single most urgent, concretely-scoped gap (zero authentication on a REST surface that trusted a caller-supplied `tenantId` field) rather than the whole milestone.

### Acceptance criterion

Section 20's M5 exit evidence: "cross-tenant tests fail closed at API, service, and database layers." This slice proves the API and service layers with real tests against a real database; the database layer (PostgreSQL RLS) is a deliberately deferred, separately-scoped follow-up (see Decisions).

### Implementation

- `ApiClient` entity (`src/database/entities/api-client.entity.ts`), `ApiClientStatus` enum (ACTIVE/REVOKED), one migration (`1787065685817-ApiClients.ts`). `hashedSecret` is `{salt}:{scryptDigest}` (`src/auth/api-client-secret.ts` — `generateApiClientSecret`/`hashApiClientSecret`/`verifyApiClientSecret`, Node's built-in `crypto.scrypt`, no new dependency); the raw secret is never persisted anywhere, generated fresh and returned exactly once.
- `ApiKeyGuard` (`src/auth/api-key.guard.ts`) — a `CanActivate` reading `Authorization: Bearer {clientId}.{secret}`, resolving and verifying the credential, and attaching `{tenantId, apiClientId}` to the request as `AuthContext`. Every failure path (missing header, malformed token, malformed clientId, unknown clientId, wrong secret, revoked client) throws the identical `UnauthorizedException` with the identical message — deliberately generic, the same "don't leak which part failed" reasoning `HealthController.ready()` already applies to database-unreachable responses.
- `AuthTenantId()` (`src/auth/auth-tenant-id.decorator.ts`) — a param decorator reading `request.authContext.tenantId`, the *only* way a controller method ever learns the caller's tenant. Throws a plain `Error` (a programming-error signal, not a caller-triggerable state) if used on a route that forgot `@UseGuards(ApiKeyGuard)`.
- `ApiClientService.create()` + `npm run create-api-client -- <tenantId> <name>` (`src/create-api-client.ts`) — no REST endpoint mints credentials (an endpoint that could would need its own "who's allowed to create API clients" authorization story first, which is exactly the administrative-duties/RBAC work this slice isn't attempting), matching this codebase's existing precedent for tenant creation itself (README: "seed one directly... for local use").
- `CasesController`/`WebhooksController`s: `@UseGuards(ApiKeyGuard)` + `@ApiBearerAuth()` at the controller level; every method gained an `@AuthTenantId() tenantId: string` first parameter. `CasesService`/`WebhookEndpointService`/`WebhookDeliveryService` methods now take `tenantId` as a real parameter (not sourced from a DTO) and filter every tenant-scoped query on it — `CasesService.getCase()`'s query changed from `findOneBy({ id: caseId })` to `findOneBy({ id: caseId, tenantId })`, the concrete mechanism behind "cross-tenant fails closed at... the service... layer."
- `CreateCaseDto`/`CreateWebhookEndpointDto` lost their `tenantId` field entirely — not just stopped trusting it, removed the field, so there is nothing left for a caller to get right or wrong (the exit evidence's "fails closed" read literally: failure isn't possible because the unsafe path no longer exists).
- OpenAPI/client: `openapi.config.ts` gained `.addBearerAuth()`; regenerated `openapi/openapi.json`/`client/generated/schema.d.ts`. `client/index.ts`'s `createApiClient()` takes an optional `token`, sent as a default `Authorization` header on every call. `client/quickstart.ts` now also mints a real API client (`ApiClientService` directly, same script pattern as `create-api-client.ts`) alongside its existing tenant-seeding step, and no longer sends `tenantId` in the case-creation body.

### Affected files

- `src/database/entities/api-client.entity.ts`, `src/database/enums/api-client.enum.ts`
- `src/database/migrations/1787065685817-ApiClients.ts`, `schema-migrations.spec.ts`
- `src/auth/api-client-secret.ts` (+`.spec.ts`), `auth-context.ts`, `api-key.guard.ts` (+`.spec.ts`), `auth-tenant-id.decorator.ts`, `api-client.service.ts`, `auth.module.ts`
- `src/create-api-client.ts`, `package.json` (new script)
- `src/app.module.ts`, `src/cases/cases.module.ts`, `src/webhooks/webhooks.module.ts`
- `src/cases/cases.controller.ts` (+`.spec.ts`), `cases.service.ts` (+`.spec.ts`), `dto/create-case.dto.ts`
- `src/webhooks/webhook-endpoints.controller.ts`, `webhook-deliveries.controller.ts`, `webhook-endpoint.service.ts` (+`.spec.ts`), `webhook-delivery.service.ts`, `dto/create-webhook-endpoint.dto.ts`, `webhook-dispatch.service.spec.ts`
- `src/openapi.config.ts`, `openapi/openapi.json`, `client/generated/schema.d.ts`, `client/index.ts`, `client/quickstart.ts`
- `test/cases.e2e-spec.ts`, `test/webhooks.e2e-spec.ts`
- `docs/DEVELOPMENT_LOG.md`, `README.md`

### Decisions and alternatives

- **Scoped API-client bearer tokens, not OIDC.** Section 20 M5 names both ("OIDC and scoped API-client authentication") as one bullet. Building a compliant OIDC authorization server from scratch, or integrating a real external IdP this codebase has no relationship with, is its own, much larger, separately-scoped effort — the same reasoning already applied to deferring the provider platform's `AUTHORIZED_SANDBOX`/`PRODUCTION_BYOC` modes (M4-001) until a real second target exists. A scoped bearer credential is a real, complete instance of the *other* half of that same bullet, not a shortcut standing in for the whole thing.
- **PostgreSQL RLS (the exit evidence's "database layer") deliberately deferred, not attempted partially.** Doing it correctly requires either a connection-per-request architecture (so a `SET LOCAL app.current_tenant_id` reliably scopes to one request under connection pooling) or careful per-transaction session-variable discipline threaded through every repository call site — a meaningfully separate, larger unit of work. A half-correct RLS implementation would be actively worse than none: it would look like a real defense-in-depth layer while being silently bypassable under real connection-pool reuse, which is a worse outcome than an honestly-documented gap. Named explicitly in Known Gaps below, not silently skipped.
- **`tenantId` removed from request DTOs entirely, not merely ignored if present.** An earlier design considered requiring the caller to redundantly supply `tenantId` and validating it matches the authenticated credential (403 on mismatch) — rejected because it leaves a whole class of "did the check actually run" bugs available to introduce later. Removing the field is the same "fails closed by construction, not by remembering to check" reasoning `ProviderRegistryService`/`dispatch-provider-request.ts` already apply to routing.
- **A cross-tenant lookup 404s, never 403s.** A 403 would itself leak that the resource exists (just not yours) — this codebase already applies the identical reasoning to `HealthController.ready()`'s deliberately generic failure response; extended here to every tenant-scoped lookup.
- **`AuthModule` is `@Global()`, and `ApiClient` is *also* independently registered via `TypeOrmModule.forFeature([ApiClient])` directly inside both `CasesModule` and `WebhooksModule` (see Errors and fixes).** The second part looks redundant next to `@Global()` — it's the actual empirical fix for a real NestJS testing-injector limitation, kept because it's proven to work, not removed for tidiness once the bug stopped reproducing.

### Errors and fixes

- **`Authorization: Bearer garbage.token` (a syntactically well-formed-enough but non-UUID clientId) crashed with an unhandled 500, not a clean 401.** Found during live manual verification against the real running API (not by a written test first) — Postgres rejected the malformed UUID literal (`22P02 invalid_text_representation`) before `ApiKeyGuard` ever got to say "unknown client." Fixed by validating the clientId against a UUID shape regex *before* any database query — a malformed credential now fails exactly like every other invalid-credential path, with no query ever reaching Postgres. Added a dedicated regression test (`api-key.guard.spec.ts`: "rejects a clientId that is not a well-formed UUID") and re-verified live against a freshly restarted API process with real curl requests (missing header, valid cross-tenant credential, malformed token, well-formed-but-unknown clientId, and the owning tenant's own credential) — all five now return the correct status, confirmed after the fix, not just in the unit test.
- **`Test.createTestingModule({imports: [AppModule]}).compile()` failed with `Nest can't resolve dependencies of the ApiKeyGuard... "ApiClientRepository" ... available in the WebhooksModule module`, even though the identical production boot (`NestFactory.create`, `npm run start:dev`) started cleanly.** `AuthModule` exporting `ApiKeyGuard` (and being `@Global()`) was not sufficient for Nest's *testing* injector (`TestingInjector`/`TestingInstanceLoader` — a different code path than the production bootstrapper) to resolve the guard's own `@InjectRepository(ApiClient)` dependency when the guard is applied via `@UseGuards(ApiKeyGuard)` (a raw class reference) at the controller level in a *different* feature module. Fixing it for `WebhooksModule` alone caused the identical error to resurface for `CasesModule` next, confirming this is a general testing-injector limitation, not a one-off. Fixed by also registering `TypeOrmModule.forFeature([ApiClient])` directly inside both `CasesModule` and `WebhooksModule` (redundant with `AuthModule`'s own registration, but empirically necessary) — verified by both `npm run test:e2e` (all 3 suites, including the new cross-tenant tests) and a real production boot passing afterward.

### Verification

```text
npm run build / npm run lint:check
  both passed clean

Migration (m5001-verify / m5001-final scratch stacks, ports 5443/7234):
  migration:run applies ApiClients1787065685817 cleanly on top of
  WebhookPlatform1787042560459; a from-empty run of all 19 migrations
  on a completely fresh stack (m5001-final) also passed cleanly

  DATABASE_URL=... npx jest schema-migrations.spec.ts --runInBand
    19/19 passed (18 -> 19: +1 new revert test proving the api_clients
    migration's one new table disappears cleanly and no other table
    is touched)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache --silent
    58 suites passed, 377 tests passed (376 -> 377: +1 test, the
    malformed-clientId regression test added after the live-found bug
    above; suite count unchanged — this slice added tests to existing
    files [api-key.guard.spec.ts, api-client-secret.spec.ts] and
    rewrote existing controller/service specs rather than only adding
    new ones)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    3 suites passed, 23 tests passed (unchanged suite/test count from
    M4-004, but cases.e2e-spec.ts and webhooks.e2e-spec.ts were both
    substantially rewritten: every request now carries a real bearer
    credential, and both suites gained genuine cross-tenant tests — a
    second tenant's real, valid, active credential 404s on the first
    tenant's case/delivery, proven at the full HTTP-through-Nest-guard
    level, not mocked)

Manual live verification (real REST API + real Temporal worker,
restarted after the malformed-clientId fix):
  ran the full quickstart end to end with real authentication —
  seeded a tenant, minted a real API-client credential via
  ApiClientService, created a case, started its workflow, resolved its
  condition, watched it complete — identical outcome to M4-003's own
  quickstart verification, confirming auth didn't change any real
  behavior, only gated access to it

  created two real tenants and a real API-client credential for each
  via `npm run create-api-client`; tenant A created a case; direct
  curl checks against the live server confirmed: tenant B's real,
  valid, active credential on tenant A's case -> 404; tenant A's own
  credential on its own case -> 200; no Authorization header -> 401;
  the malformed-clientId token that previously 500'd -> 401; a
  well-formed but unknown clientId -> 401

  synthetic tenant/case/api-client data removed with the scratch
  stack teardown (docker compose down -v)
```

### Security, privacy, cost, and compatibility

- This is a genuine security hardening, not a cosmetic one: before this slice, any caller could read, mutate, or drive the workflow of any tenant's case by supplying that tenant's UUID in a request body/path — no credential of any kind was required. That gap is now closed for the API and service layers.
- Bearer secrets are scrypt-hashed at rest with a random per-credential salt; the raw secret exists only transiently (generation → response → caller's own storage) and is never logged or persisted.
- No rate limiting or lockout on repeated failed authentication attempts — `ThrottlerModule`'s existing general rate limit applies, but nothing auth-specific yet (Known gap).
- No token expiry or rotation — an `ApiClient` is valid until explicitly `REVOKED` (no REST/CLI path revokes one yet either — Known gap).

### Known gaps

- **PostgreSQL row-level security (Section 20 M5's own "database layer" exit-evidence bullet) is not implemented** — see Decisions above for why this was deliberately deferred rather than half-built. The API and service layers close the same gap RLS would at the layers that matter for this codebase's actual current attack surface (nothing queries this database directly except this codebase's own, now tenant-scoped, service code).
- No OIDC/FAPI 2.0, no RBAC roles (every credential is equally privileged within its own tenant), no consent enforcement, no encrypted field/object boundaries, no tenant-owned self-service configuration — all separately named in Section 20 M5, none attempted this slice.
- No REST/CLI path lists, revokes, or rotates an existing `ApiClient` — only creation exists.
- No token expiry, no rate limiting specific to authentication failures.
- `WebhookDispatchService`'s own outbound delivery loop is intentionally *not* gated by this guard (it isn't an inbound HTTP route) — it already scopes every operation to the tenant of the outbox event/endpoint it's processing, unaffected by this slice.

### Next safe step

The single biggest remaining gap this codebase has is still open: PostgreSQL RLS as genuine defense-in-depth (Decisions above explains why it needs its own dedicated design pass, not a bolt-on). Absent a decision to take that on, M4's remaining separate items (sandbox scenario catalog, webhook inspector, `publish_case_update`'s Agent-tool wiring) or M5's other named pieces (RBAC roles, consent enforcement) are the next honestly-buildable increments. Not started; awaiting direction.

## M5-002: PostgreSQL row-level security for `webhook_endpoints`/`webhook_deliveries` (Section 20 M5, database layer)

### Status

Implemented and verified for exactly the two tables named in scope: `webhook_endpoints` and `webhook_deliveries`. `loan_cases` and its dependent tables (`evidence_facts`, `loan_conditions`, `condition_transitions`, `agent_runs`, `tool_attempts`, `outbox_events`, `case_policy_bindings`, `case_policy_snapshots`) are deliberately out of scope — explicit user decision, not an oversight (see Decisions). This is the "database layer" third of Section 20 M5's own exit evidence, closing the gap M5-001 named and deferred: "cross-tenant tests fail closed at API, service, **and database** layers."

Real, working PostgreSQL RLS — but it is only real when the connecting role is not a superuser, and this codebase's own default `DATABASE_URL` convention connects as one. This is stated with full prominence in Known gaps, not softened: shipping RLS policies that are correct SQL but inert under the project's own documented default setup would itself be exactly the kind of overclaim this project's standing "never fabricate coverage for a capability with no real backing subsystem" rule exists to prevent.

### Acceptance criterion

Section 20's M5 exit evidence, database-layer third: a cross-tenant query against `webhook_endpoints`/`webhook_deliveries` fails closed (returns zero rows / affects zero rows) at the PostgreSQL level itself, independent of whether any application code remembered to add a `WHERE tenantId = ...` clause. Proven by `src/webhooks/webhook-tenant-isolation.spec.ts` against a real, dedicated, non-superuser Postgres role — the only way to actually exercise what `FORCE ROW LEVEL SECURITY` enforces for a genuinely restricted role, since a superuser connection would pass every one of these tests trivially by bypassing the policy entirely, proving nothing.

### Implementation

- `src/database/tenant-context.ts` (new) — `runInTenantContext(dataSource, tenantId, work)` and `runWithRlsBypass(dataSource, work)`. Both wrap `dataSource.transaction()` and call `manager.query("SELECT set_config($1, $2, true)", [...])` — `set_config` rather than a raw `SET LOCAL` specifically because `SET` doesn't accept bound parameters (`set_config` does, so there's no string-interpolation injection surface even though `tenantId` is always a validated UUID in practice) — with `is_local = true`, i.e. `SET LOCAL` semantics: the setting reverts at transaction end regardless of commit/rollback, so it can never leak across a pooled connection into an unrelated later request. Code that calls neither helper sees zero rows on an RLS-protected table by construction, including this codebase's own future bugs, not only a hostile external caller.
- `src/database/migrations/1787069708184-WebhookTenantIsolation.ts` (new) — for each of `webhook_endpoints`/`webhook_deliveries`: `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY` (the part that matters as much as `ENABLE` — without it, the table owner, i.e. the role every migration in this codebase has ever run as, bypasses the policy by Postgres's own default), and one policy: `USING (current_setting('app.bypass_rls', true) = 'true' OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)` (the `NULLIF` is a fix for a real bug found mid-slice — see Errors and fixes). `down()` reverses cleanly: drop policy, `NO FORCE`, `DISABLE`.
- `WebhookEndpointService`/`WebhookDeliveryService` — every method wrapped in `runInTenantContext` with the tenantId the caller already has (from `AuthTenantId()` all the way down from M5-001); `findByIdOrFail` on both now takes `tenantId` as a required first parameter rather than trusting an unscoped id lookup.
- `WebhookDispatchService` — per-event delivery-row creation and per-delivery status updates use `runInTenantContext` with the tenantId already known from the event/delivery row being processed. `runWithRlsBypass` is used in exactly one place: the "find any tenant's due deliveries" batch scan, which is genuinely cross-tenant by design (a background dispatcher, not a caller-driven request) — the one explicit, auditable exception, not a general escape hatch. `outbox_events` carries no RLS policy this slice, so queries against it are unchanged. The real network `fetch()` in `attemptDelivery()` is deliberately left outside any transaction/tenant-context wrapper — a slow or hanging receiver must not hold a pooled DB connection open for up to its 10s timeout.
- `src/webhooks/webhook-tenant-isolation.spec.ts` (new) — the actual proof. Creates a dedicated Postgres role (`rls_spec_restricted_role`, `LOGIN ... NOSUPERUSER NOBYPASSRLS`, granted `SELECT/INSERT/UPDATE/DELETE` on just the two tables) via the existing admin connection, then runs every assertion — including fixture creation — through a *second* `DataSource` connected as that role. Seven tests: no-context-no-bypass sees zero rows on both tables despite real rows existing; tenant A's context sees only A; tenant B's context sees only B (including B seeing none of A's deliveries); a direct id lookup across tenants returns null; a cross-tenant `UPDATE` affects zero rows and leaves the real row untouched; a spoofed `INSERT` (row claims tenant A while the session context says tenant B) is rejected by Postgres itself; bypass mode sees every tenant's rows on both tables as the one audited exception.
- `src/database/migrations/schema-migrations.spec.ts` — new revert test ("reverts the webhook tenant isolation migration without touching other tables") inserted as the first revert test (this migration is now the most recently applied). Unlike every other revert test in this file, this migration adds no table, so the assertion checks `pg_class.relrowsecurity`/`relforcerowsecurity` and `pg_policies` directly, before and after the revert, rather than the `tableNames()` list.

### Affected files

- `src/database/tenant-context.ts` (new)
- `src/database/migrations/1787069708184-WebhookTenantIsolation.ts` (new), `schema-migrations.spec.ts`
- `src/webhooks/webhook-endpoint.service.ts` (+`.spec.ts`), `webhook-delivery.service.ts`, `webhook-dispatch.service.ts` (+`.spec.ts`)
- `src/webhooks/webhook-tenant-isolation.spec.ts` (new)
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Scope narrowed to `webhook_endpoints`/`webhook_deliveries` only, `loan_cases` and dependents explicitly deferred — a direct user decision, not a default.** When asked, the user chose the narrower option by name. Reason: `loan_cases` and its dependents are written by both the authenticated REST layer (reachable by a potentially malicious external caller, exactly the trust boundary RLS defends) *and* the Temporal worker's `case-conditions.activities.ts` (driven only by already-validated workflow inputs, never directly attacker-reachable — a fundamentally different trust boundary, and this codebase's most extensively built and verified business logic). Forcing RLS there today, with that worker setting neither session variable anywhere, would break the M2/M3 workflow outright rather than protect it.
- **A dedicated non-superuser role inside the test file, not a project-wide `DATABASE_URL`/role convention change.** The real fix for "RLS should actually protect production traffic" is provisioning the application's actual runtime connection as a non-superuser role — but that's a materially larger, separately-scoped change (touching `docker-compose.yml`, `.env.example`, README, and re-verifying the entire test suite and every migration under restricted privileges, since several existing migrations/scripts may implicitly rely on superuser-level operations). Creating a role scoped to exactly this test proves the *policy logic* is correct without taking on that larger, unapproved-scope change — and is exactly what let the NULLIF bug below surface, which a superuser-only verification path would have hidden forever.
- **`NULLIF(current_setting(...), '')::uuid`, not a bare cast.** See Errors and fixes — a bare cast throws once any transaction on a reused pooled connection has touched the GUC and ended, which is the normal case for every real request in this codebase, not an edge case.
- **Fixture creation in the proof spec goes through the restricted role too (via `runInTenantContext`), not the admin superuser connection.** This means the spec also proves `INSERT` is enforced (a policy with no explicit `WITH CHECK` applies its `USING` expression to writes too), not only the `SELECT`-side isolation the majority of the tests exercise.

### Errors and fixes

- **All 7 proof-spec tests failed on the first run, appearing to show RLS wasn't enforced at all — root cause was that the connecting role (`mortgage`, this project's own `DATABASE_URL` role, created via `POSTGRES_USER=mortgage` on the stock `postgres:16-alpine` image) is a Postgres superuser.** Confirmed via `SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'mortgage'` → `mortgage | t | t`, and `SET ROLE mortgage; SELECT current_setting('is_superuser')` → `on`. This is documented, non-overridable PostgreSQL behavior — superusers unconditionally bypass row-level security regardless of `FORCE ROW LEVEL SECURITY` — and is a distinct thing from the `rolbypassrls` attribute, which only has any effect for non-superuser roles. Fixed the *test's* methodology, not the policy: created a dedicated `rls_spec_restricted_role` (`NOSUPERUSER NOBYPASSRLS`) and ran every assertion through a connection authenticated as it. This does not fix the underlying real-world gap — see Known gaps.
- **Once genuinely running under the restricted role, a second, independent, previously-invisible bug surfaced: `current_setting('app.current_tenant_id', true)::uuid` threw `invalid input syntax for type uuid: ""` instead of matching zero rows.** Root cause: for a custom (non-built-in) Postgres GUC, `current_setting(name, missing_ok=true)` returns `NULL` only if the setting has *never* been touched in that session; once any transaction on that connection has `SET LOCAL`'d it and ended, the placeholder reverts to `''` (empty string), not `NULL`, for the rest of that connection's life. TypeORM's connection pool reuses connections across unrelated `transaction()` calls, so this is the normal steady-state on any real pooled connection after its first tenant-scoped query, not a rare edge case — every one of this codebase's own real requests would eventually hit it. This bug was completely invisible while testing under the superuser role, because the policy expression was never evaluated at all in that configuration — direct evidence for why the superuser-masking issue above had to be fixed first, not worked around. Fixed with `NULLIF(current_setting(...), '')::uuid` (`NULLIF` turns `''` into `NULL` before the cast; `NULL::uuid` never errors). Verified by re-running the full proof spec (7/7 pass) and the cumulative migration spec (fresh-database apply, confirming the fix is in the migration file itself, not just live-patched onto the already-running scratch database it was first found against).
- **`TypeORMError: Entity metadata for WebhookDelivery#outboxEvent was not found`** the first time the proof spec's second `DataSource` (the restricted-role one) was split out from the original single admin connection — `WebhookDelivery` has a real `@ManyToOne(() => OutboxEvent)` relation, so TypeORM needs `OutboxEvent` in that `DataSource`'s own `entities` array to resolve the relation target during metadata build, even though the restricted role is never granted any privilege on `outbox_events` and no query through that connection ever touches it. Fixed by adding `OutboxEvent` to the restricted `DataSource`'s entity list.
- **`role "rls_spec_restricted_role" cannot be dropped because some objects depend on it`** on a re-run after an earlier interrupted attempt (the one that hit the entity-metadata error above) left the role behind still holding its `GRANT`s. A plain `DROP ROLE IF EXISTS` doesn't revoke a role's existing grants first. Fixed by checking `pg_roles` for the role's existence and, if found, `REVOKE ALL ... FROM role` then `DROP OWNED BY role` before `DROP ROLE` — both in the spec's `beforeAll` (defensive cleanup of a prior interrupted run) and its `afterAll` (normal cleanup), and hardened `afterAll` to skip the `outbox_events` cleanup delete if `beforeAll` never got far enough to create the fixture row (the direct cause of a second, cascading `Cannot read properties of undefined (reading 'id')` failure observed alongside the role-drop error).

### Verification

```text
npm run build / npm run lint:check (after `npm run lint` auto-fixed
formatting in the new spec file)
  both passed clean

Migration (m5002-verify scratch stack, ports 5443/7234, still running
at the time this entry was written):
  migration:run applied WebhookTenantIsolation1787069708184 cleanly on
  top of ApiClients1787065685817

  DATABASE_URL=... npx jest schema-migrations.spec.ts --runInBand
    20/20 passed (19 -> 20: +1 new revert test, asserting
    pg_class/pg_policies state directly since this migration adds no
    table)

  DATABASE_URL=... npx jest webhook-tenant-isolation --runInBand
    7/7 passed, against a dedicated non-superuser role — the actual
    proof RLS enforces anything; failed 7/7 on the first attempt
    against the superuser role, then failed 2/7 after switching roles
    (the NULLIF bug), then 1/7 (leftover rows from earlier failed
    dev-loop attempts, cleared with a manual TRUNCATE), then 7/7 clean

  DATABASE_URL=... npx jest webhook-endpoint.service.spec.ts
  webhook-dispatch.service.spec.ts --runInBand
    7/7 passed against the refactored, tenant-context-wrapped services

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand
  --no-cache --silent
    59 suites passed, 385 tests passed

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    3 suites passed, 23 tests passed (unchanged from M5-001 — this
    slice didn't touch the HTTP-layer contract, only what happens
    underneath it)

No separate manual live-curl verification this slice — see Known
gaps for why running the real API against this project's own default
DATABASE_URL role couldn't have demonstrated real enforcement anyway
(that role bypasses RLS entirely), and the e2e suite already exercises
the real Nest app + real Postgres at the HTTP layer with no regression.
```

### Security, privacy, cost, and compatibility

- Genuine defense-in-depth **when the connecting role is correctly configured**: a future bug in `WebhookEndpointService`/`WebhookDispatchService` that forgot a `WHERE tenantId = ...` clause would, under a real non-superuser application role, still return zero rows rather than another tenant's data — the database enforces the boundary independent of the application code's own correctness.
- **Under this project's own current default configuration (the `mortgage` role, superuser), that protection does not exist today** — see Known gaps. This is the central honesty point of this entry.
- No performance concern worth noting: the policy is a single indexed-equality-or-flag check, evaluated per-row by Postgres's existing query planner, same order of cost as the `WHERE tenantId = ...` clauses the application code already issues.
- No new secrets introduced in application configuration; the test-scoped restricted role's password is a hardcoded, throwaway, non-production string that only ever exists inside the disposable scratch database for the duration of one test run.

### Known gaps

- **This codebase's own default `DATABASE_URL` convention (`docker-compose.yml`, `.env.example`, and by extension any real deployment following this project's own documented setup) connects as a PostgreSQL superuser, and PostgreSQL superusers unconditionally bypass row-level security.** That means the RLS policies added this slice — while correctly written and proven to work under a genuinely restricted role — provide **zero actual protection today** against `webhook_endpoints`/`webhook_deliveries` cross-tenant access via this codebase's own real running application. This is not a hedge or a footnote: shipping "RLS support" that's silently inert in the default configuration would itself be the kind of overclaim this project's standing rule against fabricating coverage exists to prevent, so it's stated here at full prominence. The concrete fix — provisioning the application's actual runtime connection as a non-superuser, non-`BYPASSRLS` role with only the grants it needs — is real, scoped, separate follow-up work, not attempted this slice (see Next safe step).
- `loan_cases` and its dependent tables have no RLS policy at all — explicitly, deliberately deferred per the user's own scope decision (see Decisions), not an oversight. M5's own exit evidence ("database layer") is therefore only partially met: true for two tables, not yet true for the case-conditions core.
- `outbox_events` carries no RLS policy this slice, even though `webhook_deliveries` (which does) references it by foreign key — reading an outbox event's payload during dispatch is unrestricted by tenant at the database level (the application code still scopes it correctly, same as before this slice).
- No live manual verification against a real running API + worker under a correctly non-superuser role — the scratch stack used throughout this slice still connects as the same superuser `mortgage` role every other slice has used, so a live check would only have reconfirmed "the app still works," not "RLS enforces anything," and would have been a wasted verification cycle rather than added evidence.
- The restricted test role, and the fixture data it creates, live only inside disposable scratch databases created and destroyed by the spec's own `beforeAll`/`afterAll` — nothing persists outside a single test run.

### Next safe step

The concrete, scoped next step this entry's Known gaps point to directly: provision this project's actual application `DATABASE_URL` role as a real non-superuser, non-`BYPASSRLS` role with only the grants the application needs, so these policies (and any future ones) protect real traffic, not just a hand-built test role. That's a genuinely separate unit of work — it touches `docker-compose.yml`, `.env.example`, README, the migration CLI's own connection, and requires re-verifying every existing migration and script under restricted privileges, since some may currently rely on superuser-level operations without anyone having had a reason to notice. Absent a decision to take that on, extending RLS to `loan_cases` and dependents (which requires first threading tenant-context/bypass discipline through every `case-conditions.activities.ts` activity — its own separately-scoped, higher-regression-risk effort) or M5's other still-open items (RBAC roles, consent enforcement, OIDC) are the next honestly-buildable increments. Not started; awaiting direction.

## M5-003: Non-superuser application runtime role for production (M5-002's own headline Known gap)

### Status

Implemented and verified, including a real live boot of the actual API under `NODE_ENV=production` connected as the new restricted role — not just a spec-level proof this time. Directly closes M5-002's own most prominent Known gap: this codebase's default `DATABASE_URL` role is a PostgreSQL superuser, which unconditionally bypasses row-level security, so the `webhook_endpoints`/`webhook_deliveries` RLS policies from M5-002 provided no real protection against this codebase's own running application until this slice.

Scoped to `NODE_ENV=production` only, by explicit user choice between two options offered: apply the restricted role everywhere including local dev (bigger blast radius, would have required removing `synchronize` and its zero-setup local dev experience entirely), or only where this codebase's own pre-existing `synchronize`-vs-migrations split already draws the line. The user chose the latter. Local `docker-compose up`/`npm run start:dev` are completely unaffected — they keep connecting as `DATABASE_URL`'s role exactly as before this slice.

### Acceptance criterion

A real, running instance of this application configured for production (`NODE_ENV=production`, `APP_DATABASE_URL` set) issues every one of its own queries as a role that cannot bypass row-level security — proven by starting the actual compiled API, confirming via `pg_stat_activity` which role it's really connected as, and directly demonstrating that a real row the live app just created through that connection is invisible to a different tenant's session context and visible to its own, at the database level, not just in a spec file.

### Implementation

- `src/database/migrations/1787082648663-AppRuntimeRole.ts` (new) — provisions `mortgage_app`: `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`, `NOCREATEDB`, `NOCREATEROLE`, password from `APP_DATABASE_ROLE_PASSWORD` (demo-only default, same reasoning as `OUTBOX_SIGNING_SECRET`'s own default). Grants `CONNECT`/`USAGE`/`SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public`, plus a standing `ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER` grant so every table a *future* migration creates is automatically covered without anyone having to remember a matching grant statement on that migration too.
- `src/database/typeorm-options.factory.ts` — `createTypeOrmOptions` now branches on `NODE_ENV`: outside production, completely unchanged (`DATABASE_URL`, `synchronize: true`). In production, prefers `APP_DATABASE_URL`; if unset, falls back to `DATABASE_URL` (still boots — a production deploy shouldn't crash-loop over one missing var) but logs a `Logger.warn` naming exactly what's at stake, matching this codebase's existing convention for consequential fallbacks (`AgentService`'s "RULES PROVIDER ACTIVE" warning).
- `src/config/env.validation.ts` — `APP_DATABASE_URL` added as an optional, `postgres://`-validated field, same regex as `DATABASE_URL`.
- `src/webhooks/webhook-tenant-isolation.spec.ts` (M5-002) — refactored to connect as the real, persistent `mortgage_app` role the migration now provisions, instead of the ad hoc `rls_spec_restricted_role` it created and dropped on every run. Removes the CREATE ROLE/DROP ROLE/GRANT/REVOKE dance from the spec entirely — it now proves the actual production role's policy enforcement, not a parallel stand-in.
- `docs/DEVELOPMENT_LOG.md`'s M5-002 entry text is left untouched (append-only journal — it accurately described the state at the time it was written); this new entry supersedes its Known gap in spirit, not by editing history.
- `README.md`, `.env.example` — document `APP_DATABASE_URL`, its production-only scope, and the fallback-with-warning behavior.

### Affected files

- `src/database/migrations/1787082648663-AppRuntimeRole.ts` (new), `schema-migrations.spec.ts`
- `src/database/typeorm-options.factory.ts` (new), `typeorm-options.factory.spec.ts` (new)
- `src/config/env.validation.ts`, `env.validation.spec.ts`
- `src/webhooks/webhook-tenant-isolation.spec.ts`
- `README.md`, `.env.example`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Production-only scope, not local dev too — a direct user decision between two explicitly offered options.** The larger option (restrict local dev as well) would have required removing `synchronize: true` entirely, since it needs DDL rights a restricted role by design doesn't have — a real, invasive change to this codebase's already-documented "just run it" local onboarding experience that the user declined to take on as part of this slice.
- **`CREATE ROLE` wrapped in an `IF NOT EXISTS` guard, not a plain statement.** PostgreSQL roles are cluster-global, not scoped to one database, unlike everything else this codebase's migrations create. A plain `CREATE ROLE` fails the instant two databases in the same cluster both run this migration — which isn't a contrived scenario, it's exactly what happens every time `schema-migrations.spec.ts`'s own disposable scratch database shares a cluster with whatever `DATABASE_URL` already points to (see Errors and fixes). Idempotent creation, paired with `GRANT`'s own natural idempotency (re-granting an already-held privilege is a no-op), makes the migration safe under that real, recurring condition rather than merely lucky about run order.
- **`down()`'s `DROP ROLE` is best-effort, not a hard requirement.** For the identical cluster-wide-role reason above, dropping the role can legitimately fail if a sibling database in the same cluster still holds grants to it — and destroying a role a sibling database is still actively using would be a worse outcome than leaving a harmless, now privilege-less-in-this-database role behind. `down()` unconditionally revokes everything *this* database granted; only the final `DROP ROLE` itself tolerates the one specific, identified Postgres error (`2BP01`/`dependent_objects_still_exist`) that means "something else still needs this," and only via a PL/pgSQL `EXCEPTION` block, not a JS-level `try`/`catch` (see Errors and fixes for why that distinction is load-bearing, not stylistic).
- **`current_database()` resolved dynamically via a PL/pgSQL `DO` block for the `GRANT CONNECT ON DATABASE` statement, rather than hardcoding `"mortgage_agent"`.** `GRANT ... ON DATABASE` takes a literal identifier, not an expression, so a literal database name would have been simpler to read — but this migration, like every other one in this codebase, also has to run cleanly against `schema-migrations.spec.ts`'s differently-named scratch database.

### Errors and fixes

- **`role "mortgage_app" already exists` broke `schema-migrations.spec.ts`'s "applies every migration" test the first time this migration ran alongside an already-migrated primary scratch database in the same Postgres cluster.** Root cause: Postgres roles are cluster-global; a plain `CREATE ROLE` has no database-scoped notion of "already exists is fine here." Because that failure happened *before* the test's own `undoLastMigration()` call, that migration was never actually reverted — which then desynchronized every subsequent revert test's assumption about which migration was "most recently applied," cascading into roughly 19 unrelated-looking failures across the rest of the file from this one root cause. Fixed with the `IF NOT EXISTS` guard described in Decisions; confirmed by reproducing the exact real-world ordering (migrate the primary scratch database first, *then* run the full suite including `schema-migrations.spec.ts`) rather than only testing the accidentally-lucky order of running `schema-migrations.spec.ts` first on a virgin cluster.
- **After adding a first-pass fix (a plain JS `try { DROP ROLE } catch`, treating Postgres error code `2BP01` as tolerable), the *next* migration revert in the same test file started failing with `current transaction is aborted, commands ignored until end of transaction block` — a different, subtler bug than the one just fixed.** Root cause: PostgreSQL aborts an entire transaction the moment any statement inside it errors, and this is *not* undone by catching the exception in application code — TypeORM runs each migration's `down()` inside one transaction, so the JS `catch` successfully handled the `DROP ROLE` failure at the Node level while the underlying Postgres transaction stayed aborted, and the very next statement in that same transaction (TypeORM's own bookkeeping delete from `typeorm_migrations`) failed too, for a completely different-looking reason. Fixed by moving the tolerance into PostgreSQL itself — a `DO $$ ... EXCEPTION WHEN dependent_objects_still_exist THEN ... END $$` block, which establishes its own implicit savepoint, so the specific, identified error is absorbed without ever aborting the outer transaction. Verified by re-running the full suite under the exact real-world ordering that first exposed both bugs (migrate the primary scratch database, then run everything else) until it passed clean.
- **The new "reverts the app runtime role migration" test's own grant-count assertion (`expect(beforeGrants.length).toBe(28 * 4)`) was itself wrong on the first run (`Received: 116`, not `112`), which was actually the proximate trigger for the cascading failure above (the test threw before reaching its own `undoLastMigration()` call).** The migration's `GRANT ... ON ALL TABLES IN SCHEMA public` also covers `typeorm_migrations` itself (a real table in the same schema) — 29 tables, not the 28 every other assertion in this file already excludes it from. Fixed the query to exclude `typeorm_migrations` explicitly, matching `tableNames()`'s own established convention in the same file.

### Verification

```text
npm run build / npm run lint:check (after `npm run lint` auto-fixed
formatting)
  both passed clean

Migration (m5003-verify scratch stack, ports 5443/7234):
  a from-empty migration:run applied AppRuntimeRole1787082648663
  cleanly on top of WebhookTenantIsolation1787069708184

  DATABASE_URL=... npx jest schema-migrations.spec.ts --runInBand
    21/21 passed (20 -> 21: +1 new revert test) — run BOTH in isolation
    on a virgin cluster AND, deliberately, with the primary scratch
    database already migrated first (the real-world ordering that
    exposed both bugs above) — passed clean both ways after the fixes

  DATABASE_URL=... npx jest webhook-tenant-isolation
  env.validation.spec.ts typeorm-options.factory.spec.ts --runInBand
    35/35 passed — webhook-tenant-isolation's 7 tests now prove the real
    mortgage_app role's enforcement directly, not a parallel test-only
    role; typeorm-options.factory.spec.ts (new) covers all four
    NODE_ENV/APP_DATABASE_URL branches including the warn-and-fall-back
    path, confirmed via the actual WARN log appearing in that specific
    case and no others

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand
  --no-cache --silent
    60 suites passed, 394 tests passed — run with the primary scratch
    database already migrated first (matching the real ordering that
    exposed the cross-database bugs), not just in isolation

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    3 suites passed, 23 tests passed (unchanged — this slice doesn't
    touch the HTTP contract)

Manual live verification — the first time in this codebase's history
any real running process has connected as anything other than the
superuser DATABASE_URL role:
  seeded two real tenants directly (same convention as every other
  slice), minted a real API-client bearer credential for each via
  `npm run create-api-client`

  started the actual compiled API with NODE_ENV=production,
  APP_DATABASE_URL pointed at mortgage_app, DATABASE_URL left set (for
  anything that might still read it) — booted cleanly, no crash, no
  fallback warning in the log

  SELECT usename, count(*) FROM pg_stat_activity WHERE datname =
  'mortgage_agent' GROUP BY usename — showed only 'mortgage' (an idle
  leftover from manual tooling) until the first real request, then
  showed 'mortgage_app' with an active connection immediately after —
  direct proof the running app's own query traffic uses the restricted
  role, not an assumption

  tenant A's real credential created a real webhook endpoint (201);
  tenant B's real credential created its own (201, proving the
  restricted role's INSERT grant genuinely works, not just SELECT);
  a request with no Authorization header still 401'd in production
  exactly as in M5-001

  connected directly to Postgres as mortgage_app (not the superuser)
  and set the session tenant context to tenant B: a SELECT for tenant
  A's real row (the one the live app had just created moments earlier
  through its own connection) returned zero rows; the identical SELECT
  under tenant A's own context returned that exact row — the concrete,
  end-to-end proof this whole slice exists for, against a real row a
  real running process created, not a spec fixture

  also created a real loan case through the same live, restricted-role
  app (after fixing unrelated test-data mistakes — a wrong loanType
  enum value and a missing jurisdictions.level column — neither related
  to this slice) to confirm the restricted role's grants cover the
  full schema, not only the two RLS-covered tables

  synthetic tenant/case/api-client/webhook data removed with the
  scratch stack teardown (docker compose down -v)
```

### Security, privacy, cost, and compatibility

- This is the fix for M5-002's own headline caveat, not a cosmetic addition: a production deployment that sets `APP_DATABASE_URL` now has row-level security that genuinely protects `webhook_endpoints`/`webhook_deliveries`, proven end-to-end against a real live process rather than only a unit test's own hand-built role.
- The demo password default (`mortgage_app_demo`, mirroring `docker-compose.yml`'s own `mortgage_demo`) is explicitly not appropriate for a real deployment — `APP_DATABASE_ROLE_PASSWORD` must be set to something real. Not enforced at migration time (no hard failure if unset) — consistent with `OUTBOX_SIGNING_SECRET`'s own existing precedent in this codebase of a documented, not mechanically enforced, "change this for real deployments" default.
- The production fallback-to-`DATABASE_URL`-with-a-warning behavior is a deliberate availability/security tradeoff: an unset `APP_DATABASE_URL` in production degrades this codebase back to M5-002's own known gap (RLS inert) rather than refusing to boot. A stricter design (hard failure) was considered and rejected as disproportionate for a first pass — logged loudly enough that it shouldn't go unnoticed in practice, but not yet enforced as a startup precondition.

### Known gaps

- Still production-only, by direct user choice (see Decisions) — local `docker-compose up`/`npm run start:dev` never exercises the restricted role at all, so a regression in `mortgage_app`'s own grants (e.g., a future migration adding a table outside the `public` schema, which the `ALTER DEFAULT PRIVILEGES` grant doesn't cover) would only surface the first time someone actually runs with `NODE_ENV=production`, not during ordinary local development.
- `APP_DATABASE_ROLE_PASSWORD`'s demo default is not mechanically prevented from reaching a real deployment — see Security above.
- The production fallback logs a warning but still boots against `DATABASE_URL`'s role if `APP_DATABASE_URL` is unset — a stricter "refuse to boot" mode was considered and explicitly not built this slice.
- `loan_cases` and dependents still have no RLS policy at all (M5-002's own deferred scope, unchanged by this slice) — this migration only makes the *existing* `webhook_endpoints`/`webhook_deliveries` policies actually matter; it doesn't add coverage anywhere new.
- `mortgage_app`'s grants are schema-wide (`ALL TABLES IN SCHEMA public`) rather than table-by-table — simpler and self-maintaining via `ALTER DEFAULT PRIVILEGES`, but means the restricted role has DML access to every table, including ones RLS doesn't protect (identical blast radius to what `DATABASE_URL`'s role already has today, just without the superuser/DDL/BYPASSRLS escalation on top).

### Next safe step

M5's own exit evidence is now genuinely true end-to-end for exactly `webhook_endpoints`/`webhook_deliveries`, under a real production configuration — not just a database-layer proof sitting on top of an inert default. The next honestly-buildable increments: extend RLS (and this same restricted-role discipline) to `loan_cases` and dependents, which first requires threading tenant-context/bypass calls through every `case-conditions.activities.ts` Temporal activity (separately-scoped, higher-regression-risk, previously deferred in M5-002 and still deferred here); or M5's other still-open items (RBAC roles, consent enforcement, OIDC). Not started; awaiting direction.

## M5-004: PostgreSQL row-level security for the case-conditions core (`loan_cases`, `evidence_facts`, `outbox_events`, `condition_transitions`)

### Status

Implemented and verified, including a real live workflow run — a genuine case driven start to finish (creation, evidence collection, Agent policy evaluation, condition opening, reviewer resolution, completion) through a real Temporal worker, entirely under `NODE_ENV=production` and the restricted `mortgage_app` role from M5-003. This is exactly the "next safe step" M5-003's own entry named, deliberately scoped narrower than "every table `loan_cases` touches" per an explicit user choice between two offered options (see Decisions).

### Acceptance criterion

The same M5-002/M5-003 standard, extended to the case-conditions core: a cross-tenant query against `loan_cases`/`evidence_facts`/`outbox_events`/`condition_transitions` fails closed at the PostgreSQL level itself — proven both by a dedicated spec against the real `mortgage_app` role (mirroring `webhook-tenant-isolation.spec.ts`) and, this slice, by a real end-to-end workflow run whose real rows were then directly queried under a different tenant's session context and found invisible.

### Implementation

- `src/database/migrations/1787084811062-CaseCoreTenantIsolation.ts` (new) — same `ENABLE`/`FORCE ROW LEVEL SECURITY` + `NULLIF(current_setting(...), '')::uuid` policy pattern as M5-002, applied to `loan_cases`, `evidence_facts`, `outbox_events` directly. `condition_transitions` has no `tenantId` column of its own (Section 14.1's append-only history is keyed only by `conditionId`) — its policy is `EXISTS (SELECT 1 FROM loan_conditions lc WHERE lc.id = condition_transitions."conditionId" AND lc."tenantId" = <context>)`, reading `loan_conditions.tenantId` as a plain column (not through any policy on that table, since `loan_conditions` itself has none this slice).
- An audit (delegated to an Explore agent, then independently verified file by file) of every production code path touching these four tables, not just `case-conditions.activities.ts`: that file's own already-manager-parameterized writes (all of them — `markCollectingEvidence`, all three `fetch*Evidence` activities, `evaluateConditions`, `resolveCondition`, `markReadyForUnderwriting`, `markWaitingForReview`, `markManualReview`), `CasesService.createCase()`/`getCase()` (REST layer), `create-condition.tool.ts`/`escalate-to-reviewer.tool.ts` (Agent-runtime tools that mutate `loan_cases` directly), `check-case-completeness.tool.ts` and `lending-operations-agent-runtime.ts`'s own two bare `LoanCase`/`EvidenceFact` reads (`evaluatePolicyNode`, `resolveOutcomeNode`), `PolicyChangeImpactService`'s two `LoanCase` queries (one genuinely cross-tenant — Section 10.6's catalog-wide impact scan on policy activation — one tenant-scoped), `CaseTimelineService`'s `outbox_events` read, `WebhookDispatchService`'s three remaining bare `outbox_events` call sites (webhooks' own webhook-facing tables already got this treatment in M5-002; `outbox_events` itself didn't, until now), and `CommunicationDeliveryService.deliver()`'s `writeOutboxEvent()` call. Every one now goes through `runInTenantContext`/`runWithRlsBypass`, matching whichever it genuinely is — a known tenantId, or an audited cross-tenant scan.
- Two services (`PolicyChangeImpactService`, `CaseTimelineService`) needed a `DataSource` injected alongside their existing `@InjectRepository`s so their in-scope-table queries could route through the tenant-context helpers; their now-unused single-purpose repositories (`caseRepository`, `outboxRepository`) were removed rather than left dead, same cleanup already applied to `WebhookDispatchService`/`WebhookEndpointService` in M5-002/M5-003.
- `src/workflows/case-core-tenant-isolation.spec.ts` (new) — the proof spec, mirroring `webhook-tenant-isolation.spec.ts`'s structure: connects as the real `mortgage_app` role (not a throwaway test-only one, same as M5-002's spec after its own M5-003 refactor), builds a real fixture case/evidence/outbox-event/condition/condition-transition pair for two tenants (via the admin connection only for `tenants`/`jurisdictions`/`loan_conditions`, none of which are RLS-protected this slice), and runs the same battery M5-002 established: no-context sees zero rows, each tenant's context sees only its own, a cross-tenant id lookup returns null, a cross-tenant `UPDATE` affects zero rows, a spoofed cross-tenant `INSERT` is rejected, `condition_transitions`' join-based policy isolates correctly despite having no `tenantId` column, and bypass mode sees everything.

### Affected files

- `src/database/migrations/1787084811062-CaseCoreTenantIsolation.ts` (new), `schema-migrations.spec.ts`
- `src/workflows/case-core-tenant-isolation.spec.ts` (new)
- `src/workflows/case-conditions.activities.ts`
- `src/cases/cases.service.ts` (+`.spec.ts`), `case-timeline.service.ts`
- `src/agent-runtime/tools/create-condition.tool.ts`, `escalate-to-reviewer.tool.ts`, `check-case-completeness.tool.ts`
- `src/agent-runtime/langgraph/lending-operations-agent-runtime.ts`
- `src/policy/policy-change-impact.service.ts`, `policy-activation.service.spec.ts`
- `src/webhooks/webhook-dispatch.service.ts` (+`.spec.ts`)
- `src/communications/communication-delivery.service.ts`
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Scope narrowed to exactly the tables reachable through code paths that already thread `tenantId` end to end without a structural refactor — a direct user decision between two offered options.** The wider option (also `loan_conditions` itself, `agent_runs`/`tool_attempts`, `case_policy_bindings`/`case_policy_snapshots`, `provider_operation_intents`/`provider_authorization_grants`) would have required refactoring several `@InjectRepository`-based services (`PolicyEvaluationService`, `EvaluationManifestService`, `ProviderAuthorizationService`, `ProviderOperationIntentService`) to accept an external `EntityManager`, a materially larger and riskier change touching this codebase's most extensively tested business logic. The user chose the narrower option.
- **`loan_conditions` itself is explicitly excluded, even though `case-conditions.activities.ts`'s `resolveCondition` reads/updates it.** Its *initial* row is created by `create-condition.tool.ts` through a code path this slice does not touch — forcing RLS on `loan_conditions` without also fixing that path would make every real condition-creation call fail with a Postgres RLS violation the moment this migration shipped (an INSERT under no tenant context is rejected the same way M5-002 proved for `webhook_endpoints`). This was caught during the file-by-file audit, before writing the migration, specifically because of that audit — not discovered live.
- **`outbox_events` *is* in scope this slice, reversing M5-002's own "no RLS policy this slice" decision for that table** — because every write site that touches it already sits inside a transaction this slice was wrapping anyway (the same transaction as a `loan_cases`/`evidence_facts` write), so covering it added only the read-side call sites (`CaseTimelineService`, `WebhookDispatchService`) rather than a whole new audit.
- **`PolicyChangeImpactService.assessImpact()`'s catalog-wide scan uses `runWithRlsBypass`, matching `WebhookDispatchService`'s existing precedent for "the one query that's genuinely cross-tenant by design."** Section 10.6's own scope ("applicability index finds potentially affected open cases" across the whole catalog on a policy activation/withdrawal) is inherently cross-tenant — the alternative (looping per-tenant) would change real behavior, not just add a database-layer guarantee.

### Errors and fixes

- **A real, independent production-code concurrency bug, found only because this slice's own proof test happened to exercise it: `Promise.all([manager.getRepository(A).find(), manager.getRepository(B).find()])` — issuing multiple queries against the *same* `EntityManager`/connection without sequencing them — is exactly what node-postgres's own "Calling client.query() when the client is already executing a query is deprecated" warning describes, and in practice returned results that didn't correspond to the queries that requested them.** Symptom: the proof spec's bypass-mode test, comparing four `Promise.all`'d queries' results against known fixture ids, intermittently reported `loan_cases` results containing ids that turned out (traced through direct SQL lookups across every table) to actually belong to `outbox_events`. Found in both this slice's own new proof spec *and* already-existing production code (`lending-operations-agent-runtime.ts`'s `resolveOutcomeNode`, fetching `LoanCase` and `EvidenceFact` concurrently on one manager) — the same risky pattern this migration's own refactor had just introduced varations of. Fixed by making every such call sequential (`await` one query, then the next) instead of `Promise.all` wherever multiple queries share one manager; independent, unrelated queries on independent connections (e.g. `CaseTimelineService`'s mix of a wrapped and two unwrapped repository calls) are unaffected and were left as `Promise.all`, since those genuinely use separate connections.
- **Separately, the same proof spec's "bypass mode sees every tenant's row" test failed again after the concurrency fix — this time correctly, exposing a real test-design flaw, not a product bug.** `outbox_events` (unlike `loan_cases`, confirmed empty via direct SQL) already held real, pre-existing rows in the shared scratch database from an earlier `npm run test:e2e` run in this same verification session — legitimate data bypass mode is *supposed* to see, since bypass mode ignores tenant scoping by design. The test's exact-equality assertion assumed the whole table started empty, which is not a safe assumption for a table this central in a shared, long-lived scratch database. Fixed by changing the bypass-mode assertions to inclusion checks (`expect.arrayContaining`) — proving bypass mode sees at least this spec's own cross-tenant rows, which is what the test is actually for; the tenant-scoped assertions elsewhere in the same file remain exact-equality, since RLS under a real tenant context correctly filters out any other tenant's rows regardless of how many exist.

### Verification

```text
npm run build / npm run lint:check (after `npm run lint` auto-fixed
formatting)
  both passed clean

Migration (m5004-verify scratch stack, ports 5443/7234):
  a from-empty migration:run applied CaseCoreTenantIsolation1787084811062
  cleanly on top of AppRuntimeRole1787082648663

  DATABASE_URL=... npx jest schema-migrations.spec.ts --runInBand
    22/22 passed (21 -> 22: +1 new revert test), run on a virgin
    cluster first (this slice's migration adds no role, so it doesn't
    hit M5-003's cross-database collision)

  DATABASE_URL=... npx jest case-core-tenant-isolation --runInBand
    8/8 passed against the real mortgage_app role, after the two fixes
    above (concurrency bug, then the inclusion-vs-exact-equality test
    design fix)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand
  --no-cache --silent
    61 suites passed, 403 tests passed (60/394 -> 61/403: +1 suite,
    +9 tests — the new proof spec, plus cases.service.spec.ts's mock
    updated to match CasesService's new constructor/runInTenantContext
    call shape)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    3 suites passed, 23 tests passed (unchanged — this slice doesn't
    touch the HTTP contract, only what happens underneath it)

Manual live verification — the real case-conditions workflow, start to
finish, through a real Temporal worker, entirely under NODE_ENV=production
with APP_DATABASE_URL pointed at mortgage_app (M5-003's role):
  seeded two real tenants + jurisdiction, minted real API-client bearer
  credentials for each via `npm run create-api-client`, started the
  actual compiled API and the actual compiled Temporal worker

  tenant A's credential created a real case (201), started its
  workflow (202) — the real worker fetched income/credit/document
  evidence (3 real evidence_facts rows through 3 separate
  provider-simulator dispatches), ran a real Agent evaluation
  (check_case_completeness/evaluate_policy/create_condition all
  SUCCESS), opened a real VERIFY_INCOME_DISCREPANCY condition,
  transitioned the case through CONDITIONS_OPEN

  submitted a real CONDITION_RESOLUTION review (202) — the workflow
  resolved the condition, wrote a real condition_transitions row, and
  completed the case to READY_FOR_UNDERWRITING (confirmed via a
  fresh GET) — the full M2/M3 workflow, unmodified by this slice's
  refactor, working end to end under the restricted role for the
  first time

  tenant B's real credential requested tenant A's real case and its
  timeline: both 404'd, identical to a nonexistent case/no separate
  403 (M5-001's own established behavior, unaffected)

  connected directly to Postgres as mortgage_app (not the superuser)
  and queried the real case/evidence/outbox rows this exact live
  workflow run had just created: under tenant B's session context, 0
  visible on all three tables; under tenant A's own context, 1 case, 3
  evidence facts, 9 outbox events (the full lifecycle's worth) —
  direct, end-to-end proof against a real production-mode workflow's
  own real rows, not a spec fixture

  synthetic tenant/case/api-client/evidence/outbox data removed with
  the scratch stack teardown (docker compose down -v)
```

### Security, privacy, cost, and compatibility

- Extends M5-003's real production protection to the case-conditions core: under `NODE_ENV=production` with `APP_DATABASE_URL` set, `loan_cases`, `evidence_facts`, `outbox_events`, and `condition_transitions` are now genuinely protected against a future application-code bug that forgets a `WHERE tenantId = ...` clause, not merely convention.
- The `Promise.all`-on-one-connection bug fixed this slice was a real, if narrow, correctness risk already present in shipped code (`resolveOutcomeNode`) before this slice ever touched it — this slice's own audit surfaced and fixed it as a byproduct, not the primary goal, but it's a genuine improvement independent of RLS.
- No new secrets, no new external dependencies, no performance concern beyond M5-002's own (indexed equality/join checks, same order of cost as the `WHERE tenantId = ...`/`WHERE caseId = ...` clauses this codebase's queries already carry).

### Known gaps

- **`loan_conditions` itself still has no RLS policy** — its initial creation path (`create-condition.tool.ts`) isn't tenant-context-aware yet; adding a policy without fixing that path first would break condition creation outright (see Decisions). Real, scoped, separate follow-up.
- **`agent_runs`/`tool_attempts`, `case_policy_bindings`/`case_policy_snapshots`, `provider_operation_intents`/`provider_authorization_grants` still have no RLS policy** — each requires refactoring an `@InjectRepository`-based service (`PolicyEvaluationService`, `EvaluationManifestService`, `ProviderAuthorizationService`, `ProviderOperationIntentService`, and the LangGraph runtime's own `persistAgentRun`) to accept an external `EntityManager`, explicitly declined as this slice's scope.
- **`evaluation/runner.ts` (the offline evaluation-corpus harness) was deliberately not audited or updated this slice** — it calls `createCaseConditionsActivities` directly (so it inherits this slice's fixes for free) but also does its own direct fixture inserts/cleanup against `loan_cases`/`evidence_facts` outside any `runInTenantContext` wrapper. Not a live-request-path concern (it's a manual, offline dev tool, not part of the running application), but it would need the same treatment before it could be run against a restricted-role database.
- Section 20 M5's own exit evidence ("database layer") is now true for `webhook_endpoints`/`webhook_deliveries`/`loan_cases`/`evidence_facts`/`outbox_events`/`condition_transitions` — six tables — but still not the full case-conditions-and-policy graph.

### Next safe step

The concurrency bug found this slice (`Promise.all` on a shared connection) is worth a deliberate, dedicated grep across the rest of the codebase outside this slice's own 4-table scope, since the same risky pattern could exist wherever a `dataSource.transaction`/`runInTenantContext` callback issues more than one query — not yet done as a full audit, only fixed where this slice's own work happened to touch it. Otherwise, the honestly-buildable increments remain: `loan_conditions` + the Agent-runtime/provider-platform tables (the deferred, larger-blast-radius RLS extension), or M5's other still-open items (RBAC roles, consent enforcement, OIDC). Not started; awaiting direction.

## M5-005: Real consent enforcement (`consent_records`, Section 6.3's "Consent... may stop processing")

### Status

Implemented and verified, including a real live workflow run proving a previously-dead code path now genuinely fires: the LangGraph runtime's `verifyConsent` node, built in M3-009 and wired as the graph's literal first step, has been real, tested, but permanently inert in production ever since — its only caller always hardcoded `consentStatus: 'VALID'` because no consent-tracking entity existed. It now reads real data, and a real revoked-consent case, driven through a real Temporal worker, genuinely landed in `MANUAL_REVIEW`.

Chosen autonomously as the next M5 slice (the user delegated the choice) over RBAC roles: consent enforcement was already concretely scoped by the charter's own type definitions and trigger lists (Section 9.3's `ConsentStatus`, Section 9.6's "consent revoked mid-case" as the *first* mandatory review trigger listed), already had a real, tested, dead-code enforcement point waiting for real data (M3-009), and sits at the very top of Section 6.3's authority order — RBAC's own design space (what roles, what granularity) has no equivalent charter-provided scaffolding and isn't a call this session should make unilaterally.

### Acceptance criterion

A case whose consent has been revoked stops new processing (Section 14.2) — proven at three layers: a unit-level activity test (`evaluateConditions` returns `REVIEW_REQUIRED` for a revoked-consent case), a provider-dispatch-level test (`ProviderAuthorizationService.revalidate()` fails closed when a grant's referenced consent record is revoked, classified non-retryable), and a real live workflow run (a genuine case, revoked before its workflow starts, driven through a real Temporal worker under `NODE_ENV=production` and the M5-003 restricted role, landing in `MANUAL_REVIEW`).

### Implementation

- `src/database/entities/consent-record.entity.ts` (new) — Section 14.1's `consent_records`, deliberately one record per case (not per purpose — a documented simplification against the charter's fuller per-purpose/policy-version model, matched to the single scalar `consentStatus` field the Agent state actually consumes today). `src/database/migrations/1787126773274-ConsentRecords.ts` (new) — a genuinely new table, so RLS (`FORCE ROW LEVEL SECURITY` + the same `tenant_isolation` policy pattern as M5-002/M5-004) is applied in the *same* migration that creates it, never retrofitted; `AppRuntimeRole`'s (M5-003) `GRANT ... ON ALL TABLES`/`ALTER DEFAULT PRIVILEGES` already covers it automatically.
- `src/consent/consent.service.ts` (new), `consent.module.ts` (new, `@Global()`, same reasoning as `AuthModule`) — `grantForCase()`, `revoke()`, `getStatus()` (computes `VALID`/`MISSING`/`EXPIRED`/`REVOKED` from the case's most recent record), `activeRecordId()`, `isRecordValid()` (bypasses tenant scoping deliberately — the caller, `ProviderAuthorizationService`, has already independently confirmed the grant's own tenant match before this is ever reached).
- `CasesService.createCase()` now calls `consentService.grantForCase()` right after a case is created — implicit, automatic consent, matching this codebase's existing behavior exactly (every case has always processed successfully with no separate consent step) rather than introducing a new required step that would break case creation for every existing caller. `CasesService.submitConsentAction()` + `POST /v1/loan-cases/{caseId}/consents` (`ConsentActionDto`, `{action: "GRANT" | "REVOKE", reason?}`) is the new real capability — synchronous, not a Temporal signal, since a consent action is a plain database write; returns the resulting `ConsentRecord` directly (`201`, matching `createCase()`'s own precedent for a POST that returns a created/mutated resource without an explicit `@HttpCode` override).
- `case-conditions.activities.ts`'s `evaluateConditions` now calls `consentService.getStatus(tenantId, caseId)` instead of hardcoding `'VALID'` — the single-line change that makes M3-009's `verifyConsent` node real.
- `ProviderAuthorizationService.issue()` accepts an optional `consentRecordIds` input (populated by `dispatchProviderRequest` via `consentService.activeRecordId()`); `revalidate()` now also confirms every referenced id is still granted and unrevoked (Section 11.5's own exact language), failing closed alongside its existing tenant/case/provider/capability/expiry/revocation checks.
- `dispatchProviderRequest` throws a new `ProviderRevalidationError` (not a plain `Error`) on any revalidation failure; `case-conditions.activities.ts`'s `callProviderWithRetryClassification` classifies it `ApplicationFailure.nonRetryable` — a mismatched, expired, revoked, or consent-invalidated grant can never succeed on retry, the identical reasoning already applied to a terminal synthetic provider rejection (found and fixed after a live-verification run showed the *un*-classified version wasting ~3 seconds of pointless Temporal retries before finally failing; the classified version fails in ~90ms).
- `evaluation/runner.ts`/`runner.spec.ts`/`evaluation-report.ts` updated to grant consent for every fixture case they create directly (bypassing `CasesService`) — matches real behavior, keeps the whole corpus's expected outcomes unchanged.
- `src/consent/consent-tenant-isolation.spec.ts` (new) — the RLS proof, mirroring M5-002/M5-004's pattern against the real `mortgage_app` role, simpler than the other two (a direct `tenantId` column, no join-based policy, RLS present from the table's first migration).

### Affected files

- `src/database/entities/consent-record.entity.ts` (new), `src/database/migrations/1787126773274-ConsentRecords.ts` (new), `schema-migrations.spec.ts`
- `src/consent/consent.service.ts` (+`.spec.ts`, new), `consent.module.ts` (new), `consent-tenant-isolation.spec.ts` (new)
- `src/cases/cases.service.ts` (+`.spec.ts`), `cases.controller.ts`, `dto/consent-action.dto.ts` (new)
- `src/workflows/case-conditions.activities.ts` (+`.spec.ts`)
- `src/provider-platform/provider-authorization.service.ts` (+`.spec.ts`), `dispatch-provider-request.ts` (+`.spec.ts`)
- `src/agent-runtime/langgraph/lending-operations-agent-runtime.ts` (unchanged this slice — `verifyConsent` was already built in M3-009)
- `src/evaluation/runner.ts`, `runner.spec.ts`, `src/evaluation-report.ts`
- `src/app.module.ts`, `src/worker.module.ts`
- `test/cases.e2e-spec.ts`
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Implicit auto-grant at case creation, not a required explicit grant step.** Section 15.1's target contract lists `POST .../consents` as its own endpoint, which could imply consent must be explicitly granted before a case can process. Requiring that would be a breaking change to case creation for every existing caller (including this codebase's own quickstart/e2e suites) and doesn't match the real-world framing that applying for a mortgage already constitutes consenting to the processing that evaluates it. Revocation — the actual, genuinely new safety capability Section 6.3/14.2 care about — is unaffected by this choice.
- **One consent record per case, not the charter's fuller per-purpose/scope/policy-version model (Section 14.1).** `LendingOperationsAgentState.consentStatus` is a single scalar the Agent run already consumes; modeling per-purpose consent now would build structure nothing reads yet. `purpose`/`scope` columns exist on the entity today as descriptive fields, not yet a real per-purpose access boundary — documented as a known simplification, not silently narrowed.
- **`activeRecordId()` returns the case's most recent record regardless of whether it's revoked, not `null` once revoked.** This looked like a bug during live verification (a revoked case's provider dispatch still tries to attach a — now stale — consent reference) but is the correct design given the auto-grant invariant: every real case always has at least one consent record, so "most recent" always accurately reflects true current state, and attaching the stale reference is exactly what lets `revalidate()`'s own explicit consent check catch it and fail closed. Returning `null` instead would make `consentRecordIds` empty, which `revalidate()` treats as "nothing to check" — the opposite of what's needed.
- **`ProviderRevalidationError` classified non-retryable, not left as a generic thrown `Error`.** Found live, not by design foresight — see Errors and fixes.
- **Data-disposition review for already-collected evidence (Section 14.2's third consequence of revocation) explicitly not attempted.** M0-010's own roadmap note already separated "consent-revocation propagation to dependent grants" from "the data-disposition workflow" as two distinct pieces of future M5 work; this slice does the first, not the second, and says so plainly rather than letting "consent enforcement" read as more complete than it is.

### Errors and fixes

- **First live workflow run revoked a case's consent, started its workflow, and the case correctly landed in `MANUAL_REVIEW` — but took ~3.25 seconds to get there and reported a generic `"ActivityFailure: Activity task failed"` reason instead of anything consent-specific.** Root cause: `dispatchProviderRequest`'s revalidation-failure branch threw a plain `Error`, which `callProviderWithRetryClassification` doesn't recognize, so it propagated unclassified — Temporal applied its own default retry policy (up to 3 attempts with backoff) before finally giving up, wasting real time on a request that could never succeed no matter how many times it was retried. Fixed by introducing `ProviderRevalidationError` and classifying it `ApplicationFailure.nonRetryable` (see Decisions). Re-ran the identical live scenario after the fix: the same case now fails in ~90ms, immediately, with no wasted retries — confirmed by comparing the real `workflow_run.started`→`workflow_run.failed` outbox-event timestamps from both runs directly.
- **The outbox event's `reason` field still shows the generic `"ActivityFailure: Activity task failed"` string even after the classification fix — not the specific `ProviderRevalidationError` message.** Root cause, confirmed by reading `case-conditions.workflow.ts`: its top-level `catch` blocks (both the evidence-collection one and the `evaluateConditions` one) call `String(error)` on whatever Temporal's own `ActivityFailure` wrapper produces, which doesn't drill into the wrapped cause's specific message — a pre-existing limitation of this workflow's error reporting that affects *every* activity failure reported this way, not something this slice introduced or made worse (if anything, the classification fix above made the failure faster). Left as-is rather than expanding scope to fix generic error-message extraction workflow-wide — tracked honestly in Known gaps instead of silently accepted or silently expanded into.
- **`case-conditions.activities.spec.ts` failed with `Cannot read properties of undefined (reading 'isRecordValid')` on the first run after wiring `consentService` into `ProviderAuthorizationService`'s constructor.** That spec file's own `beforeAll` still constructed `ProviderAuthorizationService` with only its old single argument (the repository) — `consentService` was added to `createCaseConditionsActivities`'s deps object correctly, but the *separate* `ProviderAuthorizationService` constructor call three lines above it was missed. The exact same class of ordering/completeness bug the M5-002/M5-003/M5-004 slices repeatedly found in their own direct-instantiation spec files — found immediately by running the affected spec, not live.
- **`evaluation/runner.spec.ts` (a file distinct from `runner.ts` itself, easy to miss in a `grep -l createCaseConditionsActivities` sweep since it doesn't call that function by name in its own `deps()` — it constructs `EvaluationRunnerDeps` inline) failed the same way** — full test suite run surfaced 5 failures there after the `EvaluationRunnerDeps` interface gained a required `consentService` field. Fixed by updating its own `deps()` helper and entity list, same pattern as every other direct-construction spec.

### Verification

```text
npm run build / npm run lint:check (after `npm run lint` auto-fixed
formatting)
  both passed clean

Migration (m5005-verify / m5005-final scratch stacks, ports 5443/7234):
  a from-empty migration:run applied ConsentRecords1787126773274 cleanly
  on top of CaseCoreTenantIsolation1787084811062

  DATABASE_URL=... npx jest schema-migrations.spec.ts --runInBand
    23/23 passed (22 -> 23: +1 new revert test), run on a virgin
    cluster first

  DATABASE_URL=... npx jest consent-tenant-isolation consent.service.spec.ts --runInBand
    15/15 passed against the real mortgage_app role, first attempt

  DATABASE_URL=... npx jest case-conditions.activities.spec.ts
  provider-authorization.service.spec.ts dispatch-provider-request.spec.ts --runInBand
    initial run: 4 failures (the ProviderAuthorizationService
    constructor-ordering bug above) — fixed, re-ran clean: 26/26,
    later 27/27 once the revalidation-classification test was added

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand
  --no-cache --silent
    initial run: 5 failures, all in evaluation/runner.spec.ts (the
    missing-consentService bug above) — fixed, re-ran clean: final
    count 63 suites passed, 425 tests passed (61/424 -> 63/425:
    +2 suites [consent.service.spec.ts, consent-tenant-isolation.spec.ts],
    +1 test net beyond that — several existing specs gained assertions
    rather than new `it()` blocks)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    27/27 passed (23 -> 27: +4 new consent e2e tests — implicit grant
    at creation, REVOKE marks it revoked with the reason, GRANT after
    REVOKE creates a fresh record, cross-tenant REVOKE 404s)

Manual live verification — the real case-conditions workflow under
NODE_ENV=production with APP_DATABASE_URL (M5-003's restricted role):
  seeded a real tenant, minted a real API-client credential, created a
  real case (implicit consent granted automatically, confirmed via a
  direct query), revoked it via a real POST .../consents call (201,
  revokedAt/revocationReason both real and returned), then started the
  real workflow

  first run (before the non-retryable classification fix): case
  correctly landed in MANUAL_REVIEW after ~3.25s, generic reason string

  restarted the real API + worker after the fix, ran the identical
  scenario against a fresh case: MANUAL_REVIEW after ~90ms — direct,
  measured confirmation the classification fix works, not just an
  inference from reading the code

  queried the real consent_records row this live run produced directly
  against Postgres as mortgage_app: invisible under a different
  tenant's session context, fully visible (with its real revokedAt/
  revocationReason) under its own tenant's — the same M5-002/M5-004
  database-layer proof pattern, this time against a real revoked
  consent record a live workflow run actually produced

  synthetic tenant/case/api-client/consent data removed with the
  scratch stack teardown (docker compose down -v)
```

### Security, privacy, cost, and compatibility

- Closes a real, previously-inert safety gap: Section 6.3's own top-priority authority-order item ("Consent... may stop processing") is now genuinely enforced, not merely represented by dead code waiting for data that never came.
- The non-retryable classification fix is also a genuine, independent cost/reliability improvement — any revalidation failure (not just a consent one; a mismatched or expired grant benefits identically) now fails fast instead of burning a worker's time and the configured retry budget on an attempt that could never succeed.
- No new secrets, no new external dependencies, no performance concern beyond the established RLS pattern's own (an indexed equality check, same order of cost as this codebase's existing `WHERE tenantId = ...` clauses).

### Known gaps

- **No data-disposition review for evidence already collected under a since-revoked consent (Section 14.2's third consequence)** — this slice stops *new* processing, which is the literal Section 6.3 requirement, but does not flag, review, or dispose of evidence a case already gathered before its consent was revoked. Real, separately-scoped follow-up, explicitly named in M0-010's own original roadmap note.
- **Consent revocation only takes effect the next time `evaluateConditions` runs, not by interrupting an Agent run already in flight.** Not a practical gap today — this codebase's Agent runs are synchronous and make no model calls, so there is no meaningful "in flight" window — but would become a real one if that ever changes.
- **The case timeline/outbox event's failure reason is a generic Temporal string, not the specific consent-related message**, for the reason in Errors and fixes above — a pre-existing, workflow-wide limitation this slice's live verification happened to surface clearly for the first time, not something newly introduced.
- **`purpose`/`scope` are descriptive strings, not a real per-purpose consent boundary** — see Decisions. The charter's fuller Section 14.1 model (also binding a policy version) isn't modeled.
- **`evaluation/runner.ts`'s own direct fixture inserts (bypassing `CasesService`, `runInTenantContext`) still aren't RLS-audited** — unchanged from M5-004's own Known gap; this slice only added the consent grant those fixtures now also need, not a broader audit of that file.

### Next safe step

The honestly-buildable increments remaining in M5: RBAC roles (still no charter-provided scaffolding to build against — would need its own design pass, not a mechanical extension of an existing pattern), the data-disposition review workflow this slice's own Known gaps names, extending RLS to `loan_conditions` and the Agent-runtime/provider-platform tables (M5-004's own deferred scope), or OIDC. Not started; awaiting direction.

## M5-006: PostgreSQL row-level security for `loan_conditions`, `agent_runs`, `tool_attempts` — completing the case-conditions core

### Status

Implemented and verified, including a real live workflow run. Extends M5-002/M5-004/M5-005's row-level security pattern to the three case-conditions-core tables M5-004 explicitly deferred, completing database-layer tenant isolation for the entire case-conditions core (`loan_cases`, `evidence_facts`, `outbox_events`, `condition_transitions`, and now `loan_conditions`, `agent_runs`, `tool_attempts`).

Chosen autonomously as the next M5 slice (the user delegated the choice again — "下一步做什麼 你開始") over consent-adjacent RBAC work: a prior audit (delegated to a research agent, then independently verified file by file) found this group cheap — the two heaviest write paths on `loan_conditions` were already running inside an M5-004 `runInTenantContext` transaction incidentally, and the remaining bare touch points (`case-timeline.service.ts`'s reads, `persistAgentRun`'s bare `dataSource.transaction()`) were trivial, mechanically-proven wraps with three successful RLS precedents already in the codebase — versus `case_policy_bindings`/`case_policy_snapshots`/`provider_operation_intents`/`provider_authorization_grants`, which the same audit found expensive (real service refactors: `PolicyEvaluationService` has no `DataSource`/`EntityManager` at all today, and several `ProviderAuthorizationService`/`ProviderOperationIntentService` methods don't have `tenantId` in scope).

### Acceptance criterion

A non-superuser connection (`mortgage_app`, M5-003) with no tenant context, or a different tenant's context, sees zero rows on `loan_conditions`, `agent_runs`, and `tool_attempts` — even against real rows that genuinely exist — while the owning tenant's context sees exactly its own rows. Proven at the database layer (an 8-test RLS proof spec covering all 7 case-conditions-core tables together) and at the live-application layer (a real case driven through the real LangGraph agent runtime under `NODE_ENV=production`/`APP_DATABASE_URL`, whose resulting `agent_runs`/`tool_attempts`/`loan_conditions` rows were then queried directly against Postgres under a fabricated other-tenant session and found invisible, then under the real tenant's session and found fully visible).

### Implementation

- `src/database/migrations/1787129406858-CaseConditionsAgentTenantIsolation.ts` (new) — same `ENABLE`/`FORCE ROW LEVEL SECURITY` + `tenant_isolation` policy shape as every prior RLS migration for `loan_conditions` and `agent_runs` (direct `tenantId` column). `tool_attempts` has no `tenantId` column of its own (Section 14.1's record is keyed only by `agentRunId`), so its policy resolves ownership through an `EXISTS` join to `agent_runs` — the same join-based pattern `condition_transitions`' M5-004 policy already established against `loan_conditions`.
- `src/agent-runtime/langgraph/lending-operations-agent-runtime.ts`'s `persistAgentRun` — changed from a bare `dataSource.transaction(...)` to `runInTenantContext(dataSource, result.finalState.tenantId, ...)`; body unchanged. Confirmed via grep this is the only production write site for `agent_runs`/`tool_attempts` other than `case-timeline.service.ts`'s reads.
- `src/cases/case-timeline.service.ts` — rewritten. Previously injected `AgentRun`/`ToolAttempt`/`LoanCondition` repositories and a bare `DataSource` directly (4 constructor params), issuing one wrapped `outbox_events` query alongside three *bare* queries against the other tables — meaning `GET .../timeline` was reading agent-run/condition data outside any tenant context before this slice, relying entirely on the caller having already checked `tenantId` in its `WHERE` clause with no database-layer backstop. Now takes only `DataSource` and runs all four reads (`outbox_events`, `agent_runs`, `loan_conditions`, `tool_attempts`) sequentially inside one `runInTenantContext` callback — sequential, not `Promise.all`, per the M5-004-established rule that overlapping queries on one connection risk result-set confusion (node-postgres's own deprecation warning is the concrete signal). No spec-file fixes were needed — grep confirmed no direct `new CaseTimelineService(...)` call sites exist anywhere.
- `src/workflows/case-core-tenant-isolation.spec.ts` — extended (not a new file) to cover all 7 case-conditions-core tables in one spec, since they're one coherent unit now. Added `AgentRun`/`ToolAttempt` fixtures and entity registrations to both the admin and restricted `DataSource`s; moved `loan_conditions` fixture creation from the admin (bypass) connection to the restricted connection via `runInTenantContext`, since it now has a real policy to exercise; added a dedicated assertion for `tool_attempts`' join-based policy mirroring the existing `condition_transitions` one.
- `src/database/migrations/schema-migrations.spec.ts` — new revert test (`'reverts the case conditions agent tenant isolation migration without touching other tables'`), same shape as the M5-004/M5-005 revert tests: checks `pg_class.relrowsecurity`/`relforcerowsecurity` and `pg_policies` before revert, confirms the full table list and RLS state afterward. This migration adds no new table, so the "applies every migration" test's table-count assertion needed no change.

### Affected files

- `src/database/migrations/1787129406858-CaseConditionsAgentTenantIsolation.ts` (new), `schema-migrations.spec.ts`
- `src/agent-runtime/langgraph/lending-operations-agent-runtime.ts`
- `src/cases/case-timeline.service.ts`
- `src/workflows/case-core-tenant-isolation.spec.ts`
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Extended the existing M5-004 RLS proof spec rather than writing a new one for these 3 tables.** All 7 tables are one coherent unit (the entire case-conditions core) and the fixture setup (tenants, jurisdiction, cases) is identical — a separate spec would have duplicated that setup wholesale rather than adding to it. The file's own title and header comment were updated to describe all 7 tables, not silently left describing only 4.
- **Scoped this slice to exactly the "cheap" group the prior audit identified, deferring `case_policy_bindings`/`case_policy_snapshots`/`provider_operation_intents`/`provider_authorization_grants` explicitly rather than attempting a partial pass at them.** Those tables' owning services would need real constructor/method-signature changes (a `DataSource` added to `PolicyEvaluationService`, `tenantId` threaded through several `ProviderAuthorizationService`/`ProviderOperationIntentService` methods that don't have it today) before RLS could even be exercised correctly — different, larger scope than a migration-plus-mechanical-wrap slice, and not attempted here.
- **`case-timeline.service.ts`'s pre-existing bare reads of `agent_runs`/`loan_conditions`/`tool_attempts` were a real, if narrow, latent gap** (the endpoint relied solely on its own `WHERE tenantId = ...` clause, no RLS backstop) rather than a hypothetical one this slice is inventing a fix for — worth naming plainly since this file wasn't touched at all in M5-004 despite reading from tables that migration did protect (`outbox_events`).

### Errors and fixes

None encountered this slice — `npm run build` passed clean on the first attempt after the `case-timeline.service.ts` rewrite and `persistAgentRun` wrap, and every test run (migration revert, RLS proof, full suite, e2e) passed on its first attempt. The `client.query() when the client is already executing a query is deprecated` warning observed during the e2e run was confirmed pre-existing on the unmodified `f3081d7` baseline (checked via `git stash`), not something this slice introduced.

### Verification

```text
npm run lint / npm run build / npm run lint:check
  all passed clean

Fresh scratch stack (m5006verify, ports 5443/7234):
  DATABASE_URL=... npx jest schema-migrations.spec.ts --runInBand
    24/24 passed (23 -> 24: +1 new revert test), run on a virgin
    cluster first

  migration:run applied CaseConditionsAgentTenantIsolation1787129406858
    cleanly on top of ConsentRecords1787126773274

  DATABASE_URL=... npx jest case-core-tenant-isolation.spec.ts --runInBand
    8/8 passed against the real mortgage_app role — no-context and
    wrong-tenant-context zero-visibility across all 7 tables, exact-match
    own-tenant visibility, cross-tenant UPDATE/spoofed-INSERT rejection,
    both join-based policies (condition_transitions, tool_attempts),
    bypass-mode inclusion check

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent
    63 suites / 426 tests passed (63/425 -> 63/426: +1 test, this
    slice's own spec extension — no new spec *file*)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    3 suites / 27 tests passed, unchanged from M5-005 (no e2e-visible
    behavior change — the timeline endpoint's output shape is identical,
    only its internal query path changed)

Manual live verification — real API + real Temporal worker under
NODE_ENV=production with APP_DATABASE_URL (the mortgage_app role):
  seeded a real tenant + API-client credential, created a real case,
  started its real workflow — it landed in CONDITIONS_OPEN with a real
  income-discrepancy condition opened and a real Agent run recorded

  GET .../timeline returned a correctly assembled AGENT_RUN entry built
  from the real agent_runs/tool_attempts rows the live run produced,
  confirming case-timeline.service.ts's rewrite works end-to-end in
  production, not just in isolation

  queried agent_runs/tool_attempts/loan_conditions directly against
  Postgres as mortgage_app: a fabricated other-tenant session (inside an
  explicit transaction, SET LOCAL) saw zero rows on all three tables
  despite the real rows existing; the real tenant's own session saw
  exactly its own 1 agent run, 3 tool attempts, 1 condition

  scratch stack torn down (docker compose down -v) after verification
```

### Security, privacy, cost, and compatibility

- Closes the specific latent gap named in Decisions: `GET .../timeline` (Section 7.1's launch-scenario "display the full timeline" step) now has a real database-layer backstop on every table it reads, not just the one (`outbox_events`) M5-004 happened to already cover.
- Completes RLS for the entire case-conditions core: every table on the primary case-processing path (case creation → evidence → conditions → agent runs → tool attempts → transitions → consent) now fails closed under `mortgage_app`, leaving only the two explicitly-deferred groups named in Decisions.
- No new secrets, no new external dependencies, no performance concern beyond the established pattern's own (indexed equality checks; `tool_attempts`' `EXISTS` join is against `agent_runs.id`, its primary key).

### Known gaps

- **`case_policy_bindings`/`case_policy_snapshots` still have no RLS** — `PolicyEvaluationService` has no `DataSource`/`EntityManager` at all today; adding one is a real refactor, not attempted this slice.
- **`provider_operation_intents`/`provider_authorization_grants` still have no RLS** — several methods on `ProviderOperationIntentService`/`ProviderAuthorizationService` (`markDispatched`, `markSucceeded`, `markFailedFinal`, `markOutcomeUnknown`, `revoke`) don't have `tenantId` in scope today; threading it through is real, separately-scoped work.
- **`evaluation/runner.ts`'s own direct fixture inserts still aren't RLS-audited** — unchanged, consistent Known gap repeated from M5-004/M5-005; this slice didn't touch that file at all.
- **RBAC roles and the Section 14.2 data-disposition workflow remain unstarted** — both still lack charter-provided scaffolding a mechanical extension of an existing pattern could build against, unchanged from M5-005's own Next safe step.

### Next safe step

The two explicitly-deferred "expensive" table groups (policy bindings/snapshots, provider operation intents/authorization grants) are the natural next RLS increment, but both require a real service-layer refactor first (giving `PolicyEvaluationService` a `DataSource`, threading `tenantId` through the provider-platform methods that lack it) rather than a mechanical migration-plus-wrap — a genuine design decision, not made unilaterally here. RBAC roles and the data-disposition workflow remain the other honestly-buildable options, both still without charter-provided scaffolding. Not started; awaiting direction.

## M5-007: PostgreSQL row-level security for `evaluation_input_manifests`

### Status

Implemented and verified, including a real live workflow run. Extends M5-002/M5-004/M5-005/M5-006's row-level security pattern to Section 10.5's `evaluation_input_manifests` — the durable, evidence-backed record of exactly what every completed DSL evaluation read.

Chosen autonomously as the next M5 slice (the user again delegated the choice — "繼續"). Before scoping it, ran a fresh, direct audit of every entity for a `tenantId` column (`grep tenantId! src/database/entities/*.entity.ts`), rather than trusting M5-006's own dev-log Known gaps list at face value — that list named exactly two deferred groups (`case_policy_bindings`/`case_policy_snapshots`, `provider_operation_intents`/`provider_authorization_grants`), but the fresh audit found `evaluation_input_manifests`, `communication_messages`, `communication_templates`, and `policy_change_impact_assessments` also have real `tenantId` columns and no RLS — simply missed by M5-004/M5-006's own scoping, not tables anyone deliberately excluded. Of these, `evaluation_input_manifests` was the clear next slice: exactly one write path (`EvaluationManifestService.assemble()`, a single insert-only `save()`), no reads anywhere in production code, and both real call sites already run outside any surrounding `runInTenantContext` block — no nesting concerns, no shared-method-across-different-tenant-contexts complexity like `PolicyChangeImpactService`'s `assessOneCase` has (see Known gaps).

Also corrected a factual error in M5-006's own dev-log entry along the way: `PolicyEvaluationService` does *not* have "no `DataSource`/`EntityManager` at all" — it has three `@InjectRepository`-injected repositories, just never wrapped in `runInTenantContext`, the identical unwrapped-repository pattern `case-timeline.service.ts` had before M5-006 fixed it. Converting it is mechanical (swap the injected repositories for a `DataSource`, wrap `evaluate()`'s body), but is still real, non-trivial work because `PolicyChangeImpactService.assessOneCase()` shares `CasePolicyBinding`/`CasePolicySnapshot` reads across two callers needing different tenant contexts (`assessImpact()`'s cross-tenant bypass scan vs. `assessImpactForCase()`'s single-tenant lookup) — not because no `DataSource` exists at all.

### Acceptance criterion

A non-superuser connection (`mortgage_app`, M5-003) with no tenant context, or a different tenant's context, sees zero rows on `evaluation_input_manifests` — even against a real row that genuinely exists — while the owning tenant's context sees exactly its own row. Proven at the database layer (a 6-test RLS proof spec, `evaluation-manifest-tenant-isolation.spec.ts`) and at the live-application layer (a real case driven through the real LangGraph agent runtime under `NODE_ENV=production`/`APP_DATABASE_URL`, whose resulting manifest row was then queried directly against Postgres under a fabricated other-tenant session and found invisible, then under the real tenant's session and found fully visible).

### Implementation

- `src/database/migrations/1787130439264-EvaluationManifestTenantIsolation.ts` (new) — same `ENABLE`/`FORCE ROW LEVEL SECURITY` + `tenant_isolation` policy shape as every prior RLS migration; `evaluation_input_manifests` has its own direct `tenantId` column, no join needed.
- `src/policy/evaluation-manifest.service.ts` — `EvaluationManifestService`'s constructor changed from `@InjectRepository(EvaluationInputManifest)` to `@InjectDataSource()`; `assemble()`'s single `save()` now runs inside `runInTenantContext(this.dataSource, input.tenantId, ...)`.
- Five direct-construction call sites updated from `new EvaluationManifestService(dataSource.getRepository(EvaluationInputManifest))` to `new EvaluationManifestService(dataSource)` — `src/evaluation-report.ts`, `src/workflows/case-conditions.activities.spec.ts`, `src/evaluation/runner.spec.ts`, `src/agent-runtime/langgraph/lending-operations-agent-runtime.spec.ts`, `src/policy/evaluation-manifest.service.spec.ts`. All five already had `dataSource` in scope — a pure mechanical swap, the same class of constructor-signature update M5-005's own Errors and fixes found being missed in spec files, caught here proactively by grepping every `new EvaluationManifestService(` call site before running anything.
- `src/policy/evaluation-manifest-tenant-isolation.spec.ts` (new) — the RLS proof, mirroring `consent-tenant-isolation.spec.ts`'s pattern (simple direct-`tenantId` table, no join), 6 tests: no-context zero visibility, tenant A/B own-row visibility, cross-tenant direct-id lookup returning null, cross-tenant spoofed-INSERT rejection, bypass-mode inclusion.
- `src/database/migrations/schema-migrations.spec.ts` — new revert test (`'reverts the evaluation manifest tenant isolation migration without touching other tables'`), inserted as the newest (first) revert test, same shape as every prior one. No new table, so the "applies every migration" test's table list needed no change.

### Affected files

- `src/database/migrations/1787130439264-EvaluationManifestTenantIsolation.ts` (new), `schema-migrations.spec.ts`
- `src/policy/evaluation-manifest.service.ts`, `evaluation-manifest.service.spec.ts`, `evaluation-manifest-tenant-isolation.spec.ts` (new)
- `src/evaluation-report.ts`, `src/evaluation/runner.spec.ts`
- `src/workflows/case-conditions.activities.spec.ts`
- `src/agent-runtime/langgraph/lending-operations-agent-runtime.spec.ts`
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Scoped to exactly one table, not the whole freshly-discovered list.** `communication_messages`/`communication_templates` and `policy_change_impact_assessments` are real, similarly-sized gaps, but each has its own service-level shape to verify before touching (not yet audited this slice) — bundling them in without that same care would repeat the exact mistake this slice is correcting (M5-006's own scoping missing tables it didn't look hard enough for). Named explicitly in Known gaps rather than silently left for "later" with no trace.
- **`PolicyChangeImpactService` and `PolicyEvaluationService` (the `case_policy_bindings`/`case_policy_snapshots` group) deliberately not attempted here despite the corrected understanding that `PolicyEvaluationService` itself is a mechanical wrap.** `PolicyChangeImpactService.assessOneCase()`'s shared bare reads across two different-tenant-context callers is the real remaining complexity M5-006's dev log undersold — that needs `assessOneCase` refactored to accept an `EntityManager` parameter (mirroring `finalizeReadyForUnderwriting`'s existing pattern in `case-conditions.activities.ts`) with each caller supplying its own context, a real design decision about method shape, not attempted in the same slice as a single-table, single-service, zero-read table like this one.

### Errors and fixes

None encountered — `npm run build`/`lint:check` passed clean on the first attempt, and every test run (migration revert, RLS proof spec, full suite, e2e) passed on its first attempt. The pre-existing `client.query() when the client is already executing a query is deprecated` warning during the e2e run is the same one already confirmed pre-existing (not this slice's) in M5-006.

### Verification

```text
npm run lint / npm run build / npm run lint:check
  all passed clean

Fresh scratch stack (m5007verify, ports 5443/7234):
  DATABASE_URL=... npx jest schema-migrations.spec.ts --runInBand
    25/25 passed (24 -> 25: +1 new revert test), run on a virgin
    cluster first

  migration:run applied EvaluationManifestTenantIsolation1787130439264
    cleanly on top of CaseConditionsAgentTenantIsolation1787129406858

  DATABASE_URL=... npx jest evaluation-manifest-tenant-isolation.spec.ts
  --runInBand
    6/6 passed against the real mortgage_app role, first attempt

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent
    64 suites / 433 tests passed (63/426 -> 64/433: +1 new suite,
    +7 tests)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    3 suites / 27 tests passed, unchanged from M5-006 (no e2e-visible
    behavior change)

Manual live verification — real API + real Temporal worker under
NODE_ENV=production with APP_DATABASE_URL (the mortgage_app role):
  seeded a real tenant + API-client credential, created a real case,
  started its real workflow — it landed in CONDITIONS_OPEN with a real
  income-discrepancy condition opened, meaning resolveOutcomeNode's
  evaluationManifestService.assemble() call genuinely ran

  queried evaluation_input_manifests directly against Postgres as
  mortgage_app: a real row existed referencing the real caseId/
  policyBindingId; a fabricated other-tenant session (inside an explicit
  transaction, SET LOCAL) saw zero rows despite that row existing; the
  real tenant's own session saw exactly its own 1 row

  scratch stack torn down (docker compose down -v) after verification
```

### Security, privacy, cost, and compatibility

- Closes a real gap that had gone unnamed until this slice's own fresh audit: `evaluation_input_manifests` — the durable record Section 18.3's release gate ("evaluations without a valid immutable input manifest accepted: 0") depends on for audit integrity — had no database-layer tenant backstop at all before this, despite carrying a real `tenantId` column since its first migration.
- No new secrets, no new external dependencies, no performance concern beyond the established pattern's own (a single indexed equality check on an insert-only table).

### Known gaps

- **`communication_messages`/`communication_templates` still have no RLS** — newly named by this slice's own fresh audit, not previously tracked anywhere. Service-level shape not yet audited; real follow-up work.
- **`policy_change_impact_assessments` still has no RLS** — same audit finding. Its owning service (`PolicyChangeImpactService`) already has a `DataSource` injected, but see Decisions for why it's still real work, not a one-line wrap.
- **`case_policy_bindings`/`case_policy_snapshots` still have no RLS** — corrected understanding this slice: `PolicyEvaluationService` *does* have injected repositories (M5-006's dev log entry was wrong to say it has none), so converting it to `runInTenantContext` is mechanical: swap three injected repositories for one `DataSource`. The real remaining work is `PolicyChangeImpactService.assessOneCase()`'s shared bare reads across two different-tenant-context callers (see Decisions) — that needs a method-shape change, not just a constructor swap.
- **`provider_operation_intents`/`provider_authorization_grants` still have no RLS** — unchanged from M5-006's own Known gap; several methods don't have `tenantId` in scope today.
- **`evaluation/runner.ts`'s own direct fixture inserts still aren't RLS-audited** — unchanged, consistent Known gap repeated since M5-004.
- **RBAC roles and the Section 14.2 data-disposition workflow remain unstarted** — unchanged from M5-006's own Next safe step.

### Next safe step

`policy_change_impact_assessments` (via `PolicyChangeImpactService`, which already has a `DataSource`) is the next-cheapest remaining table — its own two-different-tenant-context complexity is now understood and scoped (see Decisions), unlike when M5-004/M5-006 first deferred it as part of an undifferentiated "expensive" group. `communication_messages`/`communication_templates` need their own service-shape audit first (not yet done). `case_policy_bindings`/`case_policy_snapshots` and `provider_operation_intents`/`provider_authorization_grants` remain the two largest remaining table groups, both needing real service refactors. Not started; awaiting direction.

## M5-008: PostgreSQL row-level security for `policy_change_impact_assessments`

### Status

Implemented and verified, including a real live run that exercises the actual production call chain (`PolicyActivationService.withdraw()` → `PolicyChangeImpactService.assessImpact()` → `assessOneCase()`) against the real `mortgage_app` role. Extends RLS to Section 10.6's dry-run comparison record — one row per case a policy activation or withdrawal potentially affects.

Chosen as M5-007's own named "next-cheapest remaining table," continuing the user's "繼續" delegation. `PolicyChangeImpactService.assessOneCase()` shared bare `CasePolicyBinding`/`CasePolicySnapshot`/`PolicyChangeImpactAssessment` reads/writes across two callers needing different tenant contexts: `assessImpact()`'s catalog-wide cross-tenant candidate scan vs. `assessImpactForCase()`'s single-tenant lookup — the exact complexity M5-007 flagged as the real remaining work (not a missing `DataSource`, which the service already had). Fixed with the same bypass-for-discovery-then-per-item-context split `WebhookDispatchService`'s due-delivery scan already established: `assessOneCase` now takes an `EntityManager` parameter instead of owning its own repositories, and each caller supplies its own context.

### Acceptance criterion

A non-superuser connection (`mortgage_app`, M5-003) with no tenant context, or a different tenant's context, sees zero rows on `policy_change_impact_assessments` — even against a real row the actual production code path produced — while the owning tenant's context sees exactly its own row. Proven at the database layer (a 6-test RLS proof spec) and, more importantly for this slice, at the real-service layer: a standalone script drove the genuine `PolicyActivationService.withdraw()` → `assessImpact()` → `assessOneCase()` chain end to end against `mortgage_app` (not a superuser connection, and not the isolated RLS-policy spec, which only proves the table's policy works, not that the refactored service code is wired to it correctly), producing a real `REQUIRES_REEVALUATION` assessment, then confirmed invisible under a fabricated other-tenant session and fully visible under its own, directly against Postgres.

### Implementation

- `src/database/migrations/1787132677787-PolicyChangeImpactAssessmentTenantIsolation.ts` (new) — same `ENABLE`/`FORCE ROW LEVEL SECURITY` + `tenant_isolation` policy shape as every prior RLS migration; direct `tenantId` column, no join needed.
- `src/policy/policy-change-impact.service.ts` — constructor no longer takes `CasePolicyBinding`/`CasePolicySnapshot`/`PolicyChangeImpactAssessment` repositories (only `PolicyApplicability`, catalog data with no tenant scoping, stays a bare injected repository); `assessOneCase` is now `private async assessOneCase(manager: EntityManager, loanCase: LoanCase, context): Promise<...>`, using `manager.getRepository(...)` for all three tables. `assessImpact()`'s per-case loop wraps each `assessOneCase` call in `runInTenantContext(dataSource, loanCase.tenantId, ...)` — narrower than the candidate-discovery bypass above it, scoped to exactly the case being assessed. `assessImpactForCase()` now does its `LoanCase` lookup and `assessOneCase` call inside one shared `runInTenantContext`, a minor simplification (previously two separate calls).
- One direct-construction call site updated (`policy-activation.service.spec.ts`) — dropped the three removed constructor arguments.
- `src/policy/policy-change-impact-assessment-tenant-isolation.spec.ts` (new) — the RLS proof, 6 tests mirroring `evaluation-manifest-tenant-isolation.spec.ts`'s pattern. Needed a real `PolicyVersion`→`PolicySourceRevision`→`PolicySource`→`Jurisdiction` fixture chain (not just a random UUID) because `PolicyChangeImpactAssessment.policyVersionId` carries a real foreign key — the first RLS proof spec in this series to need a referenced-entity fixture chain rather than only the row under test.
- `src/database/migrations/schema-migrations.spec.ts` — new revert test, same shape as every prior one. No new table, so the "applies every migration" test's table list needed no change.

### Affected files

- `src/database/migrations/1787132677787-PolicyChangeImpactAssessmentTenantIsolation.ts` (new), `schema-migrations.spec.ts`
- `src/policy/policy-change-impact.service.ts`, `policy-change-impact-assessment-tenant-isolation.spec.ts` (new)
- `src/policy/policy-activation.service.spec.ts`
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Bypass scoped to only the cross-tenant candidate scan, not the whole `assessImpact()` loop.** Each case's own binding/snapshot read and assessment write runs under that specific case's own tenant context (`runInTenantContext(loanCase.tenantId)`), not the bypass — minimizing the bypass's blast radius to exactly the one query that's genuinely cross-tenant by design (finding which cases across all tenants a jurisdiction/product match), the same principle `WebhookDispatchService` already established.
- **`case_policy_bindings`/`case_policy_snapshots` still deliberately not given their own RLS policy in this slice**, even though `assessOneCase` now reads them through a real `EntityManager` inside `runInTenantContext`. Wrapping is harmless today (no policy exists on those tables yet, so the session variable has no observable effect) and becomes protective automatically whenever that table group gets its own migration — but adding that migration itself is separate, larger scope (also requires converting `PolicyEvaluationService`, per M5-007's own corrected understanding) and wasn't attempted here.
- **Wrote a standalone verification script exercising the real service call chain under `mortgage_app`, beyond the isolated RLS-policy spec.** `policy-activation.service.spec.ts` (the only existing integration coverage for this code path) connects via `DATABASE_URL`'s own superuser role, so it proves functional correctness but not RLS — it would pass identically whether or not the refactor's `runInTenantContext`/`runWithRlsBypass` calls were wired correctly at all. Given this slice's core risk was exactly that wiring (a method-shape change spanning two call sites), a real run against the restricted role was the only way to catch a wiring mistake the way M5-004's `Promise.all` bug or M5-005's retry-classification bug were both caught live rather than in a bypassed spec.

### Errors and fixes

- **The standalone verification script initially failed to compile under `ts-node` with `TS2591: Cannot find name 'process'` / `'node:crypto'`, even though `npm run evaluate` (an existing, working `ts-node` script in the same project) succeeded under identical invocation.** Isolated by testing a byte-identical copy of the working script (succeeded) and a trivial one-line new file (failed identically to the real script) — confirmed environment/tooling-specific to fresh, previously-uncompiled files in this session, not anything about the script's own content. Not a project configuration defect (untouched project files build and test cleanly throughout, via `nest build`/`jest`, neither of which showed this issue) — worked around for this one throwaway script with an explicit `/// <reference types="node" />` directive. Script deleted after use; not part of this commit.
- **The verification script's own fixture setup (not production code) initially inserted a `LoanCase` with a bare, unwrapped `save()` call, hitting the exact RLS rejection this whole series exists to enforce** (`new row violates row-level security policy for table "loan_cases"`) — a bug in the throwaway script, not the service under test; fixed by wrapping that one insert in `runInTenantContext`, matching how real production code creates cases.

### Verification

```text
npm run lint / npm run build / npm run lint:check
  all passed clean

Fresh scratch stack (m5008verify, ports 5443/7234):
  DATABASE_URL=... npx jest schema-migrations.spec.ts --runInBand
    26/26 passed (25 -> 26: +1 new revert test), run on a virgin
    cluster first

  migration:run applied PolicyChangeImpactAssessmentTenantIsolation1787132677787
    cleanly on top of EvaluationManifestTenantIsolation1787130439264

  DATABASE_URL=... npx jest policy-change-impact-assessment-tenant-isolation.spec.ts
  policy-activation.service.spec.ts check-policy-change-impact.tool.spec.ts --runInBand
    19/19 passed against the real mortgage_app role (after fixing the
    new spec's own missing PolicyVersion relation-chain entities and FK
    fixture, both errors caught on the very first run)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent
    65 suites / 440 tests passed (64/433 -> 65/440: +1 new suite,
    +7 tests)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    3 suites / 27 tests passed, unchanged from M5-007

Manual live verification — a standalone script exercising the real
PolicyActivationService.withdraw() -> PolicyChangeImpactService
.assessImpact() -> assessOneCase() chain against the real mortgage_app
role (not a superuser connection):
  seeded a real tenant/jurisdiction/policy source/revision/RELEASED
  version/applicability row, created a real case, evaluated it (real
  CasePolicyBinding/CasePolicySnapshot), then withdrew the version —
  the real code path produced one REQUIRES_REEVALUATION assessment,
  confirmed both in the withdraw() return value and via a direct
  Postgres query on a separate admin connection

  queried the real assessment row as mortgage_app: a fabricated
  other-tenant session (inside an explicit transaction, SET LOCAL) saw
  zero rows despite the row existing; the real tenant's own session
  saw exactly its own 1 row

  scratch stack torn down (docker compose down -v) after verification;
  the throwaway verification script and its temporary package.json
  entry were both removed before committing
```

### Security, privacy, cost, and compatibility

- Closes a real gap: `policy_change_impact_assessments` — Section 10.6's own advisory dry-run record — now has a database-layer tenant backstop, and the refactor closing it was verified against the actual refactored service code path under the restricted role, not just an isolated table-policy proof.
- No new secrets, no new external dependencies, no performance concern beyond the established pattern's own (a single indexed equality check; the bypass-scoped-to-discovery-only design keeps the audited cross-tenant surface as narrow as it was before this slice).

### Known gaps

- **`case_policy_bindings`/`case_policy_snapshots` still have no RLS** — unchanged; converting `PolicyEvaluationService` (mechanical, per M5-007's corrected understanding) plus adding the migration itself remains separate, not-yet-attempted work.
- **`communication_messages`/`communication_templates` still have no RLS** — unchanged from M5-007's own Known gap; service-level shape not yet audited.
- **`provider_operation_intents`/`provider_authorization_grants` still have no RLS** — unchanged; several methods don't have `tenantId` in scope today.
- **`evaluation/runner.ts`'s own direct fixture inserts still aren't RLS-audited** — unchanged, consistent Known gap repeated since M5-004.
- **RBAC roles and the Section 14.2 data-disposition workflow remain unstarted** — unchanged.

### Next safe step

`communication_messages`/`communication_templates` are the next table group needing a service-shape audit before scoping (not yet done — unlike `policy_change_impact_assessments`, whose complexity M5-007 had already scoped in advance). `case_policy_bindings`/`case_policy_snapshots` (mechanical `PolicyEvaluationService` conversion, now well understood) and `provider_operation_intents`/`provider_authorization_grants` (real `tenantId`-threading work) remain the two largest table groups. Not started; awaiting direction.

## M5-009: PostgreSQL row-level security for `communication_messages`/`communication_templates`

### Status

Implemented and verified, including a real live run driving the actual `CommunicationMessageService.draft()` → `CommunicationDeliveryService.deliver()` chain against the real `mortgage_app` role. Extends RLS to Section 9.4's `draft_information_request`/`send_information_request` backing tables.

Chosen as M5-008's own named "next table group needing a service-shape audit," continuing the "继续" delegation. The audit found a three-way split, not one uniform shape: `CommunicationMessageService.draft()` was mechanical (`tenantId` already an explicit parameter, just needed the `@InjectRepository` pair swapped for a `DataSource` and wrapped); `CommunicationDeliveryService.deliver()` had a bare, unwrapped initial read with **no** `tenantId` parameter at all, but its one real caller (`send_information_request`'s tool wrapper) already had a genuine `tenantId` in its `ToolContext` and simply discarded it — a real, fixable gap, not a design question; `CommunicationApprovalService.approve()` also has no `tenantId` parameter, but — unlike `deliver()` — has *no* caller anywhere in production code to define what a threaded-through signature should even look like, so it was left alone and named as a known gap instead of guessed at.

### Acceptance criterion

A non-superuser connection (`mortgage_app`, M5-003) with no tenant context, or a different tenant's context, sees zero rows on `communication_messages`/`communication_templates` — even against real rows the actual production code path produced — while the owning tenant's context sees exactly its own rows. Proven at the database layer (a 6-test RLS proof spec covering both tables together) and at the real-service layer: a standalone script drove the genuine `CommunicationMessageService.draft()` → `CommunicationDeliveryService.deliver()` chain against `mortgage_app`, producing a real `SENT` message, then confirmed invisible under a fabricated other-tenant session and fully visible under its own, directly against Postgres.

### Implementation

- `src/database/migrations/1787148432002-CommunicationTenantIsolation.ts` (new) — same `ENABLE`/`FORCE ROW LEVEL SECURITY` + `tenant_isolation` policy shape as every prior RLS migration, applied to both tables (each has its own direct `tenantId` column, no join needed).
- `src/communications/communication-message.service.ts` — constructor swapped from two `@InjectRepository`s to `@InjectDataSource()`; `draft()`'s template read and message write now run inside one `runInTenantContext` transaction.
- `src/communications/communication-delivery.service.ts` — `deliver()` gained a `tenantId: string` first parameter; its previously-bare initial `CommunicationMessage` lookup and its already-wrapped update+outbox-write now run inside one shared `runInTenantContext` transaction (a minor simplification, mirroring M5-008's `assessImpactForCase` merge), rather than a bare read followed by a separately-wrapped write.
- `src/agent-runtime/tools/send-information-request.tool.ts` — `execute(_context, args)` renamed to `execute({ tenantId }, args)`, now threading the tool's own real `ToolContext.tenantId` into `deliver(tenantId, args.communicationMessageId)` instead of discarding it.
- `src/communications/communication-tenant-isolation.spec.ts` (new) — the RLS proof, covering both tables in one spec (they're created together in every real fixture), 6 tests mirroring the established pattern.
- Four direct-construction call sites updated for `CommunicationMessageService`'s new single-argument constructor (`communication-message.service.spec.ts`, `communication-delivery.service.spec.ts`, `draft-information-request.tool.spec.ts`); five `.deliver(message.id)` call sites in `communication-delivery.service.spec.ts` updated to `.deliver(TENANT_ID, message.id)`; `send-information-request.tool.spec.ts`'s mock assertion updated to expect the threaded `tenantId` argument.
- `src/database/migrations/schema-migrations.spec.ts` — new revert test, same shape as every prior one. No new table, so the "applies every migration" test's table list needed no change.

### Affected files

- `src/database/migrations/1787148432002-CommunicationTenantIsolation.ts` (new), `schema-migrations.spec.ts`
- `src/communications/communication-message.service.ts` (+`.spec.ts`), `communication-delivery.service.ts` (+`.spec.ts`), `communication-tenant-isolation.spec.ts` (new)
- `src/agent-runtime/tools/send-information-request.tool.ts` (+`.spec.ts`), `draft-information-request.tool.spec.ts`
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Fixed `deliver()`'s missing `tenantId` parameter in this same slice rather than deferring it alongside `approve()`.** The two looked identical at first glance (both bare reads, both missing `tenantId`), but `deliver()` has a real, well-defined caller (`sendInformationRequestTool`, which already carries a genuine `ToolContext.tenantId` — it was simply being discarded as `_context`) while `approve()` has none at all. Threading a parameter through to a real, already-correct caller is a mechanical fix; inventing a signature for a method nothing calls yet would be guessing at a design decision that isn't this slice's to make.
- **`CommunicationApprovalService.approve()` and `communication_approvals` left entirely untouched, named as a known gap rather than silently left inconsistent.** Once `communication_messages` has RLS, `approve()`'s own bare `CommunicationMessage` lookup will now correctly return zero rows under the restricted role (it never sets any tenant context) — this is a direct, disclosed consequence of this migration, not a new bug this slice introduces, and it's the same fail-closed direction every other unwrapped read of an RLS-protected table already takes. Since nothing in production calls `approve()` today (it isn't a registered Agent tool, by the service's own design comment, and has no REST endpoint), this fail-closed behavior has no live effect — but it's recorded explicitly so a future caller doesn't discover it by surprise.
- **Wrote a standalone verification script exercising the real `draft()` → `deliver()` chain under `mortgage_app`**, the same reasoning as M5-008: `communication-message.service.spec.ts`/`communication-delivery.service.spec.ts` (the existing integration coverage) connect via `DATABASE_URL`'s own superuser role, so they prove functional correctness but not RLS wiring. Neither `draft_information_request` nor `send_information_request` is in `AGENT_ALLOWED_TOOLS` yet (a pre-existing gap, not something this slice changes), so there is no live-HTTP path to drive this through the running API the way M5-005/M5-006/M5-007 did — the standalone script is the equivalent proof for a code path that exists and works but isn't wired into the live workflow yet.

### Errors and fixes

- **The verification script's own fixture setup (not production code) initially inserted a `CommunicationTemplate` with a bare, unwrapped `save()` call, hitting the exact RLS rejection this slice exists to enforce.** A bug in the throwaway script, not the service under test — fixed by wrapping that insert in `runInTenantContext`, the same class of script-authoring mistake (and the same fix) as M5-008's live-verification script hit with its own `LoanCase` fixture.
- **The same script then failed with `EntityMetadataNotFoundError: No metadata for "OutboxEvent"` the first time `deliver()` reached its `writeOutboxEvent` call**, since the script's own `DataSource` hadn't registered that entity — fixed by adding `OutboxEvent` to the script's entity list. Not a production code issue; the real app's `DataSource` already registers every entity globally.

### Verification

```text
npm run lint / npm run build / npm run lint:check
  all passed clean

Fresh scratch stack (m5009verify, ports 5443/7234):
  DATABASE_URL=... npx jest schema-migrations.spec.ts --runInBand
    27/27 passed (26 -> 27: +1 new revert test), run on a virgin
    cluster first

  migration:run applied CommunicationTenantIsolation1787148432002
    cleanly on top of PolicyChangeImpactAssessmentTenantIsolation1787132677787

  DATABASE_URL=... npx jest communication-tenant-isolation.spec.ts
  communication-message.service.spec.ts communication-delivery.service.spec.ts
  draft-information-request.tool.spec.ts send-information-request.tool.spec.ts
  --runInBand
    21/21 passed against the real mortgage_app role, first attempt

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent
    66 suites / 447 tests passed (65/440 -> 66/447: +1 new suite,
    +7 tests)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    3 suites / 27 tests passed, unchanged from M5-008 (neither
    communication tool is e2e-reachable yet)

Manual live verification — a standalone script exercising the real
CommunicationMessageService.draft() -> CommunicationDeliveryService
.deliver() chain against the real mortgage_app role (not a superuser
connection):
  created a real APPROVED template, drafted a real ROUTINE message
  against it, delivered it — the real code path produced a genuine
  SENT message with a real deliveryReference, confirmed via a direct
  Postgres query on a separate admin connection

  queried the real message row as mortgage_app: a fabricated
  other-tenant session (inside an explicit transaction, SET LOCAL) saw
  zero rows despite the row existing; the real tenant's own session
  saw exactly its own 1 row

  scratch stack torn down (docker compose down -v) after verification;
  the throwaway verification script and its temporary package.json
  entry were both removed before committing
```

### Security, privacy, cost, and compatibility

- Closes two real gaps at once: `communication_messages`/`communication_templates` now have a database-layer tenant backstop, and `send_information_request`'s own tool wrapper now correctly threads the real tenant context it already had instead of silently discarding it — a genuine tightening of that tool's own boundary, independent of RLS.
- No new secrets, no new external dependencies, no performance concern beyond the established pattern's own (indexed equality checks on both tables).

### Known gaps

- **`communication_approvals` still has no RLS, and its sole writer (`CommunicationApprovalService.approve()`) has no `tenantId` in its signature** — unlike `deliver()`, there is no real caller today to define a correct threaded-through signature; inventing one wasn't attempted. Once RLS lands on `communication_messages`, `approve()`'s own bare read will correctly fail closed under the restricted role — disclosed, not a silent surprise.
- **`case_policy_bindings`/`case_policy_snapshots` still have no RLS** — unchanged; converting `PolicyEvaluationService` (mechanical, per M5-007's corrected understanding) plus adding the migration itself remains separate, not-yet-attempted work.
- **`provider_operation_intents`/`provider_authorization_grants` still have no RLS** — unchanged; several methods don't have `tenantId` in scope today.
- **Neither `draft_information_request` nor `send_information_request` is registered in `AGENT_ALLOWED_TOOLS`** — a pre-existing gap this slice found but did not create or attempt to close; wiring them in is a separate scope decision (what triggers a communication in the current graph, and whether `send_information_request` should require the same kind of interrupt-for-review `check_policy_change_impact`/manual-review paths already use).
- **`evaluation/runner.ts`'s own direct fixture inserts still aren't RLS-audited** — unchanged, consistent Known gap repeated since M5-004.
- **RBAC roles and the Section 14.2 data-disposition workflow remain unstarted** — unchanged.

### Next safe step

`case_policy_bindings`/`case_policy_snapshots` (via `PolicyEvaluationService`, mechanical per M5-007's corrected understanding — swap three injected repositories for one `DataSource`, wrap `evaluate()`) is now the best-understood remaining table group. `provider_operation_intents`/`provider_authorization_grants` need their own audit of exactly which methods lack `tenantId` (not yet done in the same detail this slice gave `communication_approvals`). `communication_approvals` itself is now scoped but deliberately not attempted (see Known gaps). Not started; awaiting direction.

## M5-010: PostgreSQL row-level security for `case_policy_snapshots`/`case_policy_bindings`

### Status

Implemented and verified, including a real live workflow run — this table group's writer (`evaluate_policy`) is, unlike M5-008/M5-009's tools, genuinely registered in `AGENT_ALLOWED_TOOLS` and reachable through the live API, so this slice could use the same real-HTTP-driven live verification M5-005/M5-006/M5-007 used, not a standalone script. Completes RLS for `PolicyEvaluationService`'s own tables, the piece M5-004/M5-006 originally deferred as part of an undifferentiated "expensive" group and M5-007/M5-008 progressively corrected the understanding of.

Chosen as M5-009's own named "best-understood remaining table group," continuing the "继续" delegation. Before writing any code, re-read `PolicyEvaluationService.evaluate()` in full and found something the prior "mechanical conversion" framing had missed: its concurrency-recovery `catch` block (Section 20's exit evidence H) reads back a winning row after a real unique-constraint violation on a partial unique index. Wrapping the *entire* method in one shared transaction — the pattern used for every other service in this series — would abort that transaction the moment the constraint violation fires, and every subsequent statement in the same transaction (including the catch block's own recovery reads) would fail with "current transaction is aborted, commands ignored until end of transaction block" — the identical class of bug M5-002/M5-003 already found and fixed for `DROP ROLE`'s dependent-objects error (a JS `try/catch` cannot rescue an aborted Postgres transaction; only ending that transaction can).

### Acceptance criterion

A non-superuser connection (`mortgage_app`, M5-003) with no tenant context, or a different tenant's context, sees zero rows on `case_policy_snapshots`/`case_policy_bindings` — even against real rows the actual production code path produced — while the owning tenant's context sees exactly its own rows. Proven at the database layer (a 6-test RLS proof spec covering both tables, including the FK from `CasePolicyBinding.policySnapshotId` to `CasePolicySnapshot`) and at the real-service layer: `policy-evaluation.service.spec.ts`'s full suite — including its two dedicated concurrency tests exercising the real unique-constraint race — passed unchanged after the refactor, and a real case driven through the real LangGraph agent runtime under `NODE_ENV=production`/`APP_DATABASE_URL` produced real snapshot and binding rows, confirmed invisible under a fabricated other-tenant session and fully visible under its own, directly against Postgres.

### Implementation

- `src/database/migrations/1787151654923-CasePolicyTenantIsolation.ts` (new) — same `ENABLE`/`FORCE ROW LEVEL SECURITY` + `tenant_isolation` policy shape as every prior RLS migration, applied to both tables (each has its own direct `tenantId` column, no join needed). `policy_catalog_generation` — the third table `PolicyEvaluationService` reads — is deliberately untouched: a single global row with no `tenantId` column at all, genuinely not tenant-scoped data.
- `src/policy/policy-evaluation.service.ts` — constructor's `CasePolicySnapshot`/`CasePolicyBinding` repositories replaced with `@InjectDataSource()`; `PolicyCatalogGeneration`'s own repository stays injected as-is (that table will never need RLS). Every `CasePolicySnapshot`/`CasePolicyBinding` touch point in `evaluate()`, `persistSnapshot()`, and `invalidateActiveBinding()` now goes through its own separate `runInTenantContext` call — deliberately many small transactions, not one large one, preserving the exact transactional granularity the original bare-repository-call code already had (see Decisions for why that granularity is load-bearing, not incidental).
- Six direct-construction call sites updated for the new 3-argument constructor (`resolver, dataSource, generationRepository`): `evaluation-report.ts`, `case-conditions.activities.spec.ts`, `runner.spec.ts`, `lending-operations-agent-runtime.spec.ts`, `policy-activation.service.spec.ts`, `policy-evaluation.service.spec.ts`.
- `src/policy/case-policy-tenant-isolation.spec.ts` (new) — the RLS proof, covering both tables in one spec, 6 tests mirroring the established pattern; needed a real `CasePolicySnapshot` fixture row before each `CasePolicyBinding` fixture (the real FK between them), the same class of setup `policy-change-impact-assessment-tenant-isolation.spec.ts` (M5-008) needed for its own FK.
- `src/database/migrations/schema-migrations.spec.ts` — new revert test, same shape as every prior one. No new table, so the "applies every migration" test's table list needed no change.

### Affected files

- `src/database/migrations/1787151654923-CasePolicyTenantIsolation.ts` (new), `schema-migrations.spec.ts`
- `src/policy/policy-evaluation.service.ts`, `case-policy-tenant-isolation.spec.ts` (new)
- `src/evaluation-report.ts`, `src/workflows/case-conditions.activities.spec.ts`, `src/evaluation/runner.spec.ts`, `src/agent-runtime/langgraph/lending-operations-agent-runtime.spec.ts`, `src/policy/policy-activation.service.spec.ts`, `src/policy/policy-evaluation.service.spec.ts`
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Many small `runInTenantContext` calls per `evaluate()` invocation, not one large transaction wrapping the whole method.** The obvious, simpler-looking choice (matching every other service converted in this series) would silently break the concurrency-recovery `catch` block the moment a real race occurred — see Status. Verified this reasoning empirically, not just by inspection: ran `policy-evaluation.service.spec.ts`'s full suite, including both concurrency tests, against the refactored code before considering the slice done; all 15 tests passed on the first attempt, including the two that deliberately race `Promise.all([evaluate(), evaluate()])` against the same case. This also means `evaluate()`'s operations are no less atomic than they were before this slice (each step already committed independently in the original bare-repository code) — RLS-wrapping didn't change the atomicity properties, only added the required session-context setting to each already-separate step.
- **`policy_catalog_generation` deliberately left with its bare, unconverted `@InjectRepository`.** It's a single global counter row with no `tenantId` column and no tenant-scoping need — wrapping its read in `runInTenantContext` would be harmless (per that helper's own documented behavior on unprotected tables) but adds nothing, so it was left as the simplest correct form rather than converted for uniformity's own sake.

### Errors and fixes

None encountered — every test run (migration revert, RLS proof spec, the full `policy-evaluation.service.spec.ts` suite including concurrency tests, every other spec touching `PolicyEvaluationService`, full suite, e2e) passed on its first attempt, and the live workflow run succeeded without needing any fixes. The careful upfront analysis of the concurrency-recovery path (see Status/Decisions) is what made this possible — the risk was identified and designed around before writing the refactor, not discovered by a failing test afterward.

### Verification

```text
npm run lint / npm run build / npm run lint:check
  all passed clean

Fresh scratch stack (m5010verify, ports 5443/7234):
  DATABASE_URL=... npx jest schema-migrations.spec.ts --runInBand
    28/28 passed (27 -> 28: +1 new revert test), run on a virgin
    cluster first

  migration:run applied CasePolicyTenantIsolation1787151654923 cleanly
  on top of CommunicationTenantIsolation1787148432002

  DATABASE_URL=... npx jest case-policy-tenant-isolation.spec.ts
  policy-evaluation.service.spec.ts --runInBand
    15/15 passed against the real mortgage_app role (for the RLS proof
    spec) and DATABASE_URL (for the concurrency-sensitive unit spec —
    both concurrency tests passed on the first attempt after the
    refactor), first attempt overall

  DATABASE_URL=... TEMPORAL_ADDRESS=... npx jest policy-activation
  .service.spec.ts case-conditions.activities.spec.ts lending-operations
  -agent-runtime.spec.ts runner.spec.ts --runInBand
    40/40 passed, every other spec touching PolicyEvaluationService

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent
    67 suites / 454 tests passed (66/447 -> 67/454: +1 new suite,
    +7 tests)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    3 suites / 27 tests passed, unchanged from M5-009

Manual live verification — real API + real Temporal worker under
NODE_ENV=production with APP_DATABASE_URL (the mortgage_app role):
  seeded a real tenant + API-client credential, created a real case,
  started its real workflow — evaluate_policy genuinely ran (it IS
  wired into AGENT_ALLOWED_TOOLS, unlike M5-008/M5-009's tools), the
  case landed in CONDITIONS_OPEN with a real income-discrepancy
  condition opened

  queried case_policy_snapshots/case_policy_bindings directly against
  Postgres as mortgage_app: a real row existed on each table
  referencing the real caseId; a fabricated other-tenant session
  (inside an explicit transaction, SET LOCAL) saw zero rows on both
  tables despite the rows existing; the real tenant's own session saw
  exactly its own 1 row on each

  scratch stack torn down (docker compose down -v) after verification
```

### Security, privacy, cost, and compatibility

- Closes the `PolicyEvaluationService` table group specifically named as deferred since M5-004, completing RLS for the entire policy-evaluation subsystem (resolved versions, context hash, resolution reasons, and the case-to-snapshot binding Section 10.3/10.4/14.1 all describe).
- The careful concurrency analysis is also an independent correctness confirmation, not just a security one: it re-verified (by actually running the tests, not just reading the code) that Section 20's exit evidence H — "a catalog activation racing with evaluation produces one internally consistent, auditable result" — still holds after this refactor.
- No new secrets, no new external dependencies, no performance concern beyond the established pattern's own; if anything, more separate transactions per `evaluate()` call than before is a minor connection-count cost, traded for correctness under the concurrency-recovery constraint.

### Known gaps

- **`communication_approvals` still has no RLS** — unchanged from M5-009's own Known gap.
- **`provider_operation_intents`/`provider_authorization_grants` still have no RLS** — unchanged; several methods don't have `tenantId` in scope today.
- **`evaluation/runner.ts`'s own direct fixture inserts still aren't RLS-audited** — unchanged, consistent Known gap repeated since M5-004.
- **RBAC roles and the Section 14.2 data-disposition workflow remain unstarted** — unchanged.

### Next safe step

`provider_operation_intents`/`provider_authorization_grants` are now the last remaining table group from the original M5-004/M5-006 "expensive" deferral, and need the same kind of careful per-method audit this slice and M5-009 gave their own services before scoping — several methods are already known to lack `tenantId`, but exactly which ones, and whether any share the same transactional-granularity subtlety `PolicyEvaluationService` turned out to have, isn't yet mapped in detail. `communication_approvals` remains scoped but deliberately deferred (no real caller to define a threaded-through signature). RBAC roles and the data-disposition workflow remain the other honestly-buildable options, both still without charter-provided scaffolding. Not started; awaiting direction.

## M5-011: Webhook SSRF guard (Section 16.4)

### Status

Implemented and verified, including a real live run against the running API. Closes Section 16.4's own named threat-model item — a webhook `targetUrl` (Section 14.1) is caller-supplied and this codebase's own worker process later makes a real outbound HTTP request to it (`webhook-dispatch.service.ts`, M4-004); an unrestricted target lets a caller aim the platform's own network position at an internal address (a database, a cloud metadata endpoint, another tenant's simulator) that isn't reachable from outside.

Chosen from the user's own follow-up list after a "項目還差什麼沒做" (what's left in the project) survey — the most self-contained of the three items named (the other two, wiring the four dormant Agent tools and building the ten entirely-missing ones plus M4's sandbox/webhook-inspector, are separately scoped next).

### Acceptance criterion

A `targetUrl` that is a literal private/reserved-range IP, or a hostname that resolves (via a real DNS lookup, every returned address checked) to one, is rejected with a clean `400` at registration (`POST /v1/webhook-endpoints`) and never reaches a live delivery attempt; a target whose DNS answer changes to a private address *after* registration is still caught immediately before the next dispatch attempt, not just once at registration time. A real public target is unaffected. Proven with 34 unit tests covering the full IANA special-purpose IPv4 registry and the security-relevant IPv6 ranges, a real-Postgres integration test proving `WebhookEndpointService.create()` persists nothing when blocked, a real-HTTP-receiver test proving `attemptDelivery` records a normal `FAILED` attempt (not a crash) when the guard fires at dispatch time, and a live run against the real running API confirming all of this end-to-end.

### Implementation

- `src/webhooks/webhook-url-guard.ts` (new) — `assertPublicWebhookTarget(targetUrl)`: parses the URL, rejects a non-`http`/`https` scheme, resolves the hostname (or accepts a literal IP directly) and checks *every* returned address against the full blocked-range list — a literal IPv4 CIDR-mask check against the IANA special-purpose registry (loopback, RFC1918 private ranges, link-local/cloud-metadata `169.254.0.0/16`, carrier-grade NAT, documentation ranges, multicast, reserved), and an IPv6 check (loopback, unique-local `fc00::/7`, link-local `fe80::/10`, multicast, with IPv4-mapped `::ffff:0:0/96` addresses unwrapped and re-checked against the IPv4 rules). A hostname that fails to resolve at all is rejected with a clean error rather than letting a raw Node `ENOTFOUND` propagate.
- `src/webhooks/webhook-endpoint.service.ts` — `create()` calls the guard before persisting; a `WebhookTargetBlockedError` becomes a `BadRequestException`.
- `src/webhooks/webhook-dispatch.service.ts` — `attemptDelivery()` re-calls the guard immediately before every `fetch()`, inside the same `try` block that already records a `FAILED` attempt on any other delivery error — no new failure-handling path needed, the guard's rejection flows through the existing one.
- `src/webhooks/webhook-endpoints.controller.ts` — added `@ApiBadRequestResponse` documenting the new rejection, matching `cases.controller.ts`'s existing pattern.
- `src/webhooks/webhook-url-guard.spec.ts` (new) — 34 tests: every blocked IPv4/IPv6 range, a boundary case one address outside a blocked range (proving a real CIDR mask check, not a naive prefix match), real-hostname resolution (`localhost` blocked, `example.com` allowed), scheme rejection, malformed-URL rejection, and the unresolvable-hostname fail-closed path.

### Affected files

- `src/webhooks/webhook-url-guard.ts` (new), `webhook-url-guard.spec.ts` (new)
- `src/webhooks/webhook-endpoint.service.ts` (+`.spec.ts`), `webhook-dispatch.service.ts` (+`.spec.ts`), `webhook-endpoints.controller.ts`
- `test/webhooks.e2e-spec.ts`
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **No environment-variable or config-driven bypass for private targets.** The obvious way to unbreak the existing dispatch spec's own local-HTTP-receiver fixtures (`127.0.0.1`, exactly what the guard now correctly blocks) would be a `WEBHOOK_ALLOW_LOOPBACK_TARGETS`-style flag read at runtime — rejected because it would be a real, shippable escape hatch that could be set (accidentally or not) in a real deployment, weakening the guard for everyone, not just tests. Used `jest.spyOn` to stub the guard for the pre-existing tests whose actual subject is delivery mechanics (signing, retry/backoff, final-failure) and is orthogonal to SSRF, restoring the real implementation for one new dedicated test proving the guard's dispatch-time integration point actually works. No bypass exists in shipped code at all.
- **Re-checked at dispatch time, not only once at registration.** A target validated safe at registration can have its DNS answer change by the time a retried delivery actually fires — deliveries retry with backoff over minutes to hours (`MAX_ATTEMPTS`/`backoffMs`), a real window for a DNS answer to legitimately change (or be adversarially rebound). A single point-in-time check would miss that entirely.
- **Every resolved address checked, not just the first.** `dns.lookup(..., { all: true })` can return multiple addresses for one hostname; checking only the first would let an attacker publish a hostname with one public and one private A/AAAA record and rely on whichever check happened to run first.
- **Redirect-following left as a named, not attempted, residual gap.** The guard validates the registered/dispatched URL string itself; the actual `fetch()` call still follows redirects with Node's platform default, so a receiver that returns a redirect to a private address after passing the initial check is not covered. Documented in the guard's own class comment rather than silently out of scope — a real fix would mean either disabling redirect-following entirely (a `fetch()` behavior change with its own compatibility question) or re-validating each redirect target, and wasn't attempted this slice.
- **`test/webhooks.e2e-spec.ts`'s fixture URL changed from `partner.example.com` to `example.com`.** The subdomain never resolved (confirmed directly — a real `ENOTFOUND`), which cost nothing before this slice (nothing validated it) but would now make every endpoint-creation test in that file fail closed. Changed to the bare, genuinely resolvable domain rather than inventing a bypass for the e2e suite specifically.

### Errors and fixes

- **The guard's own first test run failed 2 of 34 tests**: an IPv6 literal target like `http://[2606:4700:4700::1111]/hook` was being treated as an unresolvable hostname instead of a literal IP address. Root cause: `URL#hostname` keeps the surrounding `[...]` brackets for an IPv6 literal (confirmed directly — `new URL('http://[::1]/x').hostname === '[::1]'`), but `net.isIPv6()` and `dns.lookup()` both expect the bare form; the bracketed string matched neither `isIPv4`/`isIPv6`, so it silently fell through to the hostname-resolution branch and failed with `ENOTFOUND`. Fixed by stripping the brackets before the literal-IP check. Found by the test suite itself, not live traffic — exactly the value of writing the boundary/edge-case tests before considering the guard done.
- **`test/webhooks.e2e-spec.ts`'s fixture domain (`partner.example.com`) doesn't resolve** — found while reasoning through which existing tests the new registration-time guard would affect, confirmed with a direct DNS lookup before touching any test code (not discovered by a failing test) — fixed by switching to the bare `example.com`, which does.

### Verification

```text
npm run lint / npm run build / npm run lint:check
  all passed clean (after fixing the IPv6-bracket bug)

npx jest webhook-url-guard.spec.ts (no DB needed, pure + real-DNS tests)
  34/34 passed

Fresh scratch stack (ssrfverify, ports 5443/7234), fully migrated:
  npx jest webhook-url-guard.spec.ts webhook-endpoint.service.spec.ts
  webhook-dispatch.service.spec.ts webhook-tenant-isolation.spec.ts --runInBand
    50/50 passed (was 15 before this slice: +1 registration-rejection
    test, +1 dispatch-time-rejection test, +34 new guard-spec tests
    minus the 1 file overlap already counted)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent
    68 suites / 490 tests passed (67/454 -> 68/490: +1 new suite,
    +36 tests)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    3 suites / 27 tests passed (confirms the webhooks.e2e-spec.ts
    fixture-URL fix works)

Manual live verification — real API under NODE_ENV=production with
APP_DATABASE_URL (the mortgage_app role):
  seeded a real tenant + API-client credential, then four real
  POST /v1/webhook-endpoints calls:
    cloud-metadata address (169.254.169.254) -> 400, exact blocked-range
      message
    RFC1918 private address (10.0.0.5) -> 400
    "localhost" (resolves to ::1 and 127.0.0.1 on this machine) -> 400,
      both resolved addresses named in the error
    a real public target (example.com) -> 201, endpoint created normally

  scratch stack torn down (docker compose down -v) after verification
```

### Security, privacy, cost, and compatibility

- Closes Section 16.4's own named threat-model item — a real, working SSRF guard where none existed before, at both the point of least cost to check (registration, before anything is ever persisted) and the point that actually matters (immediately before each real outbound request).
- No new secrets, no new external dependencies (the range-checking logic is hand-written against Node's built-in `net`/`dns` modules, not a new package) — a live DNS lookup already happens implicitly for any hostname target (the `fetch()` call itself resolves it), so this doesn't introduce network I/O that wasn't already happening, only moves and duplicates a small part of it earlier for validation.
- Registration and each dispatch attempt now cost one extra DNS round trip; negligible against the existing `DELIVERY_TIMEOUT_MS` (10s) budget.

### Known gaps

- **Redirect-following is not covered** — see Decisions. A receiver could still redirect a validated request to a private address post-hoc.
- **IPv6 range coverage is the common, security-relevant subset, not exhaustive** — documented directly in the guard's own class comment (loopback, link-local, unique-local, multicast, IPv4-mapped covered; some rarer reserved ranges like NAT64's `64:ff9b::/96` are not).
- Every other M5 Known gap (`communication_approvals`, `provider_operation_intents`/`provider_authorization_grants` RLS, RBAC, data-disposition workflow) is unchanged by this slice.

### Next safe step

The other two items from the same "什麼沒做" follow-up: wiring the four dormant-but-built Agent tools (`draft_information_request`, `send_information_request`, `escalate_to_reviewer`, `check_policy_change_impact`) into `AGENT_ALLOWED_TOOLS`/the graph's actual node topology, and — separately, much larger — the ten entirely-unbuilt Section 9.4 tools plus M4's sandbox scenario library and webhook inspector. Not started; awaiting direction on scope and ordering.

## M5-012: Wire `draft_information_request` into the LangGraph runtime

### Status

Implemented and verified, including a real live workflow run. Closes one of the four dormant-but-built Agent tools from the same "項目還差什麼沒做" follow-up — `draft_information_request` now genuinely fires whenever `resolveOutcomeNode` opens a real condition, drafting a real `CommunicationMessage` explaining it to the borrower.

Chosen after investigating all four dormant tools and finding each needed a real, non-mechanical design decision before it could be wired in (see the M5-011 entry's own "什麼沒做" follow-up context) — the user was asked to choose a direction twice: first confirming that none of the four could be safely mechanically wired, then, after `check_policy_change_impact` (the initially-proposed "safest" candidate) turned out to have a structural blocker of its own — its required `policyVersionId` argument only ever exists inside `PolicyActivationService`, never in a per-case Agent run's own state, so there is no point in the existing graph where it could even be called meaningfully — switching to `draft_information_request` instead, which fits naturally right after `create_condition` succeeds.

### Acceptance criterion

A real condition being opened by the Agent graph also drafts a real, persisted `CommunicationMessage` — using the DSL evaluator's own evidence-backed reason string, not a fabricated narrative — classified `PROTECTED` (no communication template is seeded anywhere in this codebase, so `freeformContent` is the only honest option, and Section 6.4 always classifies free-form content `PROTECTED`) and left `AWAITING_APPROVAL`. Nothing is ever sent — `send_information_request` remains deliberately unwired, since a `PROTECTED` message needs human approval first and no path for that exists in the Temporal workflow yet. Proven with a direct unit assertion against a real database, the full existing test suite passing unchanged elsewhere, and a real case driven through the real API and Temporal worker under `NODE_ENV=production` with the non-superuser role, producing a real message row confirmed tenant-isolated directly against Postgres.

### Implementation

- `src/agent-runtime/langgraph/lending-operations-agent-runtime.ts` — `resolveOutcomeNode`'s `create_condition` success path now also calls `draft_information_request` (a new step, consuming its own step-budget unit — each real tool invocation gets one, matching every other node's existing convention), using `EMAIL`/`en-US`/`BORROWER` as the only defaults available (no case-level channel/locale/contact-preference model exists yet — a named, not silently assumed, gap) and freeform content built from the matched rule's own condition code and the DSL evaluator's real reason string. A `FAILURE` outcome routes to manual review, the same pattern `create_condition`'s own failure handling already uses. The drafted message's id is threaded into `proposedAction.arguments.communicationMessageId` for observability (visible in the case timeline, `case-timeline.service.ts`'s existing `AGENT_RUN` entries).
- `LendingOperationsAgentRuntimeDeps` gained `messageService: CommunicationMessageService`; `CaseConditionsActivitiesDeps`/`EvaluationRunnerDeps` gained the same, threaded through from `worker.ts`/`evaluation-report.ts`/`evaluation/runner.ts`.
- `src/worker.module.ts` — imports `CommunicationsModule`, which it never had before this slice (a real, if narrow, gap: `CommunicationMessageService` was genuinely unavailable in the Temporal worker process until now, even though `draft_information_request`'s tool code has existed since M3-012).
- `src/evaluation/runner.ts`'s `cleanupEvaluationRun` now also deletes `communication_messages` — the evaluation corpus harness's own fixture cases open conditions too, so it now produces real message rows that need cleaning up like every other side effect it already tracks.
- Five direct-construction call sites updated for the new `messageService` dependency (`case-conditions.activities.spec.ts` — four separate call sites in one file, `lending-operations-agent-runtime.spec.ts`, `evaluation/runner.spec.ts`, plus the two production files above).

### Affected files

- `src/agent-runtime/langgraph/lending-operations-agent-runtime.ts` (+`.spec.ts`)
- `src/workflows/case-conditions.activities.ts` (+`.spec.ts`)
- `src/worker.module.ts`, `src/worker.ts`
- `src/evaluation/runner.ts` (+`.spec.ts`), `src/evaluation-report.ts`
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **`check_policy_change_impact` abandoned mid-investigation, not forced into the graph.** Its own `policyVersionId` argument has no source anywhere in a per-case Agent run's state — only `PolicyActivationService` (a completely different, system-triggered call path) ever knows which version just activated. Wiring it in would have meant either duplicating the assessment record `PolicyChangeImpactService.assessImpact()`'s existing catalog-wide scan already writes, or restructuring that method's internals (recently hardened under RLS in M5-008) to route through Agent runs for uncertain benefit. Surfaced to the user rather than picked unilaterally — a genuine architecture question, not an implementation detail.
- **`send_information_request` deliberately left unwired.** Sending a `PROTECTED` message needs human approval (`CommunicationApprovalService.approve()`) first, and there is no signal/resume path in the Temporal workflow for that today — building one is real, separately-scoped orchestration work (a new Temporal signal, a decision about whether/how the workflow pauses), not something to improvise as a side effect of wiring in `draft_information_request`.
- **Each tool call consumes its own step-budget unit.** `resolveOutcomeNode` previously consumed exactly one step (`stepped`) covering its one tool call (`create_condition`); adding a second real tool call without a second `consumeStep` would have under-counted budget usage relative to every other node's own one-step-per-tool-call convention (`checkCompletenessNode`, `evaluatePolicyNode`). No mid-node budget re-check was added before the second call, matching this file's own existing granularity (budget is checked once per node entry, not per tool call within a node) — harmless in this graph's specific topology since `resolveOutcomeNode` is the last node before `END` regardless.

### Errors and fixes

- **Both directly-affected specs failed on their very first run** with `TypeORMError: Entity metadata for CommunicationMessage#template was not found` — the same relation-metadata gap found repeatedly throughout this M5 series (a spec's `DataSource` must declare every entity a queried entity has a `@ManyToOne` relation to, even when that related entity is never queried directly). Fixed by adding `CommunicationTemplate` to five specs' entity lists (`lending-operations-agent-runtime.spec.ts`, `case-conditions.activities.spec.ts`, `runner.spec.ts`, plus proactively fixing the same latent gap in `evaluation-report.ts`, which hadn't been exercised yet but would have hit the identical error the first time anything in it actually drafted a message).
- **The full test suite's first run showed 2 failures** (`case-conditions.workflow.spec.ts`, `webhook-dispatch.service.spec.ts`) that looked alarming at first — both unrelated to any file this slice touched. Isolated by re-running each failing spec alone: both passed cleanly standalone, and a full second run of the entire suite (490/490) also passed cleanly — confirmed as a one-off flake under `--runInBand` load (likely real-Temporal-replay/real-local-HTTP-server resource contention now that the suite has grown to 68 files), not a regression, by reproducing a clean run rather than assuming either way.

### Verification

```text
npm run lint / npm run build / npm run lint:check
  all passed clean

Fresh scratch stack (toolwire, ports 5443/7234), fully migrated:
  DATABASE_URL=... TEMPORAL_ADDRESS=... npx jest lending-operations-agent
  -runtime.spec.ts case-conditions.activities.spec.ts --runInBand
    24/24 passed (after fixing the CommunicationTemplate relation gap)

  DATABASE_URL=... npx jest runner.spec.ts --runInBand
    6/6 passed

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent
    first run: 488/490 (2 unrelated flakes, see Errors and fixes) —
    both isolated specs passed alone; full re-run: 68 suites / 490 tests
    passed cleanly (67/454 -> 68/490 baseline was already correct before
    this slice's own +36 from M5-011; this slice added 0 new suites,
    only extended existing ones, so the same 68/490 total confirms
    nothing regressed)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    3 suites / 27 tests passed, unchanged

Manual live verification — real API + real Temporal worker under
NODE_ENV=production with APP_DATABASE_URL (the mortgage_app role):
  seeded a real tenant + API-client credential, created a real case,
  started its real workflow — the case timeline showed a real AGENT_RUN
  entry listing all four tool attempts as SUCCESS: check_case_
  completeness, evaluate_policy, create_condition,
  draft_information_request

  queried communication_messages directly against Postgres as
  mortgage_app: a real row existed with the exact expected shape
  (PROTECTED, AWAITING_APPROVAL, BORROWER/EMAIL, rendered content
  containing the real condition code and the DSL evaluator's own real
  reason string); a fabricated other-tenant session (inside an explicit
  transaction, SET LOCAL) saw zero rows despite the row existing; the
  real tenant's own session saw exactly its own 1 row

  scratch stack torn down (docker compose down -v) after verification
```

### Security, privacy, cost, and compatibility

- Closes one of four Agent tools that were built, tested, and completely dormant — the Agent graph now genuinely exercises a fourth registered tool, not three, and the borrower-facing remediation message this codebase's own launch scenario (Section 7.1) describes is now a real, persisted artifact instead of something only the DSL evaluator's own condition description implied.
- Correctly fails closed on the approval boundary: a `PROTECTED` message can never be sent by this slice's own change, since `send_information_request` stays unwired and `CommunicationApprovalService.approve()` still has no caller — the new capability is strictly additive (a real draft exists now) without weakening Section 6.4's exact-approval requirement at all.
- No new secrets, no new external dependencies, no performance concern beyond one more `runInTenantContext` transaction per condition-opening run (the same cost profile every other tool call in this graph already has).

### Known gaps

- **`send_information_request`, `escalate_to_reviewer`, and `check_policy_change_impact` remain unwired** — see Decisions for why each is a real, separate design question, not a mechanical follow-up to this slice.
- **No case-level channel/locale/contact-preference model** — `EMAIL`/`en-US`/`BORROWER` are hardcoded defaults, not derived from any real per-case or per-tenant preference (none exists).
- Every other M5 Known gap (`communication_approvals` RLS, `provider_operation_intents`/`provider_authorization_grants` RLS, RBAC, data-disposition workflow, redirect-following on the SSRF guard) is unchanged by this slice.

### Next safe step

The ten entirely-unbuilt Section 9.4 tools (`inspect_documents`, `fetch_income_evidence`, `fetch_asset_evidence`, `fetch_credit_evidence`, `check_identity_consistency`, `calculate_qualified_income`, `calculate_dti`, `calculate_ltv`, `compare_evidence`, `publish_case_update`) plus M4's sandbox scenario library and webhook inspector remain the large, separately-scoped item from the same "什麼沒做" follow-up — not started. Building an approval-gated send path for `send_information_request` (a real Temporal signal/resume design) is the natural next increment specifically in the communications area, now that a real `PROTECTED` message actually exists to approve. Not started; awaiting direction.

## M5-013: Webhook inspector (Section 8.8/15.5's developer sandbox) + a narrow, environment-gated SSRF loopback exception

### Status

Implemented and verified, including a real live run against the running API and worker. Closes the webhook-inspection half of the third "什麼沒做" follow-up item ("M4 sandbox/webhook inspector: 章程要求的sandbox場景庫、webhook inspector工具都沒做") — a real local HTTP listener that registers itself as a genuine webhook endpoint and verifies every inbound delivery's real HMAC signature live, per the user's explicit "move on to the remaining item (M4 sandbox/webhook inspector)" instruction. The sandbox scenario library (Section 8.8's other named item) is a separate, not-yet-started piece — see Known gaps.

### Acceptance criterion

Running `npm run webhook-inspector` against a real API server that is not `NODE_ENV=production` seeds a tenant, mints an API-client credential, starts a local listener, and successfully registers that listener as a real webhook endpoint via `POST /v1/webhook-endpoints` — which requires the SSRF guard (M5-011) to admit a loopback target, something it could not do before this slice. Real events (case creation, workflow-run progress) then arrive at the listener as genuinely signed deliveries, each independently re-verified with `webhook-signer.ts`'s own `verifyWebhookSignature` — the identical code a real external integration would run — and printed with a clear VALID/INVALID verdict. The same guard still rejects a loopback target under `NODE_ENV=production` exactly as before this slice, proven by a dedicated integration test. Proven with 8 new unit tests on the guard's loopback exception, 2 new real-Postgres integration tests (production still rejects, development allows), and a full live run: a real API + real Temporal worker + the real inspector process, driving a real case and workflow run through to 7 correctly-ordered, signature-VALID deliveries, cross-checked directly against Postgres (`webhook_deliveries.status = SUCCEEDED` for all 7).

### Implementation

- `src/webhooks/webhook-url-guard.ts` — added `AssertPublicWebhookTargetOptions.allowLoopbackForSandbox`: when `true`, loopback addresses only (`127.0.0.0/8`, `::1`, and their IPv4-mapped forms — a new `isLoopback()` check) are exempted from the blocked-address filter; every other blocked range (RFC1918 private, link-local/cloud-metadata, carrier-grade NAT, documentation, multicast, reserved) is unaffected regardless of the option. Added `isSandboxEnvironment(nodeEnv: NodeEnvironment): boolean` — the single exported source of truth both real call sites use to decide when the option may ever be `true` (`Development`/`Test` only, explicitly excluding `Staging`/`Production` per Section 19.3's staging-mirrors-production posture). The option itself carries no environment check of its own, staying a pure function of its inputs.
- `src/webhooks/webhook-endpoint.service.ts` / `webhook-dispatch.service.ts` — both now inject `ConfigService`, read `NODE_ENV`, and pass `allowLoopbackForSandbox: isSandboxEnvironment(nodeEnv ?? NodeEnvironment.Development)` into the guard call.
- `client/webhook-inspector.ts` (new) — following `client/quickstart.ts`'s established pattern (direct-SQL tenant seed, `ApiClientService` used directly to mint a credential, all other traffic through the real generated OpenAPI client): starts a local `http` listener, registers it as a real webhook endpoint subscribed to all 12 known `OutboxEventType`s, and logs each inbound delivery's id, type, timestamp, real signature-verification verdict, and payload as it arrives.
- `package.json` — added the `webhook-inspector` script (`ts-node -r tsconfig-paths/register client/webhook-inspector.ts`), alongside the existing `quickstart` script.

### Affected files

- `src/webhooks/webhook-url-guard.ts` (+`.spec.ts`)
- `src/webhooks/webhook-endpoint.service.ts` (+`.spec.ts`), `webhook-dispatch.service.ts` (+`.spec.ts`)
- `client/webhook-inspector.ts` (new)
- `package.json`, `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Loopback only, never a blanket "skip SSRF checks in dev" flag.** The inspector's actual need is narrow (register `http://127.0.0.1:<port>/inbound`) — a blanket dev-mode bypass would also quietly re-admit RFC1918 private ranges and the cloud-metadata address in every developer's local environment, which is a strictly bigger, unnecessary weakening for a need that loopback alone satisfies. `isLoopback()` is a dedicated check, not a reuse/relaxation of any existing range check.
- **Environment-gated via a single exported `isSandboxEnvironment()` helper, not duplicated inline `NODE_ENV` checks at each call site.** Two call sites (`WebhookEndpointService.create()`, `WebhookDispatchService.attemptDelivery()`) both need the same decision; duplicating the environment logic would risk one of them drifting (e.g. someone later adding `Staging` to one check but not the other) without either call site's own test suite catching it. A single function both call is the single point where that logic can be verified once and trusted everywhere.
- **`Staging` deliberately excluded alongside `Production`.** The charter (Section 19.3) treats staging as mirroring production's security posture, not a relaxed environment — verified this is still true today by reading `env.validation.ts` directly rather than assuming, and confirmed `isSandboxEnvironment` returns `false` for both in a dedicated test.
- **The inspector mints its own second tenant/credential rather than accepting one via CLI args.** Matches `quickstart.ts`'s own existing convention exactly (no new pattern introduced) and keeps the tool fully self-contained — running it never requires already having a valid API-client token.
- **No sandbox scenario library built in this slice.** Section 8.8/15.5 names two separate sandbox capabilities — webhook inspection (this slice) and a scenario library (curated demo cases/fixtures for exploring the platform) — investigated only enough to confirm they are genuinely separate pieces of work with no shared implementation, not attempted together. Left as a named Known gap rather than silently expanding this slice's scope.

### Errors and fixes

- **`client/webhook-inspector.ts`'s first draft referenced `endpointSecret` inside the `createServer` request-handler closure before its `const` declaration later in the same function.** This would have worked at runtime regardless (the handler only ever fires after registration completes and assigns the value), but is a fragile use-before-define pattern that a later refactor could easily break silently. Fixed by declaring `let endpointSecret = ''` before `createServer(...)`, with a comment explaining why the ordering is safe, assigning it only after registration succeeds.
- No test-suite failures were hit for the SSRF-relaxation code itself — all 8 new `webhook-url-guard.spec.ts` tests and both new `webhook-endpoint.service.spec.ts` integration tests (production-still-rejects, development-allows) passed on first attempt.

### Verification

```text
npm run lint / npm run build / npm run lint:check
  all passed clean

Fresh scratch stack (m5013verify, ports 5443/7234), fully migrated:
  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent
    68 suites / 500 tests passed (490 -> 500: +8 webhook-url-guard.spec.ts
    loopback-exception tests, +2 webhook-endpoint.service.spec.ts
    production/development integration tests)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    3 suites / 27 tests passed, unchanged

Manual live verification — real API (NODE_ENV unset, defaults to
development) + real Temporal worker against a separate scratch stack
(sandbox013, ports 5443/7234):
  ran the actual `npm run webhook-inspector` command for real — it
  seeded a tenant, minted a credential, started listening on
  127.0.0.1:4500/inbound, and successfully registered itself as a real
  webhook endpoint (confirming the SSRF loopback exception works in the
  live running server, not just in isolated tests)

  minted a second API-client credential for the same tenant, created a
  real case, then started its real workflow run

  the inspector's own live log showed exactly 7 deliveries, in order,
  all signature VALID: loan_case.created, workflow_run.started,
  evidence.updated x3 (INCOME/CREDIT/DOCUMENT), condition.opened
  (VERIFY_INCOME_DISCREPANCY), workflow_run.waiting_for_review

  cross-checked directly against Postgres: all 7 corresponding
  webhook_deliveries rows show status = SUCCEEDED

  live processes (API, worker, inspector) terminated and both scratch
  stacks (sandbox013, m5013verify) torn down (docker compose down -v)
  after verification
```

### Security, privacy, cost, and compatibility

- Production and staging behavior is provably unchanged — `isSandboxEnvironment()` returns `false` for both, and a dedicated integration test proves `NODE_ENV=production` still rejects a loopback target with the same error as before this slice.
- The exception is scoped to loopback only, never any other blocked range, in development/test environments only — the narrowest carve-out that makes the sandbox tool possible, not a general SSRF relaxation.
- No new secrets, no new external dependencies, no data persisted beyond what `quickstart.ts`'s own established pattern already persists (a demo tenant, an API-client credential, whatever cases/workflow runs are driven through it manually).

### Known gaps

- **Section 8.8/15.5's sandbox *scenario library* (curated demo cases/fixtures) is not built** — a genuinely separate piece of work from webhook inspection, not attempted this slice (see Decisions).
- Every other M5/M5-011/M5-012 Known gap (`communication_approvals`/`provider_operation_intents`/`provider_authorization_grants` RLS, RBAC, data-disposition workflow, redirect-following on the SSRF guard, `send_information_request`/`escalate_to_reviewer`/`check_policy_change_impact` unwired) is unchanged by this slice.

### Next safe step

The ten entirely-unbuilt Section 9.4 tools and the sandbox scenario library remain the largest not-yet-started items from the original "什麼沒做" follow-up. Building the approval-gated `send_information_request` path (a real Temporal signal/resume design) remains the natural next increment in the communications area. Not started; awaiting direction.

## M5-014: PostgreSQL row-level security for `provider_authorization_grants`/`provider_operation_intents`

### Status

Implemented and verified, including a real live run under `NODE_ENV=production` with the restricted `mortgage_app` role. Extends M5-002 through M5-010's row-level-security pattern to Section 11.5's dispatch-path tables — chosen autonomously (per the user's "你決定下一步做什麼") as the highest-value remaining M5 item: unlike most of this series, this was a genuinely *live* gap, not a dormant one — `dispatchProviderRequest` exercises these two tables on every real income/credit/document/asset/identity fetch, and both services used plain `@InjectRepository` with zero tenant scoping until this slice.

### Acceptance criterion

A query against either table with no tenant context and no explicit bypass sees zero rows, even when real rows exist for other tenants. `ProviderAuthorizationService.revoke()` and `ProviderOperationIntentService`'s four `mark*()` methods — previously the only methods in the whole M5 series with *zero* tenant scoping in their SQL, not even an unenforced one — now genuinely cannot affect a different tenant's row even if a future caller passed the wrong id. The real dispatch path (`dispatchProviderRequest`, exercised on every evidence fetch) continues to work correctly end-to-end under the restricted `mortgage_app` role. Proven with 9 new tests (a dedicated `provider-platform-tenant-isolation.spec.ts`, mirroring `consent-tenant-isolation.spec.ts`'s own real-Postgres-as-`mortgage_app` pattern, plus one new `schema-migrations.spec.ts` cumulative-revert step), the full existing test suite passing unchanged elsewhere, and a real quickstart run through a real API + real Temporal worker under `NODE_ENV=production`, followed by direct Postgres queries proving cross-tenant isolation on the real rows it created.

### Implementation

- `src/database/migrations/1787161668146-ProviderPlatformTenantIsolation.ts` (new) — same `ENABLE`/`FORCE ROW LEVEL SECURITY` + `tenant_isolation` policy shape as every prior slice in this series. Both tables have direct `tenantId` columns, no join needed.
- `src/provider-platform/provider-authorization.service.ts` — converted from `@InjectRepository(ProviderAuthorizationGrant)` to `@InjectDataSource()`, mirroring `ConsentService`'s own established shape (a per-method-call `runInTenantContext`, not one long-lived transaction spanning the external provider call). `issue()` and `revalidate()`'s read now run inside tenant context (`revalidate()` already took `expected.tenantId` as an argument — directly reusable). `revoke(grantId)` — previously the only method in this whole file with **zero** tenant scoping in its SQL — gained a required `tenantId` parameter; it has no real caller anywhere in this codebase yet (a pre-existing, honestly-documented gap, same shape as `ProviderOperationIntentService`'s undriven `RECONCILING`/`CANCELLED` states), so this is a signature-only change with no production call site to update.
- `src/provider-platform/provider-operation-intent.service.ts` — same conversion. `prepare()` now runs in tenant context. `markDispatched`/`markSucceeded`/`markFailedFinal`/`markOutcomeUnknown` — all four previously bare `update({ id }, ...)` calls with no tenant predicate at all — now each require a `tenantId` parameter (a shared private `setState()` helper avoids repeating the `runInTenantContext` wrapping four times).
- `src/provider-platform/dispatch-provider-request.ts` — its four `mark*()` call sites updated to pass `intent.tenantId` (the returned `ProviderOperationIntent` value already carries it — no new argument threading needed anywhere upstream).
- `src/provider-platform/provider-platform-tenant-isolation.spec.ts` (new) — 9 tests: no-context-sees-zero, each tenant sees only its own grant/intent, a direct id lookup for another tenant's grant returns nothing, an `UPDATE` against another tenant's grant/intent (the exact query shape `revoke()`/`mark*()` now issue) affects zero rows without erroring, an `INSERT` claiming a different tenant than the session context is rejected by Postgres itself, and bypass mode sees everything.
- `src/database/migrations/schema-migrations.spec.ts` — the file's own cumulative revert-chain test suite required one new step (inserted first, mirroring the file's own documented maintenance instruction: "grows... whenever a new migration is added"), since `undoLastMigration()` always reverts whichever migration is currently latest — without this addition, every subsequent revert-chain assertion silently checks the *wrong* migration's effects, one position off.
- Six direct-construction call sites updated for the new `DataSource`-based constructors and the `mark*()`/`revoke()` signature changes: `evaluation-report.ts`, `case-conditions.activities.spec.ts`, `evaluation/runner.spec.ts`, `dispatch-provider-request.spec.ts`, `provider-authorization.service.spec.ts`, `provider-operation-intent.service.spec.ts`.

### Affected files

- `src/database/migrations/1787161668146-ProviderPlatformTenantIsolation.ts` (new)
- `src/database/migrations/schema-migrations.spec.ts`
- `src/provider-platform/provider-authorization.service.ts` (+`.spec.ts`), `provider-operation-intent.service.ts` (+`.spec.ts`), `dispatch-provider-request.ts` (+`.spec.ts`)
- `src/provider-platform/provider-platform-tenant-isolation.spec.ts` (new)
- `src/evaluation-report.ts`, `src/workflows/case-conditions.activities.spec.ts`, `src/evaluation/runner.spec.ts`
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **`communication_approvals` deliberately still out of scope**, for the exact reason M5-009's own migration comment already recorded: no `tenantId` column of its own (would need a join through `communication_messages`, unlike either table this slice touches), and its sole writer (`CommunicationApprovalService.approve()`) still has no real caller anywhere in this codebase to define what a threaded-through signature should look like — confirmed this is still true today (a fresh grep, not trusting the prior slice's note at face value, same methodology M5-007/M5-009 themselves used), not just assumed unchanged. Revisit together with the approval-gated `send_information_request` path.
- **Multiple short transactions, not one long transaction spanning the external provider call.** `dispatchProviderRequest` interleaves grant/intent writes with a call to `adapter.submit()` — every adapter in this codebase is synthetic/in-process today, but wrapping the *entire* dispatch in one `runInTenantContext` would hold a Postgres transaction open across whatever a real future provider adapter's network call takes, a bad pattern regardless of whether today's synthetic adapters would ever expose it. Followed `ConsentService`'s own already-established shape instead: each service method opens its own short transaction, exactly where a write actually happens.
- **`revalidate()`'s existing manual `entity.tenantId !== expected.tenantId` check was left in place, not removed as newly-redundant.** Once the read itself is tenant-scoped, that specific branch becomes unreachable *given a correctly-configured non-superuser role* — but this codebase's own `TypeOrmOptions` warning (`APP_DATABASE_URL is not set in production — falling back to DATABASE_URL... if superuser, RLS provides no real protection`) documents a real, not hypothetical, misconfiguration this check still catches. Kept as the same kind of defense-in-depth the codebase already explicitly reasons about elsewhere, not new speculative validation.
- **`revoke(tenantId, grantId)`'s new `tenantId` parameter has no real caller to thread it from.** Added anyway, matching every other method's own convention, rather than leaving the method's SQL tenant-unscoped until some future caller shows up — the same reasoning `ProviderOperationIntentService`'s own doc comment already applies to its undriven `RECONCILING`/`CANCELLED` states: an honest, documented gap in what calls the method, not a gap in what the method itself enforces once called.

### Errors and fixes

- **The first full-suite run showed 27 failures, all in `schema-migrations.spec.ts`.** Root cause: that file's own cumulative revert-chain tests call `undoLastMigration()` in strict sequence, one call per test, each test titled after the specific migration it expects to be reverting — adding a new latest migration without adding a matching new first revert test shifts every subsequent test's `undoLastMigration()` call to actually revert the *previous* test's migration instead, one position off, cascading through all 27 remaining revert-chain tests. Exactly the maintenance cost the file's own top-of-file comment already documents ("grows... whenever a new migration is added"), not a real regression — fixed by inserting a new first revert test for this slice's own migration, after which the full chain (29 tests now) passed cleanly.

### Verification

```text
npm run lint / npm run build / npm run lint:check
  all passed clean

Fresh scratch stack (m5014verify, ports 5443/7234), fully migrated:
  npx jest schema-migrations.spec.ts --runInBand
    first run: 1/28 passed, 27 failed (see Errors and fixes) — after
    inserting the missing revert-chain test: 29/29 passed

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent
    69 suites / 509 tests passed (500 -> 509: +1 new suite
    (provider-platform-tenant-isolation.spec.ts, 8 tests) +1 new
    schema-migrations.spec.ts revert-chain test)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    3 suites / 27 tests passed, unchanged

Manual live verification — real API + real Temporal worker under
NODE_ENV=production with APP_DATABASE_URL (the mortgage_app role):
  ran the real `npm run quickstart` script end-to-end: case creation,
  workflow start, three real evidence fetches (income/credit/document —
  each one a real dispatchProviderRequest call issuing a grant,
  preparing an intent, revalidating, dispatching, and marking SUCCEEDED,
  all now RLS-protected), a condition opened, Agent run, reviewer
  resolution, workflow completed — the whole real dispatch path works
  unchanged under the restricted role

  queried provider_authorization_grants/provider_operation_intents
  directly against Postgres as mortgage_app: the real tenant's own
  session (SET LOCAL app.current_tenant_id) saw its real 3 grants / 3
  SUCCEEDED intents; a fabricated other-tenant session saw zero rows
  despite the data existing; no tenant context at all also saw zero
  rows (fail closed); a superuser connection confirmed the real rows
  actually exist

  live processes terminated and the scratch stack torn down
  (docker compose down -v) after verification
```

### Security, privacy, cost, and compatibility

- Closes a genuinely live gap, not a dormant one: `dispatchProviderRequest` is exercised on every real income/credit/document/asset/identity fetch this codebase performs — before this slice, a direct query against either table (a compromised or buggy internal caller, not just a hostile external one) had no database-layer tenant boundary at all.
- `revoke()`/`mark*()` genuinely cannot affect a different tenant's row now, closing a real authorization gap that existed independent of RLS itself: those methods previously issued `UPDATE ... WHERE id = $1` with no tenant predicate whatsoever, relying entirely on the caller happening to pass the right id.
- No new secrets, no new external dependencies, no performance concern beyond one more short transaction per grant/intent write — the same cost profile every other RLS-converted service in this series already has.

### Known gaps

- **`communication_approvals` remains out of scope** — see Decisions.
- Every other M5 Known gap (RBAC, OIDC/FAPI 2.0, encrypted field/object boundaries, data-disposition workflow, `send_information_request`/`escalate_to_reviewer`/`check_policy_change_impact` unwired, sandbox scenario library) is unchanged by this slice.

### Next safe step

`communication_approvals` RLS, together with building the approval-gated `send_information_request` path that would finally give `CommunicationApprovalService.approve()` a real caller to define a `tenantId`-threaded signature for. RBAC and OIDC/FAPI 2.0 remain the largest untouched items in M5's own charter scope. Not started; awaiting direction.

## M5-015: Data-disposition review on consent revocation (Section 14.1/14.2)

### Status

Implemented and verified, including a real live run under `NODE_ENV=production` with the restricted `mortgage_app` role. Chosen autonomously (per the user's "繼續挑下一項," continuing from M5-014's own "you decide") — closes Section 14.2's own explicit, previously-Known-gap rule: "Consent revocation... opens a data-disposition review for evidence already collected under that consent." `data_disposition_tasks` (Section 14.1) did not exist in this codebase at all before this slice.

### Acceptance criterion

Revoking a case's consent (`POST /v1/loan-cases/{caseId}/consents` with `{action: "REVOKE"}`) opens a real, persisted `DataDispositionTask` row — `taskType=RETENTION_REVIEW`, `status=PENDING` — in the exact same database transaction as the revocation itself, referencing every `evidence_facts` row that existed for the case at that moment (a lineage snapshot, not a live query) and the id of the consent record that triggered it. The table is RLS-protected from the migration that creates it, matching every genuinely-new table in this series. Proven with a direct unit test on `DataDispositionService` (real evidence snapshot, zero-evidence case, `listForCase()`), a real-Postgres integration test on `ConsentService.revoke()` itself asserting the resulting task's exact shape, a dedicated tenant-isolation spec (`mortgage_app` role, same pattern as `consent-tenant-isolation.spec.ts`), and a real live run: a real case driven through `npm run quickstart` under `NODE_ENV=production`, its consent revoked through the real REST API, and the resulting task queried directly from Postgres, referencing all 3 real evidence records collected for that case.

### Implementation

- `src/database/enums/data-disposition.enum.ts` (new) — `DataDispositionTaskType` (`RETENTION_REVIEW`, `DELETION`, `ANONYMIZATION`, `LEGAL_HOLD` — only the first is ever created) and `DataDispositionTaskStatus` (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `VERIFIED` — only `PENDING` is ever reached), matching the charter's full vocabulary with the undriven states honestly declared, same shape as `ProviderOperationIntentStatus`'s own `RECONCILING`/`CANCELLED`.
- `src/database/entities/data-disposition-task.entity.ts` (new) — `tenantId`, `caseId`, `taskType`, `status`, `reason`, `triggeringConsentRecordId` (nullable — this slice's only trigger, no FK constraint declared), `affectedEvidenceFactIds` (jsonb array, the lineage snapshot), `createdAt`, `resolvedAt` (always null — no resolution workflow exists yet).
- `src/data-disposition/data-disposition.service.ts` (new) — `DataDispositionService` (`@InjectDataSource()`, same shape as `ConsentService`): `openRetentionReviewForRevokedConsent(manager, params)` takes an already-tenant-scoped `EntityManager` (not its own `runInTenantContext` call) so it can run inside `ConsentService.revoke()`'s own transaction — a revocation can never commit without also opening its required review, even across a process crash between the two writes. `listForCase(tenantId, caseId)` is an independent read, its own `runInTenantContext`.
- `src/data-disposition/data-disposition.module.ts` (new) — `@Global()`, same reasoning as `ConsentModule`.
- `src/consent/consent.module.ts` — imports `DataDispositionModule`.
- `src/consent/consent.service.ts` — `revoke()` now calls `dataDispositionService.openRetentionReviewForRevokedConsent(manager, {...})` right after marking the record revoked, before returning, inside the same `runInTenantContext` transaction.
- `src/database/migrations/1787162906507-DataDispositionTasks.ts` (new) — same shape as `ConsentRecords` (M5-005): table + enums + RLS, all in the migration that creates the table.
- `src/evaluation/runner.ts`'s `cleanupEvaluationRun` now also deletes `data_disposition_tasks` — the evaluation corpus harness's own fixture cases can revoke consent too, so it now produces real task rows needing the same cleanup every other side effect already gets.
- Incidentally discovered and fixed: `openapi/openapi.json`/`client/generated/schema.d.ts` had been stale since M5-005 shipped `POST .../consents` — the checked-in OpenAPI artifact's own description still claimed consents "is not yet built." Regenerated both (`npm run generate:openapi && npm run generate:client`) so the generated client can actually call the endpoint this slice's own live verification needed to drive.

### Affected files

- `src/database/enums/data-disposition.enum.ts` (new), `src/database/entities/data-disposition-task.entity.ts` (new)
- `src/data-disposition/data-disposition.service.ts` (+`.spec.ts`, new), `data-disposition.module.ts` (new), `data-disposition-tenant-isolation.spec.ts` (new)
- `src/consent/consent.module.ts`, `consent.service.ts` (+`.spec.ts`)
- `src/database/migrations/1787162906507-DataDispositionTasks.ts` (new), `schema-migrations.spec.ts`
- `src/evaluation/runner.ts` (+`.spec.ts`), `src/evaluation-report.ts`
- `src/provider-platform/provider-authorization.service.spec.ts`, `dispatch-provider-request.spec.ts`
- `src/workflows/case-conditions.activities.spec.ts`
- `openapi/openapi.json`, `client/generated/schema.d.ts`
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Opens a review, does not act on it.** The charter's own phrasing is "opens a data-disposition review," not "deletes" — matching Section 6.3's human-in-the-loop posture, a task is created and left `PENDING`; no automated deletion, anonymization, or verification runs against it. Building an actual resolution workflow (and the document/normalized-finding/cache/search-index/backup lineage traversal Section 14.2 separately names) is real, much larger, separately-scoped work — this codebase has none of those subsystems to traverse yet.
- **Runs inside `ConsentService.revoke()`'s own transaction, not a separate call afterward.** The charter frames the review as a direct, non-optional consequence of revocation, not an eventually-consistent side effect — a separate `runInTenantContext` call could succeed at revoking consent while failing (or never running) to open the review, silently violating the rule. One transaction makes that impossible.
- **`openRetentionReviewForRevokedConsent` takes a passed-in `EntityManager`, not its own `DataSource`+`runInTenantContext` call.** The only way to guarantee atomicity with `revoke()`'s own write. `listForCase()`, with no atomicity requirement of its own, uses the normal per-call `runInTenantContext` pattern instead — the same "manager for atomicity, DataSource+runInTenantContext for independent reads" split `recordEvidence`/`writeOutboxEvent` already use in `case-conditions.activities.ts`.
- **No FK constraint on `triggeringConsentRecordId`.** Every other honest-null/undriven field in this series (`ProviderAuthorizationGrant.consentRecordIds`, `EvaluationInputManifest`) stays a plain column, not a relation, when the referenced subsystem doesn't have a matching read need yet — no code today ever joins from a task back to its consent record, so a declared `@ManyToOne` would be unused ceremony, not a real guarantee (Postgres would still enforce referential integrity via a plain FK if I'd added one without the ORM relation, but nothing reads it that way either).
- **The stale-OpenAPI-artifact fix was done, not just noted.** It directly blocked this slice's own live verification (the generated client couldn't call `/consents` at all) and was a one-command regeneration with no manual editing — fixing it cost nothing extra and left the artifact honestly in sync with real endpoints again, matching Section 15.3's own "checked and published OpenAPI artifact" requirement. A larger, riskier fix would have been declined in favor of just noting the gap; this one was cheap and directly in the way.

### Errors and fixes

- **`provider-authorization.service.spec.ts` and `dispatch-provider-request.spec.ts` both failed to initialize** after adding `ConsentService`'s new `DataDispositionService` dependency, with `TypeORMError: Entity metadata for EvidenceFact#case was not found`, then (after adding `EvidenceFact`) `Entity metadata for LoanCase#tenant was not found` — the same relation-metadata gap found repeatedly throughout this whole M5 series, this time three levels deep (`EvidenceFact` → `LoanCase` → `Tenant`/`Jurisdiction`). Fixed by adding the full chain to `provider-authorization.service.spec.ts` (which genuinely calls `revoke()` in a real test). For `dispatch-provider-request.spec.ts`, which never calls `revoke()` at all, reverted the speculative `EvidenceFact`/`DataDispositionTask` additions entirely rather than chasing the relation chain for a path that's never exercised — the minimal-diff choice over blanket defensive registration.
- **The generated OpenAPI client couldn't call `/v1/loan-cases/{caseId}/consents` at all** — a TypeScript compile error (`Argument of type '"/v1/loan-cases/{caseId}/consents"' is not assignable to parameter of type 'PathsWithMethod<paths, "post">'`) while writing this slice's own live-verification script. Traced to the checked-in `openapi/openapi.json` predating M5-005's consents endpoint entirely (confirmed by reading the artifact's own stale description text, not just guessing) — fixed by regenerating both artifacts (see Decisions).
- **`schema-migrations.spec.ts`'s cumulative revert chain needed one new first step**, the same maintenance cost M5-014 already hit and documented — inserted before the existing chain, following the "DROP TABLE takes RLS with it" simpler style the file's own `ConsentRecords`-revert test already established for a genuinely-new-table migration.

### Verification

```text
npm run lint / npm run build / npm run lint:check
  all passed clean

Fresh scratch stack (m5015verify, ports 5443/7234), fully migrated:
  npx jest schema-migrations.spec.ts --runInBand
    30/30 passed (29 -> 30: +1 new first revert-chain step)

  npx jest data-disposition --runInBand
    2 suites / 10 tests passed (data-disposition.service.spec.ts,
    data-disposition-tenant-isolation.spec.ts)

  npx jest consent provider-authorization dispatch-provider-request
  case-conditions.activities runner.spec data-disposition --runInBand
    8 suites / 58 tests passed (after fixing the relation-metadata gap)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent
    71 suites / 520 tests passed (509 -> 520: +2 new suites, +11 tests)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    3 suites / 27 tests passed, unchanged

Manual live verification — real API + real Temporal worker under
NODE_ENV=production with APP_DATABASE_URL (the mortgage_app role):
  ran the real npm run quickstart — a real case with 3 real evidence
  facts (income/credit/document) collected

  revoked that case's consent through the real REST API (a one-off
  script using the now-regenerated typed client, since the stale
  artifact couldn't call the endpoint before this slice's own fix) —
  REVOKE succeeded, real revokedAt/revocationReason returned

  queried data_disposition_tasks directly against Postgres as
  mortgage_app: a real row existed — RETENTION_REVIEW, PENDING,
  triggeringConsentRecordId matching the real revoked consent record's
  id, affectedEvidenceFactIds listing all 3 real evidence record ids,
  reason text naming both — the real tenant's own session saw it; a
  fabricated other-tenant session saw zero rows despite the data
  existing; no tenant context at all also saw zero rows (fail closed);
  a superuser connection confirmed the real row actually exists

  live processes terminated and the scratch stack torn down
  (docker compose down -v) after verification
```

### Security, privacy, cost, and compatibility

- Closes a rule the charter states as a direct, non-optional consequence of consent revocation — not previously enforced at all (revocation only ever stopped new processing before this slice; evidence already collected had no review trail).
- Atomic with the revocation itself (same transaction) — the review can never be silently skipped by a crash between two separate writes.
- No new secrets, no new external dependencies, one extra `evidence_facts` read plus one insert per revocation — negligible, and revocation is not a hot path.
- The OpenAPI-artifact regeneration is a documentation/tooling fix with no runtime behavior change — the real endpoint worked identically before and after; only the generated client's ability to call it changed.

### Known gaps

- **No resolution workflow** — a task opens `PENDING` and stays there; nothing in this codebase advances it to `IN_PROGRESS`/`COMPLETED`/`VERIFIED`, and `DELETION`/`ANONYMIZATION`/`LEGAL_HOLD` task types are declared but never created.
- **No document/normalized-finding/cache/search-index/backup lineage** — Section 14.2's fuller "retention... traverses document, evidence, normalized finding, cache, search index, prompt, evaluation artifact, object, and backup lineage" is far larger than this slice; this codebase has none of those subsystems to traverse yet, so only `evidence_facts` is snapshotted.
- **No GraphQL/REST read surface** — `listForCase()` exists and is tested but has no controller/resolver calling it yet; Section 15.2's "data-disposition work" GraphQL surface and Section 20 M6's disposition queues remain unbuilt (that's explicitly M6 UI-milestone scope, not M5).
- Every other M5 Known gap (`communication_approvals` RLS, RBAC, OIDC/FAPI 2.0, encrypted field/object boundaries) is unchanged by this slice.

### Next safe step

`communication_approvals` RLS remains the last named M5-series table gap. RBAC and OIDC/FAPI 2.0 remain the largest untouched items in M5's own charter scope; a resolution workflow for `data_disposition_tasks` (closing a task, and the read surface to see open ones) is the natural next increment specifically in this area. Not started; awaiting direction.

## M5-016: Scenario catalog (Section 8.8/15.5's developer sandbox, the other named half)

### Status

Implemented and verified with a real live run. Closes the "scenario catalog"/"deterministic scenarios" item Section 8.8/15.5 names alongside webhook inspection (M5-013) and API fixtures/quickstart (M4-003) — the last of the three explicitly-named Developer Sandbox deliverables. Chosen autonomously (per the user's third consecutive "繼續挑下一項"), after concluding that the two other candidates surveyed — RBAC and the ten unbuilt Section 9.4 tools — aren't well-scoped right now: real RBAC per the charter's own data model (`users`/`tenant_memberships`, Section 14.1) is structurally tied to OIDC, which `ApiClient`'s own class comment already calls "its own, much larger, separately-scoped effort"; `calculate_dti`/`calculate_ltv`/`calculate_qualified_income` would require inventing financial-calculation methodology this codebase has no backing data model for (no appraised-value concept exists anywhere, for instance) — the same fabrication risk this project's own standing conventions warn against.

### Acceptance criterion

`npm run scenario-catalog` (or `-- <name>` for one scenario) drives six named, reproducible scenarios through the real REST API + Temporal worker, each asserting an *expected* outcome rather than just narrating one — covering every deterministic case/workflow outcome shape this codebase currently produces: straight-through approval, a policy-opened condition resolved by a real reviewer decision, a transient provider failure exhausting Temporal's retry policy, a terminal provider failure short-circuiting it, consent revoked before dispatch failing every evidence fetch closed, and a policy-applicability ambiguity that interrupts the case for review and is later resumed. A deliberately-broken assertion was verified to actually FAIL and exit non-zero (not silently pass) before being reverted, proving the catalog is real regression coverage, not narration. All six scenarios passed against a real API + Temporal worker on the first live run with no code changes needed, and again after the deliberate-failure round-trip.

### Implementation

- `client/scenario-catalog.ts` (new) — following `quickstart.ts`/`webhook-inspector.ts`'s established skeleton exactly (dotenv, direct-SQL tenant seed, `ApiClientService` directly for the credential, everything else through the real generated client). A `Scenario[]` registry, each with a `name`, a `description` printed before it runs, and a `run()` that throws on any expectation mismatch. `main()` runs every scenario (or one, via `process.argv[2]`) against one shared tenant/credential, prints PASS/FAIL with timing per scenario, and exits non-zero if any failed.
- Two shared polling helpers: `pollWorkflowToTerminal()` (Temporal's own execution status — `RUNNING` until `COMPLETED`/`FAILED`/etc., with an optional `onTick` callback so a scenario can react to a case-level status change mid-poll, e.g. submitting a review the moment a condition opens) and `pollCaseStatusUntil()` (the *case's* own application-level status — `CONDITIONS_OPEN`, `WAITING_FOR_REVIEW` — independent of workflow terminality, since the workflow stays `RUNNING` in Temporal's own terms while durably paused waiting for a signal).
- The `policy-ambiguity-unresolved-jurisdiction` scenario uses one more direct-SQL escape hatch (inserting a `NOT_COVERED` jurisdiction row, then updating it to `COVERED` after observing the interrupt) — no jurisdiction-management REST endpoint exists at all (confirmed by grepping `src/policy/` for `@Controller`, finding none), the same honest gap `quickstart.ts` already documents for tenant/API-client seeding, not a fabricated endpoint.
- `package.json` — added the `scenario-catalog` script alongside `quickstart`/`webhook-inspector`.

### Affected files

- `client/scenario-catalog.ts` (new)
- `package.json`, `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Real assertions, not narration.** `quickstart.ts` demonstrates a golden path and logs what happened; this catalog's entire value proposition is "these outcomes are guaranteed deterministic," so each scenario throws (via a small `assertEqual` helper) on any mismatch between expected and actual case/workflow status, rather than just printing what occurred. Verified this actually catches a real regression by deliberately breaking one scenario's expectation, confirming it failed loudly with a clear message and non-zero exit, then reverting — not assumed from reading the code.
- **Only six scenarios — asset/identity provider failures and the `BUDGET_OR_DEADLINE_EXHAUSTED`/`TOOL_EXECUTION_FAILURE` mandatory-review categories left out.** Asset/identity adapters are registered but never dispatched by the real M2 workflow (`case-conditions.workflow.ts` only calls income/credit/document) — not reachable end-to-end via the real REST + Temporal path today, a pre-existing gap this slice didn't invent and won't paper over with a scenario that can't actually run through it. Budget exhaustion and tool-execution failure have no clean, deterministic REST-reachable trigger today (budget exhaustion would need an artificially tiny budget config with no real knob to set it through the API; tool failure would need an actual implementation bug to reproduce on demand) — six honest, real scenarios beat inventing a seventh that doesn't reflect real reachable behavior.
- **`consent-revoked-before-dispatch` demonstrates the fail-closed provider-revalidation path, not `AgentRun.reviewCategory = CONSENT_INVALID`.** Investigated both — the `CONSENT_INVALID` mandatory-review category only fires when `evaluateConditions` re-runs with invalid consent, which in the current M2 workflow only happens inside the `POLICY_AMBIGUITY` interrupt/resume loop; there's no reliable way to hit it from a straight-line happy-path case via pure REST timing. Documented the distinction in the scenario's own description rather than silently picking the less-precise mechanism without saying so.
- **The policy-ambiguity scenario resolves fully (fixes the jurisdiction, resumes, reaches `READY_FOR_UNDERWRITING`) rather than stopping at `WAITING_FOR_REVIEW`.** Every other scenario in the catalog reaches a clean terminal outcome; stopping short would have been the one exception with no strong reason for it, and the extra direct-SQL update plus `RESUME_EVALUATION` call cost little.

### Errors and fixes

- None — all six scenarios passed against a real running API + Temporal worker on the very first live run, with every design assumption (jurisdiction/product-code mapping, Plaid's simulated income range, Temporal's retry backoff timing, the consent-revalidation fail-closed path, and the policy-ambiguity interrupt/resume mechanism) confirmed correct empirically rather than merely reasoned about.
- `nest build` excludes `client/` entirely (`tsconfig.build.json`'s own `exclude` list) — `npm run build` passing does not type-check this file. Relied on `npm run lint`'s type-aware ESLint rules plus the real `ts-node` execution (which would fail to even start on a real type/shape error) as this file's actual verification, matching how `quickstart.ts`/`webhook-inspector.ts` were verified before it — not a gap introduced by this slice.

### Verification

```text
npm run lint / npm run build / npm run lint:check
  all passed clean

Fresh scratch stack (scenarioverify, ports 5443/7234), fully migrated,
real API (development mode) + real Temporal worker running:
  npm run scenario-catalog
    6/6 scenarios passed on the first run, no code changes needed

  npx ts-node ... client/scenario-catalog.ts income-discrepancy-condition
    single-scenario selection: 1/1 passed

  npx ts-node ... client/scenario-catalog.ts nonexistent-scenario
    unknown-name path: prints the known-scenario list, exits 1

  Deliberately replaced one scenario's expected case-status string with
  a wrong value, reran: FAIL reported with the exact expected/actual
  mismatch, exit code 1 — reverted the change, reran the full catalog:
  6/6 passed again

Fresh scratch stack (scenariofinal, ports 5443/7234), fully migrated:
  npm run build / npm run lint:check — clean
  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent — 71 suites / 520 tests passed, unchanged (pure client
  tooling, no source/entity changes)
  npm run test:e2e — 3 suites / 27 tests passed, unchanged

Live processes terminated and both scratch stacks torn down
(docker compose down -v) after verification.
```

### Security, privacy, cost, and compatibility

- Pure developer/DX tooling — no production runtime code touched, no new entities, no new migrations, no new dependencies. Zero blast radius on any already-shipped capability.
- Uses only synthetic borrower ids and a throwaway sandbox tenant, matching every other script in `client/` — no real or realistic PII anywhere.
- The direct-SQL jurisdiction escape hatch writes only to a disposable scratch database in normal use (the same assumption `quickstart.ts` already makes about `DATABASE_URL`) — not intended to run against a real production database, and nothing in this slice changes that expectation.

### Known gaps

- Asset/identity provider-failure scenarios aren't included, since the real M2 workflow never dispatches those capabilities today (Known gap from M4-005, unchanged by this slice).
- `BUDGET_OR_DEADLINE_EXHAUSTED`/`TOOL_EXECUTION_FAILURE` mandatory-review categories have no scenario — no clean deterministic REST-reachable trigger exists for either yet.
- No cleanup logic — matching `quickstart.ts`'s own convention, the script assumes a disposable scratch environment and leaves its tenants/cases/jurisdiction rows behind.

### Next safe step

`communication_approvals` RLS, RBAC, and OIDC/FAPI 2.0 remain M5's largest open items — RBAC specifically needs the `users`/`tenant_memberships` human-identity foundation this codebase doesn't have yet, a genuinely separate, larger effort. The ten entirely-unbuilt Section 9.4 tools remain a large cross-milestone item, several of which (the calculation tools) need real domain-methodology decisions before they can be built honestly rather than guessed at. Not started; awaiting direction.

## M5-017: Scoped RBAC on `api_clients` (Section 20 M5's own scope line)

### Status

Implemented and verified, including a real live run under `NODE_ENV=production` with the restricted `mortgage_app` role and a direct `curl` proof against the running server. Follows a full evidence-based audit of everything left in M5's charter scope (RBAC, OIDC/FAPI 2.0, field/object encryption, `audit_events`, `legal_holds`, tenant-owned configuration, provider-promotion governance, a consolidated negative-authorization suite) presented to the user, who chose to push through the full remaining scope including a self-scoped RBAC — explicitly excluding OIDC/FAPI 2.0 and provider-promotion governance as genuinely separate, larger efforts this codebase's own `ApiClient` entity comment already named as out of reach.

### Acceptance criterion

A machine credential (`api_clients`) now carries a real `role` (`PARTNER` default, `REVIEWER`) enforced at the API layer. `POST /v1/loan-cases/{caseId}/reviews` — Section 6.3's own explicitly named human-reviewer authority ("Human reviewers approve protected communications, interpret out-of-policy cases, and record overrides") — requires `REVIEWER`; every other endpoint is unaffected, so a routine partner integration loses no capability it had before this slice. A PARTNER-role token gets a clean `403` naming the missing role; a REVIEWER-role token succeeds identically to before. Proven with a dedicated `RoleGuard` unit spec, two new `ApiKeyGuard` assertions (role attached correctly for both roles), a new e2e negative-authorization test (PARTNER 403s, the same case's REVIEWER-role client 202s immediately after, proving the 403 is genuinely role-gated and not an unrelated failure), and a live run: the real `quickstart`/`scenario-catalog` sandbox tools now mint and use two distinct role credentials, and a direct `curl` against the real running server (production `NODE_ENV`, restricted DB role) confirmed a fresh PARTNER token gets 403 on `/reviews` while still succeeding on case creation.

### Implementation

- `src/database/enums/api-client.enum.ts` — new `ApiClientRole` enum (`PARTNER`, `REVIEWER`) — exactly two roles, both grounded directly in charter language (`REVIEWER` = Section 6.3's own named authority; `PARTNER` = everything else), deliberately not a third invented "admin" tier.
- `src/database/entities/api-client.entity.ts` — new `role` column, `default: ApiClientRole.PARTNER`.
- `src/database/migrations/1787170970745-ApiClientRole.ts` (new) — adds the column `NOT NULL DEFAULT 'PARTNER'`, so every credential minted before this migration keeps working exactly as before.
- `src/auth/auth-context.ts` — `AuthContext` gains `role`. `src/auth/api-key.guard.ts` — populates it from the already-loaded `ApiClient` row (no new query).
- `src/auth/require-role.decorator.ts` (new) — `@RequireRole(...roles)`, a thin `SetMetadata` wrapper.
- `src/auth/role.guard.ts` (new) — `RoleGuard`: reads the handler's required-roles metadata via `Reflector`, allows every role through on a route with none, throws `ForbiddenException` naming the required role(s) otherwise. Runs as a method-level guard alongside `ApiKeyGuard`'s existing class-level one — `ApiKeyGuard` always resolves `authContext` first.
- `src/auth/api-client.service.ts` — `CreateApiClientInput` gains an optional `role`, defaulting to `PARTNER`.
- `src/cases/cases.controller.ts` — `submitReview` gains `@UseGuards(RoleGuard)` + `@RequireRole(ApiClientRole.REVIEWER)` + an `@ApiForbiddenResponse` doc annotation.
- `src/create-api-client.ts` — `npm run create-api-client -- <tenantId> <name> [PARTNER|REVIEWER]`, validates the role argument.
- `client/quickstart.ts`/`client/scenario-catalog.ts` — each now mints a PARTNER credential (case creation, workflow start, etc.) and a separate REVIEWER credential used specifically for review-decision calls — a more realistic reflection of how a real deployment would actually be structured, and a live demonstration of the new RBAC feature in this codebase's own flagship sandbox tooling.
- `openapi/openapi.json`/`client/generated/schema.d.ts` — regenerated to capture the new `403` response on `submitReview`.

### Affected files

- `src/database/enums/api-client.enum.ts`, `src/database/entities/api-client.entity.ts`
- `src/database/migrations/1787170970745-ApiClientRole.ts` (new), `schema-migrations.spec.ts`
- `src/auth/auth-context.ts`, `api-key.guard.ts` (+`.spec.ts`), `api-client.service.ts`, `require-role.decorator.ts` (new), `role.guard.ts` (new, +`.spec.ts`), `auth.module.ts`
- `src/cases/cases.controller.ts`
- `src/create-api-client.ts`
- `client/quickstart.ts`, `client/scenario-catalog.ts`
- `test/cases.e2e-spec.ts`
- `openapi/openapi.json`, `client/generated/schema.d.ts`
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Exactly two roles, not a speculative third "admin" tier.** Every role invented needs its own justification; the charter itself only ever distinguishes one authority level anywhere in this API surface (Section 6.3's human reviewer). Consent grant/revoke, webhook registration, and case creation all stayed open to `PARTNER` — reconsidered gating consent `REVOKE` behind a stricter role, but concluded a partner integration's own backend legitimately needs to signal "our user revoked consent" as routine, expected traffic; gating it would misrepresent how a real integration works, not add real security.
- **Guard-ordering finding, not a fabricated test fix**: adding `RoleGuard` to `/reviews` meant a cross-tenant `PARTNER`-role caller now gets `403` (role check) before ever reaching the tenant-ownership check that used to produce `404`. Investigated whether this leaks resource existence (Section 20 M5's own "never reveal via a differentiated status code" concern) — it does not: the `403` fires identically for every case id, real or fake, existing or not, for a fixed caller role, so no caller can distinguish "exists in another tenant" from "doesn't exist at all." Fixed by giving `cases.e2e-spec.ts`'s cross-tenant test client `REVIEWER` role too, preserving that test's own original intent (pure tenant isolation, unclouded by the new role dimension) — not by weakening the new guard or quietly changing what the test asserts without understanding why.
- **RBAC scoped to the machine-credential model that already exists, not OIDC.** The charter's own data model (`users`/`tenant_memberships`, Section 14.1) ties real RBAC to OIDC-linked human identity — building that is a genuinely separate, much larger effort (`ApiClient`'s own class comment already said so before this slice). This RBAC is honestly scoped to what `api_clients` can support: which *credential* gets to call which route, not "which human is logged in."

### Errors and fixes

- **`test/cases.e2e-spec.ts`'s pre-existing cross-tenant test failed**: `"404s for another tenant's real, valid credential on someone else's case"` started getting `403` instead of `404` on its `/reviews` sub-check. Traced to the guard-ordering effect described above (a real, understood consequence of this slice, not a bug) — fixed by giving that test's own "other tenant" client `REVIEWER` role, restoring the test's original tenant-isolation-only intent; the new, separate RBAC-specific negative test (added in this same file) covers the role dimension explicitly instead.
- **`schema-migrations.spec.ts`'s cumulative revert chain needed one new first step**, the same maintenance cost every migration-adding slice in this series has hit — this one column-only (no new table), so the new test checks `information_schema.columns` before/after `undoLastMigration()` rather than the table-list diff the RLS-adding migrations use.

### Verification

```text
npm run lint / npm run build / npm run lint:check
  all passed clean

Fresh scratch stack (m5017verify, ports 5443/7234), fully migrated:
  npx jest schema-migrations.spec.ts --runInBand
    31/31 passed (after inserting the missing revert-chain step)

  npx jest api-key.guard role.guard --runInBand
    2 suites / 14 tests passed

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent
    72 suites / 527 tests passed (520 -> 527: +1 new suite
    (role.guard.spec.ts, 5 tests), +2 new api-key.guard.spec.ts tests)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    first run: 1 failure (the cross-tenant guard-ordering finding above)
    — after the fix: 3 suites / 28 tests passed (27 -> 28: +1 new RBAC
    negative-authorization test)

Manual live verification — real API + real Temporal worker under
NODE_ENV=production with APP_DATABASE_URL (the mortgage_app role):
  ran the real npm run quickstart — minted a PARTNER and a REVIEWER
  credential, case creation/workflow start via PARTNER, the review
  decision via REVIEWER, completed successfully end to end

  ran the real npm run scenario-catalog — 6/6 scenarios passed using
  the same two-credential pattern, including both scenarios that submit
  review decisions

  direct curl against the real running server with a freshly-minted
  PARTNER token: POST .../reviews -> 403 "This action requires one of
  these roles: REVIEWER"; POST /v1/loan-cases (case creation) -> 201,
  same token, proving PARTNER lost no capability it had before this
  slice

  real api_clients rows confirmed via Postgres: both PARTNER and
  REVIEWER roles persisted correctly across the quickstart/scenario-
  catalog runs

  live processes terminated and the scratch stack torn down
  (docker compose down -v) after verification
```

### Security, privacy, cost, and compatibility

- Every credential minted before this migration keeps working identically — the `NOT NULL DEFAULT 'PARTNER'` backfill plus the fact that only one route (`submitReview`) is newly gated means no existing integration loses access it already had, only gains a real boundary on the one action the charter itself reserves to a human reviewer.
- No new secrets, no new external dependencies — `RoleGuard`/`Reflector` are both stock NestJS primitives.
- Closes a real, live gap: before this slice, any valid API-client token — meant for routine case/evidence submission — could submit binding reviewer decisions (condition resolutions, evaluation resumes) with zero differentiation from a genuine human-reviewer credential.

### Known gaps

- **Not real OIDC/FAPI 2.0** — this RBAC governs machine credentials only; there is still no human-identity system (`users`/`tenant_memberships`) at all, and this slice doesn't attempt to build one. Explicitly, deliberately out of scope per the user's own direction.
- **No credential-management REST surface** — `create-api-client` remains a script, matching `ApiClientService`'s own pre-existing comment ("who's allowed to create API clients?" is exactly the RBAC question this slice answers for *using* a credential, not for *minting* one).
- Every other M5 Known gap (`communication_approvals` RLS, encrypted field/object boundaries, `audit_events`, `legal_holds`, tenant-owned configuration, provider-promotion governance, consolidated negative-authorization suite) is unchanged by this slice — next up per the user's "push through the rest" direction.

### Next safe step

Continuing the user's "全力推進" direction: `communication_approvals` RLS (a real, closable gap — add a `tenantId` column derived from the message relation, matching the pattern every other retrofitted table in this series already used), then a lightweight but real `audit_events` table wired into the security-relevant mutation points this slice and its predecessors created (RBAC rejections, consent revocation, review decisions), then a consolidated negative-authorization/threat-model suite covering Section 16.4's scenarios that are honestly testable without a subsystem this codebase doesn't have. OIDC/FAPI 2.0 and provider-promotion governance remain explicitly out of scope per the user's own direction.

## M5-018: PostgreSQL row-level security for `communication_approvals`, closing the last named M5 RLS gap

### Status

Implemented and verified, including a real live run under `NODE_ENV=production` with the restricted `mortgage_app` role. Closes the one table M5-009's and M5-014's own migrations each named and deliberately deferred — `communication_approvals` had no `tenantId` column and its sole writer, `CommunicationApprovalService.approve()`, had no `tenantId` in its signature and no real caller anywhere in this codebase. Continuing the user's "全力推進" (push through the rest) direction from M5-017.

### Acceptance criterion

`communication_approvals` is now RLS-protected via a join through `communication_messages` (the same shape `condition_transitions`/`tool_attempts` already established for a table with no `tenantId` column of its own) — a query with no tenant context sees zero rows even when real rows exist, a fabricated other-tenant context sees zero rows, and an `INSERT` referencing a message owned by a *different* tenant than the session context is rejected by Postgres itself, not just a direct-column mismatch. `CommunicationApprovalService.approve()` now takes an explicit `tenantId` parameter — the very first real design of that signature, not a retrofit around an existing caller, since none existed. Proven with a dedicated 7-test tenant-isolation spec (`mortgage_app` role), the two existing specs that exercise `approve()` updated and passing, and a real live run: a real case driven through `quickstart` produced a real `PROTECTED`/`AWAITING_APPROVAL` message via `draft_information_request`, approved directly through the real service under the restricted role, flipping the message to `APPROVED` — then direct Postgres queries proved the real tenant sees its own approval while a fabricated other-tenant session sees zero rows despite the data existing.

### Implementation

- `src/communications/communication-approval.service.ts` — converted from `@InjectRepository` ×2 to `@InjectDataSource()`; `approve()` gained a required `tenantId` first parameter and now runs entirely inside one `runInTenantContext` transaction (the message read, the approval insert, and the message-status update all share it — matching the atomicity reasoning every other RLS-converted service in this series already uses).
- `src/database/migrations/1787171713047-CommunicationApprovalTenantIsolation.ts` (new) — `ENABLE`/`FORCE ROW LEVEL SECURITY` plus a join-based `tenant_isolation` policy: `EXISTS (SELECT 1 FROM communication_messages cm WHERE cm.id = communication_approvals."communicationMessageId" AND cm."tenantId" = ...)`. No new column, no backfill needed — there were no real rows to migrate (no caller had ever created one outside tests).
- `src/communications/communication-approval-tenant-isolation.spec.ts` (new) — 7 tests, same shape as every other tenant-isolation spec in this series, adapted for the join: fixture rows need a real parent `communication_messages` row to reference.
- `src/communications/communication-message.service.spec.ts`, `communication-delivery.service.spec.ts` — the only two places `approve()` was ever called (both test files) updated for the new `DataSource`-based constructor and the new `tenantId` parameter.

### Affected files

- `src/communications/communication-approval.service.ts` (+`.spec.ts` sites in the two files above)
- `src/communications/communication-approval-tenant-isolation.spec.ts` (new)
- `src/database/migrations/1787171713047-CommunicationApprovalTenantIsolation.ts` (new), `schema-migrations.spec.ts`
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Join-based policy, not a denormalized `tenantId` column.** `communication_approvals` has a real, non-nullable `ON DELETE CASCADE` foreign key to `communication_messages`, which already carries RLS and a `tenantId` column — the identical shape `condition_transitions`/`tool_attempts` already established for exactly this situation. A denormalized column was considered (and was this codebase's own original plan, from an earlier session) but rejected once the join-based precedent was re-confirmed as the established, consistent choice for a table with a real tenant-scoped parent, rather than inventing a second pattern for the same problem shape.
- **`approve()`'s new signature designed fresh, not retrofitted.** With zero real callers to preserve compatibility for, this was a genuine first design rather than a constrained retrofit — `tenantId` placed first, matching every other RLS-protected service method's own convention in this codebase.
- **No backfill migration needed.** Every prior retrofit in this series that added RLS to an existing table had real production-shaped rows to consider; `communication_approvals` never had a real caller, so there was nothing to backfill — confirmed, not assumed, by checking the table was empty in every environment this slice touched.

### Errors and fixes

- **The relation-metadata gap hit again**, this time in the new tenant-isolation spec itself: `TypeORMError: Entity metadata for CommunicationMessage#template was not found` — fixed by adding `CommunicationTemplate` to its entities array, the same fix applied repeatedly throughout this whole M5 series whenever `CommunicationMessage` is registered anywhere.
- **`schema-migrations.spec.ts`'s cumulative revert chain needed one more new first step**, the same now-routine maintenance cost every migration-adding slice in this series has hit — this one RLS-only (no new table, no new column), so the new test follows the simpler `pg_class`/`pg_policies` before/after style `CasePolicyTenantIsolation`'s own revert test already used.

### Verification

```text
npm run lint / npm run build / npm run lint:check
  all passed clean

Fresh scratch stack (m5018verify, ports 5443/7234), fully migrated:
  npx jest schema-migrations.spec.ts --runInBand
    32/32 passed (after inserting the missing revert-chain step)

  npx jest communication --runInBand
    6 suites / 38 tests passed (after fixing the CommunicationTemplate
    relation-metadata gap)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent
    73 suites / 535 tests passed (527 -> 535: +1 new suite
    (communication-approval-tenant-isolation.spec.ts, 7 tests), +1 new
    schema-migrations.spec.ts revert-chain test)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    3 suites / 28 tests passed, unchanged

Manual live verification — real API + real Temporal worker under
NODE_ENV=production with APP_DATABASE_URL (the mortgage_app role):
  ran the real npm run quickstart — produced a real case with a real
  PROTECTED/AWAITING_APPROVAL CommunicationMessage (draft_information_
  request:SUCCESS in the Agent run)

  called the real CommunicationApprovalService.approve() directly
  (a one-off script, since no REST endpoint exists — the same honest
  gap the service's own comment already names) under the restricted
  role: a real CommunicationApproval row was created and the message
  flipped to APPROVED

  queried communication_approvals directly against Postgres as
  mortgage_app: the real tenant's own session saw its 1 real approval;
  a fabricated other-tenant session saw zero rows despite the data
  existing; no tenant context at all also saw zero rows (fail closed)

  live processes terminated and the scratch stack torn down
  (docker compose down -v) after verification
```

### Security, privacy, cost, and compatibility

- Closes the last table this whole M5 RLS series had explicitly named and deferred across two prior migrations' own comments — every tenant-scoped table in this codebase's current schema now has row-level security.
- No new secrets, no new external dependencies, no performance concern beyond the same one-extra-`EXISTS`-subquery cost `condition_transitions`/`tool_attempts` already accepted for this exact policy shape.
- Since `approve()` had no real caller before this slice, this closes a purely structural gap (the table's own protection) rather than a live exploitable one — matching M5-014's own "live vs. dormant gap" distinction, this one was dormant, unlike that slice's provider-platform tables.

### Known gaps

- **`approve()` still has no real REST/GraphQL caller** — Section 6.4's protected-communication approval flow remains only reachable by direct service call (or the M5-017-adjacent question of building an approval-gated `send_information_request` path, still not attempted).
- Every other M5 Known gap (RBAC's own remaining scope beyond `submitReview`, encrypted field/object boundaries, `audit_events`, `legal_holds`, tenant-owned configuration, provider-promotion governance, consolidated negative-authorization suite) is unchanged by this slice.

### Next safe step

Continuing "全力推進": a lightweight but real `audit_events` table next, wired into the security-relevant mutation points this whole M5 series has built (RBAC rejections, consent revocation, review decisions, webhook registration) — then a consolidated negative-authorization/threat-model suite covering Section 16.4's scenarios that are honestly testable without inventing a subsystem this codebase doesn't have. OIDC/FAPI 2.0 and provider-promotion governance remain explicitly out of scope per the user's own direction.

## M5-019: `audit_events` — a real, append-only security-history table (Section 14.1)

### Status

Implemented and verified, including a real live run under `NODE_ENV=production` with the restricted `mortgage_app` role exercising all five wired audit sources at once. Closes Section 14.1's `audit_events` ("Append-only actor, action, resource, and security history") and moves Section 20 M5's own exit evidence ("every material mutation records actor, tenant, resource, correlation, and reason provenance") from zero real support to five real, wired call sites. Continuing the user's "全力推進" direction from M5-017/M5-018.

### Acceptance criterion

A new `audit_events` table (RLS-protected from creation, matching `ConsentRecords`/`DataDispositionTasks`) records real events from five distinct security-relevant call sites: RBAC rejections (`RoleGuard`), review decisions (`submitReview`), consent grant/revoke (`submitConsentAction`), webhook endpoint registration (`createWebhookEndpoint`), and protected-communication approval (`CommunicationApprovalService.approve()`). Every event carries `tenantId`, `actorId`, `action`, `resourceType`/`resourceId`, and — for every call site that has a real HTTP request behind it — a `correlationId` (a fresh id `ApiKeyGuard` mints per authenticated request, the only real per-request trace unit this codebase has). The table is genuinely append-only: a database trigger rejects `UPDATE`/`DELETE` outright, unconditionally, even under `app.bypass_rls`, not just "no service happens to call `.update()`." A failure to *write* an audit event never blocks the action it describes (logged and swallowed, not rethrown). Proven with 11 unit/tenant-isolation tests, a direct `psql` proof that the trigger rejects mutation even as the Postgres superuser, and a real live run: all five real audit sources fired in one pass against a real API + Temporal worker under the restricted role, producing five real rows with the exact expected shape, followed by a direct cross-tenant RLS proof on the real data.

### Implementation

- `src/database/entities/audit-event.entity.ts` (new) — `tenantId`, `actorId`, `action`, `resourceType`, `resourceId`, `correlationId`, `reason`, `metadata` (jsonb), `createdAt`. No `updatedAt` — nothing ever mutates a row.
- `src/database/migrations/1787172327597-AuditEvents.ts` (new) — table + RLS (new-table shape) plus a `reject_audit_event_mutation()` PL/pgSQL function and a `BEFORE UPDATE OR DELETE` trigger, the one piece with no precedent elsewhere in this series: append-only is a real, load-bearing property for an audit trail specifically, not a nice-to-have.
- `src/audit/audit-event.service.ts` (new) — `AuditEventService.record()`, always its own short `runInTenantContext` transaction (never sharing one with the action being audited — deliberate: an `RBAC_REJECTED` event has no successful transaction to piggyback on in the first place, so every call site uses the same standalone shape for consistency). Catches and logs any write failure rather than rethrowing — an audit-logging bug must never become a new way to break the action it was only supposed to observe.
- `src/audit/audit.module.ts` (new) — `@Global()`, registered in both `app.module.ts` and `worker.module.ts` (the latter needed too: `CommunicationsModule`, which now depends on `AuditEventService` via `CommunicationApprovalService`, is imported by the Temporal worker bootstrap as well).
- `src/auth/auth-context.ts`/`api-key.guard.ts` — `AuthContext` gains `correlationId`, a fresh `randomUUID()` minted per authenticated request — the only real per-request trace unit available; no distributed tracing system exists to integrate with instead.
- `src/auth/current-auth.decorator.ts` (new) — `@CurrentAuth()`, returning the full `AuthContext` (vs. `AuthTenantId()`'s narrower `tenantId`-only case) — needed at the three controller call sites below for `apiClientId`/`correlationId`.
- `src/auth/role.guard.ts` — records an `RBAC_REJECTED` event (action, `resourceType='route'`, `resourceId` = `Controller.method`) before throwing; `canActivate` is now `async` (was sync) to allow the write.
- `src/cases/cases.controller.ts` — `submitReview` and `submitConsentAction` each record an audit event after their underlying service call succeeds, using `@CurrentAuth()` for `apiClientId`/`correlationId` and each DTO's own `actorId`/`reason` where available.
- `src/webhooks/webhook-endpoints.controller.ts` — `create` records `WEBHOOK_ENDPOINT_CREATED` with the real endpoint id and `targetUrl`/`eventTypes` in `metadata`.
- `src/communications/communication-approval.service.ts` — `approve()` records `COMMUNICATION_APPROVED` after its own transaction commits; `correlationId` stays honestly null here (no HTTP request context reaches this service — it still has no real caller, per M5-018).
- Explicit controller-level wiring, not an interceptor — this codebase has no interceptors anywhere else, and four call sites didn't justify introducing the abstraction.

### Affected files

- `src/database/entities/audit-event.entity.ts` (new), `src/database/migrations/1787172327597-AuditEvents.ts` (new), `schema-migrations.spec.ts`
- `src/audit/audit-event.service.ts` (+`.spec.ts`, new), `audit.module.ts` (new), `audit-event-tenant-isolation.spec.ts` (new)
- `src/auth/auth-context.ts`, `api-key.guard.ts` (+`.spec.ts`), `current-auth.decorator.ts` (new), `role.guard.ts` (+`.spec.ts`), `auth.module.ts`
- `src/cases/cases.controller.ts` (+`.spec.ts`), `cases.module.ts`
- `src/webhooks/webhook-endpoints.controller.ts`, `webhooks.module.ts`
- `src/communications/communication-approval.service.ts`, `communication-message.service.spec.ts`, `communication-delivery.service.spec.ts`, `communications.module.ts`
- `src/app.module.ts`, `src/worker.module.ts`
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Append-only enforced by a database trigger, not just application convention.** Every other "nobody calls .update()" guarantee in this codebase is a code-review-time property; for an audit trail specifically, Section 14.1's own word "append-only" is load-bearing enough to deserve a real, unconditional database-level guarantee — verified directly with `psql` as the Postgres superuser (bypasses RLS entirely) and the trigger still rejected both `UPDATE` and `DELETE`.
- **Unconditional, even under `app.bypass_rls`.** Every other RLS policy in this codebase treats that flag as a routine, frequently-used escape hatch for legitimate cross-tenant system operations. Audit history is different: allowing bypass-mode deletion would quietly reopen exactly the "can this row ever be removed" question append-only is supposed to close. A real future retention-driven purge needs its own explicit mechanism (e.g., a migration that temporarily drops the trigger) — a named, not-yet-built, Known gap, not a silent carve-out through an existing flag.
- **Standalone transaction at every call site, not shared with the audited action's own transaction.** `RBAC_REJECTED` has no successful action to share a transaction with in the first place — the whole point is recording a rejected attempt. Rather than two different integration shapes (share-when-possible, standalone-otherwise), every call site uses the same standalone shape, which is also the more correct semantics for an audit trail generally: a write failure to the primary resource and a write failure to the audit log are different failure modes that shouldn't be coupled.
- **Explicit controller-level calls, not an interceptor.** This codebase has never used a NestJS interceptor anywhere; four call sites (three controller methods, one service method) didn't justify introducing a new abstraction pattern just to DRY up a small amount of repetition, matching this codebase's own consistently explicit style over framework magic.
- **Failures to write an audit event are logged and swallowed, not rethrown.** An audit-logging bug must never become a new way for this codebase's own instrumentation to break a case creation, a consent revocation, or a reviewer decision that would otherwise have succeeded — the action being described is always more important than the fact of describing it.
- **Only five call sites wired, not every mutation in the codebase.** A blanket instrumentation pass across every service method would be a much larger, riskier change with unclear incremental value; the five chosen are exactly the security-relevant actions this whole M5 series has itself built or hardened (authorization, consent, human review, external configuration, protected communication) — a representative cross-section, not an attempt to claim full mutation coverage the charter's own exit evidence doesn't actually require in one slice.

### Errors and fixes

- **`src/cases/cases.controller.spec.ts` broke** — a pre-existing unit spec (not an e2e spec) that constructs `CasesController` directly with a mocked `CasesService` and calls `controller.submitReview(TENANT_ID, 'case-1', reviewDto)`, passing a plain tenantId string matching the *old* `@AuthTenantId()` signature. `submitReview`'s first parameter is now `@CurrentAuth() auth: AuthContext` (a full object), so the call broke with `Cannot read properties of undefined (reading 'record')` — the controller tried to call `this.auditEventService.record(...)` on an unconstructed second dependency the spec's own `new CasesController(casesService as never)` never supplied. Fixed by adding a mocked `AuditEventService` to the spec's own constructor call and updating the `submitReview` test to pass a full `AuthContext` fixture, plus a new assertion that the resulting audit event carries the right shape.
- **`schema-migrations.spec.ts`'s cumulative revert chain needed one more new first step**, the same now-routine maintenance cost every migration-adding slice in this series has hit — new-table shape (`DROP TABLE` takes RLS with it), plus one extra check that `reject_audit_event_mutation()` is actually gone after revert (the migration's own `down()` explicitly drops it, not implied by `DROP TABLE` alone).

### Verification

```text
npm run lint / npm run build / npm run lint:check
  all passed clean

Fresh scratch stack (m5019verify, ports 5443/7234), fully migrated:
  Direct psql, as the Postgres superuser (mortgage role): INSERT
  succeeded; UPDATE and DELETE against the same row both rejected with
  "audit_events is append-only: UPDATE/DELETE is not permitted" —
  proven before writing a single test, not just asserted by one

  npx jest api-key.guard role.guard communication --runInBand
    8 suites / 53 tests passed

  npx jest audit-event --runInBand
    2 suites / 11 tests passed (audit-event.service.spec.ts,
    audit-event-tenant-isolation.spec.ts)

  npx jest schema-migrations.spec.ts --runInBand
    33/33 passed (after inserting the missing revert-chain step)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent
    first run: 1 failure (cases.controller.spec.ts, see Errors and
    fixes) — after the fix: 75 suites / 548 tests passed (535 -> 548:
    +2 new suites, +13 tests)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    3 suites / 28 tests passed, unchanged

Manual live verification — real API + real Temporal worker under
NODE_ENV=production with APP_DATABASE_URL (the mortgage_app role):
  ran the real npm run quickstart (review decision via the REVIEWER
  credential), then against the same tenant: a PARTNER token's
  rejected /reviews attempt (RBAC_REJECTED), a real webhook endpoint
  registration, a real consent revocation, and a real communication
  approval (via a one-off script, since no REST endpoint exists) — all
  five real audit sources fired in one pass

  queried audit_events directly against Postgres as mortgage: five
  real rows, exact expected actions/resourceTypes/actorIds, every
  HTTP-originated event carrying a real correlationId, the service-
  originated COMMUNICATION_APPROVED event correctly and honestly null

  queried audit_events as mortgage_app under real/fabricated tenant
  contexts: the real tenant's session saw all 5 real rows; a
  fabricated other-tenant session saw zero rows despite the data
  existing

  live processes terminated and the scratch stack torn down
  (docker compose down -v) after verification
```

### Security, privacy, cost, and compatibility

- Moves Section 20 M5's own exit evidence ("every material mutation records actor, tenant, resource, correlation, and reason provenance") from zero real support to five real, verified call sites — a genuine security-history capability where none existed before this slice.
- Append-only is a real database-level guarantee, not an application-layer promise a future bug could silently violate.
- No new secrets, no new external dependencies. One extra short transaction per audited action; a write failure never blocks the action itself (logged and swallowed).

### Known gaps

- **Not every mutation in the codebase is audited** — five representative, security-relevant call sites, not a blanket instrumentation pass (see Decisions).
- **No retention/purge mechanism** — the append-only trigger has no carve-out for one yet; a real future retention policy needs its own explicit mechanism.
- **No read surface** — `audit_events` has no GraphQL/REST query endpoint yet; Section 15.2's own "audit... history" surface remains unbuilt, matching the same M6 UI-milestone scoping this whole series has already applied to `data_disposition_tasks`.
- Every other M5 Known gap (RBAC's own remaining scope, encrypted field/object boundaries, `legal_holds`, tenant-owned configuration, provider-promotion governance, consolidated negative-authorization suite) is unchanged by this slice.

### Next safe step

Continuing "全力推進": a consolidated negative-authorization/threat-model suite next, covering Section 16.4's scenarios that are honestly testable without inventing a subsystem this codebase doesn't have (several already have scattered coverage across this whole series' own tenant-isolation specs — this slice would consolidate and name them, then add real coverage for the gaps that are actually closable now, including the RBAC/audit-event mechanisms this and M5-017 just built). OIDC/FAPI 2.0 and provider-promotion governance remain explicitly out of scope per the user's own direction.

## M5-020: Negative authorization suite and Section 16.4 threat-scenario coverage index

### Status

Implemented and verified, including a real live curl proof under `NODE_ENV=production`. Closes Section 20 M5's own scope line ("threat-model tests and negative authorization suite") — completing the last item from the "全力推進" plan laid out after M5-017. Consolidates what M5-017's own from-scratch audit found scattered across ~15 spec files built over this whole M5 series into one real, honest index, and closes the one named Section 16.4 threat scenario ("forged tenant or role context") that had never been directly tested.

### Acceptance criterion

`test/negative-authorization.e2e-spec.ts` proves, against a real running app with the real global `ValidationPipe`, that a request body cannot smuggle a `tenantId` or `role`/`apiClientId` override — the DTO whitelist (`forbidNonWhitelisted: true`) rejects it outright with a `400` naming the offending field, not a silent ignore — and that a query-string `tenantId` parameter is never consulted by anything (only the bearer credential's own tenant is). The same file's own top-of-file comment is a real, honest coverage index for every Section 16.4 threat scenario: COVERED (with the specific file), PARTIAL, NOT APPLICABLE (with why — e.g. no model calls exist yet, so prompt injection has no real attack surface), or KNOWN GAP — recorded as comments, not fake always-passing `it()` stubs, so a stale reference is a visible documentation-maintenance risk rather than fabricated coverage. Proven with 3 new e2e tests (one exposing a real ordering fact about this codebase's own request lifecycle along the way) and a live `curl` proof against a real running server under `NODE_ENV=production`.

### Implementation

- `test/negative-authorization.e2e-spec.ts` (new) — three tests: a forged `tenantId` in a case-creation body (`400`, verified nothing persisted under the forged id), a forged `role`/`apiClientId` in a review-submission body (`400`), and a forged `tenantId` query-string parameter that's silently never read (the real credential's own tenant still resolves correctly). Preceded by a long, structured comment indexing every Section 16.4 threat scenario's real current coverage status.
- No production code changed — this slice is entirely new test/documentation surface.

### Affected files

- `test/negative-authorization.e2e-spec.ts` (new)
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **A real coverage index as comments, not fake test stubs.** A file full of `it.todo(...)` or always-passing placeholder tests for "covered elsewhere" scenarios would itself be a form of fabricated coverage — implying a test suite verifies something it doesn't actually re-check. A structured comment makes the same information available without that risk, at the honest cost that nothing forces it to stay in sync with the specs it references (named explicitly in the file's own comment, not hidden).
- **Documented three scenarios as genuinely NOT APPLICABLE rather than gaps**, backed by direct verification, not assumption: prompt injection (this Agent makes no model/LLM calls anywhere — Section 9.2's own "LangGraph is an Agent runtime adapter," every node deterministic code), malicious file content (no file-upload subsystem exists), and the five provider-promotion-governance-specific scenarios (self-approval, stale activation race, artifact mismatch, cross-provider fallback reuse, duplicate callbacks after cancellation — no provider-promotion subsystem exists at all, confirmed by the same fresh audit that preceded M5-017).
- **PII-in-logs redaction left as a named Known gap, not stretched into "covered."** Structurally reduced (evidence facts store computed/typed values, not raw documents; `ApiKeyGuard`'s error messages are deliberately generic) but no dedicated log-scanning test exists — an honest gap, not claimed as closed by adjacent design choices that happen to help.

### Errors and fixes

- **Inverted ternary bug in this slice's own first draft**: `const describeOrSkip = missingVars.length > 0 ? describe : describe.skip;` — backwards from the established convention (`missingVars.length > 0 ? describe.skip : describe`) used everywhere else in this codebase's real-DB/e2e specs. The whole suite silently reported "1 skipped" with no failing assertions, which could easily have been mistaken for "nothing wrong" rather than "nothing ran" — caught by noticing the suite-level skip in the test summary, not from a failing assertion, a reminder that a skipped suite deserves the same scrutiny as a failing one.
- **A genuine finding about NestJS's own request lifecycle**, not a code bug: the first attempt at "rejects a review-submission body that tries to smuggle a role/apiClientId override" used a PARTNER-role client and got `403` (RoleGuard) instead of the expected `400` (ValidationPipe) — because NestJS runs guards *before* pipes, so a role-insufficient caller never reaches DTO validation at all. Fixed by minting a REVIEWER-role credential specifically for that test, so the request actually reaches the layer being tested — and documented the ordering fact in the test's own comment rather than silently working around it.

### Verification

```text
npm run lint / npm run build / npm run lint:check
  all passed clean

Fresh scratch stack (m5020verify, ports 5443/7234), fully migrated:
  npx jest --config ./test/jest-e2e.json negative-authorization
    first run: whole suite silently skipped (inverted ternary) — after
    the fix: 1 failed, 2 passed (the guards-before-pipes finding) —
    after minting a REVIEWER credential for that one test: 3/3 passed

  npm run test:e2e (full suite)
    4 suites / 31 tests passed (28 -> 31: +1 new suite, +3 tests)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent
    75 suites / 548 tests passed, unchanged (no production code
    touched by this slice)

Manual live verification — real API under NODE_ENV=production with
APP_DATABASE_URL (the mortgage_app role):
  direct curl with a fresh PARTNER token, a real request body
  containing a forged "tenantId" field: 400,
  {"message":["property tenantId should not exist"],...} — the real
  running server, not just the e2e-test harness, rejects it

  live process terminated and the scratch stack torn down
  (docker compose down -v) after verification
```

### Security, privacy, cost, and compatibility

- Closes the last named item from Section 20 M5's own scope line — a real, honest index of this codebase's actual threat-model coverage exists in one place for the first time, and the one previously-untested named scenario ("forged tenant or role context") is now directly proven, not just structurally assumed.
- No new production code, no new dependencies, no runtime cost — pure test/documentation surface.

### Known gaps

- **PII-in-logs/traces redaction** has no dedicated test (see Decisions).
- **The coverage index can go stale** — nothing forces the comment to track the specs it references; a future refactor that removes or weakens a referenced test would not automatically update this file. An accepted, named risk, not a solved problem.
- Every other M5 Known gap (OIDC/FAPI 2.0, encrypted field/object boundaries, `legal_holds`, tenant-owned configuration, provider-promotion governance) is unchanged by this slice, and remains explicitly out of scope per the user's own direction.

### Next safe step

This closes the "全力推進" plan laid out after M5-017 (RBAC → `communication_approvals` RLS → `audit_events` → negative-authorization suite). What remains of M5's charter scope — OIDC/FAPI 2.0, real field/object encryption, `legal_holds`, tenant-owned provider/policy/webhook/communication-template/budget configuration, and provider-promotion governance — are each genuinely separate, larger subsystems the user's own direction already scoped out of this push. Not started; awaiting direction on whether/when to take any of them on.

## M5-021: Tenant-owned Agent run budget configuration (Section 20 M5)

### Status

Implemented and verified, including a real live proof under `NODE_ENV=production` that the same scenario produces a genuinely different outcome depending on a tenant's own configuration. Closes the one concrete, currently-real gap among Section 20 M5's "tenant-owned provider, policy, webhook, communication-template, and budget configuration" scope line — chosen after checking all five domains directly rather than guessing: `communication_templates`/`webhook_endpoints` are already genuinely tenant-owned (their own `tenantId` column); the policy catalog is deliberately shared infrastructure with no `tenantId` at all (Section 10's own jurisdiction-scoped model, not a gap); the provider registry has nothing to differentiate per tenant since only `SIMULATOR` mode exists anywhere. Budget was the one domain with a real, currently-hardcoded-global value (`AGENT_RUN_STEP_BUDGET = 10`, `AGENT_RUN_DURATION_BUDGET_MS = 20_000`) to actually override.

### Acceptance criterion

`Tenant` gains two nullable override columns; null means "use the platform default," so every tenant's Agent runs behave identically to before this migration until an operator explicitly sets one. `case-conditions.activities.ts`'s `evaluateConditions` now resolves the real budget from the tenant's own row on every run, not a fixed constant. Proven with a real unit test setting a tenant's `agentRunStepBudgetOverride` to `1` and confirming a real Agent run — which needs several real tool calls to complete normally — genuinely exhausts budget and routes to `REVIEW_REQUIRED` instead, and a live run: the *same* tenant, the *same* income-discrepancy scenario, completed normally under the platform default and then, after setting the override via the new `npm run set-tenant-agent-budget` script, routed to real `MANUAL_REVIEW` with the exact real reason `[BUDGET_OR_DEADLINE_EXHAUSTED] remainingStepBudget exhausted` in the case's own timeline.

### Implementation

- `src/database/entities/tenant.entity.ts` — `agentRunStepBudgetOverride`/`agentRunDurationBudgetMsOverride` (nullable `integer`), with a class comment recording the full "why budget, not the other four domains" investigation so it isn't silently re-litigated later.
- `src/database/migrations/1787176668622-TenantAgentBudgetOverride.ts` (new) — two nullable columns, no backfill needed (null already means "default").
- `src/workflows/case-conditions.activities.ts` — `AGENT_RUN_STEP_BUDGET`/`AGENT_RUN_DURATION_BUDGET_MS` renamed to `DEFAULT_...` (still the fallback); a new `resolveAgentRunBudget(tenant)` reads the two override columns with `??` fallback to those defaults. `evaluateConditions` fetches the tenant row (a plain, unwrapped read — `tenants` itself is never RLS-protected, it's the boundary other tables' policies reference, not data scoped to one) and uses the resolved values everywhere the old constants were used directly (`initialState`'s own `remainingStepBudget`/`remainingDurationBudgetMs`, `runDeadlineAt`'s computation, and the `budget` object passed to `agentRuntime.run()`).
- `src/set-tenant-agent-budget.ts` (new) — `npm run set-tenant-agent-budget -- <tenantId> <stepBudget|clear> <durationBudgetMs|clear>`, matching `create-api-client.ts`'s own established script-not-endpoint convention (an endpoint that could change a tenant's own operational limits needs its own authorization story M5-017's two-role RBAC doesn't cover).

### Affected files

- `src/database/entities/tenant.entity.ts`, `src/database/migrations/1787176668622-TenantAgentBudgetOverride.ts` (new), `schema-migrations.spec.ts`
- `src/workflows/case-conditions.activities.ts` (+`.spec.ts`)
- `src/set-tenant-agent-budget.ts` (new), `package.json`
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Investigated all five named configuration domains before picking one, rather than assuming budget was the obvious choice.** `communication_templates`/`webhook_endpoints` turned out to already be genuinely tenant-owned; the policy catalog and provider registry turned out to have no real per-tenant value to differentiate yet given this codebase's current real capabilities (a shared jurisdiction-scoped policy library by design; only `SIMULATOR` provider mode exists anywhere). Recorded directly in `Tenant`'s own class comment so a future reader doesn't have to redo this investigation from scratch, the same courtesy M5-017's own from-scratch M5 audit wished a prior slice had left behind.
- **Two plain nullable columns on `Tenant`, not a new `TenantConfiguration` table.** Only one configuration dimension (two related fields) is real and closable today; a dedicated table would be premature abstraction for two nullable integers with a clear, simple owner already available. Revisit if/when a second real per-tenant configuration dimension emerges.
- **A script, not a REST endpoint, to set the override** — matching `create-api-client.ts`'s own precedent exactly: an endpoint that could change a tenant's own operational limits is an administrative action, and this codebase's own RBAC (M5-017) deliberately has only `PARTNER`/`REVIEWER`, no admin tier with charter grounding to justify one yet.
- **Resolved via a plain unwrapped read of `tenants`, not `runInTenantContext`.** `tenants` has never been RLS-protected in this codebase (it's the boundary other tables' own policies reference via a foreign `tenantId`, not itself scoped to a tenant) — wrapping this specific read would add ceremony with no real effect, and would be inconsistent with every other place in this codebase that already reads `Tenant` directly (`evaluation-report.ts`, this same file's own tenant lookups elsewhere).

### Errors and fixes

- **None functionally** — the new unit test (setting `agentRunStepBudgetOverride: 1` and confirming `REVIEW_REQUIRED` with a reason containing `StepBudget`) passed on the first run, and the live proof matched the predicted exact reason string (`[BUDGET_OR_DEADLINE_EXHAUSTED] remainingStepBudget exhausted`) without needing any adjustment.
- **`schema-migrations.spec.ts`'s cumulative revert chain needed its now-routine new first step** — column-only shape (matching `ApiClientRole`'s own precedent), checking `information_schema.columns` on `tenants` before/after `undoLastMigration()`.

### Verification

```text
npm run lint / npm run build / npm run lint:check
  all passed clean

Fresh scratch stack (m5021verify, ports 5443/7234), fully migrated:
  npx jest case-conditions.activities --runInBand
    15/15 passed (including the new budget-exhaustion test, first try)

  npx jest schema-migrations.spec.ts --runInBand
    34/34 passed (after inserting the missing revert-chain step)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent
    75 suites / 550 tests passed (548 -> 550: +1 new unit test, +1 new
    schema-migrations.spec.ts revert-chain test)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    4 suites / 31 tests passed, unchanged

Manual live verification — real API + real Temporal worker under
NODE_ENV=production with APP_DATABASE_URL (the mortgage_app role):
  ran the real npm run quickstart against a fresh tenant with the
  platform default budget — completed normally end to end
  (READY_FOR_UNDERWRITING), the same income-discrepancy scenario this
  whole session has used as its own baseline throughout

  ran npm run set-tenant-agent-budget against that SAME tenant
  (stepBudget=1) — then drove a new case through the identical
  scenario via real curl calls: case status became MANUAL_REVIEW, and
  the real case timeline showed the exact real reason
  "[BUDGET_OR_DEADLINE_EXHAUSTED] remainingStepBudget exhausted" after
  only one real tool call (check_case_completeness) — proving the
  override is genuinely read and genuinely changes real system
  behavior, not just stored inertly

  live processes terminated and the scratch stack torn down
  (docker compose down -v) after verification
```

### Security, privacy, cost, and compatibility

- Closes a real gap in Section 9.7's own "trusted Agent deadlines plus versioned, atomic budget usage" safety-control language: before this slice, every tenant shared the identical, hardcoded budget with no way for an operator to tighten it for a specific tenant (e.g. a new or lower-trust integration) without a code change and redeploy.
- No new secrets, no new external dependencies, no behavioral change for any tenant that never sets an override — the platform default stays byte-identical to what every tenant already had.

### Known gaps

- **Only step/duration budgets are tenant-configurable** — token/provider-call/cost budgets stay hardcoded at `0` (this graph makes no model calls and its tools make no outbound provider calls of their own), matching the same honest-null pattern already established for those dimensions elsewhere in this codebase.
- **No REST surface to read or set the override** — script-only, matching `create-api-client.ts`'s own precedent (see Decisions).
- The other four Section 20 M5 configuration domains (provider/policy/webhook/communication-template) remain as investigated: two already genuinely tenant-owned, two architecturally not tenant-specific given this codebase's current real capabilities.
- Every other M5 Known gap (OIDC/FAPI 2.0, encrypted field/object boundaries, `legal_holds`, provider-promotion governance) is unchanged by this slice.

### Next safe step

Of M5's remaining large items (OIDC/FAPI 2.0, `legal_holds`, encrypted field/object boundaries, provider-promotion governance), each is a genuinely separate, larger subsystem — the user's own "M5 剩餘的大項目" direction named these as the remaining pool without picking one yet. `legal_holds` was considered next but set aside for now: like `communication_approvals` before M5-018, it would have no real caller to wire it to (no deletion/anonymization workflow exists yet for a hold to actually gate) — the same "isolated table with no real consumer" shape this session has consistently avoided building. Awaiting direction on which of the remaining large items to take on next.

## M5-022: Real REST surface for communication-message approval and delivery (Section 9.4/6.4)

### Status

Implemented and verified, including a full live proof against a real running API + Temporal worker under `NODE_ENV=production` with the restricted `mortgage_app` role. Closes a Known gap M5-018's own dev log entry named directly ("`approve()` still has no real REST/GraphQL caller") and a second gap discovered while investigating it: `CommunicationDeliveryService.deliver()` — the actual sending mechanism `send_information_request` (Section 9.4) needs — was also fully built and tested but had zero real callers anywhere in this codebase. Chosen after ruling out all four previously-named "M5 remaining big items" (OIDC/FAPI 2.0 is charter-blocked by Section 2's own architecture table, which requires a real managed identity provider rather than a homegrown one; field/object encryption has nothing real to encrypt yet; `legal_holds` and provider-promotion governance both still have no real caller/consumer to wire to) — this was the one concrete, currently-real, already-fully-built gap left to close.

### Acceptance criterion

A new `CommunicationMessagesController` under `/v1/loan-cases/:caseId/communication-messages` exposes: `GET` (list a case's messages, newest first), `POST .../:messageId/approve` (REVIEWER-gated, Section 6.4's exact human-approval requirement), and `POST .../:messageId/send` (delivers a ready-to-send message). Proven end to end against a real API + worker: a `PROTECTED` message drafted with `freeformContent` cannot be sent before approval (409), cannot be approved by a `PARTNER`-role credential (403, and records a real `RBAC_REJECTED` audit event), cannot be approved by another tenant's own `REVIEWER` credential (404 — RLS hides it, no existence leak), succeeds for the case's own `REVIEWER` credential (201, real `CommunicationApproval` row), rejects a second approval attempt (400), lists as `APPROVED` afterward, delivers successfully via any authenticated role once approved (200, real `deliveryReference`), rejects a second send attempt (409, now `SENT`), and produces exactly one real `CommunicationDelivered` outbox event plus real `COMMUNICATION_APPROVED`/`COMMUNICATION_SENT` audit events — the former now carrying a real `correlationId` threaded from the request, closing a second small gap (`approve()` previously hardcoded `correlationId: null` because it had no HTTP caller to thread one from).

### Implementation

- `src/communications/communication-messages.controller.ts` (new) — `list`/`approve`/`send`, `@UseGuards(ApiKeyGuard)` at the class level matching `CasesController`'s convention; `approve` additionally `@UseGuards(RoleGuard)` + `@RequireRole(ApiClientRole.REVIEWER)`; `send` is deliberately not role-gated (see Decisions).
- `src/communications/dto/approve-communication-message.dto.ts` (new) — `actorId` (required) + `reason` (optional), matching `ReviewDto`'s own shape and reasoning (a shared REVIEWER credential's caller still supplies which human actually decided).
- `src/communications/communication-message.service.ts` — new `listForCase(tenantId, caseId)` method (newest-first), the read side this slice needed and the service didn't have yet.
- `src/communications/communication-approval.service.ts` — `approve()` gained an optional trailing `correlationId` parameter, threaded through to the audit event it already records internally; fixed a latent bug found while wiring the first real caller — `findOneByOrFail` on an unknown/cross-tenant message id would have thrown TypeORM's own `EntityNotFoundError`, surfacing as an unhandled 500 (no global exception filter exists in this codebase) rather than a clean 404. Replaced with `findOneBy` + an explicit `NotFoundException`, matching `CasesService.getCase()`'s own established convention.
- `src/communications/communication-delivery.service.ts` — the identical `findOneByOrFail` → 500 bug, fixed the identical way.
- `src/communications/communications.module.ts` — registers the new controller; added `ApiClient` to its own `TypeOrmModule.forFeature([...])` (see Errors and fixes).
- `test/negative-authorization.e2e-spec.ts` — two new real e2e tests (PARTNER-role 403 on approve; cross-tenant REVIEWER 404 on approve) plus a coverage-index comment update; new imports for `CommunicationMessageService`/`CommunicationMessage`.
- `openapi/openapi.json` / `client/generated/schema.d.ts` — regenerated to include the three new routes.

### Affected files

- `src/communications/communication-messages.controller.ts` (new), `src/communications/dto/approve-communication-message.dto.ts` (new)
- `src/communications/communication-message.service.ts`, `communication-approval.service.ts`, `communication-delivery.service.ts`, `communications.module.ts`
- `test/negative-authorization.e2e-spec.ts`
- `openapi/openapi.json`, `client/generated/schema.d.ts`
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **`send` is not REVIEWER-gated, deliberately.** Section 6.4's human-approval requirement is about *approving* protected content, not about who is allowed to trigger delivery of already-ready content — `deliver()`'s own state-based readiness check (`ROUTINE`+`DRAFTED` or `PROTECTED`+`APPROVED`, otherwise `NOT_READY`) already fails closed for any caller regardless of role. Restricting the role here would add no real authorization boundary beyond what that check already enforces, only ceremony. Proven directly: the live verification script had a `PARTNER`-role credential successfully call `send` on an already-`REVIEWER`-approved message.
- **`NOT_READY` maps to HTTP 409, not a 200 with an outcome field.** `deliver()`'s own return type is a union (`DELIVERED` | `NOT_READY`) because it's a legitimate non-exceptional outcome at the service layer, but at the REST boundary "you asked to send something not ready to send" is a state conflict — a real HTTP status a caller's own error-handling can branch on, not a field they have to parse out of a 200 body.
- **Nested under `/v1/loan-cases/:caseId/communication-messages`, matching `CasesController`'s own path convention**, even though Section 15.1's own target REST surface never named this endpoint — the same "an honest extension beyond the charter's minimal named surface" pattern several other M5 additions already established (e.g. `/consents`, M5-005).
- **Fixed the `findOneByOrFail` → 500 bug in both `approve()` and `deliver()` rather than leaving it**, since this slice is precisely what gives both their first real caller — an unfixed 500-instead-of-404 on a routine not-found case would have shipped as a real regression in this same commit, not a pre-existing issue merely inherited.
- **Threaded a real `correlationId` into `approve()`'s own audit event** rather than leaving M5-019's `correlationId: null` comment accurate-but-now-stale — cheap to do exactly when the first real HTTP caller appears, and the class comment already predicted this ("any other future caller without HTTP context can still omit it").

### Errors and fixes

- **`ApiKeyGuard`/`RoleGuard` used via `@UseGuards(...)` class references failed to resolve their own `ApiClientRepository` dependency** the first time the new controller was compiled into a real Nest testing module (`Nest can't resolve dependencies of the ApiKeyGuard (?)... "ApiClientRepository" ... available in the CommunicationsModule module`) — despite `AuthModule` being `@Global()`. `CasesModule`/`WebhooksModule` both already carry the identical fix (`ApiClient` added to their own `TypeOrmModule.forFeature([...])`, not just relying on the global export) for the exact same reason; applied the same fix to `CommunicationsModule`. All 4 e2e suites (33 tests, +2 new) and the full 75-suite/550-test unit run passed clean afterward.
- No other unexpected failures — `findOneByOrFail`'s latent 500-on-not-found bug (see Decisions) was found by inspection while reading the existing services before wiring a caller, not by a failing test.

### Verification

```text
npm run build / npm run lint / npm run lint:check
  all passed clean

Fresh scratch stack (m5022verify, ports 5443/7234), fully migrated:
  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    4 suites / 31 tests passed (pre coverage-index-test-addition run)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent
    75 suites / 550 tests passed

Manual live verification — real API + real Temporal worker under
NODE_ENV=production with APP_DATABASE_URL (the mortgage_app role),
driven via real fetch() calls against the real running server, not
supertest against an in-memory app:
  - drafted a real PROTECTED message (freeformContent) directly via
    CommunicationMessageService
  - send before approval -> 409 (NOT_READY)
  - PARTNER-role approve -> 403 (RoleGuard), and a real RBAC_REJECTED
    audit event was recorded
  - cross-tenant REVIEWER approve -> 404 (RLS; no existence leak)
  - real REVIEWER approve -> 201, real CommunicationApproval row
  - re-approve -> 400 (already approved)
  - list -> 200, shows the message as APPROVED
  - PARTNER send (post-approval) -> 200, DELIVERED, real
    deliveryReference
  - re-send -> 409 (already SENT)
  - direct psql/pg proof: exactly one real communication.delivered
    outbox event; real COMMUNICATION_APPROVED (with a real, non-null
    correlationId) and COMMUNICATION_SENT audit events; a real
    RBAC_REJECTED audit event for the earlier PARTNER 403

Second fresh scratch stack (m5022verify2), fully migrated, after adding
the two new negative-authorization e2e tests:
  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    4 suites / 33 tests passed (31 -> 33: +2 new)
  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent
    75 suites / 550 tests passed, unchanged

  live processes terminated, both scratch stacks torn down
  (docker compose down -v), one-off verification script deleted after use
```

### Security, privacy, cost, and compatibility

- Closes a real authorization-relevant gap: before this slice, `CommunicationApprovalService.approve()` and `CommunicationDeliveryService.deliver()` were fully built, RLS-protected, and tested in isolation, but literally unreachable from outside the process — Section 6.4's human-approval requirement had no real enforcement surface a caller could actually hit.
- Fixes a genuine 500-vs-404 information-disclosure-adjacent bug (an unhandled `EntityNotFoundError` on a not-found/cross-tenant id) in both services before either got its first real caller, rather than shipping it.
- No new secrets, no new external dependencies, no schema/migration changes.

### Known gaps

- **No REST endpoint drafts a communication message** — only the Agent tool (`draft_information_request`, called internally during a case's own Agent run) and the direct-service path this slice's own tests use can create one; this slice is the read/approve/send side only, matching the scope of the gap it closes.
- **`send`'s own idempotency is `deliver()`'s existing status-check, not a dedicated `Idempotency-Key`** — a concurrent double-send race is closed by the same status transition every other write in this codebase relies on (not a new gap this slice introduces, but not a new idempotency mechanism either).
- Every other M5 Known gap (OIDC/FAPI 2.0, encrypted field/object boundaries, `legal_holds`, provider-promotion governance) is unchanged by this slice.

### Next safe step

Awaiting direction on which of M5's remaining large items (OIDC/FAPI 2.0, `legal_holds`, encrypted field/object boundaries, provider-promotion governance) to take on next, or a pivot to M6 (Operations UI) — all four remaining M5 items still lack the concrete, currently-real, closable shape this session's own methodology looks for before starting one.

## M5-023: Real REST callers for escalate_to_reviewer and check_policy_change_impact (Section 9.4)

### Status

Implemented and verified, including a real live proof against a real running API + Temporal worker under `NODE_ENV=production` with the restricted `mortgage_app` role. Closes the M3 gap the user asked to fill directly: of Section 9.4's sixteen registered tools, seven are real, and three of those seven (`escalate_to_reviewer`, `check_policy_change_impact`, `send_information_request`) were never invoked anywhere in this codebase. Investigated all three individually rather than mechanically wiring each into `lending-operations-agent-runtime.ts`'s own `StateGraph`:

- **`send_information_request`** — concluded no further work belongs in this slice. Every communication message in this codebase is always classified `PROTECTED` (no `ROUTINE` template is seeded anywhere), so Section 6.4 forbids the Agent from ever supplying its own approval — there is no real scenario today where the graph's own synchronous run could invoke this tool and have it succeed. M5-022 already gave the underlying `CommunicationDeliveryService.deliver()` a real REST caller, which is the actual capability gap; forcing the trivial pass-through tool wrapper into the graph would only ever be exercised by a scenario (a `ROUTINE` message) that cannot occur with this codebase's current real data.
- **`escalate_to_reviewer`** — this codebase's own honest self-count (`mandatory-review-triggers.ts`'s module comment: "currently detect four of twelve" Section 9.6 triggers) already established that no fifth real, non-fabricated automatic detector exists today. Inventing one to give this tool an automatic call site would be exactly the fabricated-coverage trap this codebase's own standing conventions warn against. Given a real REST caller instead — a human reviewer's own judgment call, the same "give the tool to a human instead of a fabricated Agent decision" shape M5-022 already used for `send_information_request`/`approve`.
- **`check_policy_change_impact`** — reading `PolicyChangeImpactService` in full showed `assessImpact()` (the catalog-wide scan `PolicyActivationService.activate()`/`withdraw()` already triggers) and `assessImpactForCase()` (this tool's own backing method) share one private `assessOneCase()` helper — the tool is structurally an operator's own per-case advisory query ("does this one case need a fresh look?"), not something the per-case Agent graph's own control flow needs, since `evaluatePolicyNode` already gets real binding-validation/re-resolution on every run via `PolicyEvaluationService`. Given a real REST caller for the same reason as the other two.

### Acceptance criterion

`POST /v1/loan-cases/{caseId}/escalate` and `POST /v1/loan-cases/{caseId}/policy-change-impact` both exist, both go through the actual registered `AgentTool`s via `invokeTool`/`buildToolRegistry` (not a bypass calling the underlying service directly), and both are proven end to end against a real API + worker: escalating a fresh case succeeds (`200`, case now `WAITING_FOR_REVIEW`, a real signed `case.escalated` outbox event, a real `CASE_ESCALATED` audit event with the real reason); escalating it again `409`s (a new `INVALID_STATUS` outcome — see Errors and fixes); a cross-tenant credential gets `404` on both new routes, never a resource-existence-leaking `403`; a never-evaluated case's policy-change-impact check reports the real, honest `{assessed: false, reason: "case has no live policy binding to compare against"}` outcome, not an error.

### Implementation

- `src/agent-runtime/tools/escalate-to-reviewer.tool.ts` — new `ESCALATABLE_STATUSES` guard (`DRAFT`/`COLLECTING_EVIDENCE`/`CONDITIONS_OPEN`/`WAITING_FOR_INFORMATION` only) and a new `INVALID_STATUS` outcome, checked atomically in the same compare-and-swap `UPDATE ... WHERE status IN (...)` as the existing version check — not a separate read-then-write race. Found while designing the REST caller: the tool's own pre-existing logic would have silently regressed an already-`READY_FOR_UNDERWRITING`/`MANUAL_REVIEW`/`CLOSED` case back to `WAITING_FOR_REVIEW` given a valid version, with no real caller having ever exercised that path before now.
- `src/cases/dto/escalate.dto.ts`, `src/cases/dto/check-policy-change-impact.dto.ts` (new) — `actorId`/`reason` (both required, matching `EscalateToReviewerArgs`'s own contract) and a `@IsUUID()` `policyVersionId` respectively.
- `src/cases/cases.service.ts` — `escalate()`/`checkPolicyChangeImpact()`, each: `getCase()` first (tenant-ownership 404, and for escalate, the case's current `version` for compare-and-swap), builds a one-tool registry, calls `invokeTool`. Gained a `PolicyChangeImpactService` constructor dependency and a small `outboxSigningSecret()` private helper (used by the new `escalate()`; the pre-existing `createCase()` call site was left as its own inline call, not refactored, to keep this slice's diff minimal).
- `src/cases/cases.controller.ts` — `escalate`/`checkPolicyChangeImpact` routes; `escalate` records a `CASE_ESCALATED` audit event after success (M5-019's pattern), `checkPolicyChangeImpact` does not (advisory-only, and the assessment itself already lives in its own `policy_change_impact_assessments` row — the same reasoning M5-019's own "representative cross-section, not a blanket pass" scoping used).
- `src/cases/cases.module.ts` — imports `PolicyModule` (not `@Global()`, unlike `AuthModule`/`ConsentModule`/`AuditModule`, so this one needed an explicit import for `PolicyChangeImpactService` to resolve).
- `test/cases.e2e-spec.ts` — six new e2e tests (three per new route: happy path, a real conflict/negative case, cross-tenant 404).
- `src/agent-runtime/tools/escalate-to-reviewer.tool.spec.ts` — one new unit test for the `INVALID_STATUS` outcome.
- `openapi/openapi.json` / `client/generated/schema.d.ts` — regenerated.

### Affected files

- `src/agent-runtime/tools/escalate-to-reviewer.tool.ts` (+`.spec.ts`)
- `src/cases/dto/escalate.dto.ts` (new), `src/cases/dto/check-policy-change-impact.dto.ts` (new)
- `src/cases/cases.service.ts` (+`.spec.ts`), `cases.controller.ts`, `cases.module.ts`
- `test/cases.e2e-spec.ts`
- `openapi/openapi.json`, `client/generated/schema.d.ts`
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **A real REST caller for each, not a forced LangGraph node, and not a Temporal signal/resume mechanism.** Considered a new `communicationApproved`-style Temporal signal that would resume `case-conditions.workflow.ts` to invoke `send_information_request` after a human's REST approval (M5-022) — rejected once tracing the actual workflow control flow showed condition *resolution* (`resolveConditionSignal`, already real) and communication *delivery* are genuinely independent concerns in this codebase: the workflow's own durable wait is on the condition being resolved, never on the drafted message being sent. Coupling them would have been complexity serving no real requirement, not a genuine gap.
- **Went through `invokeTool`/`buildToolRegistry`, not the underlying services directly** — unlike M5-022's `approve`/`send` (which called `CommunicationApprovalService`/`CommunicationDeliveryService` directly, reasonable there since the Agent-tool wrappers add zero logic beyond a pass-through). Here, going through the real registry costs nothing extra and gives these two tools their first genuine invocation anywhere in the codebase, matching the "a registered tool is the only path to this side effect" invariant more strictly.
- **`escalate` is open to any authenticated role, not REVIEWER-gated.** Escalating only ever adds human scrutiny to a case, never removes it — it carries none of the approval-bypass risk `submitReview`'s/communication-`approve`'s REVIEWER gates exist for.
- **Fixed the tool's own missing status guard while giving it a real caller**, rather than leaving it and discovering the regression later: this slice is precisely what gives `escalate_to_reviewer` its first real invocation, so an unguarded regression bug would have shipped as a genuine new bug in this same commit, not merely an inherited pre-existing one (the same reasoning M5-022 used for its own `findOneByOrFail` fix).

### Errors and fixes

- **Found via design review, not a failing test**: `escalateToReviewerTool`'s pre-existing compare-and-swap `UPDATE` had no status guard at all — a correctly-versioned escalation request against an already-`READY_FOR_UNDERWRITING` case would have silently regressed it back to `WAITING_FOR_REVIEW`. Never triggered before this slice (the tool had zero real callers), so not a live regression, but a real latent bug in code about to get its first one. Fixed with `ESCALATABLE_STATUSES` + a new `INVALID_STATUS` outcome, checked atomically in the same `UPDATE ... WHERE ... status IN (...)` as the version compare-and-swap.
- No other unexpected failures — both new REST routes' happy paths and negative cases passed on the first full verification run.

### Verification

```text
npm run build / npm run lint / npm run lint:check
  all passed clean

Fresh scratch stack (m5023verify, ports 5443/7234), fully migrated
(no new migration in this slice):
  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent
    75 suites / 551 tests passed (550 -> 551: +1 new INVALID_STATUS unit test)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    4 suites / 39 tests passed (33 -> 39: +6 new e2e tests)

Manual live verification — real API + real Temporal worker under
NODE_ENV=production with APP_DATABASE_URL (the mortgage_app role),
driven via real fetch() calls against the real running server:
  - created a real case (DRAFT)
  - policy-change-impact on a never-evaluated case -> 200,
    {assessed:false, reason:"case has no live policy binding..."}
  - cross-tenant policy-change-impact -> 404
  - escalate -> 200, case now WAITING_FOR_REVIEW
  - re-escalate (already WAITING_FOR_REVIEW) -> 409 (INVALID_STATUS)
  - cross-tenant escalate -> 404
  - direct psql proof: exactly one real case.escalated outbox event
    (real signature-verifiable payload) and exactly one real
    CASE_ESCALATED audit event carrying the real supplied reason

  openapi/openapi.json + client/generated/schema.d.ts regenerated
  against a throwaway migrated scratch Postgres, diff confirmed
  purely additive

  live processes terminated, all scratch stacks torn down
  (docker compose down -v), one-off verification script deleted after use
```

### Security, privacy, cost, and compatibility

- Closes a real "written and tested but never invoked in a live process" gap for two of Section 9.4's seven real tools, and fixes a genuine latent case-status-regression bug in the third before it ever had a real caller to trigger it.
- `escalate`'s open-to-any-role design was a deliberate risk judgment (see Decisions), not an oversight — recorded here so a future reviewer can re-evaluate it explicitly rather than rediscover the reasoning from scratch.
- No new secrets, no new external dependencies, no migrations.

### Known gaps

- **`check_policy_change_impact` does not validate that `policyVersionId` references a real `PolicyVersion` row** — this is `PolicyChangeImpactService.assessImpactForCase()`'s own pre-existing characteristic (it only ever stores the id, never looks it up), now reachable by an external caller for the first time. Low real risk (the resulting assessment row is tenant-scoped and RLS-protected, so a garbage id only ever produces a slightly garbage advisory row inside the caller's own tenant, never a cross-tenant or security issue) — noted rather than silently left undocumented.
- **`send_information_request` remains genuinely un-wireable into the LangGraph graph today** (see Status) — revisit only if a real `ROUTINE`-eligible communication template is ever seeded, which would be the first real scenario this tool's graph-level wiring could ever actually exercise.
- Every other M5/M3 Known gap is unchanged by this slice.

### Next safe step

Awaiting direction: M5's remaining large items (OIDC/FAPI 2.0, `legal_holds`, encrypted field/object boundaries, provider-promotion governance) still lack a concrete closable shape; M6 (Operations UI) remains entirely unbuilt and is the largest single gap in the whole project at this point.

## M4-006: Provider kill switch (Section 11.4)

### Status

Implemented and verified, including a real live proof under `NODE_ENV=production`: the identical scenario, run twice against the same tenant, reaches `READY_FOR_UNDERWRITING` when its income provider is active and `MANUAL_REVIEW` when it's disabled — with zero redeploy in between, only a real script writing to a real table a real running worker process consults on its very next dispatch. Closes the one concrete, currently-real piece of M4's own governance gap: Section 11.4's full `ProviderPromotionManifest`/`ProviderCertificationRecord`/`ProviderApprovalRecord`/`ProviderActivation` chain is designed around a governed `PRODUCTION_BYOC` promotion, and this codebase has only ever implemented `SIMULATOR` mode (M4-001's own scoping note) — certifying or dual-approving a promotion to a mode that doesn't exist would be ceremony around nothing real, the same "fabricated coverage" trap this session has consistently avoided elsewhere. Section 11.4's own kill-switch language is explicitly independent of that: "a kill switch can suspend a provider or capability without redeploying the application" is real and useful today regardless of what mode exists, and — checked directly — nothing in this codebase could do that before this slice: `ProviderRegistryService.resolve()` is a pure in-memory lookup with no concept of "currently enabled."

### Acceptance criterion

A new `provider_adapter_status` table (no row for a tuple = ACTIVE, the implicit default) is checked by `dispatch-provider-request.ts` immediately after resolving the adapter, on every single provider dispatch. `npm run set-provider-status -- <providerId> <capability> <mode> <enable|disable> <actorId> [reason]` toggles it. Proven live: the same case-conditions scenario, same tenant, driven through the real REST API and a real Temporal worker — `READY_FOR_UNDERWRITING` with the provider active, `MANUAL_REVIEW` immediately (no wasted retries) once disabled via the script alone, `READY_FOR_UNDERWRITING` again once re-enabled — the worker process was never restarted between any of these three runs.

### Implementation

- `src/database/enums/provider-platform.enum.ts` — new `ProviderAdapterState` (`ACTIVE`/`DISABLED`) — deliberately two states, not the charter's fuller `ACTIVE`/`SUSPENDED`/`DISABLED`, since this codebase has no distinct real meaning for SUSPENDED vs DISABLED yet.
- `src/database/entities/provider-adapter-status.entity.ts` (new) — unique on `(providerId, capability, mode)`; NOT RLS-protected (see Decisions).
- `src/database/migrations/1787177600000-ProviderAdapterStatus.ts` (new).
- `src/provider-platform/provider-kill-switch.service.ts` (new, +`.spec.ts`) — `isActive()`/`disable()`/`enable()`, upserting on the tuple's own unique constraint.
- `src/provider-platform/dispatch-provider-request.ts` — new `ProviderDisabledError`; checked right after `registry.resolve()`, before any grant/intent machinery runs.
- `src/provider-platform/provider-platform.module.ts` — registers the new entity/service.
- `src/workflows/case-conditions.activities.ts` — `callProviderWithRetryClassification` now classifies `ProviderDisabledError` as `ApplicationFailure.nonRetryable('ProviderDisabled', ...)`, the same "retrying can never fix this attempt" reasoning already applied to `ProviderRevalidationError` — an operator's deliberate disable won't flip back within a few seconds, so burning Temporal's retry budget against it would only slow the route to manual review, not avoid it.
- `src/set-provider-status.ts` (new script) — matches `create-api-client.ts`/`set-tenant-agent-budget.ts`'s own established script-not-endpoint convention.
- `package.json` — new script entry.
- Threaded `providerKillSwitchService` through every `CaseConditionsActivitiesDeps`/`EvaluationRunnerDeps` construction site: `worker.ts`, `evaluation-report.ts`, and both files' own `.spec.ts` test fixtures (4 call sites in `case-conditions.activities.spec.ts`, 1 shared `deps()` factory in `runner.spec.ts`).

### Affected files

- `src/database/enums/provider-platform.enum.ts`, `src/database/entities/provider-adapter-status.entity.ts` (new), `src/database/migrations/1787177600000-ProviderAdapterStatus.ts` (new), `schema-migrations.spec.ts`
- `src/provider-platform/provider-kill-switch.service.ts` (new, +`.spec.ts`), `dispatch-provider-request.ts` (+`.spec.ts`), `provider-platform.module.ts`
- `src/workflows/case-conditions.activities.ts` (+`.spec.ts`)
- `src/worker.ts`, `src/evaluation/runner.ts` (+`.spec.ts`), `src/evaluation-report.ts`
- `src/set-provider-status.ts` (new), `package.json`
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **A standalone kill switch, not the full manifest/certification/approval/activation chain.** Considered building `ProviderPromotionManifest` rows for the 5 currently-real `SIMULATOR` adapters too (their `providerId`/`capability`/`mode` identity is genuinely real) — rejected: most of that interface's fields (`credentialRef`, `webhookSecretRef`, `endpointAllowlist`) would be honestly empty for `SIMULATOR` (Section 11.1: "free default," no real credentials), and a `ProviderCertificationRecord`/`ProviderApprovalRecord` pair certifying/dual-approving a `SIMULATOR` adapter against itself has no real stakes to govern — there is no second mode it's being promoted *to*. The kill switch stands entirely on its own in the charter's own text and doesn't need that machinery to have genuine value.
- **Two states (`ACTIVE`/`DISABLED`), not the charter's three (`ACTIVE`/`SUSPENDED`/`DISABLED`).** This codebase has no real distinction between "suspended" and "disabled" yet — both would mean "don't dispatch," with the same real consequence — so declaring a third value nothing differentiates would be the same kind of unbacked vocabulary this codebase's own conventions avoid.
- **No RLS on `provider_adapter_status`.** `ProviderRegistryService` registers exactly one adapter per `{capability, mode}` globally, shared identically across every tenant — there is no tenant dimension to scope this to, matching `tenants`/the policy catalog's own precedent (M5-021's investigation) of a real, deliberately-unprotected shared table.
- **Current-state-only, not an append-only event log.** One row per tuple, upserted — not the fuller attributable history `audit_events` gives tenant-scoped actions. `audit_events` itself structurally cannot represent this action (its `tenantId` column is NOT NULL and RLS-enforced; this action has no tenant), and building a second bespoke event-sourced history table for a single boolean flag would be premature abstraction for what's realistically an infrequent operator action. Recorded as an honest Known gap, not silently accepted.
- **Classified `ProviderDisabledError` in `callProviderWithRetryClassification` while wiring it in**, rather than leaving it to fall through as an unclassified error (Temporal's default 3-attempt retry policy) — the identical reasoning already applied to `ProviderRevalidationError`, so leaving it out would have been a real, if minor, inconsistency shipped in the same commit that introduced the error type.

### Errors and fixes

- None functionally — every new test (the 5-test `provider-kill-switch.service.spec.ts`, the new `dispatch-provider-request.spec.ts` kill-switch test, the new `case-conditions.activities.spec.ts` classification test, and the new `schema-migrations.spec.ts` revert-chain test) passed on the first full verification run.
- The usual `schema-migrations.spec.ts` maintenance ritual — a new first revert-chain test (new-table style, matching `DataDispositionTasks`'/`AuditEvents`' own precedent minus the RLS-specific checks, since this table has none).

### Verification

```text
npm run build / npx tsc --noEmit / npm run lint / npm run lint:check
  all passed clean (tsc's only remaining errors are 3 pre-existing,
  unrelated loan.service.spec.ts type errors, confirmed present on a
  git stash of this slice's own changes too)

Fresh scratch stack (m4006verify, ports 5443/7234), fully migrated:
  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent
    76 suites / 559 tests passed (551 -> 559: +1 new suite,
    provider-kill-switch.service.spec.ts, 5 tests; +1 dispatch-provider-
    request.spec.ts kill-switch test; +1 case-conditions.activities.spec.ts
    classification test; +1 schema-migrations.spec.ts revert-chain test)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    4 suites / 39 tests passed, unchanged (no REST surface changed)

Manual live verification — real API + real Temporal worker under
NODE_ENV=production with APP_DATABASE_URL (the mortgage_app role),
the same worker process running throughout all three runs below:
  - baseline: a real case run through the real workflow with the
    income provider at its default ACTIVE state -> READY_FOR_UNDERWRITING
  - ran npm run set-provider-status -- plaid-simulator INCOME SIMULATOR
    disable ... (the real script, real process, no redeploy)
  - the identical scenario, same tenant -> MANUAL_REVIEW, immediately
    (no wasted retry attempts, confirming the nonRetryable classification)
  - ran npm run set-provider-status -- ... enable ...
  - the identical scenario again -> READY_FOR_UNDERWRITING
  - direct psql proof: exactly one provider_adapter_status row, final
    state ACTIVE, matching the script's own last action

  live processes terminated, scratch stack torn down (docker compose
  down -v), one-off verification script deleted after use
```

### Security, privacy, cost, and compatibility

- Closes a real operational gap: before this slice, a misbehaving simulator adapter (a real bug, a bad synthetic-data regression) had no way to be taken offline short of a code change and redeploy — genuinely risky for any production-shaped incident-response story, even at `SIMULATOR` scale.
- `disable()`/`enable()` require no dual approval (Section 11.4: "Emergency disable remains a single authorized fail-safe action" — only governed `PRODUCTION_BYOC` re-enable needs the fuller approval chain this slice doesn't build). Recorded as a deliberate scope decision, not an oversight.
- No new secrets, no new external dependencies, no behavioral change for any tuple that's never been explicitly disabled — every existing adapter keeps its current real dispatch behavior unchanged (implicit ACTIVE default).

### Known gaps

- **Current-state-only, no history of past disable/enable cycles** (see Decisions) — a future real need for "who disabled this and when, across every past incident" would need a dedicated event-sourced table, not a retrofit of this one.
- **No dual-approval re-enable path** — matches Section 11.4's own single-action emergency-disable language, but a governed `PRODUCTION_BYOC` re-enable (requiring the fuller approval chain) remains unbuilt, tied to the same missing second provider mode as the rest of Section 11.4/11.8's governance chain. **Closed by M4-007/M5-029**: `ProviderPromotionService.activate()` never succeeds without a current valid certification and approval, whether it's a tuple's first activation or a re-activation after `deactivate()` — there is no "quick re-enable" bypass, proven by a real test (M5-029).
- The full `ProviderPromotionManifest`/`ProviderCertificationRecord`/`ProviderApprovalRecord`/`ProviderActivation` chain remains unbuilt — still blocked on there being no second real provider mode to promote to or certify against.
- Every other M4/M5/M3 Known gap is unchanged by this slice.

### Next safe step

Awaiting direction: M5's remaining large items (OIDC/FAPI 2.0, `legal_holds`, encrypted field/object boundaries) and the rest of M4's provider-promotion governance chain still lack a concrete closable shape without a second real provider mode; M6 (Operations UI) remains entirely unbuilt and is the largest single gap in the whole project.

## M3-024: send_information_request's first automatic caller — a real ROUTINE readiness notice (Section 9.4/6.4)

### Status

Implemented and verified, including a real live proof under `NODE_ENV=production`: a tenant that ran `npm run seed-communication-template` gets a real `ROUTINE`, auto-sent notice the moment its case reaches `READY_FOR_UNDERWRITING`; a tenant that never ran it gets zero behavior change, not a silent unsent draft. Closes the root cause this session identified for why `send_information_request` had never been wired anywhere: every communication message in this codebase was always `PROTECTED` because no `ROUTINE`-eligible template had ever existed. This slice supplies the missing half — a real way to create one (`npm run seed-communication-template`) and a real, structural trigger point that uses it (`finalizeReadyForUnderwriting`) — rather than fabricating a scenario around the existing gap.

### Acceptance criterion

`case-conditions.activities.ts`'s `finalizeReadyForUnderwriting` — the one real place a case genuinely, successfully reaches `READY_FOR_UNDERWRITING` (both the straight-through path and the post-condition-resolution path) — now attempts a real `draft_information_request` + `send_information_request` tool invocation for a well-known template key (`READY_FOR_UNDERWRITING_NOTICE`), through the actual registered-tool registry (`invokeTool`/`buildToolRegistry`), not a bypass. Gated on the tenant actually having an `APPROVED` template at that key first — a tenant that never seeded one gets no `CommunicationMessage` row at all, not a permanent empty `PROTECTED` draft. Live-verified: a seeded tenant's case reaches `READY_FOR_UNDERWRITING` with a real `ROUTINE`, `SENT` message (real substituted content, real `deliveryReference`); an unseeded tenant's case reaches the identical status with zero `ROUTINE` messages, only whatever the pre-existing (M5-012) condition-remediation mechanism independently produces.

### Implementation

- `src/communications/well-known-templates.ts` (new) — `READY_FOR_UNDERWRITING_TEMPLATE_KEY`/`_VERSION` constants, the one place `case-conditions.activities.ts` and the new seed script both need to agree.
- `src/seed-communication-template.ts` (new script) — `npm run seed-communication-template -- <tenantId> <templateKey> <version> <channel> <locale> <recipientRelationship> <approvedBy> <bodyTemplate>`. Creates the template already `APPROVED` (the script *is* the approval act, matching this codebase's other administrative scripts' single-step trust). `allowedVariables` is derived from `bodyTemplate`'s own `{{variableName}}` placeholders via the same `PLACEHOLDER_PATTERN` regex `communication-render.ts` uses, not a separately supplied list that could drift from the template body. Refuses to overwrite an existing `(tenantId, templateKey, version)` row (templates are immutable once created) rather than silently upserting.
- `src/workflows/case-conditions.activities.ts` — new `CommunicationDeliveryService` dependency; a small local `readyNotificationTools` registry (`draft_information_request` + `send_information_request`); `sendReadyForUnderwritingNotification(tenantId, caseId)` — checks for the approved template first (returns immediately, no draft attempt, if absent), then drafts and sends, logging (never throwing) any failure so a routine notification's own trouble can never block the case's already-committed `READY_FOR_UNDERWRITING` transition. Called from both real call sites of `finalizeReadyForUnderwriting` (the straight-through-ready branch in `evaluateConditions`, and `markReadyForUnderwriting` after a condition resolves).
- `src/agent-runtime/langgraph/lending-operations-agent-runtime.ts` — updated its own top-comment to note the new, separate (non-graph) real caller, without overstating that `send_information_request` is now wired into the `StateGraph` itself (it isn't, and still can't be — see M5-023's own entry for why the condition-remediation draft stays permanently `PROTECTED`).
- Threaded `communicationDeliveryService` through every `CaseConditionsActivitiesDeps`/`EvaluationRunnerDeps` construction site: `worker.ts`, `evaluation-report.ts` (raw-constructed: `new CommunicationDeliveryService(dataSource, new CommunicationDeliverySimulator(), new ConfigService({OUTBOX_SIGNING_SECRET: outboxSigningSecret}))`, matching `ProviderAuthorizationService`'s own existing raw-construction precedent in that same script), and both files' own `.spec.ts` fixtures.

### Affected files

- `src/communications/well-known-templates.ts` (new), `src/seed-communication-template.ts` (new), `package.json`
- `src/workflows/case-conditions.activities.ts` (+`.spec.ts`)
- `src/agent-runtime/langgraph/lending-operations-agent-runtime.ts`
- `src/worker.ts`, `src/evaluation/runner.ts` (+`.spec.ts`), `src/evaluation-report.ts`
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **The trigger point is `finalizeReadyForUnderwriting` (the activities layer), not a new node inside `lending-operations-agent-runtime.ts`'s own `StateGraph`.** `finalizeReadyForUnderwriting` is called from *two* real places — the graph's own straight-through "no condition matched" branch, and the workflow's post-condition-resolution path — and only the activities layer sees both. Putting the notification here covers a case that reaches READY either way with one code path; putting it inside the graph's own `resolveOutcomeNode` would have missed the condition-resolution path entirely.
- **Still goes through `invokeTool`/`buildToolRegistry`, not the underlying services directly** — the identical reasoning M5-023 already established: costs nothing extra, and gives `send_information_request` its first genuine registered-tool invocation, regardless of which layer the call site lives in.
- **Opt-in per tenant via an up-front template-existence check, not a fail-closed-after-drafting default.** Considered letting `classifyCommunication`'s own existing "template not found -> PROTECTED" fail-closed path handle an unseeded tenant (simpler code, one fewer query) — rejected once weighing the real cost: every case reaching READY for every tenant, forever, would get a permanent, empty-content, never-approvable `CommunicationMessage` row it never asked for. Checking first avoids that noise entirely for the common case (a tenant that hasn't opted in) at the cost of one extra tenant-scoped read.
- **A script, not a REST endpoint, for template seeding** — matches `create-api-client.ts`/`set-tenant-agent-budget.ts`/`set-provider-status.ts`'s own established convention exactly: no admin RBAC tier exists for this class of platform-configuration action, and Section 6.4's own approval requirement for this specific content class is a human, out-of-band decision regardless.

### Errors and fixes

- **A real bug in this slice's own first draft**: `sendReadyForUnderwritingNotification` read `drafted.id` from the `draft_information_request` tool's result — but `DraftInformationRequestResult`'s actual field is `communicationMessageId`, not `id`. The typo passed `undefined` through to `send_information_request`, which silently found and "delivered" a message via a coincidental empty-`WHERE`-clause read (only one message existed for the test tenant) but then failed to actually persist the `SENT` status update the same way — caught by the unit test's own exact status assertion (`DRAFTED` instead of `SENT`), not a live-verification-only bug. Fixed by reading the correct field and typing it against `DraftInformationRequestResult` instead of an inline `{ id: string }` shape that let the typo through unchecked.
- **Live-verify script found a real environmental gotcha, not a product bug**: the Plaid simulator's income is deterministically hash-derived *per borrowerId string*, not fixed — a hardcoded verify-script borrowerId could coincidentally land outside the seeded rule's 10% discrepancy threshold and open a real condition instead of reaching `READY_FOR_UNDERWRITING` directly. Fixed the verify script (not the product) to detect and resolve an opened condition via the real `POST .../reviews` endpoint before continuing to poll — which, incidentally, ended up exercising *both* real code paths this slice touches (the straight-through path and the post-resolution path) across its two tenant runs.
- A stale `communication_templates` row from an earlier failed verification attempt (before the fix above) briefly caused a real `FK violation` on cleanup (`communication_messages.templateId` is `RESTRICT`) — fixed the test's own cleanup ordering (delete referencing messages before the template), not a product-code issue.

### Verification

```text
npm run build / npx tsc --noEmit / npm run lint / npm run lint:check
  all passed clean (tsc's only remaining errors are the same 3
  pre-existing, unrelated loan.service.spec.ts errors noted in M4-006)

Fresh scratch stack (m3024verify, ports 5443/7234), fully migrated
(no new migration — no schema change in this slice):
  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent
    76 suites / 561 tests passed (559 -> 561: +2 new
    case-conditions.activities.spec.ts tests — the opt-in/no-noise case
    and the real seeded-template draft-then-send case)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    4 suites / 39 tests passed, unchanged (no REST surface changed)

Manual live verification — real API + real Temporal worker under
NODE_ENV=production with APP_DATABASE_URL (the mortgage_app role):
  - ran npm run seed-communication-template for real against one tenant
    (the real script, real process)
  - seeded tenant: a real case driven through the real workflow via the
    real REST API reached READY_FOR_UNDERWRITING with exactly one real
    communication_messages row: classification ROUTINE, status SENT,
    renderedContent the real substituted template text, a real
    deliveryReference
  - unseeded tenant: the identical scenario reached the identical
    status with zero ROUTINE messages (one incidental PROTECTED
    condition-remediation draft did appear, from the pre-existing
    M5-012 mechanism unrelated to this slice, confirming this slice
    adds nothing extra for a tenant that never opted in)

  live processes terminated, scratch stack torn down (docker compose
  down -v), one-off verification script deleted after use
```

### Security, privacy, cost, and compatibility

- Closes a real "this tool has never been invoked anywhere, ever" gap for the last of Section 9.4's seven real tools, without weakening Section 6.4's human-approval requirement anywhere: the notice can only ever be `ROUTINE` (auto-sendable) if it passes `classifyCommunication`'s own unchanged, deterministic guard against a real `APPROVED` template — the exact same gate every other communication in this codebase has always gone through.
- No new secrets, no new external dependencies, no migrations, no behavioral change for any tenant that never runs the new seed script.

### Known gaps

- **Only one well-known template key exists** (`READY_FOR_UNDERWRITING_NOTICE`) — the mechanism is generic (any tenant can seed any template via the script), but only this one specific trigger point (`finalizeReadyForUnderwriting`) is wired to look one up. A future real trigger (e.g. "case created" acknowledgment) would need its own well-known key and its own call site.
- **The seed script has no update/versioning helper beyond "use a new version manually"** — matches the entity's own immutability discipline but is genuinely more friction than a dedicated `--supersede` flag would be; not built since no real operational need for frequent template revision has come up yet.
- Every other M5/M4/M3 Known gap is unchanged by this slice.

### Next safe step

Continuing directly to the other gap named alongside this one: `legal_holds` and a real deletion/anonymization/verification executor for `data_disposition_tasks`, closing the second of the two gaps identified as buildable without any external dependency.

## M5-025: legal_holds and real data-disposition-task resolution (Section 14.1/14.2)

### Status

Implemented and verified, including a real live proof under `NODE_ENV=production` covering all three real disposition outcomes end to end against a real running API + worker. Closes the second of two gaps identified as buildable without any external dependency (alongside M3-024): `data_disposition_tasks` had existed since M5-015 but nothing had ever advanced a task past `PENDING`, and `legal_holds` — a top-level Section 14.1 entity — had never been built at all. Both needed each other to be honest: a real deletion/anonymization executor with no way to check a legal hold first would violate Section 14.2's own "legal holds are explicit, scoped, reviewable, and never inferred" requirement, so this is one slice, not two.

### Acceptance criterion

`DataDispositionService.resolve(tenantId, taskId, action, actorId)` — `action` is `DELETE`, `ANONYMIZE`, or `RETAIN` — is the first real thing that ever acts on a `PENDING` task. `DELETE`/`ANONYMIZE` both check `LegalHoldService.hasActiveHold()` first and fail closed if a hold is active; `RETAIN` requires an active hold to be a legitimate, explainable choice (this codebase's only real retention basis) and fails closed otherwise. `DELETE` really removes the referenced `evidence_facts` rows; `ANONYMIZE` keeps the rows but blanks `value` to `{}`; either way the task moves straight to `VERIFIED` with a real `resolutionOutcome`/`resolvedBy`/`resolvedAt`. Live-verified: a real DELETE removed real evidence rows; a real active hold genuinely blocked a real DELETE attempt (task stayed `PENDING`); `RETAIN` under that same hold succeeded and left the evidence completely untouched; a separate real ANONYMIZE blanked real evidence values while keeping the rows.

### Implementation

- `src/database/enums/legal-hold.enum.ts` (new) — `LegalHoldStatus` (`ACTIVE`/`RELEASED`).
- `src/database/entities/legal-hold.entity.ts` (new) — one row per hold, not an append-only log (documented simplicity tradeoff, same shape M4-006's kill switch already made).
- `src/database/enums/data-disposition.enum.ts` — new `DataDispositionResolutionOutcome` (`DELETED`/`ANONYMIZED`/`RETAINED_UNDER_HOLD` — deliberately no `PENDING_BACKUP_EXPIRY`, since this codebase has no backup subsystem to track one against).
- `src/database/entities/data-disposition-task.entity.ts` — new `resolutionOutcome`/`resolvedBy` columns.
- `src/database/migrations/1787177700000-LegalHoldsAndDataDispositionResolution.ts` (new) — `legal_holds` table + RLS, plus the two new columns on the already-RLS-protected `data_disposition_tasks`, in one migration (one real feature slice).
- `src/data-disposition/legal-hold.service.ts` (new, +`.spec.ts`) — `place()` (rejects a second `ACTIVE` hold for the same case), `release()`, `hasActiveHold()` (checked fresh on every call, never cached).
- `src/data-disposition/data-disposition.service.ts` — new `resolve()` method; gained a `LegalHoldService` constructor dependency.
- `src/data-disposition/data-disposition.module.ts` — registers `LegalHold`/`LegalHoldService`.
- `src/manage-legal-hold.ts` (new script) — `npm run manage-legal-hold -- <tenantId> <caseId> place <ownerId> <reason>` / `... <legalHoldId> release <releasedBy>`.
- `src/resolve-data-disposition-task.ts` (new script) — `npm run resolve-data-disposition-task -- <tenantId> <taskId> <DELETE|ANONYMIZE|RETAIN> <actorId>`.
- `package.json` — two new script entries.
- Threaded the new `LegalHoldService` constructor dependency through every raw `new DataDispositionService(...)` construction site (7 files: `evaluation-report.ts` and 6 `.spec.ts` fixtures).

### Affected files

- `src/database/enums/legal-hold.enum.ts` (new), `src/database/entities/legal-hold.entity.ts` (new)
- `src/database/enums/data-disposition.enum.ts`, `src/database/entities/data-disposition-task.entity.ts`
- `src/database/migrations/1787177700000-LegalHoldsAndDataDispositionResolution.ts` (new), `schema-migrations.spec.ts`
- `src/data-disposition/legal-hold.service.ts` (new, +`.spec.ts`), `data-disposition.service.ts` (+`.spec.ts`), `data-disposition.module.ts`
- `src/manage-legal-hold.ts` (new), `src/resolve-data-disposition-task.ts` (new), `package.json`
- `src/evaluation-report.ts`, `src/workflows/case-conditions.activities.spec.ts`, `src/consent/consent.service.spec.ts`, `src/evaluation/runner.spec.ts`, `src/provider-platform/provider-authorization.service.spec.ts`, `src/provider-platform/dispatch-provider-request.spec.ts`
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **`legal_holds` is its own dedicated table, not a `DataDispositionTaskType.LEGAL_HOLD` row.** The charter lists `legal_holds` as its own top-level Section 14.1 entity with its own lifecycle (place/review/release), structurally different from a disposition task's own PENDING-to-VERIFIED resolution flow. `DataDispositionTaskType.LEGAL_HOLD` stays declared-but-undriven (unchanged Known gap) rather than repurposed to mean something it doesn't.
- **`RETAIN` requires an active hold; there is no "retain for an unrelated business reason" option.** This codebase has exactly one real, honest retention basis (Section 14.2: "retained under a valid hold") — inventing a second freeform retention reason with no real backing policy would be exactly the fabricated-coverage this session's own methodology avoids.
- **`ANONYMIZE` blanks `value` to `{}` rather than deleting the row.** Keeps the row (and its `factType`/`sourceKind`/`observedAt` lineage metadata) as a real anonymized marker, distinct from `DELETE`'s full removal — matching Section 14.2's own explicit distinction between "deleted" and "anonymized" as two different real outcomes to record, not one.
- **Scripts, not REST endpoints, for both new actions** — matches `create-api-client.ts`/`set-tenant-agent-budget.ts`/`set-provider-status.ts`'s own established convention exactly: deciding to actually delete or anonymize collected evidence, or to place/release a legal hold, is squarely a human, out-of-band decision this codebase's two-role tenant RBAC has no admin tier for.
- **One migration for both `legal_holds` and the `data_disposition_tasks` columns**, not two — `resolve()` cannot exist honestly without `legal_holds` to check first, so splitting the migration would have shipped a half-working intermediate state.

### Errors and fixes

- **A real FK violation in this slice's own new tests**: `makeCaseWithTask()`'s first draft attached evidence to a bare `randomUUID()` "case id" with no real `LoanCase` row behind it — `EvidenceFact.case` is a real FK (`onDelete: CASCADE`), unlike `DataDispositionTask.caseId`, which is a plain column with no FK of its own. Fixed by creating a genuine `LoanCase` row per test.
- **The same relation-metadata gap this session has hit repeatedly**: `resolve-data-disposition-task.ts`'s live-verify run failed with `Entity metadata for EvidenceFact#case was not found` — its `DataSource`'s own `entities: [...]` array was missing `LoanCase` (and transitively `Tenant`/`Jurisdiction`, `LoanCase`'s own two `@ManyToOne` relations). Fixed by adding all three.

### Verification

```text
npm run build / npx tsc --noEmit / npm run lint / npm run lint:check
  all passed clean (tsc's only remaining errors are the same 3
  pre-existing, unrelated loan.service.spec.ts errors noted in M4-006)

Fresh scratch stack (m5025verify, ports 5443/7234), fully migrated:
  DATABASE_URL=... TEMPORAL_ADDRESS=... npm test -- --runInBand --no-cache
  --silent
    77 suites / 574 tests passed (561 -> 574: +1 new suite,
    legal-hold.service.spec.ts, 6 tests; +7 new DataDispositionService
    resolve() tests; +1 schema-migrations.spec.ts revert-chain test)

  DATABASE_URL=... TEMPORAL_ADDRESS=... npm run test:e2e
    4 suites / 39 tests passed, unchanged (no REST surface changed)

Manual live verification — real API + real Temporal worker under
NODE_ENV=production with APP_DATABASE_URL (the mortgage_app role):
  - scenario 1 (DELETE): a real case's real evidence, revoked consent
    opened a real PENDING RETENTION_REVIEW task with 3 real evidence
    ids snapshotted; npm run resolve-data-disposition-task ... DELETE
    -> task VERIFIED/DELETED, all 3 evidence_facts rows genuinely gone
  - scenario 2 (hold blocks DELETE, then RETAIN): npm run
    manage-legal-hold ... place put a real ACTIVE hold on a second
    case; a DELETE attempt against that case's task genuinely failed
    (task stayed PENDING, real evidence untouched); RETAIN then
    succeeded -> task VERIFIED/RETAINED_UNDER_HOLD, all evidence intact
  - scenario 3 (ANONYMIZE): a third case's task resolved via
    ANONYMIZE -> all 3 evidence_facts rows still exist but every
    value column is genuinely {}

  live processes terminated, scratch stack torn down (docker compose
  down -v), one-off verification script deleted after use
```

### Security, privacy, cost, and compatibility

- Closes a real Section 14.2 compliance gap: before this slice, a data-disposition review could be opened but never actually resolved — no deletion, anonymization, or hold ever really happened, meaning the whole mechanism was observational only.
- `legal_holds` is real, explicit, and checked fresh on every `resolve()` call — never inferred from case status or any other signal, matching Section 14.2's own explicit requirement.
- No new secrets, no new external dependencies, no behavioral change for any existing `PENDING` task until an operator explicitly resolves it.

### Known gaps

- **`legal_holds` is current-state-only, not a full append-only history** — matches `ProviderAdapterStatus`'s own documented simplicity tradeoff (M4-006); a genuine future need for "every past hold on this case, not just the current one" would need a dedicated history table.
- **Only `evidence_facts` is a real deletion/anonymization target** — Section 14.2's fuller lineage ("document, evidence, normalized finding, cache, search index, prompt, evaluation artifact, object, and backup") stays unbuilt for every concept beyond evidence, since this codebase has none of those other subsystems to traverse (same honest scoping `DataDispositionTask.affectedEvidenceFactIds` already had).
- **No backup-expiry tracking** — this codebase has no backup subsystem at all, so `DataDispositionResolutionOutcome` deliberately has no `PENDING_BACKUP_EXPIRY` value to track against nothing real.
- Every other M5/M4/M3 Known gap is unchanged by this slice.

### Next safe step

Both gaps named as "buildable without any external dependency" (M3-024, M5-025) are now closed. What remains — OIDC/FAPI 2.0, encrypted field/object boundaries, and the provider-promotion governance chain (M4/M5) — each still needs either an external identity-provider decision or a second real provider mode this codebase doesn't have. M6 (Operations UI) remains entirely unbuilt and is the largest single gap in the whole project.

## M4-007: A real `AUTHORIZED_SANDBOX` provider (Plaid) and the governed promotion chain that gates it (Section 11.1/11.4)

### Status

Implemented and verified, including a real live proof under real Plaid sandbox credentials and a real running database: the exact scenario M4-006's own entry named as blocking the full chain — "certifying or dual-approving a promotion to a mode that doesn't exist would be ceremony around nothing real" — no longer applies. This is the second real provider mode this codebase has ever had (`SIMULATOR` was the only one since M4-001), and the governed chain Section 11.4 designs around it: `ProviderPromotionManifest` -> `ProviderCertificationRecord` -> `ProviderApprovalRecord` -> `ProviderActivation`, mirroring `PolicyTransitionApprovalService`'s exact dual-control shape (Section 16.1). Deliberately scoped to two closable pieces — the real adapter, and the real governance chain that gates it — and deliberately NOT wired into the live default underwriting dispatch path (see Decisions): every real case today still resolves through `SIMULATOR` exactly as before this slice.

### Acceptance criterion

`PlaidIncomeSandboxAdapter` (`providerId: 'plaid-sandbox'`, `mode: 'AUTHORIZED_SANDBOX'`) makes real HTTP calls to `sandbox.plaid.com` — `/user/create`, `/sandbox/public_token/create`, `/item/public_token/exchange`, `/credit/bank_income/get` — and maps Plaid's real Bank Income response into this codebase's existing `PlaidIncomeData` shape. `dispatchProviderRequest` refuses to dispatch to it (`ProviderNotActivatedError`) until a manifest for `{plaid-sandbox, INCOME, AUTHORIZED_SANDBOX}` has gone through `propose()` -> a `PASSED`, unexpired `certify()` -> an `APPROVED`, unexpired `approve()` from a *different* actor than the proposer -> `activate()`; `SIMULATOR` mode is never gated (Section 11.1's free default is unchanged). Live-verified end to end: `status` reports `NOT ACTIVATED` before any of this; `activate()` fails closed with neither certification nor approval, then with only one of the two; a same-actor `approve()` is rejected; a real dispatch after full activation returns real Plaid data (`monthlyIncome: 2100.78, employmentStatus: "FULL_TIME", bankAccountAge: 11.93, incomeStability: 100`) through the unmodified production `dispatchProviderRequest` code path.

### Implementation

**Part 1 — the real adapter:**

- `src/integrations/plaid/plaid-sandbox.service.ts` (new, +`.spec.ts`) — `PlaidSandboxService`, a real HTTP client against `https://sandbox.plaid.com` using real `PLAID_SANDBOX_CLIENT_ID`/`PLAID_SANDBOX_SECRET`; exported `mapBankIncomeToPlaidIncomeData()` — a pure function mapping Plaid's real `bank_income_sources[]` shape into `PlaidIncomeData`: `monthlyIncome` from the `SALARY` source only (falling back to `GIG_ECONOMY`, classified `SELF_EMPLOYED`; `UNEMPLOYED`/0 if neither exists) divided by real elapsed months; `bankAccountAge` as the earliest `start_date` across every source, in months — an honest *lower bound*, since Plaid's real Accounts product has no account-opening-date field at all (confirmed empirically against all 14 real sandbox accounts); `incomeStability` as a real coefficient-of-variation score over `historical_summary[]`'s monthly buckets (100 for zero variance, lower for volatile income).
- `src/integrations/plaid/plaid-income-sandbox.adapter.ts` (new, +`.spec.ts`) — `PlaidIncomeSandboxAdapter implements ProviderAdapter<...>`, same shape as the existing `PlaidIncomeAdapter` (`SIMULATOR`); `submit()` calls the real service, `healthCheck()` does a real `HEAD` against `sandbox.plaid.com`.
- `src/integrations/integrations.module.ts`, `src/integrations/provider-adapter-bootstrap.service.ts` — registers the new adapter alongside the existing five; registration itself is free (no network call, no credential check) — a missing/invalid credential only fails at actual dispatch time, matching this codebase's established "fail at call time, not boot time" convention.

**Part 2 — the governance chain:**

- `src/database/enums/provider-promotion.enum.ts` (new) — `ProviderCertificationDecision` (`PASSED`/`FAILED`/`REVOKED`), `ProviderApprovalDecision` (`APPROVED`/`REJECTED`/`REVOKED`), `ProviderActivationState` — deliberately binary (`ACTIVE`/`DEACTIVATED`), mirroring `ProviderAdapterState`'s own M4-006 reasoning: no distinct real consequence for a third value.
- Four new entities (`provider-promotion-manifest.entity.ts`, `provider-certification-record.entity.ts`, `provider-approval-record.entity.ts`, `provider-activation.entity.ts`) — an honestly-trimmed subset of the charter's full field lists (keeps `endpointAllowlist`, `dataClassifications`, `adapterVersion`, `contentHash`, `validFrom`/`validUntil`; skips fields referencing governance subsystems that don't exist, like `consentAndPurposePolicyId`/`rateAndCostBudgetId`). Manifest and certification/approval records are immutable/append-only (new row per proposal or decision, never mutated); `ProviderActivation` is current-state-only, one row per `{providerId, capability, mode}`, matching `ProviderAdapterStatus`'s own precedent. None are tenant-scoped or RLS-protected — same reasoning as `ProviderAdapterStatus`: `ProviderRegistryService.resolve()` has no tenant dimension, so neither does promoting one of its registrations.
- `src/database/migrations/1787177800000-ProviderPromotionChain.ts` (new) — all four tables, no RLS.
- `src/provider-platform/provider-promotion.service.ts` (new, +`.spec.ts`) — `propose()` (increments `version` per tuple, computes a real `contentHash` via the existing `computeDigest()`), `certify()`, `approve()` (rejects self-approval exactly like `PolicyTransitionApprovalService`, only for `APPROVED` decisions), `activate()` (requires a current `PASSED`+unexpired certification for the target environment AND a current `APPROVED`+unexpired approval; an optimistic-lock `expectedCurrentManifestVersion` guards against two operators racing to activate two different manifests for the same tuple), `deactivate()` (single-actor, matching the kill switch's own "emergency disable needs no dual control" precedent), `isActivated()` (the real dispatch-time gate — fails closed, no row means never-activated, the opposite of the kill switch's own "no row means ACTIVE" default).
- `src/provider-platform/dispatch-provider-request.ts` — new `ProviderNotActivatedError`; checked right after the kill-switch check, only for `mode !== 'SIMULATOR'`.
- `src/manage-provider-promotion.ts` (new script, 6 subcommands: propose/certify/approve/activate/deactivate/status) — matches `set-provider-status.ts`/`manage-legal-hold.ts`'s established script-not-endpoint convention; `package.json` gained one entry.
- Threaded `providerPromotionService` through every `DispatchProviderRequestDeps`/`CaseConditionsActivitiesDeps`/`EvaluationRunnerDeps` construction site: `worker.ts`, `evaluation-report.ts`, `evaluation/runner.ts`, and all their `.spec.ts` fixtures (4 call sites in `case-conditions.activities.spec.ts`, 1 in `dispatch-provider-request.spec.ts`, 1 in `runner.spec.ts`).
- `provider-adapter-status.entity.ts`, `provider-platform/types.ts` — comments updated to stop claiming no promotion chain or second provider mode exists.

### Affected files

- `src/integrations/plaid/plaid-sandbox.service.ts` (new, +`.spec.ts`), `plaid-income-sandbox.adapter.ts` (new, +`.spec.ts`)
- `src/integrations/integrations.module.ts`, `provider-adapter-bootstrap.service.ts`
- `src/database/enums/provider-promotion.enum.ts` (new)
- `src/database/entities/provider-promotion-manifest.entity.ts`, `provider-certification-record.entity.ts`, `provider-approval-record.entity.ts`, `provider-activation.entity.ts` (all new)
- `src/database/migrations/1787177800000-ProviderPromotionChain.ts` (new), `schema-migrations.spec.ts`
- `src/database/entities/provider-adapter-status.entity.ts`, `src/provider-platform/types.ts` (comment accuracy only)
- `src/provider-platform/provider-promotion.service.ts` (new, +`.spec.ts`), `dispatch-provider-request.ts` (+`.spec.ts`), `provider-platform.module.ts`
- `src/manage-provider-promotion.ts` (new), `package.json`
- `src/workflows/case-conditions.activities.ts` (+`.spec.ts`), `src/worker.ts`, `src/evaluation/runner.ts` (+`.spec.ts`), `src/evaluation-report.ts`
- `.env` (git-ignored; real sandbox-only Plaid credentials, never production)
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Investigated Plaid's real sandbox API directly before writing any mapping code** — live `curl` calls with real credentials plus `WebFetch` against Plaid's actual documentation, the same "confirm real state before designing" discipline this session has applied to internal code all along, now applied to an external, real system. Found and fixed a real integration bug this way: `/sandbox/public_token/create`'s `user_id` belongs at the request's top level, not nested in `options` (nesting throws `HTTP 400 UNKNOWN_FIELDS`).
- **Not wired into the live default underwriting dispatch path.** `dispatchProviderRequest`'s `mode` parameter defaults to `SIMULATOR` and nothing in `case-conditions.activities.ts` was changed to ever pass `AUTHORIZED_SANDBOX` — every real case today resolves exactly as before this slice. Reached deliberately, not by omission: routing real borrower PII through a real external sandbox from the live decisioning path intersects with the still-fully-deferred field/object-encryption item (Section 11.5/16.2), and this slice's own acceptance criterion — a real adapter, gated by a real governance chain, both provably real via direct dispatch calls — doesn't need that wiring to be honest.
- **Binary `ProviderActivationState` (`ACTIVE`/`DEACTIVATED`), not the charter's `ACTIVE`/`SUSPENDED`/`DISABLED`.** Same reasoning `ProviderAdapterState` already established (M4-006): no real behavioral difference between a third value and `DEACTIVATED` exists in this codebase yet.
- **`ProviderActivation` stays separate from the pre-existing kill switch, not merged into it.** They're opposite defaults for opposite failure modes: the kill switch defaults ACTIVE (an emergency single-actor stop for something already trusted), the promotion chain defaults DEACTIVATED/never-activated (a default-deny gate for something not yet trusted). `dispatchProviderRequest` checks both for any non-`SIMULATOR` mode; `SIMULATOR` itself only ever goes through the kill switch, unchanged from M4-006.
- **No FK constraints from certification/approval records to their manifest** — matches this codebase's existing convention (`PolicyTransitionApproval.policyVersionId`) of plain `uuid` reference columns without a declared relation.
- **Credential handling**: the real Plaid Client ID and Secret, received via chat, were written directly to the git-ignored `.env` and never echoed back, placed in visible command text, or logged — sourced via `set -a; source .env; set +a` for every verification step, and redacted from printed API-response output during investigation.

### Errors and fixes

- **`/sandbox/public_token/create` field placement** — see Decisions above.
- **A hand-miscalculated test expectation** in `plaid-sandbox.service.spec.ts`: first draft expected `monthlyIncome ≈ 2094.05` from a miscounted date span; the actual, correct value (348 real days ÷ 30.44 avg days/month) is `2100.78`. Fixed the test, not the (already-correct) production formula.
- **The default Plaid sandbox test user has no clean payroll transactions** — confirmed via a real `/transactions/sync` call before relying on it for anything; switched to Plaid's own documented `user_bank_income` override persona for income-specific testing instead.
- **A self-inflicted `replace_all` overlap** while threading `providerPromotionService` through `case-conditions.activities.spec.ts`'s four call sites: a 6-space-indent replacement string matched as a substring of the file's 8-space-indent occurrences too, duplicating one line at two of the four sites. Caught immediately by re-grepping the file's own edited state before moving on, not by a later test failure.
- The usual `schema-migrations.spec.ts` maintenance ritual — a new first revert-chain test (four new tables, no RLS, matching `provider_adapter_status`'s own precedent).

### Verification

```text
npm run build / npm run lint / npm run lint:check — all clean

Fresh scratch stack (ports 5544/7244), fully migrated via npm run migration:run:
  npm test -- --runInBand
    79 of 80 suites passed (1 pre-existing skip: case-conditions.workflow.spec.ts,
    needs TEMPORAL_ADDRESS, unrelated to this slice)
    583 passed / 10 skipped / 593 total
    (10 skipped = describeOrSkip specs gated on env not present in every run)
  With PLAID_SANDBOX_CLIENT_ID/SECRET sourced: plaid-income-sandbox.adapter.spec.ts's
    3 real-network tests against sandbox.plaid.com all passed

Second fresh scratch stack (ports 5545/7245), fully migrated:
  npm run test:e2e — 4 suites / 39 tests passed, unchanged (no REST surface changed)

Manual live verification against the first scratch stack:
  - npm run manage-provider-promotion -- status plaid-sandbox INCOME
    AUTHORIZED_SANDBOX -> NOT ACTIVATED
  - propose -> activate before certify/approve -> real BadRequestException
    ("no current PASSED, unexpired certification")
  - certify PASSED -> approve as the SAME actor -> real BadRequestException
    ("self-approval is not permitted")
  - approve as a DIFFERENT actor -> APPROVED -> activate -> succeeds
  - status -> ACTIVE
  - direct dispatchProviderRequest() call (mode: AUTHORIZED_SANDBOX,
    capability: INCOME) through the unmodified production dispatch
    function -> real Plaid data: {monthlyIncome: 2100.78,
    employmentStatus: "FULL_TIME", bankAccountAge: 11.93,
    incomeStability: 100}
  - status for a never-promoted tuple (plaid-sandbox/CREDIT/AUTHORIZED_SANDBOX)
    -> NOT ACTIVATED, confirming the gate isn't accidentally always-open

  both scratch stacks torn down (docker rm -f + network rm), one-off
  verification script deleted after use
```

### Security, privacy, cost, and compatibility

- No behavioral change to any existing case: `SIMULATOR` remains the only mode any real workflow dispatches to; this slice is reachable only through direct `dispatchProviderRequest` calls (specs, scripts, and any future explicit wiring).
- New real external dependency: `sandbox.plaid.com`, sandbox-only credentials, never production. No real borrower PII is sent — every test/verification used synthetic borrower IDs and Plaid's own sandbox test personas.
- The governance chain defaults deny, not allow: a manifest that's merely proposed (not certified+approved+activated) grants no dispatch access — the opposite failure mode from an unbacked "trust by default" gate.
- No new secrets beyond the two Plaid sandbox values, both git-ignored in `.env`.

### Known gaps

- **`bankAccountAge` is a lower bound, not a true account-open date** — Plaid's real Accounts product has no such field (confirmed empirically); the earliest income-source `start_date` is the best honest proxy available.
- **`PART_TIME` employment status is never actually producible** from this real data source — Plaid's Bank Income categories don't distinguish it from `FULL_TIME`'s `SALARY` category. Left in the type for interface parity with the `SIMULATOR` adapter, not fabricated.
- **`ProviderActivation` is current-state-only**, same tradeoff `ProviderAdapterStatus` already made — no full history of past activate/deactivate cycles.
- **No dispatch-time wiring into the live underwriting workflow** — by design (see Decisions), tracked here as the concrete next step if real Plaid-sourced income ever needs to reach a real case.
- **No approval-role RBAC** — `approvalRole` is a free-text string, the same honest scoping `PolicyTransitionApproval` already uses instead of a real role system. **Re-confirmed still open at M5-029**: closing this for real would mean building a REST/GraphQL surface for provider-promotion actions plus an admin RBAC tier this codebase's two-role (`PARTNER`/`REVIEWER`) model has no room for — genuinely new user-facing infrastructure nobody has asked for, not a gap closable by extending an existing mechanism the way M5-026/M5-027/M5-028 each were. Left open deliberately, not attempted.
- Every other M4/M5/M3 Known gap is unchanged by this slice.

### Next safe step

The provider-promotion governance chain named in every prior "remaining gaps" list is now closed. What's left: OIDC/FAPI 2.0 (still awaiting the user's go-ahead to self-host Keycloak), encrypted field/object boundaries (now unblocked in principle — a second real provider mode exists — but still a large, separate slice), and wiring `AUTHORIZED_SANDBOX` into a real case's live dispatch path if that's ever wanted. M6 (Operations UI) remains entirely unbuilt and is the largest single gap in the whole project.

## M5-024: Real OIDC for human identity — self-hosted Keycloak, `users`/`tenant_memberships`, and `TenantAuthGuard` (Section 14.1/16.1)

### Status

Implemented and verified, including a real live proof: a real running API server accepted a real Keycloak-issued OIDC access token, resolved it to a real, previously-provisioned `User`/`TenantMembership`, and created a real loan case through the unmodified `CasesController` — the identical route machine `api_clients` already used, now genuinely reachable by a human credential too. Closes the second half of Section 20 M5's own "OIDC and scoped API-client authentication" line — M5-001's own entry named this as "a genuinely separate, larger effort" deferred at the time; this slice is that effort.

### Acceptance criterion

`TenantAuthGuard` (`src/auth/`) is now what every tenant-scoped controller uses (`@UseGuards(TenantAuthGuard)`, replacing the bare `ApiKeyGuard` reference everywhere it appeared) — it composes `ApiKeyGuard` (unchanged) and a new `OidcGuard` as *alternatives*: a request authenticates if either a machine `{clientId}.{secret}` bearer token or a real OIDC access token (plus an `X-Tenant-Id` header, since one human can hold `tenant_memberships` in more than one tenant) checks out. Both resolve to the identical `AuthContext` shape every existing consumer already reads. `OidcService` does real OpenID Connect Discovery against a configured `OIDC_ISSUER_URL`, then real remote-JWKS signature/issuer/audience/expiry verification via `jose`. Live-verified end to end against a real, freshly-imported Keycloak realm: a real `POST /v1/loan-cases` with a real OIDC bearer token and no `X-Tenant-Id` header got a real `401`; the same request with a real, granted tenant got a real `201` with a real persisted case; the same token against a different, never-granted tenant got a real `401` again.

### Implementation

- `src/auth/auth-context.ts` — `AuthContext.apiClientId` renamed to `actorId` (a machine `ApiClient.id` or a human `User.id` depending on which guard populated it) — audit-event call sites already called this field `actorId`; this interface now matches that name honestly instead of overclaiming a single credential type. Propagated through `api-key.guard.ts`, `role.guard.ts`, `current-auth.decorator.ts`, `auth-tenant-id.decorator.ts`, and every controller/DTO/spec that referenced the old name (6 non-spec files, 3 spec files).
- `src/database/entities/user.entity.ts` (new) — Section 14.1's `users`: global, not tenant-scoped, unique `subject` (the OIDC `sub` claim).
- `src/database/entities/tenant-membership.entity.ts` (new) — Section 14.1's `tenant_memberships`: `(tenantId, userId)` unique, `role` reusing `ApiClientRole` (no second, parallel role vocabulary for a distinction that means the same real thing either way).
- `src/database/migrations/1787177900000-UsersAndTenantMemberships.ts` (new) — both tables, no RLS (see Decisions).
- `src/auth/oidc.service.ts` (new, +`.spec.ts`) — real OIDC Discovery (`/.well-known/openid-configuration`) to find the issuer's own `jwks_uri` rather than hardcoding Keycloak's URL convention; `jose`'s `createRemoteJWKSet`+`jwtVerify` does the real signature/issuer/audience/expiry check. Every failure (unconfigured, unreachable, bad signature, wrong audience, expired) throws the same generic `UnauthorizedException`, matching `ApiKeyGuard`'s own "don't leak which part failed" discipline.
- `src/auth/oidc.guard.ts` (new, +`.spec.ts`) — parses the bearer token and `X-Tenant-Id` header, verifies via `OidcService`, looks up `User` by `subject` then `TenantMembership` by `(tenantId, userId)`, attaches `AuthContext`.
- `src/auth/tenant-auth.guard.ts` (new, +`.spec.ts`) — the OR-composition: try `ApiKeyGuard`, fall back to `OidcGuard` on any failure. NestJS's own `@UseGuards(...)` only composes with AND, so this is hand-written, not framework-provided.
- `src/auth/auth.module.ts` — registers `User`/`TenantMembership`/`OidcService`/`OidcGuard`/`TenantAuthGuard`.
- 4 controllers (`CasesController`, `WebhookEndpointsController`, `WebhookDeliveriesController`, `CommunicationMessagesController`) — `@UseGuards(ApiKeyGuard)` → `@UseGuards(TenantAuthGuard)`; zero other changes, since both guards populate the identical `AuthContext` shape.
- `src/config/env.validation.ts` — `OIDC_ISSUER_URL`/`OIDC_AUDIENCE`, both optional (unset means `OidcGuard` always fails closed; the machine-credential path is completely unaffected).
- `src/manage-user.ts` (new script: `create-user`/`grant-membership`/`revoke-membership`) — matches `create-api-client.ts`'s established script-not-endpoint convention.
- `docker-compose.yml` — new `keycloak` service (`start-dev --import-realm`, its own embedded dev database — a local-only convenience service, not a production deployment target).
- `keycloak/realm-export.json` (new) — a real, importable realm: public client `mortgage-agent-app` with an audience protocol mapper (so `aud` actually carries the client id — Keycloak's own default omits it), one real seeded test user.
- `package.json` — `jose` dependency, `manage-user` script entry.
- `.env.example` — documents `OIDC_ISSUER_URL`/`OIDC_AUDIENCE`.

### Affected files

- `src/auth/auth-context.ts`, `api-key.guard.ts` (+`.spec.ts`), `role.guard.ts` (+`.spec.ts`), `current-auth.decorator.ts`, `auth-tenant-id.decorator.ts`, `auth.module.ts`
- `src/auth/oidc.service.ts` (new, +`.spec.ts`), `oidc.guard.ts` (new, +`.spec.ts`), `tenant-auth.guard.ts` (new, +`.spec.ts`)
- `src/database/entities/user.entity.ts`, `tenant-membership.entity.ts` (both new), `api-client.entity.ts` (comment only)
- `src/database/enums/api-client.enum.ts` (comment only — no longer claims `users`/`tenant_memberships` don't exist)
- `src/database/migrations/1787177900000-UsersAndTenantMemberships.ts` (new), `schema-migrations.spec.ts`
- `src/config/env.validation.ts`
- `src/cases/cases.controller.ts` (+`.spec.ts`), `src/webhooks/webhook-endpoints.controller.ts`, `webhook-deliveries.controller.ts`, `src/communications/communication-messages.controller.ts`
- `src/manage-user.ts` (new), `package.json`, `.env.example`
- `docker-compose.yml`, `keycloak/realm-export.json` (new)
- `test/negative-authorization.e2e-spec.ts` (comment only)
- `README.md`, `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **`jose@4`, not `jose@6`.** `jose@6` is pure ESM (`"type": "module"`, no CJS entry) — this codebase compiles to CommonJS, so a static `import` of it compiles to a `require()` that fails at real Node runtime, not just under Jest. Found this by actually running the test suite after adding the dependency, not by reading changelogs first. `jose@4` has a real CJS build and the identical `createRemoteJWKSet`/`jwtVerify`/`decodeJwt` API this slice needs — a real compatibility constraint, not a downgrade taken lightly.
- **`TenantAuthGuard` composes two existing guards rather than merging OIDC detection into `ApiKeyGuard` directly.** Considered extending `ApiKeyGuard` in place (cheaper — zero new call sites to update) — rejected: a class named `ApiKeyGuard` that also verifies OIDC JWTs would be a real, misleading name, and NestJS's own `@UseGuards(...)` has no built-in OR composition, so *something* has to do it explicitly regardless. A small, honestly-named composing class was worth the 4-controller mechanical update.
- **No RLS on `users`/`tenant_memberships`** — the identical bootstrap reasoning `api_clients` itself already established (no RLS either): `OidcGuard` looks `tenant_memberships` up using a caller-supplied, not-yet-trusted `tenantId` specifically to determine whether the request may act in that tenant at all — tenant context cannot already be established before that lookup runs.
- **One shared `ApiClientRole` enum for both credential models**, not a second `UserRole`. A `PARTNER`/`REVIEWER` distinction means the same real thing regardless of which credential authenticated the request; a parallel enum would be unbacked duplication, the same reasoning `ProviderActivationState` already applied to avoid an unbacked third value (M4-007).
- **Membership required by `(tenantId, userId)` lookup, not auto-provisioned on first successful login.** A real, valid OIDC token alone proves *who* someone is, never *what tenant they may act in* — auto-granting tenant access to any authenticated Keycloak user would be a real self-service privilege-escalation path this codebase's existing "no self-service credential minting" convention (`create-api-client.ts`) already avoids for machine credentials. `manage-user.ts`'s `grant-membership` is a deliberate, separate, human-operated step.
- **Keycloak's own default access token doesn't carry the requesting client in `aud`** (it defaults to `["account"]`; the client id only appears in `azp`) — found this the hard way (an early `jwtVerify(..., { audience })` call failed against a real token before the mapper was added) and fixed it the standard, correct way: a real `oidc-audience-mapper` protocol mapper in the realm config, not a code-side fallback to checking `azp` instead.
- **Keycloak's realm-export needed `firstName`/`lastName` on the seeded user** — a real, reproducible finding: Keycloak 26's declarative User Profile feature requires those attributes by default, and a user missing them fails the Direct Grant (password) flow with a generic, unhelpful `"Account is not fully set up"` / `resolve_required_actions` error that names no specific missing field. Diagnosed via the real Keycloak server's own event log (`docker logs`), not by guessing.

### Errors and fixes

- `jose@6`'s ESM-only build breaking the actual test runtime (not just a lint/type issue) — see Decisions.
- Keycloak's default token `aud` omitting the requesting client — see Decisions (audience mapper).
- Keycloak's Direct Grant flow rejecting a user missing `firstName`/`lastName` under the User Profile feature — see Decisions.
- A self-inflicted `sed`/sequential-edit slip during the `apiClientId` → `actorId` rename left the file consistent (build and lint both passed clean before this was ever committed), but is worth naming as a reminder: a wide rename across many files is exactly the kind of change worth re-grepping in full after, not just spot-checking — done here before moving on.

### Verification

```text
npm run build / npm run lint / npm run lint:check — all clean

Fresh scratch stack (Postgres 5546, Temporal 7246, Keycloak 8090 —
imported from the real keycloak/realm-export.json), fully migrated:
  npm test -- --runInBand
    81 of 83 suites passed (2 pre-existing skips: PLAID_SANDBOX_* not
    sourced in this shell, TEMPORAL_ADDRESS-gated workflow spec run
    separately) — 595 passed / 13 skipped / 608 total, including all
    new auth specs (oidc.service, oidc.guard, tenant-auth.guard —
    every one making real network calls to the real Keycloak container)
  npm run test:e2e — 4 suites / 39 tests passed, unchanged (every
    existing e2e test still authenticates via ApiKeyGuard's own
    unchanged path, proving TenantAuthGuard's fallback is fully
    transparent to every pre-existing machine-credential caller)

Manual live verification — a real API server (NODE_ENV=development,
against the same scratch Postgres) plus real curl calls:
  - npm run manage-user -- create-user <realSubjectFromARealToken>
    reviewer@example.com
  - npm run manage-user -- grant-membership <userId> <tenantId> REVIEWER
  - POST /v1/loan-cases with a real Keycloak access token, no
    X-Tenant-Id header -> real 401
  - the same request + X-Tenant-Id: <granted tenant> -> real 201,
    a real loan_cases row, through the completely unmodified
    CasesController/CasesService
  - the same token against a different, never-granted tenantId -> 401

  live API server stopped, both scratch stacks (Postgres+Temporal,
  separately verified Keycloak-only container) torn down
  (docker rm -f + network rm)
```

### Security, privacy, cost, and compatibility

- `OidcGuard` fails closed by default: unset `OIDC_ISSUER_URL`/`OIDC_AUDIENCE` means every OIDC request is rejected, with zero effect on the pre-existing machine-credential path — a deployment that never needs human login pays no cost for this slice existing.
- Real cryptographic verification throughout: no token is ever trusted without a real signature check against the issuer's own live, remotely-fetched JWKS.
- `X-Tenant-Id` is caller-supplied but never trusted on its own — it only selects *which* `tenant_memberships` row (if any) to check; a request can never act in a tenant it has no real, admin-granted membership in, regardless of what it claims.
- No new secrets beyond `OIDC_AUDIENCE` (not secret) and whatever the deployment's own OIDC provider needs — this codebase itself holds no OIDC client secret (the seeded Keycloak client is public, appropriate for a first-party confidential-client-free local setup).

### Known gaps

- **FAPI 2.0 profile compliance is not attempted** — Section 20 M5 names it as "where required by the provider or customer ecosystem," and this slice's own Keycloak client is a plain public OAuth2/OIDC client (Authorization Code + Direct Grant), not a FAPI 2.0-profiled one (mTLS/DPoP-bound tokens, PAR, JARM). A real FAPI 2.0 deployment is a substantially larger, separately-scoped effort this slice doesn't claim.
- **No membership-change audit trail** — `manage-user.ts`'s `grant-membership`/`revoke-membership` don't write `audit_events` (the script has no real per-request actor/correlationId context an HTTP-layer caller would have); a membership row's own `createdAt` is the only real history.
- **`tenant_memberships` is current-state-only** — one row per `(tenantId, userId)`, updated in place by a re-grant; no history of past role changes, the same simplicity tradeoff `ProviderAdapterStatus` already made.
- **No browser-based login flow anywhere in this codebase** — every real verification used the Direct Grant (password) flow via `curl`, appropriate for this slice's own scope (a real relying party exists and works) but not a full interactive login UI, which is M6 Operations UI scope.
- Every other M5/M4/M3 Known gap is unchanged by this slice.

### Next safe step

Both credential models Section 20 M5 names ("OIDC and scoped API-client authentication") are now real. What's left of M5's own scope: encrypted field/object boundaries (unblocked in principle since M4-007, still a large separate slice) and a FAPI 2.0-profiled client configuration if a real ecosystem partner ever requires it. M6 (Operations UI) remains entirely unbuilt and is the largest single gap in the whole project — and now has a real human-identity system to actually build a login flow against.

## M6-001: A real GraphQL operations-query surface — case, evidence, conditions, timeline (Section 15.2)

### Status

Implemented and verified, including a real live proof: a real running API server, queried over real HTTP with a real Keycloak-issued OIDC token, returned a real case's own core fields plus its real (empty or populated) evidence facts, conditions, and timeline through genuine nested GraphQL field resolution — not a REST response reshaped into GraphQL's wire format. Closes the query-layer half of Section 15.2/the tech-stack table's own assignment ("GraphQL + Apollo Server — flexible case, evidence, and timeline querying for the console"), which had been essentially unbuilt: the only resolver in this codebase before this slice was `LoanResolver`, the older pre-Agent-runtime `evaluateLoan` one-shot path. This is deliberately scoped to the query layer only — no React console exists yet; that's the rest of M6.

### Acceptance criterion

`query { case(caseId: ID!) { ...LoanCase fields... evidenceFacts { ... } conditions { ... } timeline { ... } } }` — a single top-level `case` query gated by the same `TenantAuthGuard` (M5-024) REST already uses (machine `api_client` or human OIDC, either one), with `evidenceFacts`/`conditions`/`timeline` as lazy `@ResolveField()`s a client only pays for by asking for them. Live-verified: the real query above, run with a real OIDC bearer token + `X-Tenant-Id` header against a real running server, returned a real case's real fields and a real, non-empty `timeline` (the real `loan_case.created` domain event); the identical query with no `Authorization` header, and again with a real token against a tenant the caller has no membership in, both failed with the identical generic `UNAUTHENTICATED` GraphQL error `ApiKeyGuard`/`OidcGuard` already use for REST.

### Implementation

- **The real, non-obvious blocker found and fixed first**: every existing auth guard/decorator (`ApiKeyGuard`, `OidcGuard`, `RoleGuard`, `AuthTenantId()`, `CurrentAuth()`) read the request via `context.switchToHttp().getRequest()` — which does not populate correctly for a GraphQL resolver's `ExecutionContext`, the identical real distinction `GqlThrottlerGuard`'s own comment already documented for rate limiting (predates this slice). `src/auth/get-request-from-context.ts` (new, +`.spec.ts`) centralizes the fix `GqlThrottlerGuard` already applied ad hoc: check `context.getType()`, extract `req` via `GqlExecutionContext.create(context).getContext()` for `'graphql'`, fall back to `switchToHttp()` otherwise. All five call sites now use it; every existing mock `ExecutionContext` in their spec files needed a `getType: () => 'http'` stub added (a real, if narrow, regression this slice's own first full-suite run caught immediately).
- `src/database/entities/loan-case.entity.ts`, `evidence-fact.entity.ts`, `loan-condition.entity.ts`, `src/cases/case-timeline.service.ts` (`TimelineEntry`) — `@ObjectType()`/`@Field()` added directly onto these same classes, alongside their pre-existing `@Entity()`/`@Column()`/`@ApiProperty()` decorators (`LoanCase` already did this dual-decoration for two transports; this is a third, real one reusing the same fields rather than a parallel GraphQL DTO). New enum registrations: `CaseStatus` (in `loan-case.entity.ts`, deliberately *not* inside `case-status.enum.ts` itself — that file's own comment already explains why it stays free of anything the Temporal-sandboxed workflow can't load, and `@nestjs/graphql` is exactly that kind of heavy import), `EvidenceType`/`EvidenceSourceKind`/`ConditionStatus`. `LoanType` is already registered by `src/loan/loan.model.ts` — registering it twice throws at startup, so `loan-case.entity.ts` reuses it. `EvidenceFact.value`/`TimelineEntry.detail` (both JSONB/`Record<string, unknown>`) use the `graphql-type-json` scalar (new dependency) rather than a hand-rolled one.
- `src/cases/case-query.service.ts` (new, +`.spec.ts`) — `listEvidenceFacts()`/`listConditions()`, real tenant-scoped reads via `runInTenantContext`, the first real query surface of any kind for either table (no REST route lists either). Kept separate from `CasesService` (REST-facing orchestration, per that class's own comment), the same "small, focused read service" shape `CaseTimelineService` already is.
- `src/cases/cases.resolver.ts` (new, +`.spec.ts`) — `@Resolver(() => LoanCase)`, `@UseGuards(TenantAuthGuard)`; the `case` query plus three `@ResolveField()`s (`evidenceFacts`, `conditions`, `timeline`, the last delegating to the already-existing `CasesService.getTimeline()`/`CaseTimelineService`).
- `src/cases/cases.module.ts` — registers `CaseQueryService`/`CasesResolver`, adds `EvidenceFact` to `TypeOrmModule.forFeature()`.
- `package.json` — `graphql-type-json` dependency.

### Affected files

- `src/auth/get-request-from-context.ts` (new, +`.spec.ts`)
- `src/auth/api-key.guard.ts` (+`.spec.ts`), `oidc.guard.ts` (+`.spec.ts`), `role.guard.ts` (+`.spec.ts`), `current-auth.decorator.ts`, `auth-tenant-id.decorator.ts` — all switched to the new helper
- `src/database/entities/loan-case.entity.ts`, `evidence-fact.entity.ts`, `loan-condition.entity.ts`
- `src/cases/case-timeline.service.ts`, `case-query.service.ts` (new, +`.spec.ts`), `cases.resolver.ts` (new, +`.spec.ts`), `cases.module.ts`
- `package.json`, `package-lock.json`

### Decisions and alternatives

- **Decorate the existing entities directly for GraphQL, not a parallel DTO layer.** `LoanCase` already carries both `@ApiProperty()` (REST) and `@Column()` (TypeORM) on the same fields — adding `@Field()` is the same established pattern extended to a third transport, not a new one. Rejected a separate `CaseGraphQLType` mirroring every field: real duplication-drift risk (a new REST field silently missing from GraphQL, or vice versa) for no real benefit here, since every field genuinely is meant to be readable through both surfaces.
- **`@ResolveField()`s, not an eagerly-populated top-level query.** A client asking only for `{ id status }` triggers zero evidence/condition/timeline reads — GraphQL's own main advantage over a REST response shape that always returns everything.
- **`X-Tenant-Id` (already established by M5-024's `OidcGuard`) works identically for GraphQL** — no new tenant-resolution mechanism needed; `TenantAuthGuard` itself needed zero changes, only the request-extraction helper underneath it.
- **`CaseQueryService` stays separate from `CasesService`.** Matches this codebase's own established preference (`ProviderKillSwitchService`/`ProviderPromotionService`, M4-006/M4-007) for small, single-purpose services over widening an existing one's responsibility.

### Errors and fixes

- **`context.switchToHttp()` not working for GraphQL resolver contexts** — the real, central finding of this slice; see Implementation. Found immediately when actually booting the app and running a real query, not caught by `tsc`/lint (both passed clean before this was ever run).
- **`UndefinedTypeError` on `EvidenceFact.validThrough`** — a real, if narrow, `@nestjs/graphql` reflection limitation: a nullable `Date | null`-typed field needs an explicit `@Field(() => Date, { nullable: true })`, since the implicit form's design-time-metadata inference doesn't resolve correctly through the union. Caught at real app boot (schema generation fails fast with a specific, actionable message naming the exact field), fixed by making the type explicit — the same fix `policySnapshotId`/`evaluationManifestId` (`LoanCondition`) already needed and got right the first time by analogy.

### Verification

```text
npm run build / npm run lint / npm run lint:check — all clean

Fresh scratch stack (Postgres 5547, Temporal 7247, Keycloak 8091):
  npm test -- --runInBand
    84 of 86 suites passed (2 pre-existing skips) — 604 passed / 13
    skipped / 617 total, including the new get-request-from-context,
    case-query.service, and cases.resolver specs
  npm run test:e2e — 4 suites / 39 tests passed, unchanged (no REST
    route touched)
  npm run generate:openapi — zero diff against the committed
    openapi/openapi.json, confirming the REST surface is genuinely
    untouched (git status openapi/ clean)

Manual live verification — a real API server (NODE_ENV=development):
  - real POST /v1/loan-cases with a real OIDC token -> a real case
  - real POST /graphql: query { case(caseId) { id status borrowerId
    requestedAmount statedMonthlyIncome loanType evidenceFacts { id
    factType } conditions { id code status } timeline { kind summary
    timestamp } } } with the same real OIDC token + X-Tenant-Id ->
    the real case's real fields, real empty evidenceFacts/conditions
    (none exist yet for this synthetic case), real non-empty timeline
    (the real loan_case.created domain event)
  - the identical query with no Authorization header -> real
    UNAUTHENTICATED GraphQL error
  - the identical query, real token, a different/never-granted
    X-Tenant-Id -> real UNAUTHENTICATED GraphQL error

  live API server stopped, scratch stack torn down (docker rm -f +
  network rm)
```

### Security, privacy, cost, and compatibility

- No new authentication mechanism — reuses `TenantAuthGuard`/`ApiKeyGuard`/`OidcGuard` exactly as REST already does; the only real change was making the *existing* guards correctly read a GraphQL resolver's request, not a new trust boundary.
- No new secrets, no new external dependency beyond `graphql-type-json` (a tiny, single-purpose, widely-used scalar package — chosen over hand-rolling JSON parse/serialize edge cases).
- `tenantId` is deliberately not exposed as a `@Field()` on `EvidenceFact`/`LoanCondition` (only `LoanCase` already exposed it via REST) — reduces redundant exposure since it's already implied by the parent case a client had to authenticate into.

### Known gaps

- **No React console yet** — this slice is the query layer only, per its own explicit scope. M6's "operations users can understand, review, and recover every synthetic case without direct database access" user-visible outcome needs a real frontend still.
- **No mutations** (satisfy/waive a condition, approve a communication, submit a review) exposed over GraphQL — those all have real REST routes already; whether a console needs GraphQL mutations too, or drives writes through the existing REST surface, is an open design question for the next slice.
- **No case-list query** — only single-case lookup by id exists; a console's own case queue/worklist view needs a real list/filter/paginate query this slice doesn't build.
- Every other M5/M4/M3 Known gap is unchanged by this slice.

### Next safe step

The GraphQL query layer this slice built is real and ready to build a React screen against. Concretely: a case-detail/timeline view, real login via the OIDC/Keycloak stack M5-024 already built, is the natural next slice — the smallest real vertical slice of M6's own user-visible outcome, not the whole console at once.

## M5-026: A permanent structural capability denylist (Section 2/7.5/16.4)

### Status

Implemented and verified. Closes a real, previously-untested Section 16.4 threat scenario: "Provider certification is misread as authority to move funds or perform another structurally excluded action" — the charter's own named mitigation is "Enforce a permanent capability denylist across registries, manifests, routers, and Agent tools" (16.4's own words), and until this slice nothing in this codebase actually enforced that; the boundary held only because no tool or adapter had ever tried to cross it, not because anything would have stopped one that did.

### Acceptance criterion

`assertNotStructurallyExcluded()` (`src/common/structural-exclusions.ts`) is called at both of this codebase's genuinely independent registration choke points — `buildToolRegistry()` (Agent tools) and `ProviderRegistryService.register()` (provider adapters) — and throws, permanently and unconditionally, if a tool or adapter ever declares one of Section 7.5's nine named excluded command classes (`FUNDS_MOVEMENT`, `RATE_LOCK`, `LEGAL_DISCLOSURE`, `FORMAL_DECISION`, `CLEAR_TO_CLOSE`, `SETTLEMENT`, `FUNDING`, `SERVICING_PAYMENT`, `CAPITAL_DELIVERY`). Proven with a real, synthetic test tool/adapter declaring each of the nine classes in turn (18 parameterized tests) — every one rejected; every real tool/adapter in this codebase today declares none, so registration is unaffected.

### Implementation

- **First, real investigation before writing anything**, to avoid the exact anti-pattern this codebase's own conventions warn against: read `LendingOperationsAgentState`'s existing budget fields (`remainingTokenBudget`/`remainingProviderCallBudget`/`remainingCostBudgetMinorUnits`) and confirmed they are correctly, honestly hardcoded to `0` with real justifying comments (`case-conditions.activities.ts`: "this graph makes no model calls," "its tools make no outbound provider calls... evidence was already fetched by earlier workflow activities," "all providers are synthetic; no real cost is ever incurred") — confirmed by reading `lending-operations-agent-runtime.ts` end to end (zero model/Ollama calls anywhere in the graph) and the graph's own topology (`StateGraph`: `verifyConsent -> checkCompleteness -> evaluatePolicy -> resolveOutcome`, a strictly linear chain, no `Send()`/parallel fan-out — no real race condition on `remainingStepBudget` exists for a ledger to guard against either). **Conclusion: M0-009's own "budget ledger" gap (token/cost/provider-call dimensions, currency normalization, unknown-cost reserve, ledger-conflict test) has no real subject matter to enforce in this codebase as built — every dimension it names is either honestly, permanently `0`, or a race that cannot occur given the graph's own linear topology.** Building a ledger for values that are always `0` would itself be the fabricated-coverage anti-pattern this codebase's own standing conventions exist to prevent — so this slice does not attempt one, and instead closes the one M0-009-adjacent gap that *does* have real substance: the structural capability denylist.
- `src/common/structural-exclusions.ts` (new, +`.spec.ts`) — `STRUCTURALLY_EXCLUDED_COMMAND_CLASSES` (Section 7.5's own nine named classes, verbatim) and `assertNotStructurallyExcluded()`.
- `AgentTool<TArgs, TResult>` (`agent-runtime/agent-tool.types.ts`) gains an optional `structurallyExcludedCommandClass` field; `buildToolRegistry()` calls the assertion for every tool.
- `ProviderAdapter<TRequest, TReceipt, TFinding>` (`provider-platform/types.ts`) gains the identical optional field; `ProviderRegistryService.register()` calls the same assertion.
- **Not re-checked at `dispatch-provider-request.ts`/`ProviderPromotionService.propose()`** — `ProviderRegistryService.resolve()` can only ever return an adapter that already passed `register()`'s own check, and adapters are re-registered fresh on every process boot (never persisted), so there is no stale-registration state for a second check to catch that the first one didn't.
- `test/negative-authorization.e2e-spec.ts` — added this scenario to the Section 16.4 coverage index (it was missing entirely); while there, fixed two now-stale entries the same file's own comment had gotten wrong: "early activation... — NOT APPLICABLE for provider activation, no provider-promotion governance subsystem exists" and the whole "self-approval, stale activation race, artifact mismatch..." block, both written before M4-007 built the real promotion-governance chain. Corrected to COVERED (self-approval, stale-activation-race — real M4-007 tests) with the three still-genuinely-N/A sub-scenarios (artifact mismatch, cross-provider fallback reuse, duplicate callbacks after cancellation) named individually with the real reason each still doesn't apply, rather than left under one blanket stale N/A.

### Affected files

- `src/common/structural-exclusions.ts` (new, +`.spec.ts`)
- `src/agent-runtime/agent-tool.types.ts` (+`.spec.ts`)
- `src/provider-platform/types.ts`, `provider-registry.service.ts` (+`.spec.ts`)
- `test/negative-authorization.e2e-spec.ts`

### Decisions and alternatives

- **Investigated and explicitly declined to build a token/cost/provider-call budget ledger** — see Implementation. Recording this as a real, evidence-based decision (not silence) matters: a future reader should not re-open this gap without first checking whether a real model call or real billed provider call has since been added to Section 9's Agent runtime loop, since that is the actual precondition that would make a ledger real rather than ceremonial.
- **An optional field on the existing `AgentTool`/`ProviderAdapter` interfaces, not a parallel manifest/config file.** A denylist that lived in a separate config a developer could simply forget to update would be weaker than one baked into the same interface every tool/adapter must already implement to be registered at all — the same "the type system is the enforcement" reasoning `ProviderOperationDescriptor.effectClass` already established for providers.
- **Checked at registration, not at dispatch/invocation time.** Registration is the one place every tool/adapter must pass through exactly once, at boot; checking again at every dispatch would be redundant runtime cost enforcing an invariant that registration-time already guarantees for the lifetime of the process.

### Errors and fixes

None — built clean, tests passed on the first full run.

### Verification

```text
npm run build / npm run lint / npm run lint:check — all clean

npx jest structural-exclusions agent-tool.types provider-registry.service
  33 passed (18 of them the parameterized one-per-excluded-class tests)

Fresh scratch stack (Postgres 5548, Temporal 7248, Keycloak 8092):
  npm test -- --runInBand — 85 of 87 suites passed (2 pre-existing
    skips), 627 passed / 13 skipped / 640 total
  npm run test:e2e — 4 suites / 39 tests passed, unchanged
```

### Security, privacy, cost, and compatibility

- Closes a real, previously-open Section 16.4 threat scenario with a permanent, structural (not policy-configurable) control — no tenant, provider certification, or Agent configuration can ever disable or narrow it, matching Section 7.5's own "cannot expand it" language.
- Zero behavioral change for any real tool or adapter today — every one declares no command class, so every one continues registering exactly as before.
- No new dependencies, no runtime cost beyond one cheap Set lookup per registration (once, at boot).

### Known gaps

- **No enforcement at the `ProviderPromotionManifest`/`ProviderPromotionService.propose()` layer directly** — relies transitively on the registry-level gate (a manifest can only ever reference a `providerId` whose adapter already passed `register()`). Documented as a deliberate design choice, not an oversight (see Decisions), but a future reader should confirm that reasoning still holds if the promotion chain's own relationship to the registry ever changes.
- **Budget ledger (M0-009) remains genuinely unbuilt** — investigated and explicitly declined this slice; see Implementation and Decisions for the real evidence.
- Every other M0/M3/M4/M5/M6 Known gap is unchanged by this slice.

### Next safe step

Continuing the pre-M5 gap-closure pass: the provider reconciliation worker (`OUTCOME_UNKNOWN` intents have no automatic resolution path — first named M4-001, restated unchanged through M4-007) is next.

## M5-027: Provider reconciliation — real error classification and a real (human) resolution path (Section 11.5)

### Status

Implemented and verified, including a real live proof: a real synthetic-timeout dispatch produced a real `OUTCOME_UNKNOWN` intent; a real reconciliation sweep moved it to `RECONCILING`; the real `resolve-provider-operation-intent` CLI resolved it to `FAILED_FINAL` with a real `resolvedBy`/`resolutionNote`, confirmed with a direct `psql` read. Closes the reconciliation-worker gap first named at M4-001 and restated unchanged through every M4 entry since ("no reconciliation worker... an `OUTCOME_UNKNOWN` intent has no automatic resolution path today") — honestly, not by pretending automatic polling exists when it structurally can't yet (see Decisions).

### Acceptance criterion

Two real fixes, not one: (1) `dispatch-provider-request.ts`'s own catch block previously classified only `SyntheticProviderRejectionError`/`SyntheticProviderTimeoutError` — any other thrown error (including a real one from M4-007's real `AUTHORIZED_SANDBOX` Plaid adapter) fell through unclassified, leaving its intent silently stuck at `DISPATCHED` forever. It now classifies every non-`SyntheticProviderRejectionError` failure as `OUTCOME_UNKNOWN`, the same conservative "we don't actually know what happened" state Section 11.5 already names for an ambiguous timeout. (2) `ProviderReconciliationService.reconcilePendingIntents(staleAfterMs)` — run on a plain interval by `worker.ts` (`PROVIDER_RECONCILIATION_INTERVAL_MS`/`PROVIDER_RECONCILIATION_STALE_AFTER_MS`) — finds every tenant's `OUTCOME_UNKNOWN` intents older than the threshold and moves them to `RECONCILING`; `npm run resolve-provider-operation-intent` is the real, human, out-of-band path from there to a real terminal outcome (`SUCCEEDED`/`FAILED_FINAL`/`CANCELLED`), recording who resolved it and why. Live-verified end to end (see Verification).

### Implementation

- `src/provider-platform/dispatch-provider-request.ts` — the catch block's `else if (SyntheticProviderTimeoutError)` branch became a plain `else`, covering every unrecognized error the same way. New test in `dispatch-provider-request.spec.ts` proves it with a synthetic adapter that throws a plain `Error` (not any recognized synthetic-fault type) and confirms the resulting intent is `OUTCOME_UNKNOWN`.
- `src/database/entities/provider-operation-intent.entity.ts` — new nullable `resolvedBy`/`resolutionNote` columns (migration `1787178000000-ProviderOperationIntentReconciliation.ts`), mirroring `DataDispositionTask`'s own `resolvedBy` precedent (M5-025) for the identical "a human investigated an ambiguous state out of band and is recording the real outcome" shape.
- `src/provider-platform/provider-operation-intent.service.ts` — new `markReconciling()` and `resolveManually()` (rejects resolving anything not currently `OUTCOME_UNKNOWN`/`RECONCILING` — a `SUCCEEDED`/`FAILED_FINAL` intent already has its own real outcome).
- `src/provider-platform/provider-reconciliation.service.ts` (new, +`.spec.ts`) — `reconcilePendingIntents(staleAfterMs)`: a genuinely cross-tenant sweep (`runWithRlsBypass`, the identical precedent `WebhookDispatchService`'s own due-event/due-delivery scans already established) for `OUTCOME_UNKNOWN` intents past the threshold, moved to `RECONCILING`. **Deliberately does not attempt automatic polling** — see Decisions for why that would be dead code today, not a missing feature.
- `src/worker.ts` — a new plain `setInterval` (matching `WebhookDispatchService`'s own "not a Temporal workflow, an intent row already is the durable record" reasoning), alongside the existing webhook-dispatch timer.
- `src/resolve-provider-operation-intent.ts` (new script) — matches `resolve-data-disposition-task.ts`'s established convention exactly (no REST endpoint — this is squarely a human, out-of-band decision).
- `src/config/env.validation.ts` — `PROVIDER_RECONCILIATION_INTERVAL_MS` (default 60s), `PROVIDER_RECONCILIATION_STALE_AFTER_MS` (default 5min), both optional.
- `test/negative-authorization.e2e-spec.ts` — no change needed this slice (already corrected the provider-promotion coverage entries in M5-026).

### Affected files

- `src/provider-platform/dispatch-provider-request.ts` (+`.spec.ts`)
- `src/database/entities/provider-operation-intent.entity.ts`, `src/database/migrations/1787178000000-ProviderOperationIntentReconciliation.ts` (new), `schema-migrations.spec.ts`
- `src/provider-platform/provider-operation-intent.service.ts` (+`.spec.ts`), `provider-reconciliation.service.ts` (new, +`.spec.ts`), `provider-platform.module.ts`
- `src/worker.ts`, `src/config/env.validation.ts`
- `src/resolve-provider-operation-intent.ts` (new), `package.json`

### Decisions and alternatives

- **No `poll()`-calling branch in `ProviderReconciliationService`.** Section 11.5's fuller design assumes an adapter can be asked "what actually happened" — but no adapter in this codebase implements `poll()` (every one is synchronous; see `types.ts`'s own comment), *and* no receipt from `submit()` is ever persisted anywhere for a later poll to use even if one did. A branch calling a method nothing implements, against data nothing stores, would be untested dead code creating a false impression of automatic reconciliation — the exact fabricated-coverage pattern this codebase's conventions exist to prevent. The honest scope is exactly what got built: detect, flag, let a human resolve.
- **`RECONCILING` as a real, distinct state a human must act on, not an automatic retry.** Matches Section 11.5's own state machine (`OUTCOME_UNKNOWN -> RECONCILING`) and the "don't guess at what an unclassified real provider error means" reasoning `callProviderWithRetryClassification`'s own comment already established for the Temporal-activity layer.
- **The real-error classification fix (dispatch-provider-request.ts) matters independently of the reconciliation worker** — even without `ProviderReconciliationService` existing at all, leaving a real error's intent silently stuck at `DISPATCHED` (the pre-slice behavior) is strictly worse than `OUTCOME_UNKNOWN`, since the latter at least signals genuine ambiguity a human or a future mechanism could act on.

### Errors and fixes

None functionally — every new test passed on the first full run.

### Verification

```text
npm run build / npm run lint / npm run lint:check — all clean

Fresh scratch stack (Postgres 5548, Temporal 7248, Keycloak 8092):
  npm test -- --runInBand — 86 of 88 suites passed (2 pre-existing
    skips), 634 passed / 13 skipped / 647 total
  npm run test:e2e — 4 suites / 39 tests passed, unchanged

Manual live verification — a one-off scratch script against the same
stack, deleted after use:
  - real dispatchProviderRequest() to a real registered adapter with a
    SYNTHETIC-TRANSIENT-FAILURE-* borrower id -> real thrown
    SyntheticProviderTimeoutError -> real intent row, state=OUTCOME_UNKNOWN
  - real reconcilePendingIntents(0ms threshold) -> real state=RECONCILING
  - npm run resolve-provider-operation-intent -- <tenantId> <intentId>
    FAILED_FINAL scratch-verify-operator "Confirmed via real
    investigation: ..." -> real state=FAILED_FINAL
  - direct psql read confirmed the real resolvedBy/resolutionNote values
    persisted exactly as passed

  scratch stack torn down (docker rm -f + network rm) after verification
```

### Security, privacy, cost, and compatibility

- Closes a real correctness gap, not just a documentation one: before this slice, any unclassified real provider error (reachable today only via direct `AUTHORIZED_SANDBOX` dispatch calls, not the live default workflow path) left its intent silently stuck with no signal anything was wrong.
- No new secrets, no new external dependency. `RECONCILING` intents are the only new operational surface an operator needs to watch — genuinely rare today (SIMULATOR adapters essentially never throw outside synthetic-fault injection; the real Plaid AUTHORIZED_SANDBOX adapter isn't wired into any live case's dispatch path per M4-007's own scope decision).

### Known gaps

- **No automatic `poll()`-based resolution** — see Decisions; this is a real, structural limitation (no adapter implements it, no receipt is persisted), not an oversight, and is the concrete precondition a future reader should check before assuming this is closeable without more work.
- **No REST/GraphQL surface listing `RECONCILING` intents for an operator to find** — `resolve-provider-operation-intent.ts` requires already knowing the `tenantId`/`intentId` (from logs or a direct `psql` query today). M6's Operations UI is the natural home for a real worklist view.
- Every other M0/M3/M4/M5/M6 Known gap is unchanged by this slice.

### Next safe step

Continuing the pre-M5 gap-closure pass: `permittedFields` field-level provider authorization (M0-010/M4-001/M4-007 — `ProviderAuthorizationGrant.permittedFields` has stayed permanently null since no provider capability exposes a field-addressable contract) is next.

## M5-028: Real field-level provider authorization (Section 11.5)

### Status

Implemented and verified. Closes the `permittedFields` gap named at M0-010 and restated unchanged through every provider-platform entry since ("no provider capability exposes a field-addressable contract, so `permittedFields` remains unused") — real, end to end: a caller can now request field-scoped access, the grant records it, and `dispatchProviderRequest()` actually restricts the returned finding to just those fields.

### Acceptance criterion

`ProviderAuthorizationService.issue({ ..., permittedFields: ['monthlyIncome'] })` persists real field names on the grant (previously hardcoded to `null` regardless of input — the field existed in the database column and the TypeScript interface but nothing ever set it to anything else). `dispatchProviderRequest()` filters the adapter's normalized finding down to exactly those top-level keys, checked against the *freshly revalidated* grant (not the original request) — the same "trust revalidated state, not the original ask" discipline `revalidate()` itself already embodies. Unset `permittedFields` (every real caller today) means completely unfiltered, byte-identical behavior to before this slice. Proven end to end with a real asset-verification dispatch: requesting `permittedFields: ['liquidAssets']` against a real adapter returning `{liquidAssets, investmentAssets, accountCount, reserveMonths}` returns exactly `{liquidAssets: <number>}`.

### Implementation

- `src/provider-platform/provider-authorization.service.ts` — `IssueGrantInput.permittedFields?: string[]`, threaded into `issue()`'s own insert (`input.permittedFields ?? null` replacing the hardcoded `null`).
- `src/provider-platform/dispatch-provider-request.ts` — new exported `filterToPermittedFields<T>(finding, permittedFields)`: a real, generic, top-level-key filter — passes any non-object finding or unset `permittedFields` through completely unchanged (every finding shape in this codebase, `PlaidIncomeData`/`CreditBureauData`/etc., is a plain object, so this is never a no-op by accident, only by design when unset). `DispatchProviderRequestParams` gains the same optional `permittedFields`, passed to `issue()` and applied to the finding after `normalize()`, filtered against `revalidation.grant.permittedFields` (the freshly re-read grant), not the caller's original request.
- `src/database/entities/provider-authorization-grant.entity.ts` — comment updated: `permittedFields` is real now, honestly noting no real Agent-tool/activity caller requests field-scoping yet (every current caller wants the whole finding) — the same "real mechanism, zero current triggers" honesty already established for `assertNotStructurallyExcluded()` (M5-026).

### Affected files

- `src/provider-platform/provider-authorization.service.ts` (+`.spec.ts`)
- `src/provider-platform/dispatch-provider-request.ts` (+`.spec.ts`)
- `src/database/entities/provider-authorization-grant.entity.ts`

### Decisions and alternatives

- **A generic top-level-key filter, not a per-capability field schema.** Every real finding in this codebase is a flat object (`PlaidIncomeData: {monthlyIncome, employmentStatus, bankAccountAge, incomeStability}`, similarly for credit/asset/identity/document) — a capability-specific field allowlist schema would be real infrastructure for a problem a plain `Object.entries()` filter already solves honestly, at real cost (a schema to maintain per capability, kept in sync with every finding shape) for no real benefit over the simpler mechanism.
- **No live workflow caller wired to request field-scoping.** Considered changing `case-conditions.activities.ts`'s evidence-fetch calls to request a narrower field set — rejected: none of them are known to only need a strict subset today, and changing what gets fetched/stored in the live default dispatch path for a demonstration of this mechanism would be exactly the kind of scope creep into real behavior change this session's own discipline avoids. The mechanism is proven real via a direct test call (mirroring the capability denylist's own "real gate, no current trigger" shape, M5-026), not forced into the live path to manufacture a consumer.
- **Filtered against the revalidated grant, not `params.permittedFields` directly** — consistent with why `revalidate()` exists at all: the freshest read of persisted state, not what the caller originally asked for, is what should gate the actual dispatch.

### Errors and fixes

None — built and tested clean on the first full run.

### Verification

```text
npm run build / npm run lint / npm run lint:check — all clean

npx jest dispatch-provider-request.spec.ts — 4 pure filterToPermittedFields
  tests pass with no DB at all

Fresh scratch stack (Postgres 5549, Temporal 7249):
  npx jest dispatch-provider-request.spec.ts provider-authorization.service.spec.ts
    22 passed, including a real end-to-end asset-verification dispatch
    with permittedFields: ['liquidAssets'] returning exactly
    { liquidAssets: <number> }
  npm test -- --runInBand — 626 passed (env-dependent skip count this
    particular run; no failures)
  npm run test:e2e — 4 suites / 39 tests passed, unchanged (no REST
    surface touched)
```

### Security, privacy, cost, and compatibility

- Zero behavioral change for every real caller today — `permittedFields` unset means byte-identical output to before this slice.
- A real, additional data-minimization control now genuinely exists and works, ready for a future caller (an Agent tool, a policy rule, a tenant configuration) that only needs a narrow slice of a provider's finding to actually use it, without further plumbing changes.

### Known gaps

- **No real caller requests field-scoping yet** — honestly documented, not hidden (see Decisions). The mechanism is real and tested; nothing in the live workflow path exercises it non-trivially yet.
- **No capability-level schema constraining which field names are ever meaningful** for a given provider — `permittedFields` accepts any string; a typo'd field name simply filters everything out (proven behavior, see the "produces an empty object" test) rather than erroring, matching this filter's own deliberately generic, capability-agnostic design.
- Every other M0/M3/M4/M5/M6 Known gap is unchanged by this slice.

### Next safe step

Continuing the pre-M5 gap-closure pass: M4's own remaining named gaps — no dual-approval re-enable path for a deactivated provider promotion, and `approvalRole` being a free-text string with no real RBAC behind it (both M4-006/M4-007) — are next, followed by an OpenAPI-coverage pass over Section 15.1's still-undocumented partner-API routes.

## M5-029: Confirmed the provider-promotion dual-control re-enable gate is real; approval-role RBAC investigated and left honestly open (Section 11.4)

### Status

Investigated both M4-006/M4-007 Known Gaps items named as still open. One was already closed by M4-007's own design and just needed a real test proving it; the other genuinely cannot be closed without building new, unrequested admin infrastructure, and is left open with that reasoning recorded rather than attempted.

### Acceptance criterion

**Dual-approval re-enable — CLOSED, proven, not built new.** `ProviderPromotionService.activate()` has no "quick re-enable" path: calling it again for a `{providerId, capability, mode}` tuple that was previously `deactivate()`d requires a *current*, valid `PASSED` certification and `APPROVED` approval exactly as the original activation did — there is no code path that skips this. A new test proves the realistic sequence directly: activate a manifest, `deactivate()` it (the kill switch's own single-actor emergency stop), propose a *second*, corrected manifest, and show `activate()` on it fails closed with no certification, fails closed with certification but no approval, then succeeds only once both exist fresh. Section 11.4's own "governed re-enable" requirement was already satisfied by M4-007's design — this slice's real contribution is the proof, not new code.

**Approval-role RBAC — investigated, left open.** Closing this for real needs a REST/GraphQL surface for provider-promotion actions (none exists — it's script-only, `manage-provider-promotion.ts`, the same honest administrative-action gap `create-api-client.ts` already has) *and* an admin RBAC tier this codebase's two-role (`PARTNER`/`REVIEWER`) model has no room for. Both are genuinely new, unrequested user-facing infrastructure, not a gap closable by extending something that already exists the way M5-026 (denylist)/M5-027 (reconciliation)/M5-028 (field authorization) each were. Recorded as a deliberate non-attempt, not silently dropped.

### Implementation

- `src/provider-platform/provider-promotion.service.spec.ts` — one new test: activate -> deactivate -> propose a second manifest -> activate fails closed twice (no cert, then no approval) -> succeeds once both are fresh, and confirms `isActivated()` reports `true` again afterward.
- `docs/DEVELOPMENT_LOG.md` — annotated the original M4-006 "No dual-approval re-enable path" and M4-007 "No approval-role RBAC" Known Gaps entries in place with forward pointers to this slice's real findings, rather than silently rewriting history.

### Affected files

- `src/provider-platform/provider-promotion.service.spec.ts`
- `docs/DEVELOPMENT_LOG.md`

### Decisions and alternatives

- **Annotated the original Known Gaps entries in place rather than leaving them to silently go stale.** Matches this same slice's own broader theme (and M5-026's own fix to the negative-authorization coverage index): a Known Gap that gets closed by a later slice should say so, not require a future reader to cross-reference every subsequent entry to find out.
- **Declined to build a REST/GraphQL admin surface for provider promotion just to make `approvalRole` RBAC closable.** That would be building real, permanent user-facing infrastructure (routes, RBAC gating, tests, documentation) as a side effect of a gap-closure pass, not because anyone asked for provider-promotion administration over HTTP — the same "don't invent scope nobody requested" discipline this whole session's gap-closure work has followed for the genuinely-external-dependency gaps (official policy-source connector, downstream decision-status ingestion).

### Errors and fixes

None.

### Verification

```text
npm run build — clean

Fresh scratch stack (Postgres 5550):
  npx jest provider-promotion.service.spec.ts — 8 passed (7 -> 8: +1 new
    re-activation test)
```

### Security, privacy, cost, and compatibility

No behavior change — this slice is a real test plus documentation corrections, not new production code.

### Known gaps

- **Approval-role RBAC remains genuinely open** — see Acceptance criterion. The concrete precondition for closing it: a real decision to build administrative REST/GraphQL routes for provider-promotion actions, which nothing in this codebase's own scope has asked for yet.
- Every other M0/M3/M4/M5/M6 Known gap is unchanged by this slice.

### Next safe step

An OpenAPI-coverage pass over Section 15.1's still-undocumented partner-API routes (M4-003's own named gap: only `CasesController`'s endpoints are documented; webhook, communication-message, and consent routes added since aren't).

## M5-030: OpenAPI-coverage gap confirmed already closed by normal development; two stale Known Gaps entries corrected (Section 15.3)

### Status

Investigated M4-003's own "only `CasesController` is documented" gap before attempting anything. Found it was already closed — every controller built since (`WebhookEndpointsController`/`WebhookDeliveriesController`, `CommunicationMessagesController`) was written with real `@ApiTags`/`@ApiOperation` Swagger decoration from the start, a convention that stuck without ever needing a dedicated "catch up the docs" slice. Verified, not assumed: `npm run generate:openapi` (real regeneration) produces zero diff against the checked-in `openapi/openapi.json`, and a direct count confirms 14 real documented operations across all 4 real controllers — 100% of this codebase's actual REST surface.

### Acceptance criterion

No code change needed or made. Two stale `docs/DEVELOPMENT_LOG.md` Known Gaps entries (M4-003's "no authentication on this REST surface at all," false since M5-001; same entry's "only `CasesController`... is documented," false since M4-004/M5-022) annotated in place with what's actually true today and a pointer to the real evidence.

### Implementation

- No production code, no tests — a verification pass confirmed nothing needed building, and a documentation-accuracy pass corrected two stale claims found along the way.
- `docs/DEVELOPMENT_LOG.md` — M4-003's own Known Gaps entries annotated.

### Decisions and alternatives

- **Verified before writing anything** — the exact discipline this whole gap-closure pass (M5-026 through M5-030) has followed throughout: `grep`-check real decoration coverage, `diff`-check the real generated artifact, count real operations, rather than assuming a gap named months ago is still accurate today. Two separate M4-006/M0-009-era gaps (dual-approval re-enable, budget ledger) already turned out to be either closed-by-design or honestly-inapplicable on the same kind of check.
- **What remains real**: Section 15.1's own fuller target partner API (consents-listing, documents, policy snapshots, provider operations, audit export) still has no REST surface at all — not an OpenAPI-documentation problem, a "these routes were never built" one, in the same category as approval-role RBAC (M5-029): each would mean building genuinely new, unrequested REST surface, not extending or correcting something that already exists.

### Verification

```text
npm run generate:openapi against a real running app — zero diff against
  the committed openapi/openapi.json
grep -c '@ApiOperation' across all 4 real controllers — 9+1+1+3 = 14,
  matching the artifact's own real route count exactly
```

### Known gaps

Unchanged by this slice (a documentation-accuracy correction, not new work) — see the annotated M4-003 entry itself for the real, current state of the OpenAPI/auth gaps it originally named.

### Next safe step

This closes the pre-M5 gap-closure pass's own reasonably-scoped items (M5-026 through M5-030). What remains, per the earlier audit: gaps needing real external dependencies (official federal/state policy-source connector, downstream decision-status ingestion) or a real business/user decision (approval-role RBAC's admin surface, the rest of Section 15.1's partner API) or a large net-new subsystem (document OCR/inspection, calculation tools, most of Section 9.4's remaining Agent tools) — none closable by extending existing code the way this whole pass's items were.

## M5-031: Real REST + GraphQL read surfaces for consents, policy binding, provider operations, and audit events (Section 15.1/15.2)

### Status

Implemented and verified. Closes the closable part of M5-030's own "consents-listing, policy snapshots, provider operations, audit export" gap: a real REST `GET .../consents` route, and real GraphQL `policyBinding`/`providerOperations`/`auditEvents` fields (plus a nested `policyBinding.policySnapshot`) on the `case` query built at M6-001. `documents` (Section 15.1's own list) and approval-role RBAC are explicitly not attempted here — see Decisions.

### Acceptance criterion

`GET /v1/loan-cases/:caseId/consents` returns a tenant-scoped case's own full `ConsentRecord` history, newest first, 404 for a case the caller's tenant doesn't own — the same ownership check every other `CasesController` route already uses (`getCase()` first). The GraphQL `case` query gains four ways to read what was previously only visible via direct database access or was entirely unexposed: `policyBinding` (the currently active, non-invalidated `CasePolicyBinding`, nullable), `policyBinding.policySnapshot` (the immutable resolved-policy snapshot it points to), `providerOperations` (the case's own `ProviderOperationIntent` history), and `auditEvents` (append-only `AuditEvent` rows recorded with this case as `resourceId`). All four are lazy `@ResolveField()`s, tenant-scoped through the caller's own authenticated tenantId exactly like every existing resolver field — never a client-suppliable argument. Proven end to end against a real running app: a real consent `REVOKE` action produces a real `CONSENT_REVOKE` audit event, and that event is then visible through the new `auditEvents` GraphQL field — the full real stack, not just the query shape.

### Implementation

- `src/consent/consent.service.ts` — new `listForCase(tenantId, caseId)`, same `runInTenantContext` pattern as `getStatus()`, ordered `grantedAt: 'DESC'`.
- `src/cases/cases.service.ts` — new `listConsents(tenantId, caseId)`: calls `getCase()` first (ownership check), then delegates.
- `src/cases/cases.controller.ts` — new `GET :caseId/consents` route, placed directly after the existing `POST :caseId/consents` route.
- `src/database/entities/case-policy-snapshot.entity.ts` — `@ObjectType()`, `registerEnumType(PolicyResolutionStatus, ...)`, `@Field()` on every column except `tenantId` (deliberately not exposed, matching every other dual-decorated entity's own convention). This table's first GraphQL exposure of any kind — no REST route to dual-decorate against.
- `src/database/entities/case-policy-binding.entity.ts` — `@ObjectType()`, `@Field()` on every column; `invalidatedAt` needed the explicit `@Field(() => Date, { nullable: true })` form (see Errors and fixes).
- `src/database/entities/provider-operation-intent.entity.ts` — `@ObjectType()`, `registerEnumType()` for both `ProviderCapabilityStatus` and `ProviderOperationIntentStatus`, `@Field()` on every column; `resolvedBy`/`resolutionNote` needed the explicit nullable-`String` form.
- `src/database/entities/audit-event.entity.ts` — `@ObjectType()`, `@Field()` on every column; `resourceId`/`reason` needed the explicit nullable-`String` form; `metadata` uses `GraphQLJSON`.
- `src/cases/case-query.service.ts` — four new methods: `getActivePolicyBinding()` (filters `invalidatedAt: IsNull()`), `getPolicySnapshot(tenantId, snapshotId)`, `listProviderOperationIntents()` (ordered `createdAt: 'ASC'`), `listAuditEvents()` (filtered by `resourceId: caseId` — the only join key `AuditEvent` actually has back to a case, since it's a generic cross-resource table, not case-specific).
- `src/cases/cases.resolver.ts` — three new `@ResolveField()`s on `CasesResolver` (`policyBinding`, `providerOperations`, `auditEvents`), and a new exported `CasePolicyBindingResolver` class (`@Resolver(() => CasePolicyBinding)`) for the nested `policySnapshot` field — a separate resolver class since the parent type differs from `LoanCase`, matching this codebase's own established pattern for cross-type nested resolution.
- `src/cases/cases.module.ts` — registers `CasePolicyBindingResolver`; adds `CasePolicyBinding`/`CasePolicySnapshot`/`ProviderOperationIntent`/`AuditEvent` to `TypeOrmModule.forFeature()`.

### Affected files

- `src/consent/consent.service.ts`
- `src/cases/cases.service.ts`
- `src/cases/cases.controller.ts`
- `src/database/entities/case-policy-snapshot.entity.ts`
- `src/database/entities/case-policy-binding.entity.ts`
- `src/database/entities/provider-operation-intent.entity.ts`
- `src/database/entities/audit-event.entity.ts`
- `src/cases/case-query.service.ts` (+`.spec.ts`)
- `src/cases/cases.resolver.ts` (+`.spec.ts`)
- `src/cases/cases.module.ts`
- `openapi/openapi.json` (regenerated)
- `README.md`

### Decisions and alternatives

- **`documents` and approval-role RBAC stay explicitly out of scope**, reaffirming M5-029/M5-030's own reasoning rather than re-litigating it: `documents` has no backing table or subsystem at all in this codebase (Section 14.1's own `documents` entity was never built — `DocumentService` only ever verifies a caller-declared package shape, it doesn't store or list real document records), and building one now would be the same "large net-new subsystem" category as document OCR/inspection, not a read-surface gap on something that already exists. Approval-role RBAC still needs new admin infrastructure this codebase's two-role model has no room for (M5-029's own finding, unchanged).
- **`listAuditEvents()` filters by `resourceId`, not a dedicated case-audit join table.** `AuditEvent` is Section 14.1's generic, cross-resource append-only log (`resourceType`/`resourceId` free-text pair) — the same shape used for provider-promotion, webhook, and consent events alike. Filtering by `resourceId: caseId` is honest about what the table actually guarantees: it returns exactly the events recorded *against this case specifically*, not every event that happens to reference the case indirectly (e.g. a `resourceType: 'provider_authorization_grant'` row for a grant this case's dispatch used). No broader join was built, since no code in this codebase currently records audit events with any indirect linkage back to a caseId that would make one meaningful.
- **`CasePolicySnapshot` gets GraphQL exposure with no REST precedent to dual-decorate against** — the first entity this session added `@ObjectType()` to without an existing REST route already returning it. Followed the same field-selection discipline anyway (`tenantId` omitted, matching every other entity).
- **A separate `CasePolicyBindingResolver` class for the nested `policySnapshot` field**, not a method on `CasesResolver` — `@ResolveField()` binds to the class's own `@Resolver(() => X)` parent type, and the parent here is `CasePolicyBinding`, not `LoanCase`. This mirrors the existing lazy-resolution discipline: a client reading `case { policyBinding { boundAt } }` never triggers a `policySnapshot` read unless it's actually asked for.

### Errors and fixes

- **`UndefinedTypeError` for nullable fields, same class of bug as M6-001's `EvidenceFact.validThrough`, hit twice more in this slice**: `CasePolicyBinding.invalidatedAt` (a nullable `Date`) and `ProviderOperationIntent.resolvedBy`/`resolutionNote` plus `AuditEvent.resourceId`/`reason` (nullable `string`s) all threw `Make sure you are providing an explicit type for the "<field>" of the "<Class>" class` at real app boot when declared as plain `@Field({ nullable: true })`. Only surfaced by actually booting the real app, not by `tsc`/lint. Fixed with the explicit form (`@Field(() => Date, { nullable: true })` / `@Field(() => String, { nullable: true })`) established at M6-001 — now confirmed to apply to nullable `string` fields as well as nullable `Date` fields, not just the one case originally found.
- **`QueryFailedError: audit_events is append-only: DELETE is not permitted`** from `case-query.service.spec.ts`'s own `afterAll` cleanup, once `AuditEvent` fixture rows were added for the new `listAuditEvents()` test. Fixed by removing the delete call for that one entity and adding an explanatory comment, matching `audit-event.service.spec.ts`'s own already-established precedent verbatim in spirit (grepped and confirmed before fixing).

### Verification

```text
npm run build / npm run lint — clean

Fresh scratch stack (Postgres 5551, Temporal 7249):
  npx jest cases.resolver.spec.ts case-query.service.spec.ts — 2 suites,
    15 passed (8 resolver + 7 query-service, incl. 4 new query-service
    tests for getActivePolicyBinding/getPolicySnapshot/
    listProviderOperationIntents/listAuditEvents, and 4 new resolver
    tests for policyBinding/providerOperations/auditEvents/policySnapshot)
  npm test -- --runInBand — 83 suites / 635 tests passed (5 suites / 27
    tests skipped, pre-existing env-gated skips)
  npm run test:e2e — 4 suites / 39 tests passed, unchanged (no existing
    REST route's behavior changed)
  npm run generate:openapi — real regeneration against the running app;
    diff against the committed artifact is exactly the new listConsents
    operation (44 lines added, nothing else touched)

Real live-server verification (not just spec-level):
  a real POST .../consents GRANT then REVOKE, followed by a real
  GET .../consents confirming both rows in newest-first order; a real
  GraphQL `case { policyBinding { policySnapshot { resolutionStatus } }
  providerOperations { providerId state } auditEvents { action } }`
  query against a real case with a real active policy binding and a
  real provider dispatch; the REVOKE's own real CONSENT_REVOKE audit
  event independently confirmed visible through the new auditEvents
  GraphQL field
```

### Security, privacy, cost, and compatibility

- Every new read is tenant-scoped through the caller's own authenticated identity (`AuthTenantId()`/`getCase()`'s own ownership check), never a client-suppliable tenantId — the same guarantee every existing route/resolver in this codebase already provides.
- `CasePolicySnapshot`/`CasePolicyBinding`/`ProviderOperationIntent`/`AuditEvent` all omit `tenantId` from their GraphQL surface, consistent with every other dual-decorated entity.
- No behavioral change to any existing route or resolver — purely additive.

### Known gaps

- **`documents` and approval-role RBAC remain genuinely open**, unchanged from M5-029/M5-030's own findings — see Decisions.
- **No audit-event export/pagination** — `listAuditEvents()` returns a case's full history unpaginated, matching every other `list*` method in `CaseQueryService` today (none of them paginate yet); acceptable at current real data volumes, not yet a real gap until a case accumulates enough audit events for it to matter.
- Every other M0/M3/M4/M5/M6 Known gap is unchanged by this slice.

### Next safe step

Section 15.1/15.2's closable read-surface gaps are now closed. What remains is unchanged from M5-030's own framing: real external dependencies, a real business/user decision for admin RBAC, or a large net-new subsystem (documents) — none closable by extending existing code the way this slice and M5-026 through M5-030 were.
