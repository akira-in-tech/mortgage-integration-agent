import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { LoanModule } from './loan/loan.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { AgentModule } from './agent/agent.module';
import { DatabaseModule } from './database/database.module';
import { NodeEnvironment, validateEnvironment } from './config/env.validation';

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
        };
      },
      inject: [ConfigService],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [join(__dirname, '**', '*.entity.{ts,js}')],
        // synchronize: true only for development — use migrations in production.
        // Reads the validated NODE_ENV enum (never a raw string) so a typo
        // cannot leave auto-sync silently enabled in a production deploy.
        synchronize:
          configService.get<NodeEnvironment>('NODE_ENV') !==
          NodeEnvironment.Production,
        logging:
          configService.get<NodeEnvironment>('NODE_ENV') ===
          NodeEnvironment.Development,
      }),
      inject: [ConfigService],
    }),

    DatabaseModule,
    LoanModule,
    IntegrationsModule,
    AgentModule,
  ],
})
export class AppModule {}
