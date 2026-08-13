# mortgage-integration-agent

A portfolio backend that demonstrates auditable mortgage-underwriting orchestration. It fetches deterministic Plaid, credit-bureau, and document-verification fixtures in parallel, combines them into a decision request, and returns a structured approved, conditional, or denied outcome with a plain-English explanation. Decisioning can run through Claude or a credential-free rule engine.

Built with NestJS, GraphQL, TypeORM, and the Anthropic SDK.

> The three upstream integrations are deterministic adapters, not connections to production financial institutions. They make local and CI runs reproducible while preserving the orchestration and data contracts that real providers would implement.

[![CI](https://github.com/akira-in-tech/mortgage-integration-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/akira-in-tech/mortgage-integration-agent/actions/workflows/ci.yml)

## Architecture

```
                          ┌─────────────────────────────────────────────────┐
                          │           mortgage-integration-agent            │
                          │                                                 │
  Client (GraphQL)        │   ┌────────────┐      ┌──────────────────────┐  │
  ─────────────────────►  │   │   Loan     │      │    Agent Service     │  │
                          │   │  Resolver  │─────►│  (Orchestration      │  │
  query {                 │   └────────────┘      │   Core)              │  │
    evaluateLoan(input) { │                       └──────────┬───────────┘  │
      decision            │                                  │              │
      confidence          │              ┌───────────────────┼────────────┐ │
      reasoning           │              │      Promise.all  │            │ │
      conditions          │              ▼                   ▼            ▼ │
    }                     │   ┌──────────────┐  ┌────────────────┐  ┌──────────────┐ │
  }                       │   │   Plaid      │  │ Credit Bureau  │  │  Document    │ │
                          │   │  Service     │  │   Service      │  │  Service     │ │
                          │   │ (Income)     │  │ (FICO/DTI)     │  │  (IDP/OCR)   │ │
                          │   └──────┬───────┘  └───────┬────────┘  └──────┬───────┘ │
                          │          └──────────────────┼───────────────────┘ │
                          │                             │                     │
                          │                             ▼                      │
                          │              ┌─────────────────────────┐           │
                          │              │    Claude API           │           │
                          │              │  (claude-sonnet-4-6)    │           │
                          │              │                         │           │
                          │              │  Underwriting prompt +  │           │
                          │              │  borrower data ->       │           │
                          │              │  JSON decision          │           │
                          │              └────────────┬────────────┘           │
                          │                           │                        │
                          │                           ▼                        │
                          │              ┌─────────────────────────┐           │
                          │              │   PostgreSQL (TypeORM)  │           │
                          │              │   loan_applications     │           │
                          │              │   + raw JSONB audit log │           │
                          │              └─────────────────────────┘           │
                          └─────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| API | GraphQL (code-first), Apollo Server |
| Framework | NestJS 11 |
| Language | TypeScript 5 (strict mode) |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) |
| ORM | TypeORM 0.3 |
| Database | PostgreSQL 15+ |
| Validation | class-validator, class-transformer |
| Testing | Jest, Supertest, PostgreSQL integration CI |

## Demo

**No API key, no database, no setup:**

```bash
npm install
npm run demo
```

```
  Mortgage Integration Agent  demo mode
  Rule-based underwriter · no API key required · no database

  ────────────────────────────────────────────────────────────────
  Sarah Chen  (CONVENTIONAL · $420,000)
  ────────────────────────────────────────────────────────────────
  Decision    ✓ APPROVED
  Confidence  ██████████████████████░░ 94%
  Strong application: score 745 with excellent payment history, DTI 31.0%,
  verified income $150,000/yr, all documents valid.

  Integration data  (fetched in parallel)
    Plaid    $150,000/yr · FULL TIME · stability 94/100
    Credit   score 745 · DTI 31.0% · excellent history · 0 derog
    Docs     all valid

  ────────────────────────────────────────────────────────────────
  Marcus Rivera  (FHA · $285,000)
  ────────────────────────────────────────────────────────────────
  Decision    ◐ CONDITIONAL
  Confidence  ██████████████░░░░░░░░░░ 60%
  ...
```

**Full GraphQL playground via Docker (recommended):**

```bash
# Demo mode — no API key required; migrations run before startup
docker compose up

# Real Claude API — uses ANTHROPIC_API_KEY and DEMO_MODE from your .env
DEMO_MODE=false docker compose up
```

Open **http://localhost:3000/graphql** once the app is running.

## Setup (local, without Docker)

**Prerequisites:** Node.js 20+, PostgreSQL 15+

```bash
npm install
createdb mortgage_agent
# Create .env with DATABASE_URL, ANTHROPIC_API_KEY, DEMO_MODE (see below)
npm run start:dev
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DEMO_MODE` | No | `true` = rule-based engine, no API key needed (default) |
| `ANTHROPIC_API_KEY` | When `DEMO_MODE=false` | Your Anthropic API key |
| `API_KEY` | Production | Required `x-api-key` value for underwriting mutations |
| `CORS_ALLOWED_ORIGINS` | No | Explicit comma-separated browser origin allowlist |
| `RUN_MIGRATIONS` | No | Apply pending migrations at application startup when `true` |

Production disables GraphQL introspection and the playground, requires `API_KEY`, and never uses TypeORM schema synchronization. Database changes are made through versioned migrations.

**Verify the AI is really calling Claude:** when `DEMO_MODE=false`, the app logs will NOT show `DEMO MODE ACTIVE`, and the `reasoning` field in responses will be richer natural language generated by `claude-sonnet-4-6`.

## Example Mutation

```graphql
mutation {
  evaluateLoan(input: {
    borrowerId: "B001"
    requestedAmount: 450000
    loanType: CONVENTIONAL
  }) {
    applicationId
    decision
    confidence
    reasoning
    incomeVerified
    creditScore
    documentsValid
    conditions
    createdAt
  }
}
```

The following examples are real responses generated by `claude-sonnet-4-6`.

### CONDITIONAL — High credit score, DTI exceeds guideline

```json
{
  "data": {
    "evaluateLoan": {
      "applicationId": "670756c8-0432-4a71-b665-b463f283cd60",
      "decision": "CONDITIONAL",
      "confidence": 0.78,
      "reasoning": "Borrower presents a strong credit score of 759 and an excellent loan-to-income ratio of 1.94x, well within the 4.5x threshold. However, the DTI of 46.0% exceeds the conventional standard limit of 43% (though remains below the 50% denial threshold), placing this application in conditional territory. Additionally, the FAIR payment history and 2 derogatory marks on the credit report introduce elevated risk that must be addressed, particularly given the self-employed income status which warrants additional income documentation scrutiny.",
      "incomeVerified": true,
      "creditScore": 759,
      "documentsValid": true,
      "conditions": [
        "DTI of 46.0% exceeds conventional guideline of 43%; borrower must provide a letter of explanation and evidence of compensating factors",
        "Two derogatory marks on credit report require written explanation letters detailing the nature, date, and resolution status of each item",
        "Self-employed status requires 2 years of signed federal tax returns and a year-to-date profit and loss statement prepared by a licensed CPA"
      ],
      "createdAt": "2026-06-28T12:12:08.123Z"
    }
  }
}
```

### DENIED — Credit score below JUMBO minimum

```json
{
  "data": {
    "evaluateLoan": {
      "applicationId": "e8106610-f0f0-4b1f-8fdc-0e562ca8fc6c",
      "decision": "DENIED",
      "confidence": 0.97,
      "reasoning": "This application is denied primarily because the borrower's credit score of 598 falls significantly below the JUMBO loan minimum requirement of 720. JUMBO loan guidelines are strictly enforced and require both a credit score ≥ 720 and DTI ≤ 0.38; this borrower meets neither threshold. While the DTI of 21.0%, loan-to-income ratio of 2.44x, and document validity are all strong positives, the credit score deficiency for a JUMBO product is a disqualifying condition that cannot be conditionally remediated without a fundamental improvement in the borrower's credit profile.",
      "incomeVerified": true,
      "creditScore": 598,
      "documentsValid": true,
      "conditions": [],
      "createdAt": "2026-06-28T12:13:09.007Z"
    }
  }
}
```

## Verify

The standard test suite is deterministic and does not call Claude:

```bash
npm ci
npm run check
npm audit --omit=dev --audit-level=high
```

GraphQL E2E requires PostgreSQL but runs in `DEMO_MODE=true` by default:

```bash
export DATABASE_URL=postgres://mortgage:mortgage_demo@localhost:5432/mortgage_agent
npm run migration:run
npm run test:e2e -- --runInBand
```

GitHub Actions runs both quality checks and the migrated PostgreSQL E2E path. A real Claude run is optional and requires explicitly setting `DEMO_MODE=false` with `ANTHROPIC_API_KEY`.

## Design Notes

The three deterministic integration adapters (Plaid-shaped income, credit-bureau-shaped risk data, and document verification) run in parallel via `Promise.all` before anything is sent to the selected decision engine. This keeps latency low because the integrations are independent.

All raw integration responses are stored as JSONB alongside each decision. This makes it straightforward to audit what data Claude actually saw for any given application.

The demo mode (`DEMO_MODE=true`) runs the same underwriting rules locally without hitting the API, so the full GraphQL flow works without any credentials.
