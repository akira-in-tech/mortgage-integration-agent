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
  // TypeORM auto-generates migration filenames as `<timestamp>-Name.ts`, so
  // requiring a leading digit excludes hand-written *.spec.ts test files in
  // the same directory — without this, ts-node tries to type-check spec
  // files (which need Jest's ambient types) as part of loading this
  // DataSource for the CLI, and fails as soon as more than one real
  // migration exists alongside a spec file.
  migrations: [join(__dirname, 'migrations', '[0-9]*.{ts,js}')],
  migrationsTableName: 'typeorm_migrations',
});
