<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/meridian-logo-dark.svg">
  <img src="docs/assets/meridian-logo.svg" alt="Meridian" height="56">
</picture>

**The governed operations workspace for lending teams that need every case action to be explainable.**

[![CI](https://github.com/akira-in-tech/mortgage-integration-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/akira-in-tech/mortgage-integration-agent/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/Node-24-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Temporal](https://img.shields.io/badge/Temporal-durable_workflows-000000?logo=temporal&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16_%2B_RLS-4169E1?logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/license-proprietary-lightgrey)

Meridian turns a lending-case workflow into an accountable handoff: it gathers evidence through controlled adapters, binds the case to a policy context, lets a bounded AI planner assist with routing, and pauses for a reviewer whenever human judgment is required.

**[▶ Open the live synthetic demo](https://d136v61al3mroo.cloudfront.net)** &nbsp;·&nbsp; [Architecture](#architecture) &nbsp;·&nbsp; [Run locally](#run-locally)

> The live demo uses generated data only. It does not access a real borrower or provider, make a credit decision, move money, or represent a lender, regulator, GSE, or automated-underwriting finding.

</div>

## See the product in three minutes

The public sandbox is an isolated, disposable workspace — no sign-up or API key required. Every capture below — the recording and every screenshot — is a live, unedited run against that real sandbox, not a mockup or storyboard.

<div align="center">

<img src="docs/assets/meridian-walkthrough.gif" alt="A real, unedited recording of the guided sandbox: creating a case, running the workflow, resolving a policy-triggered reviewer condition, and inspecting the resulting audit trail." width="820">

<sub>Real time, one continuous session against the live demo — create a case → run the workflow → resolve the condition it opens → the resulting audit entry.</sub>

</div>

Optionally, customize the requested loan amount and stated monthly income before creating your case — two bounded, hypothetical numbers, never real borrower data — and the same real evaluation responds to them. Select **+ New case** at any point to try another scenario in the same sandbox, without losing the one you already have.

<div align="center">

<img src="docs/assets/meridian-shot-4-customize.png" alt="The connect screen with the scenario expanded, a custom requested loan amount and stated monthly income entered." width="820"><br>
<b>0 · Customize your scenario (optional)</b><br>
<sub>Expand <b>Customize the scenario</b> and enter your own requested loan amount and stated monthly income — two bounded numbers, never real borrower data.</sub>

<br><br>

<img src="docs/assets/meridian-shot-5-custom-case.png" alt="The resulting case's overview tab, showing the caller's own requested amount and stated income, not the hardcoded defaults." width="820"><br>
<sub>The seeded case reflects exactly what you entered — <code>$550,000</code> requested, <code>$11,000</code> stated income — not a fixed demo value.</sub>

<br><br>

<img src="docs/assets/meridian-shot-1-start.png" alt="A fresh synthetic case, guide at step 2: run the simulated evaluation." width="820"><br>
<b>1 · Create &amp; evaluate</b><br>
<sub>Select <b>Try live sandbox</b> to create a tenant and a conventional-mortgage case, then run the real Temporal workflow against it.</sub>

<br><br>

<img src="docs/assets/meridian-shot-2-condition.png" alt="An open, policy-bound income-verification condition awaiting reviewer action." width="820"><br>
<b>2 · Review a condition</b><br>
<sub>The workflow opens a deliberately triggered income-verification condition. Satisfy or waive it as the sandbox reviewer.</sub>

<br><br>

<img src="docs/assets/meridian-shot-3-audit.png" alt="The completed case's audit trail, showing the recorded reviewer action." width="820"><br>
<b>3 · Inspect the audit trail</b><br>
<sub>Every workflow step, policy binding, evidence item, and reviewer action is recorded in order — nothing is inferred after the fact.</sub>

</div>

Each sandbox uses an opaque `HttpOnly`, CSRF-protected session. It expires automatically, and its tenant-scoped synthetic records are removed after expiry.

## The governance surface, for operators

The public sandbox shows the case workflow. The screenshots below are the platform-admin and reviewer side — not part of the guest demo, reached only with an operator credential — and are real, unedited captures of the same running environment.

<div align="center">

<img src="docs/assets/meridian-shot-6-provider-active.png" alt="A provider active after clearing the propose, certify, and approve gates." width="820"><br>
<b>Provider promotion chain</b><br>
<sub>A provider reaches <code>ACTIVE</code> only after a separate proposer, certifier, and approver each act — self-approval is rejected by the server, not just the form.</sub>

<br><br>

<img src="docs/assets/meridian-shot-7-killswitch.png" alt="The same provider immediately after an operator pressed Emergency-stop, now DEACTIVATED." width="820"><br>
<b>An operator's kill switch</b><br>
<sub>Pressing <b>Emergency-stop</b> takes effect on the very next dispatch attempt, not just as a governance record.</sub>

<br><br>

<img src="docs/assets/meridian-shot-8-data-disposition.png" alt="A real data-disposition task showing evidence and provider results awaiting a reviewer's retention decision." width="820"><br>
<b>Consent revocation opens a real decision, not a deletion</b><br>
<sub>Revoking consent doesn't erase anything automatically — it opens a retention-review task naming exactly what's affected, for a reviewer to delete, anonymize, or place under legal hold.</sub>

</div>

## What Meridian gives an operations team

| Outcome | Meridian behavior |
| --- | --- |
| **Know what is blocking a case** | Durable workflows collect evidence, open explicit conditions, and wait without losing state when a worker restarts. |
| **Keep policy current and attributable** | Immutable policy bindings, source freshness checks, applicability guards, and impact assessments prevent silent reuse of stale or ambiguous policy. When a source goes stale or applicability is ambiguous, an advisory research queue drafts a citation-bound candidate brief for a human policy owner — it never activates policy on its own. |
| **Use AI without delegating authority** | The optional private Qwen planner has a bounded schema and route set. Deterministic tools, budgets, validation, and human review remain authoritative. |
| **Explain every handoff** | Tenant isolation, consent/purpose checks, provider-operation lineage, reviewer actions, and chronological audit events preserve the evidence behind a case state. |
| **Introduce integrations deliberately** | Provider adapters, authorization gates, signed webhooks, REST/OpenAPI, GraphQL, and a generated TypeScript client create controlled ports for future approved integrations. Every provider reaches live traffic only through an auditable propose -> certify -> approve -> activate chain — nothing is dispatchable until it clears all three gates. |
| **Cut a provider off immediately** | An operator's kill switch takes effect on the very next dispatch attempt, not just as a governance record — verified by a real test that activates a provider, dispatches through it, deactivates it, and confirms the following dispatch is rejected. |
| **Keep data retention decisions human** | Revoking consent automatically opens a real retention-review task; a reviewer chooses to delete, anonymize, or place a legal hold on the affected evidence — nothing is silently kept or discarded. |

## Product principles

- **Human authority is explicit.** Protected communications, exceptions, and reviewer conditions do not become automatic merely because an Agent proposed an action.
- **Policy is a control plane.** The workflow records which policy context it used and routes uncertainty to review instead of guessing.
- **The model is untrusted assistance.** It cannot write policy, bypass authorization, issue a formal lending decision, or invoke structurally excluded actions.
- **A synthetic demo is still privacy conscious.** The public environment creates isolated guest tenants, uses generated facts, and automatically purges expired workspaces.

## Architecture

```text
 React operations console       Partner REST / generated TypeScript client
            │                                      │
            └──────────────┬───────────────────────┘
                           ▼
                 NestJS API control plane
              GraphQL + REST/OpenAPI + OIDC
                           │
             ┌─────────────┼──────────────┐
             ▼             ▼              ▼
       Case domain    Policy control     Provider gateway
       + audit/outbox  + bindings         + authorization gates
             │             │              │
             └─────────────┼──────────────┘
                           ▼
                 Temporal durable workflow
                           │
                           ▼
               Bounded LangGraph.js Agent
          optional private Qwen planner + rules
                           │
              ┌────────────┴─────────────┐
              ▼                          ▼
     PostgreSQL + row-level security   Simulators / approved
     audit, lineage, policy records    provider adapter ports
```

| Layer | Technology |
| --- | --- |
| Operations console | React, Apollo Client, Vite, Vitest, Playwright |
| Control plane | NestJS, REST/OpenAPI, GraphQL/Apollo Server |
| Durable orchestration | Temporal |
| Agent runtime | LangGraph.js behind an `AgentRuntimePort` |
| Planner | Deterministic rules by default; optional schema-constrained Ollama + Qwen |
| Data and isolation | PostgreSQL 16, TypeORM, row-level security |
| Identity | OIDC/OAuth 2.0 or scoped API clients |
| Delivery | GitHub Actions, GitHub OIDC, Terraform, AWS ECS/RDS/CloudFront |

## Delivery confidence

- **Continuous integration** runs on pushes and pull requests: linting, builds, migrations, unit/integration/Temporal tests, browser tests, generated-contract drift checks, dependency auditing, secret scanning, SAST, container builds, and observability configuration validation.
- **A real evaluation corpus** (`npm run evaluate`) runs synthetic fixtures across normal, boundary, missing-data, policy-coverage, and provider-failure categories and records pass rate, condition recall/precision, and every failure's detail per run — inspectable and downloadable from the platform-admin console, not a one-off script output.
- **Protected staging delivery** is intentionally manual because it changes persistent AWS resources. It uses GitHub OIDC rather than stored cloud credentials, publishes immutable application and Qwen images, records SBOM/provenance attestations, applies Terraform, publishes the console, and verifies the API and public HTTPS edge.
- **Operational evidence** is documented in the [development log](docs/DEVELOPMENT_LOG.md) and [operator runbook](docs/OPERATIONS.md). The environment remains a persistent synthetic staging demo, not a production lending deployment.

## Run locally

### Fastest path

```bash
npm install
npm run demo
```

This runs the zero-cost deterministic command-line demo. No model server, API key, or database is required.

### Full local workspace

```bash
# Deterministic workflow and simulated providers
docker compose up

# Optional local open-weight planner; Ollama must be available locally
DECISION_PROVIDER=ollama docker compose up
```

The full stack starts PostgreSQL, Temporal, Keycloak, the API, and the worker. Run the React console separately:

```bash
cd console
npm install
npm run dev
```

To use the configured local model outside Docker:

```bash
ollama pull qwen3.5:9b
ollama serve
DECISION_PROVIDER=ollama npm run start:dev
DECISION_PROVIDER=ollama npm run start:worker:dev
```

The planner receives only server-owned enums and booleans for its bounded routing task. It never receives borrower values, sets policy, approves communications, or causes side effects. Thinking is disabled because this task uses a budgeted structured response, not an unbounded reasoning trace.

## Boundaries that matter

Meridian is an integration-ready architecture and synthetic product demo. It deliberately does **not** claim:

- reviewed jurisdictional policy coverage or legal advice;
- authorization to use real borrower data or real provider credentials;
- a formal credit decision, approval, denial, rate lock, or clear-to-close;
- funds movement, settlement, funding, servicing payments, or capital delivery; or
- provider certification or automated-underwriting equivalence.

Those capabilities require separately governed providers, legal and operational approval, real-data controls, and release evidence.

## Documentation

- [Project charter](docs/PROJECT_CHARTER.md) — normative product and engineering contract
- [Development log](docs/DEVELOPMENT_LOG.md) — append-only implementation and verification record
- [Operations runbook](docs/OPERATIONS.md) — synthetic-environment telemetry, SLOs, drills, and incident procedures
- [OpenAPI contract](openapi/openapi.json) — generated REST contract
- [TypeScript client](client/) — generated client and integration examples

## License

This repository is intended as a portfolio and engineering demonstration. Review the repository license and all third-party model/provider terms before any use beyond the included synthetic environment.
