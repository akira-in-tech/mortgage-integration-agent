import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { createCaseConditionsActivities } from './case-conditions.activities';
import { PlaidService } from '../integrations/plaid/plaid.service';
import { CreditService } from '../integrations/credit/credit.service';
import { DocumentService } from '../integrations/document/document.service';
import { Tenant } from '../database/entities/tenant.entity';
import { LoanCase } from '../database/entities/loan-case.entity';
import {
  LoanCondition,
  ConditionStatus,
} from '../database/entities/loan-condition.entity';
import { ConditionTransition } from '../database/entities/condition-transition.entity';
import {
  EvidenceFact,
  EvidenceType,
  EvidenceSourceKind,
} from '../database/entities/evidence-fact.entity';
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
import { ProviderAdapterStatus } from '../database/entities/provider-adapter-status.entity';
import { ConsentRecord } from '../database/entities/consent-record.entity';
import { CommunicationMessage } from '../database/entities/communication-message.entity';
import { CommunicationTemplateStatus } from '../database/enums/communication.enum';
import {
  READY_FOR_UNDERWRITING_TEMPLATE_KEY,
  READY_FOR_UNDERWRITING_TEMPLATE_VERSION,
} from '../communications/well-known-templates';
import { CommunicationTemplate } from '../database/entities/communication-template.entity';
import { LoanType } from '../database/enums/loan-type.enum';
import { CaseStatus } from '../database/enums/case-status.enum';
import {
  JurisdictionLevel,
  JurisdictionCoverageStatus,
} from '../database/enums/jurisdiction.enum';
import { PlaidIncomeData } from '../integrations/plaid/plaid.types';
import { OutboxEventType } from '../database/outbox/outbox-event-types';
import { verifyOutboxSignature } from '../database/outbox/outbox-signer';
import { PolicyApplicabilityResolverService } from '../policy/policy-applicability-resolver.service';
import { PolicyEvaluationService } from '../policy/policy-evaluation.service';
import { EvaluationManifestService } from '../policy/evaluation-manifest.service';
import { ProviderRegistryService } from '../provider-platform/provider-registry.service';
import { ProviderAuthorizationService } from '../provider-platform/provider-authorization.service';
import { ProviderOperationIntentService } from '../provider-platform/provider-operation-intent.service';
import { ProviderKillSwitchService } from '../provider-platform/provider-kill-switch.service';
import { ProviderCapability } from '../provider-platform/types';
import { ConsentService } from '../consent/consent.service';
import { DataDispositionService } from '../data-disposition/data-disposition.service';
import { DataDispositionTask } from '../database/entities/data-disposition-task.entity';
import { CommunicationMessageService } from '../communications/communication-message.service';
import { CommunicationDeliveryService } from '../communications/communication-delivery.service';
import { CommunicationDeliverySimulator } from '../communications/communication-delivery-simulator';
import { ConfigService } from '@nestjs/config';
import { PlaidIncomeAdapter } from '../integrations/plaid/plaid-income.adapter';
import { CreditReportAdapter } from '../integrations/credit/credit-report.adapter';
import { DocumentVerificationAdapter } from '../integrations/document/document-verification.adapter';

// Requires a reachable Postgres (same convention as test/loan.e2e-spec.ts):
// skip instead of failing when no DATABASE_URL is configured. Writes
// synthetic rows directly to the configured database, same as the e2e
// suite, and cleans them up in afterAll.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

const OUTBOX_SIGNING_SECRET = 'activities-spec-signing-secret-32-chars';

// Matches the SeedIncomeDiscrepancyPolicy migration's seeded rule exactly
// (jurisdiction, product, lifecycle event) — this suite relies on that
// migration having run against DATABASE_URL, the same way it already
// relies on the schema migrations having run.
const SEEDED_JURISDICTION_CODE = 'US-CA';
const NOT_COVERED_JURISDICTION_CODE = 'US-ZZ-ACTSPEC';

const GOOD_INCOME: PlaidIncomeData = {
  monthlyIncome: 9000,
  employmentStatus: 'FULL_TIME',
  bankAccountAge: 48,
  incomeStability: 88,
};

