import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';
import { NodeEnvironment } from '../config/env.validation';

/**
 * Shared by both the API process (app.module.ts) and the Temporal worker
 * process (worker.module.ts) so their database connections can't drift
 * apart — both must apply the same synchronize/logging/role policy.
 *
 * `APP_DATABASE_URL` (M5-003) is used in staging and production: the
 * `AppRuntimeRole` migration provisions a `mortgage_app` role with plain
 * DML grants and no DDL rights, so PostgreSQL's row-level security on
 * `webhook_endpoints`/`webhook_deliveries` (M5-002) actually applies to
 * this process's own queries instead of being silently bypassed by a
 * superuser connection. Deployment environments never auto-synchronize
 * schema and must use the restricted runtime credential; local development
 * keeps the DDL-capable `DATABASE_URL` behavior. The defensive throw below
 * preserves that boundary even if this factory is called without the normal
 * environment validator.
 */
export function createTypeOrmOptions(
  configService: ConfigService,
): TypeOrmModuleOptions {
  const nodeEnv = configService.get<NodeEnvironment>('NODE_ENV');
  const isDeployment =
    nodeEnv === NodeEnvironment.Production ||
    nodeEnv === NodeEnvironment.Staging;

  let url = configService.get<string>('DATABASE_URL');
  if (isDeployment) {
    const appUrl = configService.get<string>('APP_DATABASE_URL');
    if (!appUrl) {
      throw new Error('APP_DATABASE_URL is required in staging and production');
    }
    url = appUrl;
  }

  return {
    type: 'postgres',
    url,
    entities: [join(__dirname, 'entities', '*.entity.{ts,js}')],
    // synchronize: true only for local/test work — use migrations in every deployment.
    // Reads the validated NODE_ENV enum (never a raw string) so a typo
    // cannot leave auto-sync silently enabled in a production deploy.
    synchronize: !isDeployment,
    logging: nodeEnv === NodeEnvironment.Development,
  };
}
