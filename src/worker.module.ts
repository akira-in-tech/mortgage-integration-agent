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

/**
 * Deliberately not AppModule: the worker process never serves HTTP or
 * GraphQL traffic, so it has no GraphQLModule, ThrottlerModule, HealthModule,
 * or rate-limit guard — only what activities actually need (the database
 * and the integration simulators). Section 12.1's API/worker process
 * boundary: two processes from one codebase, not one process wearing two
 * hats.
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
  ],
})
export class WorkerModule {}
