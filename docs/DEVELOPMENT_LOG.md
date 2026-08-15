# Development Log

This append-only journal records implementation evidence, decisions, failures, and remaining gaps. Product claims must be supported by the repository and the verification recorded here.

## 2026-08-14 — M0-001: Local open-model decision provider

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
