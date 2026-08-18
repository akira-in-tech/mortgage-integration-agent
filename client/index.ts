import createClient from 'openapi-fetch';
import type { paths } from './generated/schema';

/**
 * Section 20 M4 exit evidence: "generated client completes the published
 * quickstart." `paths` is genuinely generated (`npm run generate:openapi`
 * then `npm run generate:client`, see package.json) from the real,
 * decorated `CasesController`/`WebhookEndpointsController`/
 * `WebhookDeliveriesController` — this file is the only hand-written
 * part, a thin `openapi-fetch` wrapper that makes every call fully typed
 * against that generated schema. Regenerate `generated/schema.d.ts` after
 * any controller change; a stale schema fails to compile against a
 * changed route rather than silently drifting.
 *
 * `token` is a Section 20 M5 scoped API-client credential
 * (`{clientId}.{secret}`, minted via `npm run create-api-client`) — every
 * tenant-scoped route requires it (`ApiKeyGuard`). Passed once here, not
 * per call: the tenant a client acts as is fixed by its own credential,
 * never a value an individual request chooses.
 */
export function createApiClient(baseUrl: string, token?: string) {
  return createClient<paths>({
    baseUrl,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export type { paths } from './generated/schema';
export type { components } from './generated/schema';
