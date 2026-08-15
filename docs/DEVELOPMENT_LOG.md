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
