# mortgage-integration-agent

An AI-native mortgage integration orchestration service built on NestJS and GraphQL. It aggregates data from multiple financial integrations (income verification, credit bureaus, document parsing) in parallel, then routes the combined borrower profile through Claude to produce a structured, auditable underwriting decision — all exposed through a single, clean GraphQL API.

---

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
                          │              │  borrower data  →       │           │
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

---

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

---

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ running locally (or a connection URL)
- An Anthropic API key

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://postgres:password@localhost:5432/mortgage_agent
PORT=3000
NODE_ENV=development
```

### 3. Create the database

```bash
createdb mortgage_agent
```

TypeORM will auto-sync the schema on first run in development mode.

### 4. Start the server

```bash
npm run start:dev
```

GraphQL Playground is available at `http://localhost:3000/graphql`.

---

## Example Query

```graphql
query EvaluateLoan {
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

**Example response (APPROVED):**

```json
{
  "data": {
    "evaluateLoan": {
      "applicationId": "a1b2c3d4-...",
      "decision": "APPROVED",
      "confidence": 0.94,
      "reasoning": "Strong credit score of 752 with excellent payment history. DTI of 31% is well within conventional guidelines. All four document types verified. Loan-to-income ratio of 3.2x is conservative.",
      "incomeVerified": true,
      "creditScore": 752,
      "documentsValid": true,
      "conditions": [],
      "createdAt": "2026-06-20T09:14:22.000Z"
    }
  }
}
```

**Example response (CONDITIONAL):**

```json
{
  "data": {
    "evaluateLoan": {
      "decision": "CONDITIONAL",
      "confidence": 0.73,
      "reasoning": "Credit score of 662 is below conventional threshold but qualifies under FHA guidelines. DTI of 47% exceeds standard limit and requires documented compensating factors.",
      "conditions": [
        "Provide letter of explanation for credit score below 700",
        "Document compensating factors for DTI exceeding 43%"
      ]
    }
  }
}
```

---

## Running Tests

```bash
# Unit tests
npm run test

# E2E tests (no live services required — AgentService is mocked)
npm run test:e2e

# Coverage report
npm run test:cov
```

---

## Why This Architecture

**Monolith-first, API-as-product.** Mortgage underwriting involves tightly coupled data dependencies — income, credit, and documents must all be assessed together to make a coherent decision. A distributed microservices split would add network hops and distributed transaction complexity with no benefit at this stage. The monolith lets us fan out to integration vendors in a single `Promise.all`, pass the combined data to Claude in one context window, and persist the result atomically.

**AI as a first-class underwriting component.** Traditional rules-engine underwriting requires maintaining thousands of if/else conditions across loan programs. By describing underwriting guidelines in a system prompt and giving Claude structured borrower data, the same codebase handles CONVENTIONAL, FHA, VA, and JUMBO logic without conditional sprawl. The LLM produces reasoning and conditions in plain English, which is what loan officers actually need.

**GraphQL as the external contract.** A single `evaluateLoan` query abstracts three integration vendors and an AI model behind a typed, self-documenting API. Callers (loan origination systems, mobile apps, broker portals) never need to know which bureau was called or which Claude model evaluated the file. Integration vendor swaps and model upgrades are invisible to API consumers.

**Audit trail by default.** Every decision writes the full raw integration payloads to `rawIntegrationData (jsonb)`. This satisfies ECOA adverse action notice requirements and supports post-hoc model auditing — you can always replay exactly what data Claude saw for any decision.
