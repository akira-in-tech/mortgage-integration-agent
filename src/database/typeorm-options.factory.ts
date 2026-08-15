import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';
import { NodeEnvironment } from '../config/env.validation';

/**
 * Shared by both the API process (app.module.ts) and the Temporal worker
 * process (worker.module.ts) so their database connections can't drift
 * apart — both must apply the same synchronize/logging policy.
 */
export function createTypeOrmOptions(
  configService: ConfigService,
): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: configService.get<string>('DATABASE_URL'),
    entities: [join(__dirname, 'entities', '*.entity.{ts,js}')],
    // synchronize: true only for development — use migrations in production.
    // Reads the validated NODE_ENV enum (never a raw string) so a typo
    // cannot leave auto-sync silently enabled in a production deploy.
    synchronize:
      configService.get<NodeEnvironment>('NODE_ENV') !==
      NodeEnvironment.Production,
    logging:
      configService.get<NodeEnvironment>('NODE_ENV') ===
      NodeEnvironment.Development,
  };
}
