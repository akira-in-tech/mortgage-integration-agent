import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { join } from 'path';

loadEnv();

/**
 * Standalone DataSource for the TypeORM CLI (migration generate/run/revert).
 * Kept separate from AppModule's TypeOrmModule.forRootAsync: the CLI runs
 * outside Nest's dependency-injection container, so it cannot resolve
 * ConfigService and reads DATABASE_URL directly instead. Entity and
 * migration globs match both `.ts` (via ts-node, for local development)
 * and compiled `.js` (for a production migration run against `dist/`).
 */
// A single default export only — the TypeORM CLI requires the data-source
// file to contain exactly one exported DataSource instance.
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [join(__dirname, 'entities', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  migrationsTableName: 'typeorm_migrations',
});