/** Fresh per call site: `ProviderRegistryService.register` throws on a second registration for the same capability+mode, so each differently-mocked service needs its own registry. Credit/document default to an unused mock — most call sites only exercise income, and `ProviderRegistryService.resolve()` still requires every capability to be registered. */
function registryFor(overrides: {
  plaidService?: PlaidService;
  creditService?: CreditService;
  documentService?: DocumentService;
}): ProviderRegistryService {
  const registry = new ProviderRegistryService();
  registry.register(
    new PlaidIncomeAdapter(
      overrides.plaidService ?? ({ getIncomeData: jest.fn() } as any),
    ),
  );
  registry.register(
    new CreditReportAdapter(
      overrides.creditService ?? ({ getCreditData: jest.fn() } as any),
    ),
  );
  registry.register(
    new DocumentVerificationAdapter(
      overrides.documentService ?? ({ verifyDocuments: jest.fn() } as any),
    ),
  );
  return registry;
}

describeOrSkip('createCaseConditionsActivities', () => {
  let dataSource: DataSource;
  let policyResolver: PolicyApplicabilityResolverService;
  let policyEvaluationService: PolicyEvaluationService;
  let evaluationManifestService: EvaluationManifestService;
  let providerAuthorizationService: ProviderAuthorizationService;
  let providerOperationIntentService: ProviderOperationIntentService;
  let providerKillSwitchService: ProviderKillSwitchService;
  let consentService: ConsentService;
  let messageService: CommunicationMessageService;
  let communicationDeliveryService: CommunicationDeliveryService;
  let activities: ReturnType<typeof createCaseConditionsActivities>;
  let tenantId: string;
  let caseIds: string[] = [];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [
        Tenant,
        LoanCase,
        LoanCondition,
        ConditionTransition,
        EvidenceFact,
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
        ProviderAdapterStatus,
        ConsentRecord,
        CommunicationMessage,
        CommunicationTemplate,
        DataDispositionTask,
      ],
    });
    await dataSource.initialize();

    policyResolver = new PolicyApplicabilityResolverService(
      dataSource.getRepository(Jurisdiction),
      dataSource.getRepository(PolicyApplicability),
      dataSource.getRepository(PolicyVersion),
    );
    policyEvaluationService = new PolicyEvaluationService(
      policyResolver,
      dataSource,
      dataSource.getRepository(PolicyCatalogGeneration),
    );
    evaluationManifestService = new EvaluationManifestService(dataSource);
    consentService = new ConsentService(
      dataSource,
      new DataDispositionService(dataSource),
    );
    providerAuthorizationService = new ProviderAuthorizationService(
      dataSource,
      consentService,
    );
    providerOperationIntentService = new ProviderOperationIntentService(
      dataSource,
    );
    providerKillSwitchService = new ProviderKillSwitchService(dataSource);
    messageService = new CommunicationMessageService(dataSource);
    communicationDeliveryService = new CommunicationDeliveryService(
      dataSource,
      new CommunicationDeliverySimulator(),
      new ConfigService({ OUTBOX_SIGNING_SECRET }),
    );

    const plaidService = { getIncomeData: jest.fn() } as any;
    activities = createCaseConditionsActivities({
      dataSource,
      providerRegistry: registryFor({ plaidService }),
      policyEvaluationService,
      evaluationManifestService,
      providerAuthorizationService,
      providerOperationIntentService,
      providerKillSwitchService,
      consentService,
      messageService,
      communicationDeliveryService,
      outboxSigningSecret: OUTBOX_SIGNING_SECRET,
    });

    const tenant = await dataSource
      .getRepository(Tenant)
      .save(
        dataSource
          .getRepository(Tenant)
          .create({ name: 'Activities Spec Tenant' }),
      );
    tenantId = tenant.id;

    // A real, catalogued jurisdiction that simply hasn't been reviewed for
    // coverage yet — a case CAN legally reference it (the FK just requires
    // the jurisdiction to exist), but the resolver must still fail closed
    // rather than treat "exists but not COVERED" as good enough.
    await dataSource.getRepository(Jurisdiction).save(
      dataSource.getRepository(Jurisdiction).create({
        code: NOT_COVERED_JURISDICTION_CODE,
        level: JurisdictionLevel.STATE,
        name: 'Not-yet-covered (activities spec)',
        coverageStatus: JurisdictionCoverageStatus.NOT_COVERED,
      }),
    );
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const caseRepo = dataSource.getRepository(LoanCase);
      const evidenceRepo = dataSource.getRepository(EvidenceFact);
      const conditionRepo = dataSource.getRepository(LoanCondition);
      const outboxRepo = dataSource.getRepository(OutboxEvent);
      if (caseIds.length > 0) {
        // ToolAttempt cascades on AgentRun's delete.
        await dataSource.getRepository(AgentRun).delete({ tenantId });
        await dataSource
          .getRepository(EvaluationInputManifest)
          .delete({ tenantId });
        await evidenceRepo.delete({ tenantId });
        await outboxRepo.delete({ tenantId });
        await dataSource
          .getRepository(DataDispositionTask)
          .delete({ tenantId });
        await dataSource.getRepository(ConsentRecord).delete({ tenantId });
        await dataSource
          .getRepository(CommunicationMessage)
          .delete({ tenantId });
        await dataSource.getRepository(CasePolicyBinding).delete({ tenantId });
        await dataSource.getRepository(CasePolicySnapshot).delete({ tenantId });
        const conditions = await conditionRepo.find({
          where: caseIds.map((caseId) => ({ caseId })),
        });
        if (conditions.length > 0) {
          await dataSource
            .getRepository(ConditionTransition)
            .delete(conditions.map((c) => ({ conditionId: c.id })));
          await conditionRepo.delete(conditions.map((c) => ({ id: c.id })));
        }
        await caseRepo.delete(caseIds);
      }
      await dataSource.getRepository(Tenant).delete({ id: tenantId });
      // After every case referencing it is gone (RESTRICT FK).
      await dataSource
        .getRepository(Jurisdiction)
        .delete({ code: NOT_COVERED_JURISDICTION_CODE });
      await dataSource.destroy();
    }
  }, 30_000);

  async function makeCase(overrides: {
    statedMonthlyIncome: number;
    jurisdictionCode?: string;
  }): Promise<string> {
    const caseRepo = dataSource.getRepository(LoanCase);
    const loanCase = await caseRepo.save(
      caseRepo.create({
        tenantId,
        idempotencyKey: `activities-spec-${Date.now()}-${Math.random()}`,
        borrowerId: 'activities-spec-borrower',
        requestedAmount: 300_000,
        loanType: LoanType.CONVENTIONAL,
        statedMonthlyIncome: overrides.statedMonthlyIncome,
        jurisdictionCode:
          overrides.jurisdictionCode ?? SEEDED_JURISDICTION_CODE,
        status: CaseStatus.DRAFT,
      }),
    );
    caseIds.push(loanCase.id);
    // Matches CasesService.createCase()'s own real behavior (M5-005) —
    // evaluateConditions now reads real consent status, so every test
    // case needs the same implicit grant a real case gets at creation,
    // or every evaluateConditions() call in this file would see MISSING
    // instead of VALID.
    await consentService.grantForCase(tenantId, loanCase.id);
    return loanCase.id;
  }

  // evaluateConditions now runs a bounded Agent run whose
  // check_case_completeness/resolveOutcome tools read real EvidenceFact
  // rows, not a directly-passed income parameter — this seeds the same
  // three fact types the workflow's fetch activities would have recorded
  // by the time evaluateConditions actually runs in production.
  async function seedEvidence(
    caseId: string,
    verifiedMonthlyIncome: number,
  ): Promise<void> {
    const evidenceRepo = dataSource.getRepository(EvidenceFact);
    await evidenceRepo.save([
      evidenceRepo.create({
        tenantId,
        caseId,
        factType: EvidenceType.INCOME,
        sourceKind: EvidenceSourceKind.SIMULATOR,
        sourceIdentifier: 'plaid-simulator',
        value: { ...GOOD_INCOME, monthlyIncome: verifiedMonthlyIncome },
        observedAt: new Date(),
      }),
      evidenceRepo.create({
        tenantId,
        caseId,
        factType: EvidenceType.CREDIT,
        sourceKind: EvidenceSourceKind.SIMULATOR,
        sourceIdentifier: 'credit-bureau-simulator',
        value: {},
        observedAt: new Date(),
      }),
      evidenceRepo.create({
        tenantId,
        caseId,
        factType: EvidenceType.DOCUMENT,
        sourceKind: EvidenceSourceKind.SIMULATOR,
        sourceIdentifier: 'document-verification-simulator',
        value: {},
        observedAt: new Date(),
      }),
    ]);
  }

  async function outboxEventsFor(caseId: string) {
    return dataSource
      .getRepository(OutboxEvent)
      .find({ where: { caseId }, order: { createdAt: 'ASC' } });
  }

  it('markCollectingEvidence sets the case status and writes a signed workflow_run.started event', async () => {
    const caseId = await makeCase({ statedMonthlyIncome: 9000 });
    await activities.markCollectingEvidence({ tenantId, caseId });

    const updated = await dataSource
      .getRepository(LoanCase)
      .findOneByOrFail({ id: caseId });
    expect(updated.status).toBe(CaseStatus.COLLECTING_EVIDENCE);

    const events = await outboxEventsFor(caseId);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(OutboxEventType.WorkflowRunStarted);
    expect(events[0].tenantId).toBe(tenantId);
    // Round-trips through the real jsonb column and a fresh read — proves
    // the signature verifies against what Postgres actually stored, not
    // just the in-memory object at write time (see outbox-signer.ts's
    // canonicalization comment on why this specifically needs a real DB).
    expect(
      verifyOutboxSignature(
        events[0].payload,
        events[0].signature,
        OUTBOX_SIGNING_SECRET,
      ),
    ).toBe(true);
    expect(
      verifyOutboxSignature(
        events[0].payload,
        events[0].signature,
        'wrong-secret-value-at-least-16-chars',
      ),
    ).toBe(false);
  });

  it('fetchIncomeEvidence persists an INCOME evidence fact, returns the simulator data, and writes an evidence.updated event', async () => {
    const caseId = await makeCase({ statedMonthlyIncome: 9000 });
    const plaidService = {
      getIncomeData: jest.fn().mockResolvedValue(GOOD_INCOME),
    } as any;
    const scoped = createCaseConditionsActivities({
      dataSource,
      providerRegistry: registryFor({ plaidService }),
      policyEvaluationService,
      evaluationManifestService,
      providerAuthorizationService,
      providerOperationIntentService,
      providerKillSwitchService,
      consentService,
      messageService,
      communicationDeliveryService,
      outboxSigningSecret: OUTBOX_SIGNING_SECRET,
    });

    const result = await scoped.fetchIncomeEvidence({
      tenantId,
      caseId,
      borrowerId: 'activities-spec-borrower',
    });

    expect(result).toEqual(GOOD_INCOME);
    const facts = await dataSource
      .getRepository(EvidenceFact)
      .find({ where: { caseId, factType: EvidenceType.INCOME } });
    expect(facts).toHaveLength(1);
    expect(facts[0].value).toEqual(GOOD_INCOME);
    expect(facts[0].sourceIdentifier).toBe('plaid-simulator');

    const events = await outboxEventsFor(caseId);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(OutboxEventType.EvidenceUpdated);
    expect(events[0].payload).toMatchObject({
      caseId,
      evidenceType: EvidenceType.INCOME,
      sourceIdentifier: 'plaid-simulator',
    });
  });

  it('evaluateConditions with no income discrepancy marks the case ready and writes workflow_run.completed', async () => {
    // statedMonthlyIncome === verified income -> 0% difference, well under
    // the seeded rule's 10% threshold.
    const caseId = await makeCase({ statedMonthlyIncome: 9000 });
    await seedEvidence(caseId, 9000);

    const result = await activities.evaluateConditions({
      tenantId,
      caseId,
      workflowRunId: 'activities-spec-run-ready',
    });

    expect(result).toEqual({ outcome: 'READY' });
    const updated = await dataSource
      .getRepository(LoanCase)
      .findOneByOrFail({ id: caseId });
    expect(updated.status).toBe(CaseStatus.READY_FOR_UNDERWRITING);
    const conditions = await dataSource
      .getRepository(LoanCondition)
      .find({ where: { caseId } });
    expect(conditions).toHaveLength(0);

    const events = await outboxEventsFor(caseId);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(OutboxEventType.WorkflowRunCompleted);
    expect(events[0].payload).toMatchObject({
      caseId,
      finalStatus: CaseStatus.READY_FOR_UNDERWRITING,
    });
  });

  describe('READY_FOR_UNDERWRITING routine notification (Section 9.4 send_information_request, M3-024)', () => {
    it('creates no CommunicationMessage at all for a tenant that never seeded the well-known template (opt-in, no noise)', async () => {
      const caseId = await makeCase({ statedMonthlyIncome: 9000 });
      await seedEvidence(caseId, 9000);

      const result = await activities.evaluateConditions({
        tenantId,
        caseId,
        workflowRunId: 'activities-spec-run-ready-unseeded',
      });
      expect(result).toEqual({ outcome: 'READY' });

      const messages = await dataSource
        .getRepository(CommunicationMessage)
        .find({ where: { caseId } });
      expect(messages).toHaveLength(0);
    });

    it('drafts and really sends a ROUTINE notice when the tenant has an APPROVED template at the well-known key', async () => {
      const templateRepo = dataSource.getRepository(CommunicationTemplate);
      const template = await templateRepo.save(
        templateRepo.create({
          tenantId,
          templateKey: READY_FOR_UNDERWRITING_TEMPLATE_KEY,
          version: READY_FOR_UNDERWRITING_TEMPLATE_VERSION,
          channel: 'EMAIL',
          locale: 'en-US',
          recipientRelationship: 'BORROWER',
          bodyTemplate:
            'Your case {{caseId}} has moved into underwriting review.',
          allowedVariables: ['caseId'],
          attachmentsAllowed: false,
          status: CommunicationTemplateStatus.APPROVED,
          approvedBy: 'activities-spec-operator',
          approvedAt: new Date(),
        }),
      );

      try {
        const caseId = await makeCase({ statedMonthlyIncome: 9000 });
        await seedEvidence(caseId, 9000);

        const result = await activities.evaluateConditions({
          tenantId,
          caseId,
          workflowRunId: 'activities-spec-run-ready-seeded',
        });
        expect(result).toEqual({ outcome: 'READY' });

        const messages = await dataSource
          .getRepository(CommunicationMessage)
          .find({ where: { caseId } });
        expect(messages).toHaveLength(1);
        expect(messages[0]).toMatchObject({
          classification: 'ROUTINE',
          status: 'SENT',
          templateId: template.id,
          renderedContent: `Your case ${caseId} has moved into underwriting review.`,
        });
        expect(messages[0].deliveryReference).toBeTruthy();
        expect(messages[0].sentAt).not.toBeNull();
      } finally {
        // Messages referencing this template must go first (RESTRICT FK,
        // FK_f07e0f283fe4267365c909aa0ea) — afterAll's own tenant-wide
        // CommunicationMessage cleanup runs later, after this test's own
        // finally, so it's still too late to rely on here.
        await dataSource
          .getRepository(CommunicationMessage)
          .delete({ templateId: template.id });
        await templateRepo.delete({ id: template.id });
      }
    });
  });

  it('evaluateConditions routes to REVIEW_REQUIRED when the case consent has been revoked (M5-005, Section 9.6: "consent revoked mid-case")', async () => {
    // Same otherwise-clean setup as the READY case above — the only
    // difference is the explicit revoke() call, proving this is genuinely
    // the consentStatus check (verifyConsent, the LangGraph runtime's own
    // first node, built in M3-009 but permanently inert until this
    // slice), not some other unrelated review trigger.
    const caseId = await makeCase({ statedMonthlyIncome: 9000 });
    await seedEvidence(caseId, 9000);
    await consentService.revoke(tenantId, caseId, 'borrower withdrew consent');

    const result = await activities.evaluateConditions({
      tenantId,
      caseId,
      workflowRunId: 'activities-spec-run-consent-revoked',
    });

    expect(result).toEqual({
      outcome: 'REVIEW_REQUIRED',
      reviewReason: expect.stringContaining('consentStatus'),
    });
    // No condition opened, no READY transition — the run stopped at the
    // very first node, before check_case_completeness/evaluate_policy/
    // create_condition ever ran.
    const conditions = await dataSource
      .getRepository(LoanCondition)
      .find({ where: { caseId } });
    expect(conditions).toHaveLength(0);
  });

  it("evaluateConditions routes to REVIEW_REQUIRED when the tenant's own agentRunStepBudgetOverride (M5-021) is exhausted before the run can finish — proving the override is genuinely read, not just stored", async () => {
    // Shared tenant across this whole file — set, then always reset,
    // even on assertion failure, so this test can never leak a budget
    // override into any test that runs after it.
    await dataSource
      .getRepository(Tenant)
      .update({ id: tenantId }, { agentRunStepBudgetOverride: 1 });
    try {
      const caseId = await makeCase({ statedMonthlyIncome: 9000 });
      await seedEvidence(caseId, 9000);

      const result = await activities.evaluateConditions({
        tenantId,
        caseId,
        workflowRunId: 'activities-spec-run-budget-exhausted',
      });

      expect(result).toEqual({
        outcome: 'REVIEW_REQUIRED',
        reviewReason: expect.stringContaining('StepBudget'),
      });
    } finally {
      await dataSource
        .getRepository(Tenant)
        .update({ id: tenantId }, { agentRunStepBudgetOverride: null });
    }
  });

  it('evaluateConditions with an income discrepancy opens a condition from the resolved rule and writes condition.opened + workflow_run.waiting_for_review atomically', async () => {
    // statedMonthlyIncome=12000 vs verified 9000 -> 25% difference, over
    // the seeded rule's 10% threshold.
    const caseId = await makeCase({ statedMonthlyIncome: 12_000 });
    await seedEvidence(caseId, 9000);

    const result = await activities.evaluateConditions({
      tenantId,
      caseId,
      workflowRunId: 'activities-spec-run-condition-opened',
    });

    expect(result.outcome).toBe('CONDITION_OPENED');
    expect(result.conditionId).toBeDefined();

    const updated = await dataSource
      .getRepository(LoanCase)
      .findOneByOrFail({ id: caseId });
    expect(updated.status).toBe(CaseStatus.CONDITIONS_OPEN);

    const condition = await dataSource
      .getRepository(LoanCondition)
      .findOneByOrFail({ id: result.conditionId });
    expect(condition.status).toBe(ConditionStatus.OPEN);
    // Code comes from the resolved policy rule's own outcome, not a
    // hardcoded string — this is the seeded Section 10.7 example rule.
    expect(condition.code).toBe('VERIFY_INCOME_DISCREPANCY');
    expect(condition.description).toContain('difference_percent');
    // policySnapshotId has existed on LoanCondition since M2-001, with a
    // comment saying M3 would populate it (Section 6.2) — this is that.
    expect(condition.policySnapshotId).not.toBeNull();

    const events = await outboxEventsFor(caseId);
    expect(events.map((e) => e.eventType)).toEqual([
      OutboxEventType.ConditionOpened,
      OutboxEventType.WorkflowRunWaitingForReview,
    ]);
    expect(events[0].payload).toMatchObject({
      caseId,
      conditionId: result.conditionId,
      ruleId: 'synthetic-income-discrepancy-review',
    });
  });

  it('evaluateConditions routes to INTERRUPTED when the jurisdiction exists but is not COVERED', async () => {
    // Policy-applicability ambiguity (Section 9.5: "ambiguity...
    // interrupt for review") is resumable, distinct from REVIEW_REQUIRED
    // (a runtime failure — see the workflow-level try/catch's tests).
    const caseId = await makeCase({
      statedMonthlyIncome: 9000,
      jurisdictionCode: NOT_COVERED_JURISDICTION_CODE,
    });
    await seedEvidence(caseId, 9000);

    const result = await activities.evaluateConditions({
      tenantId,
      caseId,
      workflowRunId: 'activities-spec-run-interrupted',
    });

    expect(result.outcome).toBe('INTERRUPTED');
    expect(result.reviewReason).toContain(NOT_COVERED_JURISDICTION_CODE);

    const updated = await dataSource
      .getRepository(LoanCase)
      .findOneByOrFail({ id: caseId });
    // evaluateConditions itself does not write case state for
    // INTERRUPTED — the workflow calls markWaitingForReview separately
    // (case-conditions.workflow.ts), so status is still whatever it was
    // before this call.
    expect(updated.status).toBe(CaseStatus.DRAFT);
  });

  it('markWaitingForReview sets the case status and writes an evaluation.interrupted event', async () => {
    const caseId = await makeCase({ statedMonthlyIncome: 9000 });
    await activities.markWaitingForReview({
      tenantId,
      caseId,
      reason: 'synthetic ambiguity for markWaitingForReview test',
    });

    const updated = await dataSource
      .getRepository(LoanCase)
      .findOneByOrFail({ id: caseId });
    expect(updated.status).toBe(CaseStatus.WAITING_FOR_REVIEW);

    const events = await outboxEventsFor(caseId);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(OutboxEventType.EvaluationInterrupted);
    expect(events[0].payload).toMatchObject({
      caseId,
      reason: 'synthetic ambiguity for markWaitingForReview test',
    });
  });

  it('resolveCondition updates the condition, records an attributed transition, and writes condition.satisfied or condition.waived', async () => {
    const caseId = await makeCase({ statedMonthlyIncome: 12_000 });
    await seedEvidence(caseId, 9000);
    const { conditionId } = await activities.evaluateConditions({
      tenantId,
      caseId,
      workflowRunId: 'activities-spec-run-resolve-condition',
    });

    await activities.resolveCondition({
      tenantId,
      caseId,
      conditionId: conditionId!,
      actorId: 'reviewer-activities-spec',
      resolution: 'WAIVED',
      reason: 'Confirmed acceptable in this test.',
    });

    const condition = await dataSource
      .getRepository(LoanCondition)
      .findOneByOrFail({ id: conditionId });
    expect(condition.status).toBe(ConditionStatus.WAIVED);

    const transitions = await dataSource
      .getRepository(ConditionTransition)
      .find({ where: { conditionId } });
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toMatchObject({
      fromStatus: ConditionStatus.OPEN,
      toStatus: ConditionStatus.WAIVED,
      actorId: 'reviewer-activities-spec',
      reason: 'Confirmed acceptable in this test.',
    });

    const events = await outboxEventsFor(caseId);
    // condition.opened + workflow_run.waiting_for_review from
    // evaluateConditions above, then condition.waived from this call.
    expect(events).toHaveLength(3);
    expect(events[2].eventType).toBe(OutboxEventType.ConditionWaived);
    expect(events[2].payload).toMatchObject({
      caseId,
      conditionId,
      actorId: 'reviewer-activities-spec',
      resolution: 'WAIVED',
    });
  });

  it('markReadyForUnderwriting sets the case status and writes workflow_run.completed', async () => {
    const caseId = await makeCase({ statedMonthlyIncome: 9000 });
    await activities.markReadyForUnderwriting({ tenantId, caseId });

    const updated = await dataSource
      .getRepository(LoanCase)
      .findOneByOrFail({ id: caseId });
    expect(updated.status).toBe(CaseStatus.READY_FOR_UNDERWRITING);

    const events = await outboxEventsFor(caseId);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(OutboxEventType.WorkflowRunCompleted);
  });

  it('markManualReview sets the case status and writes a workflow_run.failed event with the given reason', async () => {
    const caseId = await makeCase({ statedMonthlyIncome: 9000 });
    await activities.markManualReview({
      tenantId,
      caseId,
      reason: 'synthetic failure for markManualReview test',
    });

    const updated = await dataSource
      .getRepository(LoanCase)
      .findOneByOrFail({ id: caseId });
    expect(updated.status).toBe(CaseStatus.MANUAL_REVIEW);

    const events = await outboxEventsFor(caseId);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(OutboxEventType.WorkflowRunFailed);
    expect(events[0].payload).toMatchObject({
      caseId,
      reason: 'synthetic failure for markManualReview test',
    });
  });

  describe('retry classification against real provider simulators', () => {
    // Real PlaidService/CreditService/DocumentService, not mocks — proves
    // the full chain (simulator throws a synthetic failure -> the
    // activity's callProviderWithRetryClassification reclassifies it as
    // an ApplicationFailure with the right retry decision), not just that
    // a mocked collaborator was called correctly.
    let realActivities: ReturnType<typeof createCaseConditionsActivities>;

    beforeAll(() => {
      realActivities = createCaseConditionsActivities({
        dataSource,
        providerRegistry: registryFor({
          plaidService: new PlaidService(),
          creditService: new CreditService(),
          documentService: new DocumentService(),
        }),
        policyEvaluationService,
        evaluationManifestService,
        providerAuthorizationService,
        providerOperationIntentService,
        providerKillSwitchService,
        consentService,
        messageService,
        communicationDeliveryService,
        outboxSigningSecret: OUTBOX_SIGNING_SECRET,
      });
    });

    it('classifies a synthetic transient provider failure as retryable', async () => {
      const caseId = await makeCase({ statedMonthlyIncome: 9000 });
      await expect(
        realActivities.fetchIncomeEvidence({
          tenantId,
          caseId,
          borrowerId: 'SYNTHETIC-TRANSIENT-FAILURE-x',
        }),
      ).rejects.toMatchObject({
        nonRetryable: false,
        type: 'TransientProviderFailure',
      });

      // The provider call failed before the transaction that would have
      // written an EvidenceFact/outbox row ever started.
      const facts = await dataSource
        .getRepository(EvidenceFact)
        .find({ where: { caseId } });
      expect(facts).toHaveLength(0);
      expect(await outboxEventsFor(caseId)).toHaveLength(0);
    });

    it('classifies a synthetic terminal provider failure as non-retryable', async () => {
      const caseId = await makeCase({ statedMonthlyIncome: 9000 });
      await expect(
        realActivities.fetchCreditEvidence({
          tenantId,
          caseId,
          borrowerId: 'SYNTHETIC-TERMINAL-FAILURE-x',
        }),
      ).rejects.toMatchObject({
        nonRetryable: true,
        type: 'TerminalProviderFailure',
      });
    });

    it('classifies a revoked-consent provider dispatch as non-retryable (M5-005, Section 11.5)', async () => {
      const caseId = await makeCase({ statedMonthlyIncome: 9000 });
      // makeCase() already granted consent; revoke it before ever
      // dispatching — the same scenario a real revoked-consent case hits,
      // since dispatchProviderRequest attaches whatever the case's own
      // most recent consent record is (M5-005) and revalidate() then
      // rejects it. Retrying a request against an already-revoked
      // consent record can never succeed, so this must be non-retryable
      // the same way a terminal provider rejection already is above —
      // not left to Temporal's default retry policy to waste attempts on.
      await consentService.revoke(
        tenantId,
        caseId,
        'spec: revoked before dispatch',
      );

      await expect(
        realActivities.fetchIncomeEvidence({
          tenantId,
          caseId,
          borrowerId: 'activities-spec-borrower',
        }),
      ).rejects.toMatchObject({
        nonRetryable: true,
        type: 'ProviderAuthorizationRevalidationFailed',
      });

      const facts = await dataSource
        .getRepository(EvidenceFact)
        .find({ where: { caseId } });
      expect(facts).toHaveLength(0);
    });

    it('classifies a kill-switch-disabled provider dispatch as non-retryable (Section 11.4, M4-006)', async () => {
      await providerKillSwitchService.disable(
        'plaid-simulator',
        ProviderCapability.INCOME,
        'SIMULATOR',
        'activities-spec: simulating an operational incident',
        'activities-spec-operator',
      );

      try {
        const caseId = await makeCase({ statedMonthlyIncome: 9000 });

        await expect(
          realActivities.fetchIncomeEvidence({
            tenantId,
            caseId,
            borrowerId: 'activities-spec-kill-switch-borrower',
          }),
        ).rejects.toMatchObject({
          nonRetryable: true,
          type: 'ProviderDisabled',
        });

        const facts = await dataSource
          .getRepository(EvidenceFact)
          .find({ where: { caseId } });
        expect(facts).toHaveLength(0);
      } finally {
        await providerKillSwitchService.enable(
          'plaid-simulator',
          ProviderCapability.INCOME,
          'SIMULATOR',
          'activities-spec-operator',
        );
      }
    });

    it('leaves an unrecognized error unclassified (propagated as-is)', async () => {
      const caseId = await makeCase({ statedMonthlyIncome: 9000 });
      const brokenPlaid = {
        getIncomeData: jest.fn().mockRejectedValue(new Error('unrelated bug')),
      } as any;
      const scoped = createCaseConditionsActivities({
        dataSource,
        providerRegistry: registryFor({
          plaidService: brokenPlaid,
          creditService: new CreditService(),
          documentService: new DocumentService(),
        }),
        policyEvaluationService,
        evaluationManifestService,
        providerAuthorizationService,
        providerOperationIntentService,
        providerKillSwitchService,
        consentService,
        messageService,
        communicationDeliveryService,
        outboxSigningSecret: OUTBOX_SIGNING_SECRET,
      });

      await expect(
        scoped.fetchIncomeEvidence({
          tenantId,
          caseId,
          borrowerId: 'irrelevant',
        }),
      ).rejects.toThrow('unrelated bug');
    });
  });
});
