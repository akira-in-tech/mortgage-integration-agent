import createClient from 'openapi-fetch';
import type { paths } from './generated/schema';

/**
 * Section 20 M4 exit evidence: "generated client completes the published
 * quickstart." `paths` is genuinely generated (`npm run generate:openapi`
 * then `npm run generate:client`, see package.json) from the real,
 * decorated `CasesController` — this file is the only hand-written part,
 * a thin `openapi-fetch` wrapper that makes every call fully typed against
 * that generated schema. Regenerate `generated/schema.d.ts` after any
 * controller change; a stale schema fails to compile against a changed
 * route rather than silently drifting.
 */
export function createApiClient(baseUrl: string) {
  return createClient<paths>({ baseUrl });
}

export type { paths } from './generated/schema';
export type { components } from './generated/schema';
