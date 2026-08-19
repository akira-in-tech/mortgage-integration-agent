import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { LoanModule } from './loan/loan.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { AgentModule } from './agent/agent.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { NodeEnvironment, validateEnvironment } from './config/env.validation';
import { GqlThrottlerGuard } from './common/gql-throttler.guard';
import { createTypeOrmOptions } from './database/typeorm-options.factory';
import { TemporalModule } from './workflows/temporal.module';
import { CasesModule } from './cases/cases.module';
import { PolicyModule } from './policy/policy.module';
import { CommunicationsModule } from './communications/communications.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AuthModule } from './auth/auth.module';
import { ConsentModule } from './consent/consent.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnvironment,
    }),

    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // The GraphQL Playground and schema introspection are convenient for
        // local development but leak the full schema to anyone who can reach
        // the endpoint — the charter (16.1) requires both disabled outside
        // development.
        const isDevelopment =
          configService.get<NodeEnvironment>('NODE_ENV') ===
          NodeEnvironment.Development;

        return {
          autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
          sortSchema: true,
          playground: isDevelopment,
          introspection: isDevelopment,
          // Exposes req/res on the resolver context so GqlThrottlerGuard can
          // rate-limit GraphQL requests the same way it does REST ones.
          context: ({ req, res }: { req: unknown; res: unknown }) => ({
            req,
            res,
          }),
        };
      },
      inject: [ConfigService],
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('RATE_LIMIT_TTL_MS', 60_000),
          limit: configService.get<number>('RATE_LIMIT_MAX', 100),
        },
      ],
      inject: [ConfigService],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: createTypeOrmOptions,
      inject: [ConfigService],
    }),

    DatabaseModule,
    LoanModule,
    IntegrationsModule,
    AgentModule,
    HealthModule,
    TemporalModule,
    AuthModule,
    ConsentModule,
    CasesModule,
    PolicyModule,
    CommunicationsModule,
    WebhooksModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: GqlThrottlerGuard }],
})
export class AppModule {}
