# mortgage-integration-agent

A backend service that handles mortgage underwriting decisions using Claude. It pulls income data, credit reports, and document verification in parallel, combines everything into a prompt, and gets back a structured decision (approved / conditional / denied) with a plain-English explanation.

Built with NestJS, GraphQL, TypeORM, and the Anthropic SDK.

## Architecture

```
                          ┌─────────────────────────────────────────────────┐
                          │           mortgage-integration-agent            │
                          │                                                  │
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
                          │          └───────────────────┼───────────────────┘ │
                          │                              │                     │
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
| Framework | NestJS 10 |
| Language | TypeScript 5 (strict mode) |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) |
| ORM | TypeORM 0.3 |
| Database | PostgreSQL 15+ |
| Validation | class-validator, class-transformer |
| Testing | Jest, Supertest |

## Setup

**Prerequisites:** Node.js 20+, PostgreSQL 15+, Anthropic API key

```bash
npm install
cp .env.example .env   # fill in your keys
createdb mortgage_agent
npm run start:dev
```

GraphQL Playground at `http://localhost:3000/graphql`.

**No API key?** Set `DEMO_MODE=true` in `.env` and skip the `ANTHROPIC_API_KEY`. The service will use a built-in rule-based engine instead of calling Claude.

## Example Query

```graphql
query {
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

Example response:

```json
{
  "data": {
    "evaluateLoan": {
      "applicationId": "a1b2c3d4-...",
      "decision": "APPROVED",
      "confidence": 0.94,
      "reasoning": "Credit score of 752 with clean payment history. DTI at 31% is well within conventional limits. All documents verified.",
      "incomeVerified": true,
      "creditScore": 752,
      "documentsValid": true,
      "conditions": [],
      "createdAt": "2026-06-20T09:14:22.000Z"
    }
  }
}
```

## Tests

```bash
npm run test        # unit tests
npm run test:e2e    # e2e (AgentService is mocked, no live services needed)
npm run test:cov    # coverage report
```

## Design Notes

The three integration calls (Plaid, credit bureau, document parser) run in parallel via `Promise.all` before anything gets sent to Claude. This keeps latency low since the integrations are independent of each other.

All raw integration responses are stored as JSONB alongside each decision. This makes it straightforward to audit what data Claude actually saw for any given application.

The demo mode (`DEMO_MODE=true`) runs the same underwriting rules locally without hitting the API, so the full GraphQL flow works without any credentials.
