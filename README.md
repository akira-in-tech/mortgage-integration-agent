# mortgage-integration-agent

A vendor-neutral lending orchestration MVP that pulls simulated income, credit, and document-verification data in parallel and produces a structured loan-readiness result. It supports a deterministic rules provider and an optional local open-weight model through Ollama.

Built with NestJS, GraphQL, TypeORM, PostgreSQL, and Ollama-compatible local models. No paid AI API key is required.

> The current integrations and decisions are simulations for development and demonstration. They are not official lender, GSE, or automated underwriting system findings.

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
                          │              │ Decision Provider       │           │
                          │              │ rules | local Ollama    │           │
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
| Framework | NestJS 10 |
| Language | TypeScript 5 (strict mode) |
| Decisioning | Deterministic rules or local Ollama + Qwen3.5 |
| ORM | TypeORM 0.3 |
| Database | PostgreSQL 15+ |
| Validation | class-validator, class-transformer |
| Testing | Jest |

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
# Deterministic rules — no model or API key required
docker-compose up

# Local open-weight model — Ollama must be running on the host
DECISION_PROVIDER=ollama docker-compose up
```

Open **http://localhost:3000/graphql** once the app is running.

## Setup (local, without Docker)

**Prerequisites:** Node.js 20+, PostgreSQL 15+. Ollama is optional.

```bash
npm install
createdb mortgage_agent
# Copy .env.example to .env and set DATABASE_URL
npm run start:dev
```

To use the local AI provider:

```bash
ollama pull qwen3.5:9b
ollama serve
DECISION_PROVIDER=ollama npm run start:dev
```

`qwen3.5:9b` is the default local model. It supports tool-oriented workflows, structured responses, and future document-image inputs while remaining practical on a 16 GB Apple Silicon development machine. On a lower-memory machine, set `OLLAMA_MODEL=qwen3.5:4b`.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DECISION_PROVIDER` | No | `rules` (default) or `ollama` |
| `OLLAMA_BASE_URL` | With `ollama` | Local Ollama endpoint; defaults to `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | With `ollama` | Local model tag; defaults to `qwen3.5:9b` |
| `OLLAMA_TIMEOUT_MS` | No | Positive request timeout in milliseconds; defaults to `60000` |

When `DECISION_PROVIDER=ollama`, the app logs the selected local model and endpoint. Ollama structured output is constrained by a JSON schema and then validated again before the result is accepted.

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

The following examples show the response contract. Exact reasoning varies by provider and generated borrower scenario.

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

## Tests

End-to-end tests use the configured decision provider and require a live database. They default to the deterministic rules provider, so no model or API key is required:

```bash
# Set DATABASE_URL in .env, then:
npm run test:e2e
```

Tests are automatically skipped with a warning if either env var is missing.

## Design Notes

The three integration calls (Plaid, credit bureau, document parser) run in parallel via `Promise.all` before decisioning. This keeps latency low since the integrations are independent of each other.

All raw integration responses are stored as JSONB alongside each result. This makes it straightforward to audit what data the selected provider saw for any given application.

The default `rules` provider is deterministic and runs fully locally. The optional `ollama` provider uses an open-weight local model and never sends borrower data to a paid cloud-model API.
