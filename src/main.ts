import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { NodeEnvironment } from './config/env.validation';
import { resolveCorsOrigin } from './config/cors';
import { buildOpenApiDocument } from './openapi.config';

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

bootstrap();
