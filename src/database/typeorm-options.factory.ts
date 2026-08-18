import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';
import { NodeEnvironment } from '../config/env.validation';

const logger = new Logger('TypeOrmOptions');

/**
 * Shared by both the API process (app.module.ts) and the Temporal worker
 * process (worker.module.ts) so their database connections can't drift
 * apart — both must apply the same synchronize/logging/role policy.
 *
 * `APP_DATABASE_URL` (M5-003) is used only in production: the
 * `AppRuntimeRole` migration provisions a `mortgage_app` role with plain
 * DML grants and no DDL rights, so PostgreSQL's row-level security on
 * `webhook_endpoints`/`webhook_deliveries` (M5-002) actually applies to
 * this process's own queries instead of being silently bypassed by a
 * superuser connection. Scoped to production only because `synchronize`
 * (below) needs DDL rights and is only disabled there — local development
 * keeps connecting as `DATABASE_URL`'s role exactly as before. A
 * production deploy that hasn't set `APP_DATABASE_URL` yet still boots
 * (falling back to `DATABASE_URL`, which is that deploy's own migration
 * role) rather than crash-looping, but does so with a loud warning: an
 * unnoticed missing var should be visible in the logs, not a silent
 * re-opening of the exact RLS-bypass gap this migration exists to close.
 */
export function createTypeOrmOptions(
  configService: ConfigService,
): TypeOrmModuleOptions {
  const nodeEnv = configService.get<NodeEnvironment>('NODE_ENV');
  const isProduction = nodeEnv === NodeEnvironment.Production;

  let url = configService.get<string>('DATABASE_URL');
  if (isProduction) {
    const appUrl = configService.get<string>('APP_DATABASE_URL');
    if (appUrl) {
      url = appUrl;
    } else {
      logger.warn(
        'APP_DATABASE_URL is not set in production — falling back to DATABASE_URL. ' +
          'If that role is a superuser (or otherwise has BYPASSRLS), row-level security ' +
          'on webhook_endpoints/webhook_deliveries provides no real protection for this ' +
          "process's own queries. See docs/DEVELOPMENT_LOG.md M5-002/M5-003.",
      );
    }
  }

  return {
    type: 'postgres',
    url,
    entities: [join(__dirname, 'entities', '*.entity.{ts,js}')],
    // synchronize: true only for development — use migrations in production.
    // Reads the validated NODE_ENV enum (never a raw string) so a typo
    // cannot leave auto-sync silently enabled in a production deploy.
    synchronize: !isProduction,
    logging: nodeEnv === NodeEnvironment.Development,
  };
}
