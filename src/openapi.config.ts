import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/**
 * Section 15.3: "checked and published OpenAPI artifact." One shared
 * builder so `main.ts` (the live `/api-docs` UI/JSON, dev-only — same
 * gating this codebase already applies to the GraphQL Playground) and
 * `generate-openapi-spec.ts` (the checked-in artifact `openapi/openapi.json`,
 * which `npm run generate:client` reads) can never drift from each other —
 * both call this same function against the same real, decorated
 * controllers, rather than either hand-maintaining a duplicate.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Mortgage Integration Agent — Partner API')
    .setDescription(
      'Section 15.1 partner REST API. This artifact documents only the ' +
        'endpoints this codebase actually implements today (case creation, ' +
        'lookup, timeline, workflow-run start/status, and reviewer decisions; ' +
        'webhook endpoint registration and delivery lookup) — the full ' +
        'Section 15.1 surface (consents, documents, conditions, evidence, ' +
        'policy-snapshots, provider-operations, audit-export) is not yet ' +
        'built and is not represented here.',
    )
    .setVersion('1.0.0')
    .addTag('loan-cases')
    .addTag('webhooks')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      description:
        'A Section 20 M5 scoped API-client credential, "{clientId}.{secret}" — minted via `npm run create-api-client` (no self-service REST endpoint exists yet). The tenant is always the one this credential belongs to; no request body or query parameter can specify a different one.',
    })
    .addCookieAuth('meridian_session', {
      type: 'apiKey',
      in: 'cookie',
      description:
        'Opaque HttpOnly human-session handle issued by the OIDC BFF. Unsafe requests also require the session CSRF value in X-CSRF-Token.',
    })
    .build();
  return SwaggerModule.createDocument(app, config);
}
