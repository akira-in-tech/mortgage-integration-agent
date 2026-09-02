import { shutdownTelemetry } from './instrumentation';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { NodeEnvironment } from './config/env.validation';
import { resolveCorsOrigin } from './config/cors';
import { buildOpenApiDocument } from './openapi.config';
import { getActiveTraceFields } from './observability/trace-context';
import {
  describeTenantIsolationRlsGaps,
  findTenantIsolationRlsGaps,
} from './database/check-tenant-isolation-rls';

// Explicit, not Express's implicit default — the charter (16.1) requires
// request-size limits to be a deliberate decision, not an accident of
// whatever the framework happens to default to. No endpoint currently
// accepts file uploads, so one conservative JSON/urlencoded limit covers
// every route.
const REQUEST_BODY_LIMIT = '1mb';

async function bootstrap(): Promise<void> {
  // Env validation runs as ConfigModule resolves during AppModule creation;
  // an invalid or missing variable throws here, before any HTTP listener
  // or database connection is attempted.
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Return the opaque trace id to operators and API clients without exposing
  // any tenant, case, borrower, credential, query, or request-body data.
  app.use(
    (
      _request: unknown,
      response: { setHeader(name: string, value: string): void },
      next: () => void,
    ) => {
      const traceFields = getActiveTraceFields();
      if (traceFields) {
        response.setHeader('X-Trace-Id', traceFields.traceId);
      }
      next();
    },
  );

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<NodeEnvironment>(
    'NODE_ENV',
    NodeEnvironment.Development,
  );
  const isDevelopment = nodeEnv === NodeEnvironment.Development;

  app.use(
    helmet({
      // The GraphQL Playground (dev-only, see app.module.ts) loads assets
      // from external CDNs that helmet's default CSP blocks; CSP is only
      // meaningful for browser-rendered content, and the playground is the
      // only such surface before the operations console (Section 8.6) exists.
      contentSecurityPolicy: isDevelopment ? false : undefined,
    }),
  );

  app.useBodyParser('json', { limit: REQUEST_BODY_LIMIT });
  app.useBodyParser('urlencoded', {
    limit: REQUEST_BODY_LIMIT,
    extended: true,
  });

  app.enableCors({
    origin: resolveCorsOrigin(
      configService.get<string>('CORS_ALLOWED_ORIGINS'),
      nodeEnv,
    ),
  });

  // Global validation pipe — enforces class-validator decorators on all DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Lets Nest run onModuleDestroy/beforeApplicationShutdown on SIGTERM/SIGINT
  // (closing the TypeORM connection pool cleanly) instead of the process
  // being killed mid-request with connections left open.
  app.enableShutdownHooks();

  // Same reasoning as the GraphQL Playground/introspection gate above this
  // block: interactive API documentation is convenient for local
  // development but leaks the full REST surface to anyone who can reach
  // the endpoint — disabled outside development (charter 16.1). The
  // checked-in `openapi/openapi.json` artifact (Section 15.3: "checked and
  // published OpenAPI artifact") is generated separately via
  // `npm run generate:openapi`, not served live in every environment.
  if (isDevelopment) {
    SwaggerModule.setup('api-docs', app, buildOpenApiDocument(app));
  }

  // M7-055: a real audit found this codebase's own long-lived local dev
  // database can have row-level security silently disabled on nearly
  // every tenant-scoped table (built via `synchronize` instead of the
  // real migration chain, which is the only thing that actually applies
  // the `ENABLE ROW LEVEL SECURITY`/`FORCE ROW LEVEL SECURITY` statements)
  // — tenant isolation fails open there, with nothing surfacing that
  // until someone happens to run the tenant-isolation spec suite
  // directly. Staging/production fail closed and refuse to boot; local
  // development gets a loud, impossible-to-miss warning instead of a
  // silent trust-boundary gap, since hard-failing there would break the
  // documented, existing local-dev workflow this codebase already has.
  const rlsGaps = await findTenantIsolationRlsGaps(app.get(DataSource));
  if (rlsGaps.length > 0) {
    const lines = describeTenantIsolationRlsGaps(rlsGaps);
    if (
      nodeEnv === NodeEnvironment.Staging ||
      nodeEnv === NodeEnvironment.Production
    ) {
      throw new Error(
        `Refusing to start in ${nodeEnv}: tenant isolation (row-level security) is missing on ${rlsGaps.length} table(s): ${lines.join('; ')}. Run the real migration chain (npm run migration:run) against this database, not a synchronize-built schema.`,
      );
    }
    console.warn(
      `WARNING: row-level security is missing on ${rlsGaps.length} tenant-scoped table(s) — tenant isolation fails open on this database: ${lines.join('; ')}. This is a known local-dev quirk when the schema was built via synchronize instead of "npm run migration:run" — fine for casual local development, but never trust cross-tenant test results against this database until it's fixed.`,
    );
  }

  const port = configService.get<number>('PORT', 3000);

  await app.listen(port);
  console.log(
    `Mortgage Integration Agent running on port ${port} (${nodeEnv})`,
  );
  if (isDevelopment) {
    console.log(`GraphQL Playground: http://localhost:${port}/graphql`);
    console.log(`OpenAPI docs: http://localhost:${port}/api-docs`);
  }
}

bootstrap().catch(async (error) => {
  console.error('API failed to start:', error);
  await shutdownTelemetry();
  process.exitCode = 1;
});
