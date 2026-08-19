import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Tenant } from '../database/entities/tenant.entity';
import { LoanCase } from '../database/entities/loan-case.entity';
import { EvidenceFact } from '../database/entities/evidence-fact.entity';
import { LoanCondition } from '../database/entities/loan-condition.entity';
import { ConditionTransition } from '../database/entities/condition-transition.entity';
import { LoanApplication } from '../database/entities/loan-application.entity';
import { OutboxEvent } from '../database/entities/outbox-event.entity';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import { PolicySource } from '../database/entities/policy-source.entity';
import { PolicySourceRevision } from '../database/entities/policy-source-revision.entity';
import { PolicyVersion } from '../database/entities/policy-version.entity';
import { PolicyApplicability } from '../database/entities/policy-applicability.entity';
import { CasePolicySnapshot } from '../database/entities/case-policy-snapshot.entity';
import { CasePolicyBinding } from '../database/entities/case-policy-binding.entity';
import { PolicyCatalogGeneration } from '../database/entities/policy-catalog-generation.entity';
import { EvaluationInputManifest } from '../database/entities/evaluation-input-manifest.entity';
import { AgentRun } from '../database/entities/agent-run.entity';
import { ToolAttempt } from '../database/entities/tool-attempt.entity';
import { ProviderAuthorizationGrant } from '../database/entities/provider-authorization-grant.entity';
import { ProviderOperationIntent } from '../database/entities/provider-operation-intent.entity';
import { ConsentRecord } from '../database/entities/consent-record.entity';
import { CommunicationMessage } from '../database/entities/communication-message.entity';
import { CommunicationTemplate } from '../database/entities/communication-template.entity';
import { PolicyApplicabilityResolverService } from '../policy/policy-applicability-resolver.service';
import { PolicyEvaluationService } from '../policy/policy-evaluation.service';
import { EvaluationManifestService } from '../policy/evaluation-manifest.service';
import { ProviderRegistryService } from '../provider-platform/provider-registry.service';
import { ProviderAuthorizationService } from '../provider-platform/provider-authorization.service';
import { ProviderOperationIntentService } from '../provider-platform/provider-operation-intent.service';
import { ConsentService } from '../consent/consent.service';
import { CommunicationMessageService } from '../communications/communication-message.service';
import { PlaidService } from '../integrations/plaid/plaid.service';
import { PlaidIncomeAdapter } from '../integrations/plaid/plaid-income.adapter';
import { CreditService } from '../integrations/credit/credit.service';
import { CreditReportAdapter } from '../integrations/credit/credit-report.adapter';
import { DocumentService } from '../integrations/document/document.service';
import { DocumentVerificationAdapter } from '../integrations/document/document-verification.adapter';
import { EvaluationCaseFixture } from './types';
import { LoanType } from '../database/enums/loan-type.enum';
import { runCorpus, cleanupEvaluationRun } from './runner';

const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

