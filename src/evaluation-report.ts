import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
loadEnv();

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { Tenant } from './database/entities/tenant.entity';
import { LoanCase } from './database/entities/loan-case.entity';
import { EvidenceFact } from './database/entities/evidence-fact.entity';
import { LoanCondition } from './database/entities/loan-condition.entity';
import { ConditionTransition } from './database/entities/condition-transition.entity';
import { LoanApplication } from './database/entities/loan-application.entity';
import { OutboxEvent } from './database/entities/outbox-event.entity';
import { Jurisdiction } from './database/entities/jurisdiction.entity';
import { PolicySource } from './database/entities/policy-source.entity';
import { PolicySourceRevision } from './database/entities/policy-source-revision.entity';
import { PolicyVersion } from './database/entities/policy-version.entity';
import { PolicyApplicability } from './database/entities/policy-applicability.entity';
import { CasePolicySnapshot } from './database/entities/case-policy-snapshot.entity';
import { CasePolicyBinding } from './database/entities/case-policy-binding.entity';
import { PolicyCatalogGeneration } from './database/entities/policy-catalog-generation.entity';
import { EvaluationInputManifest } from './database/entities/evaluation-input-manifest.entity';
import { AgentRun } from './database/entities/agent-run.entity';
import { ToolAttempt } from './database/entities/tool-attempt.entity';
import { ProviderAuthorizationGrant } from './database/entities/provider-authorization-grant.entity';
import { ProviderOperationIntent } from './database/entities/provider-operation-intent.entity';
import { PolicyApplicabilityResolverService } from './policy/policy-applicability-resolver.service';
import { PolicyEvaluationService } from './policy/policy-evaluation.service';
import { EvaluationManifestService } from './policy/evaluation-manifest.service';
import { ProviderRegistryService } from './provider-platform/provider-registry.service';
import { ProviderAuthorizationService } from './provider-platform/provider-authorization.service';
import { ProviderOperationIntentService } from './provider-platform/provider-operation-intent.service';
import { PlaidService } from './integrations/plaid/plaid.service';
import { PlaidIncomeAdapter } from './integrations/plaid/plaid-income.adapter';
import { loadCorpus } from './evaluation/load-corpus';
import { runCorpus, cleanupEvaluationRun } from './evaluation/runner';
import { buildReport } from './evaluation/report';

const CASES_DIR = join(__dirname, '..', 'evaluation', 'cases');
const REPORTS_DIR = join(__dirname, '..', 'evaluation', 'reports');

/**
 * Section 20's M3 scope: "initial release evaluation corpus and report
 * command." Drives every `evaluation/cases/*.json` fixture through the
 * real `case-conditions.activities.ts` functions (the same code the M2
 * Temporal workflow calls) against a real database, then writes a
 * reproducible JSON report to `evaluation/reports/`. See
 * `docs/DEVELOPMENT_LOG.md`'s M3-019 entry for why this corpus is a
 * dozen precisely-designed real cases rather than Section 18.2's full
 * 150-case target — this codebase has exactly one seeded synthetic
 * policy rule to test against, so 150 distinct *meaningful* cases isn't
 * honestly reachable yet.
 */
async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required to run the evaluation corpus.');
    process.exit(1);
  }
  const outboxSigningSecret =
    process.env.OUTBOX_SIGNING_SECRET ?? 'dev-outbox-signing-secret-change-me';

  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [
      Tenant,
      LoanCase,
      EvidenceFact,
      LoanCondition,
      ConditionTransition,
      LoanApplication,
      OutboxEvent,
      Jurisdiction,
      PolicySource,
      PolicySourceRevision,
      PolicyVersion,
      PolicyApplicability,
      CasePolicySnapshot,
      CasePolicyBinding,
      PolicyCatalogGeneration,
      EvaluationInputManifest,
      AgentRun,
      ToolAttempt,
      ProviderAuthorizationGrant,
      ProviderOperationIntent,
    ],
  });
  await dataSource.initialize();

  const resolver = new PolicyApplicabilityResolverService(
    dataSource.getRepository(Jurisdiction),
    dataSource.getRepository(PolicyApplicability),
    dataSource.getRepository(PolicyVersion),
  );
  const policyEvaluationService = new PolicyEvaluationService(
    resolver,
    dataSource.getRepository(CasePolicySnapshot),
    dataSource.getRepository(CasePolicyBinding),
    dataSource.getRepository(PolicyCatalogGeneration),
  );
  const evaluationManifestService = new EvaluationManifestService(
    dataSource.getRepository(EvaluationInputManifest),
  );
  const providerRegistry = new ProviderRegistryService();
  providerRegistry.register(new PlaidIncomeAdapter(new PlaidService()));
  const providerAuthorizationService = new ProviderAuthorizationService(
    dataSource.getRepository(ProviderAuthorizationGrant),
  );
  const providerOperationIntentService = new ProviderOperationIntentService(
    dataSource.getRepository(ProviderOperationIntent),
  );

  const tenantRepo = dataSource.getRepository(Tenant);
  const tenant = await tenantRepo.save(
    tenantRepo.create({
      name: `Evaluation report ${new Date().toISOString()}`,
    }),
  );

  let exitCode = 0;
  try {
    const fixtures = loadCorpus(CASES_DIR);
    console.log(`Loaded ${fixtures.length} evaluation cases from ${CASES_DIR}`);

    const results = await runCorpus(
      {
        dataSource,
        policyEvaluationService,
        evaluationManifestService,
        providerRegistry,
        providerAuthorizationService,
        providerOperationIntentService,
        outboxSigningSecret,
      },
      tenant.id,
      fixtures,
    );

    const report = await buildReport(dataSource, CASES_DIR, results);

    mkdirSync(REPORTS_DIR, { recursive: true });
    const reportPath = join(
      REPORTS_DIR,
      `report-${report.generatedAt.replace(/[:.]/g, '-')}.json`,
    );
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('');
    for (const result of report.results) {
      const mark = result.passed ? 'PASS' : 'FAIL';
      console.log(
        `[${mark}] ${result.fixtureId} (${result.category}): ${result.detail}`,
      );
    }
    console.log('');
    console.log(
      `Total: ${report.summary.totalCases}  Passed: ${report.summary.passed}  Failed: ${report.summary.failed}`,
    );
    console.log(
      `Condition recall: ${report.summary.conditionRecall ?? 'n/a'}  Condition precision: ${report.summary.conditionPrecision ?? 'n/a'}`,
    );
    console.log(`Report written to ${reportPath}`);

    exitCode = report.summary.failed === 0 ? 0 : 1;
  } finally {
    await cleanupEvaluationRun(dataSource, tenant.id);
    await dataSource.getRepository(Tenant).delete({ id: tenant.id });
    await dataSource.destroy();
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error('Evaluation report failed:', error);
  process.exit(1);
});
