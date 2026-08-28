import { MigrationInterface, QueryRunner } from 'typeorm';

const APP_ROLE = 'mortgage_app';

/**
 * The concrete fix for M5-002's own headline Known gap: PostgreSQL
 * superusers unconditionally bypass row-level security, and this
 * project's own `DATABASE_URL` role (`mortgage`, bootstrapped as the
 * cluster's superuser via `POSTGRES_USER` on the stock `postgres` image)
 * is one — so the RLS policies on `webhook_endpoints`/`webhook_deliveries`
 * are inert against it. This migration creates a second, genuinely
 * restricted role for the application's own runtime traffic to connect
 * as, so RLS actually protects something in a real deployment.
 *
 * Deliberately scoped to `NODE_ENV=staging|production` (see
 * `createTypeOrmOptions`), matching this codebase's own pre-existing
 * `synchronize`-vs-migrations split (README: local development
 * auto-synchronizes the schema from entities, which needs DDL rights;
 * deployment environments require running migrations first and therefore
 * can require a non-DDL runtime role too). Local
 * `docker-compose up`/`npm run start:dev` are unaffected — they keep
 * connecting as `mortgage` exactly as before.
 *
 * `mortgage_app` gets exactly DML (`SELECT/INSERT/UPDATE/DELETE`) on
 * every table that exists today, plus a standing `ALTER DEFAULT
 * PRIVILEGES` grant so every table a *future* migration creates (always
 * run by the same admin/migration role, matched here via `CURRENT_USER`
 * rather than hardcoding "mortgage" a second time) is automatically
 * covered too — without this, a forgotten grant on a future migration
 * would silently break the app's very next boot, a much worse failure
 * mode than being covered by default and revisited if a table genuinely
 * needs a narrower policy later.
 *
 * The password has a demo-only default so local scratch-stack
 * verification (and this migration's own `down()`/re-`up()` round trip
 * in `schema-migrations.spec.ts`) needs no extra setup — identical
 * reasoning to `OUTBOX_SIGNING_SECRET`'s own "fine for local development
 * only" default. A real deployment must set `APP_DATABASE_ROLE_PASSWORD`
 * itself.
 */
export class AppRuntimeRole1787082648663 implements MigrationInterface {
  name = 'AppRuntimeRole1787082648663';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const password =
      process.env.APP_DATABASE_ROLE_PASSWORD ?? 'mortgage_app_demo';

    // PostgreSQL roles are cluster-global, not scoped to one database —
    // unlike every other object this codebase's migrations create. A
    // plain CREATE ROLE would fail with "already exists" the moment two
    // databases in the same cluster both run this migration (exactly
    // what schema-migrations.spec.ts's own disposable scratch database
    // does, alongside whatever database DATABASE_URL itself points to).
    // Guarding it, and leaving the GRANTs themselves unconditional (GRANT
    // is naturally idempotent — re-granting an already-held privilege is
    // a no-op, not an error) keeps this migration safe to apply against
    // any database sharing a cluster with one that's already run it.
    await queryRunner.query(
      `DO $$
       BEGIN
         IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
           EXECUTE format(
             'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE',
             '${APP_ROLE}', '${password}'
           );
         END IF;
       END $$`,
    );
    // GRANT ... ON DATABASE takes a literal identifier, not an expression,
    // so current_database() has to be resolved dynamically through EXECUTE
    // rather than named directly — this migration must not hardcode
    // "mortgage_agent", since schema-migrations.spec.ts runs the full
    // migration chain (this one included) against a disposably-named
    // scratch database of its own.
    await queryRunner.query(
      `DO $$ BEGIN
         EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), '${APP_ROLE}');
       END $$`,
    );
    await queryRunner.query(`GRANT USAGE ON SCHEMA public TO "${APP_ROLE}"`);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${APP_ROLE}"`,
    );
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public
         GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${APP_ROLE}"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public
         REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM "${APP_ROLE}"`,
    );
    await queryRunner.query(
      `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "${APP_ROLE}"`,
    );
    await queryRunner.query(`REVOKE USAGE ON SCHEMA public FROM "${APP_ROLE}"`);
    await queryRunner.query(
      `DO $$ BEGIN
         EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM %I', current_database(), '${APP_ROLE}');
       END $$`,
    );

    // Best-effort: this database's own privileges are fully revoked
    // above regardless of what happens here. DROP ROLE itself can fail
    // with Postgres error 2BP01 (dependent_objects_still_exist, "cannot
    // be dropped because some objects depend on it") for a
    // role-is-cluster-global reason unrelated to this database — a
    // sibling database in the same cluster that has *also* run this
    // migration (schema-migrations.spec.ts's own disposable scratch
    // database is exactly this case when it shares a cluster with
    // whatever DATABASE_URL points to) still holds grants to the same
    // role name. Destroying the role out from under that sibling's
    // still-active grants would be a worse outcome than leaving a
    // harmless, now privilege-less-in-this-database role behind.
    //
    // This has to be a PL/pgSQL EXCEPTION block, not a plain JS
    // try/catch around queryRunner.query(): a JS catch can observe the
    // driver error, but it cannot undo Postgres's own transaction-abort
    // state — once any statement inside a transaction errors, every
    // later statement in that same transaction (including TypeORM's own
    // migration-bookkeeping DELETE right after this) fails with "current
    // transaction is aborted" regardless of what JS does with the
    // exception. A PL/pgSQL EXCEPTION clause establishes an implicit
    // savepoint, so catching the error here — and only here — lets the
    // outer transaction continue normally.
    await queryRunner.query(
      `DO $$
       BEGIN
         EXECUTE format('DROP ROLE %I', '${APP_ROLE}');
       EXCEPTION
         WHEN dependent_objects_still_exist THEN
           RAISE NOTICE 'AppRuntimeRole revert: role "${APP_ROLE}" still has grants in another database in this cluster, so it was not dropped -- only this database''s own grants were revoked.';
       END $$`,
    );
  }
}
