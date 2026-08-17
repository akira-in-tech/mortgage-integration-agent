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
