import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 30 }],
    }),

    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      context: ({ req, res }: { req: unknown; res: unknown }) => ({ req, res }),
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [join(__dirname, '**', '*.entity.{ts,js}')],
        synchronize: false,
        migrationsRun: configService.get<string>('RUN_MIGRATIONS') === 'true',
        migrations: [join(__dirname, 'database', 'migrations', '*.{ts,js}')],
        logging: configService.get<string>('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),

    DatabaseModule,
    LoanModule,
    IntegrationsModule,
    AgentModule,
    HealthModule,
  ],
})
export class AppModule {}
