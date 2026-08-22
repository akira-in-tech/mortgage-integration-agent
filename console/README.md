# Meridian — Underwriting Ops Console

A real React operations console for the mortgage-integration-agent GraphQL API. Four real screens:

- **Triage Queue** — case list with cursor pagination and status filtering, and a six-tab case detail pane (overview, evidence, conditions, timeline, communications, audit) with working mutations (resolve condition, escalate, approve/send communications).
- **Ops Dashboard** — KPI stat tiles and a status-breakdown bar chart, backed by the real `caseStatusCounts` GraphQL aggregate query.
- **Case Dossier** — a single continuous, printable document view of one case (reached from its detail pane's "View dossier" button, not the nav rail — it's per-case, not a tenant-wide section).
- **Live Stream** — a polling (8s) tenant-wide activity feed backed by `recentActivity`, newest first, with newly-arrived events visually distinguished from ones already seen.

See the main repo's `README.md` ("Operations console" section) and `docs/DEVELOPMENT_LOG.md`'s M6-007 through M6-014 entries for what was built, how it was verified, and its known gaps.

## Run it

```bash
npm install
npm run dev
```

Serves on `http://localhost:5173`. Requires the main API running (`npm run start:dev` from the repo root, or the docker-compose stack) and a real bearer token, obtained from the repo root's `create-api-client.ts` script. The console has no login flow of its own — paste the token and a reviewer name into the connect screen on first load; both are kept in `localStorage` (`meridian.apiToken` / `meridian.actorId`).

If the API isn't at the default `http://localhost:3000/graphql`, set `VITE_GRAPHQL_URL` (e.g. in a `.env.local` file, gitignored).

## Build

```bash
npm run build   # tsc --noEmit + vite build, output to dist/
npm run preview # serve the production build locally
```

## Test

```bash
npm test        # vitest run — format helpers, StatusPill, useCaseMutations,
                 # the "Mark satisfied" click path, OpsDashboard, CaseDossier,
                 # LiveStream
npm run lint     # real ESLint flat config — TS, React hooks, prettier
```

## GraphQL codegen

`src/gql/` is generated from the real backend schema (`../src/schema.gql`, written when the main app boots) and is committed — no live server is required to `npm install && npm run build`. After any backend GraphQL schema change:

```bash
npm run codegen
```

`src/graphql/types.ts` re-exports from the generated types, so most components never need to change; only `queries.ts`/`mutations.ts` and `types.ts` itself touch `src/gql/` directly.

## Known gaps

- No OIDC login — bearer-token-only. Real Keycloak infrastructure already exists in this repo (`keycloak/realm-export.json`) but the console has never used it.
- Client-side-only search on Triage Queue (substring match over currently-loaded rows).
- No CI enforcement that `src/gql/` stays in sync with the backend schema — `npm run codegen` must be re-run by hand after a schema change.
