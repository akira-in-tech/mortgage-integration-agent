import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';

// Requires a reachable Postgres (same convention as test/loan.e2e-spec.ts):
// skip instead of failing when no DATABASE_URL is configured.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

// A whole disposable database — not just a dedicated schema — is required
// here: TypeORM's Postgres migration generator hardcodes an explicit
// "public". qualifier on CREATE TYPE statements for enum columns, so an
// isolated schema within the *same* database would still collide with the
// real application's already-existing enum types of the same name.
const SCRATCH_DB_NAME = 'mortgage_agent_migration_test';

function withDatabase(url: string, databaseName: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}

/**
 * Tests the full, cumulative migration sequence against a disposable
 * database rather than one file per migration: `runMigrations()` always
 * applies every pending migration, and `undoLastMigration()` only ever
 * reverts the most recently applied one, so per-migration isolation isn't
 * available through the DataSource API without much more machinery. This
 * grows by extending the "after all migrations" and "after each revert"
 * assertions below whenever a new migration is added, not by adding a new
 * spec file per migration.
 */
describeOrSkip('Schema migrations (cumulative)', () => {
  let adminDataSource: DataSource;
  let scratchDataSource: DataSource;

  beforeAll(async () => {
    adminDataSource = new DataSource({ type: 'postgres', url: DATABASE_URL });
    await adminDataSource.initialize();
    // Defensive: clean up a leftover database from a prior interrupted run
    // before (re)creating it.
    await adminDataSource.query(`DROP DATABASE IF EXISTS "${SCRATCH_DB_NAME}"`);
    await adminDataSource.query(`CREATE DATABASE "${SCRATCH_DB_NAME}"`);

    scratchDataSource = new DataSource({
      type: 'postgres',
      url: withDatabase(DATABASE_URL as string, SCRATCH_DB_NAME),
      // Entities must be declared (matching src/database/data-source.ts),
      // not just migrations: TypeORM's Postgres driver only auto-creates
      // the uuid-ossp extension (needed by @PrimaryGeneratedColumn('uuid')'s
      // uuid_generate_v4() default) when it discovers a uuid column via
      // entity metadata at connect time — a migrations-only DataSource
      // never triggers that and the migration fails with
      // "function uuid_generate_v4() does not exist".
      entities: [join(__dirname, '..', 'entities', '*.entity.{ts,js}')],
      // Leading-digit filter matches TypeORM's `<timestamp>-Name.ts` naming
      // convention and excludes *.spec.ts files in this same directory —
      // see the matching comment in src/database/data-source.ts.
      migrations: [join(__dirname, '[0-9]*.{ts,js}')],
      migrationsTableName: 'typeorm_migrations',
    });
    await scratchDataSource.initialize();
  }, 30_000);

  afterAll(async () => {
    if (scratchDataSource?.isInitialized) {
      await scratchDataSource.destroy();
    }
    if (adminDataSource?.isInitialized) {
      await adminDataSource.query(
        `DROP DATABASE IF EXISTS "${SCRATCH_DB_NAME}"`,
      );
      await adminDataSource.destroy();
    }
  }, 30_000);

  async function tableNames(): Promise<string[]> {
    const rows: Array<{ table_name: string }> = await scratchDataSource.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name != 'typeorm_migrations'
       ORDER BY table_name`,
    );
    return rows.map((r) => r.table_name);
  }

  it('applies every migration and produces the expected tables', async () => {
    await scratchDataSource.runMigrations();

    expect(await tableNames()).toEqual([
      'agent_runs',
      'api_clients',
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'consent_records',
      'data_disposition_tasks',
      'evaluation_input_manifests',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_transition_approvals',
      'policy_versions',
      'provider_authorization_grants',
      'provider_operation_intents',
      'tenants',
      'tool_attempts',
      'webhook_deliveries',
      'webhook_endpoints',
    ]);

    const caseColumns: Array<{
      column_name: string;
      data_type: string;
      is_nullable: 'YES' | 'NO';
    }> = await scratchDataSource.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'loan_cases'`,
    );
    const byName = Object.fromEntries(
      caseColumns.map((c) => [c.column_name, c]),
    );

    expect(byName.tenantId).toMatchObject({
      data_type: 'uuid',
      is_nullable: 'NO',
    });
    expect(byName.idempotencyKey).toMatchObject({
      data_type: 'character varying',
      is_nullable: 'NO',
    });
    expect(byName.status).toMatchObject({
      data_type: 'USER-DEFINED',
      is_nullable: 'NO',
    });
    expect(byName.version).toMatchObject({
      data_type: 'integer',
      is_nullable: 'NO',
    });

    const foreignKeys: Array<{ constraint_name: string }> =
      await scratchDataSource.query(
        `SELECT constraint_name FROM information_schema.table_constraints
       WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY'`,
      );
    // loan_cases -> tenants, loan_conditions -> loan_cases,
    // evidence_facts -> loan_cases, condition_transitions -> loan_conditions,
    // jurisdictions -> jurisdictions (self, parentCode), policy_sources ->
    // jurisdictions, policy_source_revisions -> policy_sources,
    // policy_versions -> policy_source_revisions, policy_applicability ->
    // policy_versions, loan_cases -> jurisdictions, case_policy_bindings ->
    // case_policy_snapshots, policy_change_impact_assessments ->
    // policy_versions, communication_messages -> communication_templates,
    // communication_approvals -> communication_messages, tool_attempts ->
    // agent_runs, webhook_deliveries -> webhook_endpoints,
    // webhook_deliveries -> outbox_events
    expect(foreignKeys).toHaveLength(17);

    // SeedIncomeDiscrepancyPolicy's data, not schema: the charter's own
    // Section 10.7 example rule, reproducible and revertible the same way
    // every other migration is (see that migration's own class comment).
    const seededVersions: Array<{ ruleId: string; releaseStatus: string }> =
      await scratchDataSource.query(
        `SELECT "ruleId", "releaseStatus" FROM policy_versions WHERE "ruleId" = 'synthetic-income-discrepancy-review'`,
      );
    expect(seededVersions).toEqual([
      {
        ruleId: 'synthetic-income-discrepancy-review',
        releaseStatus: 'RELEASED',
      },
    ]);

    // The single row PolicyEvaluationService's fast path always reads.
    const generationRows: Array<{ id: number; generation: number }> =
      await scratchDataSource.query(
        `SELECT id, generation FROM policy_catalog_generation`,
      );
    expect(generationRows).toEqual([{ id: 1, generation: 0 }]);
  });

  it('reverts the api client role migration without touching other tables', async () => {
    // No new table — only a column (and its enum type) on api_clients.
    const beforeColumns: Array<{ column_name: string }> =
      await scratchDataSource.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'api_clients' AND column_name = 'role'`,
      );
    expect(beforeColumns).toHaveLength(1);

    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'agent_runs',
      'api_clients',
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'consent_records',
      'data_disposition_tasks',
      'evaluation_input_manifests',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_transition_approvals',
      'policy_versions',
      'provider_authorization_grants',
      'provider_operation_intents',
      'tenants',
      'tool_attempts',
      'webhook_deliveries',
      'webhook_endpoints',
    ]);

    const afterColumns: Array<{ column_name: string }> =
      await scratchDataSource.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'api_clients' AND column_name = 'role'`,
      );
    expect(afterColumns).toHaveLength(0);
  });

  it('reverts the data disposition tasks migration without touching other tables', async () => {
    // Adds a real table (like "reverts the consent records migration"
    // below) — DROP TABLE trivially takes its policy/RLS state with it,
    // so no separate pg_policies/pg_class check is needed here.
    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'agent_runs',
      'api_clients',
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'consent_records',
      'evaluation_input_manifests',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_transition_approvals',
      'policy_versions',
      'provider_authorization_grants',
      'provider_operation_intents',
      'tenants',
      'tool_attempts',
      'webhook_deliveries',
      'webhook_endpoints',
    ]);
  });

  it('reverts the provider platform tenant isolation migration without touching other tables', async () => {
    // No new table — only RLS state and a policy on
    // provider_authorization_grants and provider_operation_intents.
    const beforeRls: Array<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }> = await scratchDataSource.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname IN ('provider_authorization_grants', 'provider_operation_intents')
         AND relkind = 'r'
       ORDER BY relname`,
    );
    expect(beforeRls).toEqual([
      {
        relname: 'provider_authorization_grants',
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
      {
        relname: 'provider_operation_intents',
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
    ]);
    const beforePolicies: Array<{ tablename: string; policyname: string }> =
      await scratchDataSource.query(
        `SELECT tablename, policyname FROM pg_policies
         WHERE tablename IN ('provider_authorization_grants', 'provider_operation_intents')
         ORDER BY tablename`,
      );
    expect(beforePolicies).toEqual([
      {
        tablename: 'provider_authorization_grants',
        policyname: 'tenant_isolation',
      },
      {
        tablename: 'provider_operation_intents',
        policyname: 'tenant_isolation',
      },
    ]);

    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'agent_runs',
      'api_clients',
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'consent_records',
      'evaluation_input_manifests',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_transition_approvals',
      'policy_versions',
      'provider_authorization_grants',
      'provider_operation_intents',
      'tenants',
      'tool_attempts',
      'webhook_deliveries',
      'webhook_endpoints',
    ]);

    const afterRls: Array<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }> = await scratchDataSource.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname IN ('provider_authorization_grants', 'provider_operation_intents')
         AND relkind = 'r'
       ORDER BY relname`,
    );
    expect(afterRls).toEqual([
      {
        relname: 'provider_authorization_grants',
        relrowsecurity: false,
        relforcerowsecurity: false,
      },
      {
        relname: 'provider_operation_intents',
        relrowsecurity: false,
        relforcerowsecurity: false,
      },
    ]);
    const afterPolicies: Array<{ tablename: string; policyname: string }> =
      await scratchDataSource.query(
        `SELECT tablename, policyname FROM pg_policies
         WHERE tablename IN ('provider_authorization_grants', 'provider_operation_intents')`,
      );
    expect(afterPolicies).toEqual([]);
  });

  it('reverts the case policy tenant isolation migration without touching other tables', async () => {
    // No new table — only RLS state and a policy on case_policy_snapshots
    // and case_policy_bindings.
    const beforeRls: Array<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }> = await scratchDataSource.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname IN ('case_policy_snapshots', 'case_policy_bindings')
         AND relkind = 'r'
       ORDER BY relname`,
    );
    expect(beforeRls).toEqual([
      {
        relname: 'case_policy_bindings',
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
      {
        relname: 'case_policy_snapshots',
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
    ]);
    const beforePolicies: Array<{ tablename: string; policyname: string }> =
      await scratchDataSource.query(
        `SELECT tablename, policyname FROM pg_policies
         WHERE tablename IN ('case_policy_snapshots', 'case_policy_bindings')
         ORDER BY tablename`,
      );
    expect(beforePolicies).toEqual([
      { tablename: 'case_policy_bindings', policyname: 'tenant_isolation' },
      { tablename: 'case_policy_snapshots', policyname: 'tenant_isolation' },
    ]);

    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'agent_runs',
      'api_clients',
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'consent_records',
      'evaluation_input_manifests',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_transition_approvals',
      'policy_versions',
      'provider_authorization_grants',
      'provider_operation_intents',
      'tenants',
      'tool_attempts',
      'webhook_deliveries',
      'webhook_endpoints',
    ]);

    const afterRls: Array<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }> = await scratchDataSource.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname IN ('case_policy_snapshots', 'case_policy_bindings')
         AND relkind = 'r'
       ORDER BY relname`,
    );
    expect(afterRls).toEqual([
      {
        relname: 'case_policy_bindings',
        relrowsecurity: false,
        relforcerowsecurity: false,
      },
      {
        relname: 'case_policy_snapshots',
        relrowsecurity: false,
        relforcerowsecurity: false,
      },
    ]);
    const afterPolicies: Array<{ tablename: string; policyname: string }> =
      await scratchDataSource.query(
        `SELECT tablename, policyname FROM pg_policies
         WHERE tablename IN ('case_policy_snapshots', 'case_policy_bindings')`,
      );
    expect(afterPolicies).toEqual([]);
  });

  it('reverts the communication tenant isolation migration without touching other tables', async () => {
    // No new table — only RLS state and a policy on communication_messages
    // and communication_templates.
    const beforeRls: Array<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }> = await scratchDataSource.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname IN ('communication_messages', 'communication_templates')
         AND relkind = 'r'
       ORDER BY relname`,
    );
    expect(beforeRls).toEqual([
      {
        relname: 'communication_messages',
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
      {
        relname: 'communication_templates',
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
    ]);
    const beforePolicies: Array<{ tablename: string; policyname: string }> =
      await scratchDataSource.query(
        `SELECT tablename, policyname FROM pg_policies
         WHERE tablename IN ('communication_messages', 'communication_templates')
         ORDER BY tablename`,
      );
    expect(beforePolicies).toEqual([
      { tablename: 'communication_messages', policyname: 'tenant_isolation' },
      { tablename: 'communication_templates', policyname: 'tenant_isolation' },
    ]);

    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'agent_runs',
      'api_clients',
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'consent_records',
      'evaluation_input_manifests',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_transition_approvals',
      'policy_versions',
      'provider_authorization_grants',
      'provider_operation_intents',
      'tenants',
      'tool_attempts',
      'webhook_deliveries',
      'webhook_endpoints',
    ]);

    const afterRls: Array<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }> = await scratchDataSource.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname IN ('communication_messages', 'communication_templates')
         AND relkind = 'r'
       ORDER BY relname`,
    );
    expect(afterRls).toEqual([
      {
        relname: 'communication_messages',
        relrowsecurity: false,
        relforcerowsecurity: false,
      },
      {
        relname: 'communication_templates',
        relrowsecurity: false,
        relforcerowsecurity: false,
      },
    ]);
    const afterPolicies: Array<{ tablename: string; policyname: string }> =
      await scratchDataSource.query(
        `SELECT tablename, policyname FROM pg_policies
         WHERE tablename IN ('communication_messages', 'communication_templates')`,
      );
    expect(afterPolicies).toEqual([]);
  });

  it('reverts the policy change impact assessment tenant isolation migration without touching other tables', async () => {
    // No new table — only RLS state and a policy on
    // policy_change_impact_assessments.
    const beforeRls: Array<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }> = await scratchDataSource.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname = 'policy_change_impact_assessments' AND relkind = 'r'`,
    );
    expect(beforeRls).toEqual([
      {
        relname: 'policy_change_impact_assessments',
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
    ]);
    const beforePolicies: Array<{ tablename: string; policyname: string }> =
      await scratchDataSource.query(
        `SELECT tablename, policyname FROM pg_policies
         WHERE tablename = 'policy_change_impact_assessments'`,
      );
    expect(beforePolicies).toEqual([
      {
        tablename: 'policy_change_impact_assessments',
        policyname: 'tenant_isolation',
      },
    ]);

    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'agent_runs',
      'api_clients',
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'consent_records',
      'evaluation_input_manifests',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_transition_approvals',
      'policy_versions',
      'provider_authorization_grants',
      'provider_operation_intents',
      'tenants',
      'tool_attempts',
      'webhook_deliveries',
      'webhook_endpoints',
    ]);

    const afterRls: Array<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }> = await scratchDataSource.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname = 'policy_change_impact_assessments' AND relkind = 'r'`,
    );
    expect(afterRls).toEqual([
      {
        relname: 'policy_change_impact_assessments',
        relrowsecurity: false,
        relforcerowsecurity: false,
      },
    ]);
    const afterPolicies: Array<{ tablename: string; policyname: string }> =
      await scratchDataSource.query(
        `SELECT tablename, policyname FROM pg_policies
         WHERE tablename = 'policy_change_impact_assessments'`,
      );
    expect(afterPolicies).toEqual([]);
  });

  it('reverts the evaluation manifest tenant isolation migration without touching other tables', async () => {
    // No new table — only RLS state and a policy on evaluation_input_manifests.
    const beforeRls: Array<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }> = await scratchDataSource.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname = 'evaluation_input_manifests' AND relkind = 'r'`,
    );
    expect(beforeRls).toEqual([
      {
        relname: 'evaluation_input_manifests',
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
    ]);
    const beforePolicies: Array<{ tablename: string; policyname: string }> =
      await scratchDataSource.query(
        `SELECT tablename, policyname FROM pg_policies
         WHERE tablename = 'evaluation_input_manifests'`,
      );
    expect(beforePolicies).toEqual([
      {
        tablename: 'evaluation_input_manifests',
        policyname: 'tenant_isolation',
      },
    ]);

    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'agent_runs',
      'api_clients',
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'consent_records',
      'evaluation_input_manifests',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_transition_approvals',
      'policy_versions',
      'provider_authorization_grants',
      'provider_operation_intents',
      'tenants',
      'tool_attempts',
      'webhook_deliveries',
      'webhook_endpoints',
    ]);

    const afterRls: Array<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }> = await scratchDataSource.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname = 'evaluation_input_manifests' AND relkind = 'r'`,
    );
    expect(afterRls).toEqual([
      {
        relname: 'evaluation_input_manifests',
        relrowsecurity: false,
        relforcerowsecurity: false,
      },
    ]);
    const afterPolicies: Array<{ tablename: string; policyname: string }> =
      await scratchDataSource.query(
        `SELECT tablename, policyname FROM pg_policies
         WHERE tablename = 'evaluation_input_manifests'`,
      );
    expect(afterPolicies).toEqual([]);
  });

  it('reverts the case conditions agent tenant isolation migration without touching other tables', async () => {
    // No new table — only RLS state and a policy on three existing
    // tables (two plain, plus tool_attempts' join-based policy) — same
    // pattern as the webhook/case-core tenant isolation revert tests
    // below.
    const beforeRls: Array<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }> = await scratchDataSource.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname IN ('loan_conditions', 'agent_runs', 'tool_attempts')
         AND relkind = 'r'
       ORDER BY relname`,
    );
    expect(beforeRls).toEqual([
      {
        relname: 'agent_runs',
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
      {
        relname: 'loan_conditions',
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
      {
        relname: 'tool_attempts',
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
    ]);
    const beforePolicies: Array<{ tablename: string; policyname: string }> =
      await scratchDataSource.query(
        `SELECT tablename, policyname FROM pg_policies
         WHERE tablename IN ('loan_conditions', 'agent_runs', 'tool_attempts')
         ORDER BY tablename`,
      );
    expect(beforePolicies).toEqual([
      { tablename: 'agent_runs', policyname: 'tenant_isolation' },
      { tablename: 'loan_conditions', policyname: 'tenant_isolation' },
      { tablename: 'tool_attempts', policyname: 'tenant_isolation' },
    ]);

    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'agent_runs',
      'api_clients',
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'consent_records',
      'evaluation_input_manifests',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_transition_approvals',
      'policy_versions',
      'provider_authorization_grants',
      'provider_operation_intents',
      'tenants',
      'tool_attempts',
      'webhook_deliveries',
      'webhook_endpoints',
    ]);

    const afterRls: Array<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }> = await scratchDataSource.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname IN ('loan_conditions', 'agent_runs', 'tool_attempts')
         AND relkind = 'r'
       ORDER BY relname`,
    );
    expect(afterRls).toEqual([
      {
        relname: 'agent_runs',
        relrowsecurity: false,
        relforcerowsecurity: false,
      },
      {
        relname: 'loan_conditions',
        relrowsecurity: false,
        relforcerowsecurity: false,
      },
      {
        relname: 'tool_attempts',
        relrowsecurity: false,
        relforcerowsecurity: false,
      },
    ]);
    const afterPolicies = await scratchDataSource.query(
      `SELECT tablename, policyname FROM pg_policies
       WHERE tablename IN ('loan_conditions', 'agent_runs', 'tool_attempts')`,
    );
    expect(afterPolicies).toEqual([]);
  });

  it('reverts the consent records migration without touching other tables', async () => {
    // Unlike the RLS-only migrations below, this one adds a real table —
    // same pattern as "reverts the api clients migration" above it in
    // migration order. DROP TABLE trivially takes its policy/RLS state
    // with it, so no separate pg_policies/pg_class check is needed here.
    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'agent_runs',
      'api_clients',
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'evaluation_input_manifests',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_transition_approvals',
      'policy_versions',
      'provider_authorization_grants',
      'provider_operation_intents',
      'tenants',
      'tool_attempts',
      'webhook_deliveries',
      'webhook_endpoints',
    ]);
  });

  it('reverts the case core tenant isolation migration without touching other tables', async () => {
    // No new table — only RLS state and a policy on four existing tables
    // (three plain, plus condition_transitions' join-based policy) — same
    // pattern as the webhook tenant isolation revert test below.
    const beforeRls: Array<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }> = await scratchDataSource.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname IN ('loan_cases', 'evidence_facts', 'outbox_events', 'condition_transitions')
         AND relkind = 'r'
       ORDER BY relname`,
    );
    expect(beforeRls).toEqual([
      {
        relname: 'condition_transitions',
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
      {
        relname: 'evidence_facts',
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
      {
        relname: 'loan_cases',
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
      {
        relname: 'outbox_events',
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
    ]);
    const beforePolicies: Array<{ tablename: string; policyname: string }> =
      await scratchDataSource.query(
        `SELECT tablename, policyname FROM pg_policies
         WHERE tablename IN ('loan_cases', 'evidence_facts', 'outbox_events', 'condition_transitions')
         ORDER BY tablename`,
      );
    expect(beforePolicies).toEqual([
      { tablename: 'condition_transitions', policyname: 'tenant_isolation' },
      { tablename: 'evidence_facts', policyname: 'tenant_isolation' },
      { tablename: 'loan_cases', policyname: 'tenant_isolation' },
      { tablename: 'outbox_events', policyname: 'tenant_isolation' },
    ]);

    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'agent_runs',
      'api_clients',
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'evaluation_input_manifests',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_transition_approvals',
      'policy_versions',
      'provider_authorization_grants',
      'provider_operation_intents',
      'tenants',
      'tool_attempts',
      'webhook_deliveries',
      'webhook_endpoints',
    ]);

    const afterRls: Array<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }> = await scratchDataSource.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname IN ('loan_cases', 'evidence_facts', 'outbox_events', 'condition_transitions')
         AND relkind = 'r'
       ORDER BY relname`,
    );
    expect(afterRls).toEqual([
      {
        relname: 'condition_transitions',
        relrowsecurity: false,
        relforcerowsecurity: false,
      },
      {
        relname: 'evidence_facts',
        relrowsecurity: false,
        relforcerowsecurity: false,
      },
      {
        relname: 'loan_cases',
        relrowsecurity: false,
        relforcerowsecurity: false,
      },
      {
        relname: 'outbox_events',
        relrowsecurity: false,
        relforcerowsecurity: false,
      },
    ]);
    const afterPolicies = await scratchDataSource.query(
      `SELECT tablename, policyname FROM pg_policies
       WHERE tablename IN ('loan_cases', 'evidence_facts', 'outbox_events', 'condition_transitions')`,
    );
    expect(afterPolicies).toEqual([]);
  });

  it('reverts the app runtime role migration without touching other tables', async () => {
    // This migration adds no table — only a role and its grants — so the
    // assertions here check pg_roles/information_schema.role_table_grants
    // directly, same pattern as the webhook tenant isolation revert test
    // below.
    const beforeRole = await scratchDataSource.query(
      `SELECT rolname FROM pg_roles WHERE rolname = 'mortgage_app'`,
    );
    expect(beforeRole).toEqual([{ rolname: 'mortgage_app' }]);
    const beforeGrants: Array<{ table_name: string }> =
      await scratchDataSource.query(
        `SELECT table_name FROM information_schema.role_table_grants
         WHERE grantee = 'mortgage_app' AND table_schema = 'public'
           AND table_name != 'typeorm_migrations'
         ORDER BY table_name`,
      );
    // 28 tables x 4 privileges (SELECT/INSERT/UPDATE/DELETE) each — the
    // migration's `GRANT ... ON ALL TABLES IN SCHEMA public` also covers
    // typeorm_migrations itself (harmlessly), excluded here the same way
    // tableNames() below excludes it.
    expect(beforeGrants.length).toBe(28 * 4);

    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'agent_runs',
      'api_clients',
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'evaluation_input_manifests',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_transition_approvals',
      'policy_versions',
      'provider_authorization_grants',
      'provider_operation_intents',
      'tenants',
      'tool_attempts',
      'webhook_deliveries',
      'webhook_endpoints',
    ]);

    // Not "the role no longer exists in pg_roles": DROP ROLE is
    // best-effort (see the migration's own down() comment) because roles
    // are cluster-global — if some other database in this same cluster
    // has also run this migration and still holds grants to the role,
    // dropping it here would break that sibling database, so the
    // migration tolerates that specific failure and leaves the role
    // behind rather than destroying shared state out from under it. What
    // down() unconditionally guarantees, and what's actually meaningful
    // to assert here, is that *this* database's own grants are gone.
    const afterGrants = await scratchDataSource.query(
      `SELECT 1 FROM information_schema.role_table_grants
       WHERE grantee = 'mortgage_app' AND table_schema = 'public'`,
    );
    expect(afterGrants).toEqual([]);
  });

  it('reverts the webhook tenant isolation migration without touching other tables', async () => {
    // This migration adds/removes no table — only RLS state and a policy
    // on two existing tables — so the assertions here check pg_class/
    // pg_policies directly rather than the tableNames() list.
    const beforeRls: Array<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }> = await scratchDataSource.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname IN ('webhook_endpoints', 'webhook_deliveries') AND relkind = 'r'
       ORDER BY relname`,
    );
    expect(beforeRls).toEqual([
      {
        relname: 'webhook_deliveries',
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
      {
        relname: 'webhook_endpoints',
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
    ]);
    const beforePolicies: Array<{ tablename: string; policyname: string }> =
      await scratchDataSource.query(
        `SELECT tablename, policyname FROM pg_policies
         WHERE tablename IN ('webhook_endpoints', 'webhook_deliveries')
         ORDER BY tablename`,
      );
    expect(beforePolicies).toEqual([
      { tablename: 'webhook_deliveries', policyname: 'tenant_isolation' },
      { tablename: 'webhook_endpoints', policyname: 'tenant_isolation' },
    ]);

    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'agent_runs',
      'api_clients',
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'evaluation_input_manifests',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_transition_approvals',
      'policy_versions',
      'provider_authorization_grants',
      'provider_operation_intents',
      'tenants',
      'tool_attempts',
      'webhook_deliveries',
      'webhook_endpoints',
    ]);

    const afterRls: Array<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }> = await scratchDataSource.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname IN ('webhook_endpoints', 'webhook_deliveries') AND relkind = 'r'
       ORDER BY relname`,
    );
    expect(afterRls).toEqual([
      {
        relname: 'webhook_deliveries',
        relrowsecurity: false,
        relforcerowsecurity: false,
      },
      {
        relname: 'webhook_endpoints',
        relrowsecurity: false,
        relforcerowsecurity: false,
      },
    ]);
    const afterPolicies = await scratchDataSource.query(
      `SELECT tablename, policyname FROM pg_policies
       WHERE tablename IN ('webhook_endpoints', 'webhook_deliveries')`,
    );
    expect(afterPolicies).toEqual([]);
  });

  it('reverts the api clients migration without touching other tables', async () => {
    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'agent_runs',
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'evaluation_input_manifests',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_transition_approvals',
      'policy_versions',
      'provider_authorization_grants',
      'provider_operation_intents',
      'tenants',
      'tool_attempts',
      'webhook_deliveries',
      'webhook_endpoints',
    ]);
  });

  it('reverts the webhook platform migration without touching other tables', async () => {
    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'agent_runs',
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'evaluation_input_manifests',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_transition_approvals',
      'policy_versions',
      'provider_authorization_grants',
      'provider_operation_intents',
      'tenants',
      'tool_attempts',
    ]);
  });

  it('reverts the provider platform migration without touching other tables', async () => {
    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'agent_runs',
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'evaluation_input_manifests',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_transition_approvals',
      'policy_versions',
      'tenants',
      'tool_attempts',
    ]);
  });

  it('reverts the agent run review category migration without touching other tables', async () => {
    await scratchDataSource.undoLastMigration();

    // No new table — this migration only adds a column and enum type to
    // the existing agent_runs table.
    expect(await tableNames()).toEqual([
      'agent_runs',
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'evaluation_input_manifests',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_transition_approvals',
      'policy_versions',
      'tenants',
      'tool_attempts',
    ]);

    const reviewCategoryColumns: Array<{ column_name: string }> =
      await scratchDataSource.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'agent_runs'
           AND column_name = 'reviewCategory'`,
      );
    expect(reviewCategoryColumns).toEqual([]);
  });

  it('reverts the case policy binding one-active-per-case index migration without touching other tables', async () => {
    await scratchDataSource.undoLastMigration();

    // No new table — this migration only adds a partial unique index to
    // the existing case_policy_bindings table.
    expect(await tableNames()).toEqual([
      'agent_runs',
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'evaluation_input_manifests',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_transition_approvals',
      'policy_versions',
      'tenants',
      'tool_attempts',
    ]);

    const indexRows: Array<{ indexname: string }> =
      await scratchDataSource.query(
        `SELECT indexname FROM pg_indexes
       WHERE tablename = 'case_policy_bindings' AND indexname = 'IDX_case_policy_bindings_one_active'`,
      );
    expect(indexRows).toEqual([]);
  });

  it('reverts the communication delivery migration without touching other tables', async () => {
    await scratchDataSource.undoLastMigration();

    // No new table — this migration only adds columns and an enum value
    // to the existing communication_messages table, so the table list
    // itself is unchanged before and after.
    expect(await tableNames()).toEqual([
      'agent_runs',
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'evaluation_input_manifests',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_transition_approvals',
      'policy_versions',
      'tenants',
      'tool_attempts',
    ]);

    const messageColumns: Array<{ column_name: string }> =
      await scratchDataSource.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'communication_messages'
           AND column_name IN ('deliveryReference', 'sentAt')`,
      );
    expect(messageColumns).toEqual([]);
  });

  it('reverts the policy transition approval migration without touching other tables', async () => {
    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'agent_runs',
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'evaluation_input_manifests',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_versions',
      'tenants',
      'tool_attempts',
    ]);
  });

  it('reverts the evaluation input manifest migration without touching other tables', async () => {
    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'agent_runs',
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_versions',
      'tenants',
      'tool_attempts',
    ]);

    const conditionColumns: Array<{ column_name: string }> =
      await scratchDataSource.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'loan_conditions'
           AND column_name = 'evaluationManifestId'`,
      );
    expect(conditionColumns).toEqual([]);
  });

  it('reverts the agent run timeline migration without touching other tables', async () => {
    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'case_policy_bindings',
      'case_policy_snapshots',
      'communication_approvals',
      'communication_messages',
      'communication_templates',
      'condition_transitions',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_versions',
      'tenants',
    ]);
  });

  it('reverts the communication classification migration without touching other tables', async () => {
    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'case_policy_bindings',
      'case_policy_snapshots',
      'condition_transitions',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_catalog_generation',
      'policy_change_impact_assessments',
      'policy_source_revisions',
      'policy_sources',
      'policy_versions',
      'tenants',
    ]);
  });

  it('reverts the policy catalog generation/change-impact migration without touching other tables', async () => {
    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'case_policy_bindings',
      'case_policy_snapshots',
      'condition_transitions',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_source_revisions',
      'policy_sources',
      'policy_versions',
      'tenants',
    ]);
  });

  it('reverts the case policy snapshot/binding migration without touching other tables', async () => {
    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'condition_transitions',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_source_revisions',
      'policy_sources',
      'policy_versions',
      'tenants',
    ]);
  });

  it('reverts the seed-data migration without touching schema', async () => {
    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'condition_transitions',
      'evidence_facts',
      'jurisdictions',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'policy_applicability',
      'policy_source_revisions',
      'policy_sources',
      'policy_versions',
      'tenants',
    ]);
    const remainingVersions = await scratchDataSource.query(
      `SELECT * FROM policy_versions WHERE "ruleId" = 'synthetic-income-discrepancy-review'`,
    );
    expect(remainingVersions).toEqual([]);
  });

  it('reverts the loan_cases income/jurisdiction migration without touching other tables', async () => {
    await scratchDataSource.undoLastMigration();

    const caseColumns: Array<{ column_name: string }> =
      await scratchDataSource.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'loan_cases'
           AND column_name IN ('statedMonthlyIncome', 'jurisdictionCode')`,
      );
    expect(caseColumns).toEqual([]);
  });

  it('reverts the policy schema migration without touching case/evidence/condition/outbox tables', async () => {
    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'condition_transitions',
      'evidence_facts',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'outbox_events',
      'tenants',
    ]);
  });

  it('reverts the outbox events migration without touching case/evidence/condition tables', async () => {
    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([
      'condition_transitions',
      'evidence_facts',
      'loan_applications',
      'loan_cases',
      'loan_conditions',
      'tenants',
    ]);
  });

  it('reverts the case/evidence/condition migration without touching loan_applications', async () => {
    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual(['loan_applications']);
  });

  it('reverts the initial migration, leaving the database empty', async () => {
    await scratchDataSource.undoLastMigration();

    expect(await tableNames()).toEqual([]);

    const enumTypes: Array<{ typname: string }> = await scratchDataSource.query(
      `SELECT t.typname FROM pg_type t
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public'
         AND (t.typname LIKE 'loan_applications_%' OR t.typname LIKE 'loan_cases_%'
              OR t.typname LIKE 'loan_conditions_%' OR t.typname LIKE 'evidence_facts_%'
              OR t.typname LIKE 'condition_transitions_%' OR t.typname LIKE 'jurisdictions_%'
              OR t.typname LIKE 'policy_sources_%' OR t.typname LIKE 'policy_versions_%'
              OR t.typname LIKE 'case_policy_snapshots_%')`,
    );
    expect(enumTypes).toEqual([]);
  });
});
