# Meridian — Underwriting Ops Console

A real React operations console for the mortgage-integration-agent GraphQL API. Six real tenant screens, plus a separate platform-admin console outside the tenant shell entirely:

- **Triage Queue** — case list with cursor pagination and status filtering, and a six-tab case detail pane (overview, evidence, conditions, timeline, communications, audit) with working mutations (resolve condition, escalate, approve/send communications). The Overview tab's Policy binding card can also check whether a given policy version would require re-evaluating that case.
- **Ops Dashboard** — KPI stat tiles and a status-breakdown bar chart, backed by the real `caseStatusCounts` GraphQL aggregate query.
- **Case Dossier** — a single continuous, printable document view of one case (reached from its detail pane's "View dossier" button, not the nav rail — it's per-case, not a tenant-wide section).
- **Live Stream** — a polling (8s) tenant-wide activity feed backed by `recentActivity`, newest first, with newly-arrived events visually distinguished from ones already seen.
- **Agent Budget Operations** — UTC-month provider-call/cost authority plus the reviewer queue for outcome-unknown Agent budget reservations.
- **Admin Queues** — two reviewer queues: provider calls whose real outcome is still unclear, and evidence waiting on a delete/anonymize/retain decision after a consent revocation.

Plus **Platform Admin** — reached from a link on the connect screen, not the nav rail: the provider promotion chain (propose/certify/approve/activate a provider adapter) and a list of saved evaluation reports (real `npm run evaluate` runs, each downloadable as a real file). Neither is one of the six tenant screens above — providers and evaluation runs aren't scoped to any tenant, so this uses its own platform-admin credential (`npm run create-platform-admin`, from the repo root) that a tenant session can never satisfy and vice versa. See `src/components/PlatformAdminConsole.tsx`.

See the main repo's `README.md` ("Operations console" section) and `docs/DEVELOPMENT_LOG.md`'s M6-007 through M7-023 entries for what was built, how it was verified, and its known gaps.

## Run it

```bash
npm install
npm run dev
```

Serves on `http://localhost:5173`. Requires the main API running (`npm run start:dev` from the repo root, or the docker-compose stack).

Two ways to sign in:

- **Bearer token** — obtain one from the repo root's `create-api-client.ts` script, paste it and a reviewer name into the connect screen. Kept in `localStorage` (`meridian.apiToken` / `meridian.actorId`).
- **Sign in with SSO** — a real Authorization Code + PKCE flow owned by the API's same-origin backend-for-frontend. Provider access, refresh, and ID tokens are AES-256-GCM ciphertext in PostgreSQL; the browser receives an opaque `HttpOnly` session cookie and a double-submit CSRF value. The API returns only the verified identity's provisioned memberships and re-authorizes the selected tenant on every request. The seeded local Keycloak account is `reviewer@example.com` / `reviewer-dev-password`.

Vite proxies `/graphql` and `/v1` to `http://localhost:3000`, keeping browser traffic first-party in development. Override `VITE_GRAPHQL_URL`/`VITE_API_URL` only when a reverse proxy supplies an equivalent same-origin route. Configure the provider, client, callback, console origin, session lifetime, and production encryption key through the root `OIDC_*`/`CONSOLE_ORIGIN` server variables; no provider configuration or secret belongs in a `VITE_*` variable.

## Build

```bash
npm run build   # tsc --noEmit + vite build, output to dist/
npm run preview # serve the production build locally
```

## Test

```bash
npm test        # vitest run — format helpers, StatusPill, useCaseMutations,
                 # the "Mark satisfied" click path, OpsDashboard, CaseDossier,
                 # LiveStream, oidc (BFF session/tenant/CSRF orchestration)
npm run lint     # real ESLint flat config — TS, React hooks, prettier
npm run test:e2e # Playwright Chromium journeys + axe WCAG scan
```

Install the local browser once with `npx playwright install chromium`. The browser gate exercises Bearer and OIDC tenant-session orchestration, cookie-session GraphQL headers, CSRF, RP-initiated logout, absence of provider tokens in browser storage, keyboard-addressable controls, and automated WCAG checks. Its network responses are deterministic fixtures — a real, complete browser redirect through live Keycloak/PostgreSQL is a separate journey (below).

`RUN_LIVE_OIDC=true npm run test:e2e -- e2e/oidc-live.spec.ts` runs that credential-backed gate when the local API, migrated PostgreSQL, Keycloak realm, and synthetic user membership are provisioned — real Keycloak login form, real GraphQL tenant/CSRF headers, real session cookies, real logout. As of M7-022 this also runs by default on every CI push/PR (`build-and-test`, not just locally): `keycloak/realm-export.json` pins the seeded reviewer account's own Keycloak id, so its `sub` claim is the same deterministic value on every fresh realm import, letting CI seed a real matching `User`/`TenantMembership` row with `npm run manage-user` before the browser ever logs in.

## GraphQL codegen

`src/gql/` is generated from the real backend schema (`../src/schema.gql`, written when the main app boots) and is committed — no live server is required to `npm install && npm run build`. After any backend GraphQL schema change:

```bash
npm run codegen
```

`src/graphql/types.ts` re-exports from the generated types, so most components never need to change; only `queries.ts`/`mutations.ts` and `types.ts` itself touch `src/gql/` directly.

## Known gaps

- Client-side-only search on Triage Queue (substring match over currently-loaded rows).
- The live Keycloak/API/PostgreSQL journey now runs in hosted CI by default (M7-022) as well as locally via `RUN_LIVE_OIDC=true`.
- Key rotation currently requires invalidating existing OIDC sessions; a versioned multi-key decrypt window is not implemented.
- No way to browse or search existing policy versions — the policy-impact check needs a version id typed in, from whoever published it.
- No key rotation or expiry for either bearer-token credential type (`ApiClient` or the newer `PlatformAdmin`).
- No unified audit-event trail for platform-admin actions specifically — the manifest/certification/approval/activation rows themselves record who and when, but there's no cross-action log the way tenant `audit_events` gives reviewers.