describeOrSkip('runCorpus', () => {
  let dataSource: DataSource;
  let tenantId: string;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
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
        ConsentRecord,
        CommunicationMessage,
        CommunicationTemplate,
      ],
    });
    await dataSource.initialize();

    const tenant = await dataSource
      .getRepository(Tenant)
      .save(
        dataSource
          .getRepository(Tenant)
          .create({ name: 'runCorpus spec tenant' }),
      );
    tenantId = tenant.id;
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await cleanupEvaluationRun(dataSource, tenantId);
      await dataSource.getRepository(Tenant).delete({ id: tenantId });
      await dataSource
        .getRepository(Jurisdiction)
        .delete({ code: 'US-EVAL-NC' });
      await dataSource.destroy();
    }
  }, 30_000);

  function deps() {
    const resolver = new PolicyApplicabilityResolverService(
      dataSource.getRepository(Jurisdiction),
      dataSource.getRepository(PolicyApplicability),
      dataSource.getRepository(PolicyVersion),
    );
    const policyEvaluationService = new PolicyEvaluationService(
      resolver,
      dataSource,
      dataSource.getRepository(PolicyCatalogGeneration),
    );
    const evaluationManifestService = new EvaluationManifestService(dataSource);
    const providerRegistry = new ProviderRegistryService();
    providerRegistry.register(new PlaidIncomeAdapter(new PlaidService()));
    providerRegistry.register(new CreditReportAdapter(new CreditService()));
    providerRegistry.register(
      new DocumentVerificationAdapter(new DocumentService()),
    );
    const consentService = new ConsentService(dataSource);
    const providerAuthorizationService = new ProviderAuthorizationService(
      dataSource,
      consentService,
    );
    const providerOperationIntentService = new ProviderOperationIntentService(
      dataSource,
    );
    const messageService = new CommunicationMessageService(dataSource);
    return {
      dataSource,
      policyEvaluationService,
      evaluationManifestService,
      providerRegistry,
      providerAuthorizationService,
      providerOperationIntentService,
      consentService,
      messageService,
      outboxSigningSecret: 'runner-spec-signing-secret-32-characters',
    };
  }

  it('passes a matched normal case, a discrepancy case, and a boundary case against the real seeded policy rule', async () => {
    const fixtures: EvaluationCaseFixture[] = [
      {
        id: 'SPEC-NORMAL-MATCH',
        description: 'income matches',
        category: 'normal',
        borrowerId: 'EVAL-CASE-001',
        jurisdictionCode: 'US-CA',
        loanType: LoanType.CONVENTIONAL,
        statedMonthlyIncome: 14000,
        requestedAmount: 300000,
        expected: { outcome: 'NO_CONDITION' },
      },
      {
        id: 'SPEC-NORMAL-DISCREPANCY',
        description: 'income diverges',
        category: 'normal',
        borrowerId: 'EVAL-CASE-002',
        jurisdictionCode: 'US-CA',
        loanType: LoanType.CONVENTIONAL,
        statedMonthlyIncome: 9000,
        requestedAmount: 300000,
        expected: {
          outcome: 'CONDITION_OPENED',
          conditionCode: 'VERIFY_INCOME_DISCREPANCY',
        },
      },
      {
        id: 'SPEC-BOUNDARY-UNDER',
        description: '9.9% difference, just under threshold',
        category: 'boundary',
        borrowerId: 'EVAL-CASE-003',
        jurisdictionCode: 'US-CA',
        loanType: LoanType.CONVENTIONAL,
        statedMonthlyIncome: 13404,
        requestedAmount: 300000,
        expected: { outcome: 'NO_CONDITION' },
      },
    ];

    const results = await runCorpus(deps(), tenantId, fixtures);

    expect(results.map((r) => ({ id: r.fixtureId, passed: r.passed }))).toEqual(
      [
        { id: 'SPEC-NORMAL-MATCH', passed: true },
        { id: 'SPEC-NORMAL-DISCREPANCY', passed: true },
        { id: 'SPEC-BOUNDARY-UNDER', passed: true },
      ],
    );
  });

  it("passes a missing-data case via the DSL evaluator's own missing-fact fail-safe", async () => {
    const fixtures: EvaluationCaseFixture[] = [
      {
        id: 'SPEC-MISSING-DATA',
        description: 'incomplete income evidence',
        category: 'missing-data',
        borrowerId: 'EVAL-CASE-MISSING-SPEC',
        jurisdictionCode: 'US-CA',
        loanType: LoanType.CONVENTIONAL,
        statedMonthlyIncome: 9000,
        requestedAmount: 300000,
        incomeEvidenceOverride: {},
        expected: { outcome: 'NO_CONDITION' },
      },
    ];

    const results = await runCorpus(deps(), tenantId, fixtures);

    // Note (also recorded in docs/DEVELOPMENT_LOG.md's M3-019 entry): the
    // DSL evaluator's own "cannot evaluate: missing..." reason is computed
    // internally but never surfaced through evaluateConditions's return
    // value when nothing matches — a below-threshold difference and
    // missing data both collapse to the same READY/NO_CONDITION outcome
    // at this level. This test verifies the fail-safe behavior (no crash,
    // no false-positive condition), not that the specific reason is
    // externally visible — it currently isn't.
    expect(results[0].passed).toBe(true);
    expect(results[0].actualOutcome).toBe('NO_CONDITION');
  });

  it('passes a policy-coverage case, seeding the not-covered jurisdiction on demand', async () => {
    const fixtures: EvaluationCaseFixture[] = [
      {
        id: 'SPEC-POLICY-COVERAGE',
        description: 'jurisdiction never reviewed for coverage',
        category: 'policy-coverage',
        borrowerId: 'EVAL-CASE-NC-SPEC',
        jurisdictionCode: 'US-EVAL-NC',
        loanType: LoanType.CONVENTIONAL,
        statedMonthlyIncome: 9000,
        requestedAmount: 300000,
        expected: { outcome: 'REVIEW_REQUIRED' },
      },
    ];

    const results = await runCorpus(deps(), tenantId, fixtures);

    expect(results[0].passed).toBe(true);
    const jurisdiction = await dataSource
      .getRepository(Jurisdiction)
      .findOneBy({ code: 'US-EVAL-NC' });
    expect(jurisdiction).not.toBeNull();
  });

  it('passes provider-failure cases, correctly classifying transient vs terminal', async () => {
    const fixtures: EvaluationCaseFixture[] = [
      {
        id: 'SPEC-PROVIDER-TRANSIENT',
        description: 'transient income failure',
        category: 'provider-failure',
        borrowerId: 'SYNTHETIC-TRANSIENT-FAILURE-spec1',
        jurisdictionCode: 'US-CA',
        loanType: LoanType.CONVENTIONAL,
        statedMonthlyIncome: 9000,
        requestedAmount: 300000,
        failingStep: 'income',
        expected: { outcome: 'PROVIDER_TRANSIENT_FAILURE' },
      },
      {
        id: 'SPEC-PROVIDER-TERMINAL',
        description: 'terminal credit failure',
        category: 'provider-failure',
        borrowerId: 'SYNTHETIC-TERMINAL-FAILURE-spec1',
        jurisdictionCode: 'US-CA',
        loanType: LoanType.CONVENTIONAL,
        statedMonthlyIncome: 9000,
        requestedAmount: 300000,
        failingStep: 'credit',
        expected: { outcome: 'PROVIDER_TERMINAL_FAILURE' },
      },
    ];

    const results = await runCorpus(deps(), tenantId, fixtures);

    expect(results.every((r) => r.passed)).toBe(true);
  });

  it('reports a failed case honestly when the actual outcome does not match what was expected', async () => {
    const fixtures: EvaluationCaseFixture[] = [
      {
        id: 'SPEC-DELIBERATE-MISMATCH',
        description: 'expects the wrong outcome on purpose',
        category: 'normal',
        borrowerId: 'EVAL-CASE-001',
        jurisdictionCode: 'US-CA',
        loanType: LoanType.CONVENTIONAL,
        statedMonthlyIncome: 14000,
        requestedAmount: 300000,
        // Actual behavior is NO_CONDITION (see the matched-normal-case
        // test above) — asserting CONDITION_OPENED here must fail, not
        // be silently coerced to pass.
        expected: { outcome: 'CONDITION_OPENED' },
      },
    ];

    const results = await runCorpus(deps(), tenantId, fixtures);

    expect(results[0].passed).toBe(false);
    expect(results[0].actualOutcome).toBe('NO_CONDITION');
  });

  it('cleanupEvaluationRun removes every row the run created', async () => {
    const fixtures: EvaluationCaseFixture[] = [
      {
        id: 'SPEC-CLEANUP',
        description: 'to be cleaned up',
        category: 'normal',
        borrowerId: 'EVAL-CASE-001',
        jurisdictionCode: 'US-CA',
        loanType: LoanType.CONVENTIONAL,
        statedMonthlyIncome: 9000,
        requestedAmount: 300000,
        expected: { outcome: 'CONDITION_OPENED' },
      },
    ];
    const cleanupTenant = await dataSource
      .getRepository(Tenant)
      .save(
        dataSource
          .getRepository(Tenant)
          .create({ name: 'runCorpus cleanup spec tenant' }),
      );

    await runCorpus(deps(), cleanupTenant.id, fixtures);
    const beforeCleanup = await dataSource
      .getRepository(LoanCase)
      .find({ where: { tenantId: cleanupTenant.id } });
    expect(beforeCleanup.length).toBeGreaterThan(0);

    await cleanupEvaluationRun(dataSource, cleanupTenant.id);

    const afterCases = await dataSource
      .getRepository(LoanCase)
      .find({ where: { tenantId: cleanupTenant.id } });
    const afterEvidence = await dataSource
      .getRepository(EvidenceFact)
      .find({ where: { tenantId: cleanupTenant.id } });
    const afterConditions = await dataSource
      .getRepository(LoanCondition)
      .find({ where: { tenantId: cleanupTenant.id } });
    expect(afterCases).toHaveLength(0);
    expect(afterEvidence).toHaveLength(0);
    expect(afterConditions).toHaveLength(0);

    await dataSource.getRepository(Tenant).delete({ id: cleanupTenant.id });
  });
});
