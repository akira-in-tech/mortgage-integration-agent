import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationsModule } from './integrations/integrations.module';
import { DatabaseModule } from './database/database.module';
import { PolicyModule } from './policy/policy.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { validateEnvironment } from './config/env.validation';
import { createTypeOrmOptions } from './database/typeorm-options.factory';
import { ConsentModule } from './consent/consent.module';
import { CommunicationsModule } from './communications/communications.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';

/**
 * Deliberately not AppModule: the worker process never serves HTTP or
 * GraphQL traffic, so it has no GraphQLModule, ThrottlerModule, HealthModule,
 * or rate-limit guard — only what activities actually need (the database
 * and the integration simulators). Section 12.1's API/worker process
 * boundary: two processes from one codebase, not one process wearing two
 * hats.
 *
 * `AuthModule` is imported even though nothing here calls it directly:
 * `WebhooksModule`'s own controllers (needed only for `WebhookDispatchService`,
 * which this process genuinely uses) carry `@UseGuards(TenantAuthGuard)`,
 * and `NestFactory.createApplicationContext()` still eagerly instantiates
 * controllers and their guards even though it never binds HTTP routes for
 * them. `AuthModule`'s own `@Global()` only takes effect once something in
 * *this* bootstrap's own module tree imports it — a separate
 * `NestFactory` call, like this one, gets none of AppModule's global
 * registrations for free. Omitting this import is a real, previously-
 * undiscovered bug: the worker process cannot boot at all without it
 * (`UnknownDependenciesException` on `ApiKeyGuard`), found by actually
 * running `node dist/worker.js`, not by reasoning about the module graph.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: createTypeOrmOptions,
      inject: [ConfigService],
    }),
    DatabaseModule,
    IntegrationsModule,
    PolicyModule,
    WebhooksModule,
    ConsentModule,
    AuditModule,
    CommunicationsModule,
    AuthModule,
  ],
})
export class WorkerModule {}
