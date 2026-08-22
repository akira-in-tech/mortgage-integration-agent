# Meridian — Underwriting Ops Console

A real React operations console for the mortgage-integration-agent GraphQL API. Two real screens:

- **Triage Queue** — case list with cursor pagination and status filtering, and a six-tab case detail pane (overview, evidence, conditions, timeline, communications, audit) with working mutations (resolve condition, escalate, approve/send communications).
- **Ops Dashboard** — KPI stat tiles and a status-breakdown bar chart, backed by the real `caseStatusCounts` GraphQL aggregate query.

See the main repo's `README.md` ("Operations console" section) and `docs/DEVELOPMENT_LOG.md`'s M6-007/M6-008/M6-009 entries for what was built, how it was verified, and its known gaps.

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
                 # the "Mark satisfied" click path, OpsDashboard
```

## Known gaps

- No OIDC login — bearer-token-only.
- No GraphQL codegen — `src/graphql/types.ts` is hand-written against a real `src/schema.gql` dump and must be kept in sync by hand.
- Case Dossier and Live Stream (two of the original four design concepts) still unbuilt.
- Client-side-only search (substring match over currently-loaded rows).
- No working ESLint config in this directory (`npm run lint` will fail — never set up).
