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
