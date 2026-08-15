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
