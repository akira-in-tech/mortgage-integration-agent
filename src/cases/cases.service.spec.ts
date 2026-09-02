import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { WorkflowNotFoundError } from '@temporalio/client';
import { CasesService } from './cases.service';
import { LoanCase, CaseStatus } from '../database/entities/loan-case.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import { OutboxEvent } from '../database/entities/outbox-event.entity';
import { LoanType } from '../database/enums/loan-type.enum';
import { CreateCaseDto } from './dto/create-case.dto';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const CASE_ID = '22222222-2222-2222-2222-222222222222';

const BASE_DTO: CreateCaseDto = {
  borrowerId: 'borrower-1',
  requestedAmount: 300_000,
  loanType: LoanType.CONVENTIONAL,
  statedMonthlyIncome: 9000,
  jurisdictionCode: 'US-CA',
};

describe('CasesService', () => {
  let caseRepo: {
    findOneBy: jest.Mock;
    findOneByOrFail: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let tenantRepo: { findOneBy: jest.Mock };
  let jurisdictionRepo: { findOneBy: jest.Mock };
  let txOutboxRepo: { create: jest.Mock; save: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let configService: { get: jest.Mock };
  let temporalClient: {
    startCaseConditionsWorkflow: jest.Mock;
    resolveCondition: jest.Mock;
    resumeInterruptedEvaluation: jest.Mock;
    getWorkflowStatus: jest.Mock;
    cancelCaseConditionsWorkflow: jest.Mock;
    recoverCaseConditionsWorkflow: jest.Mock;
  };
  let caseTimelineService: { getTimeline: jest.Mock };
  let consentService: { grantForCase: jest.Mock; revoke: jest.Mock };
  let policyChangeImpactService: { assessImpactForCase: jest.Mock };
  let service: CasesService;

  beforeEach(() => {
    tenantRepo = { findOneBy: jest.fn() };
    jurisdictionRepo = { findOneBy: jest.fn() };
    jurisdictionRepo.findOneBy.mockResolvedValue({
      code: 'US-CA',
    } as Jurisdiction);
    // dataSource.transaction is mocked to actually invoke the callback
    // (not just record the call) so CasesService's real transaction body —
    // the case save, the outbox write, and the unique-violation catch —
    // runs for real against these manager-scoped repo mocks. Every call
    // now goes through runInTenantContext (M5-004), which itself always
    // calls dataSource.transaction and, before the work callback, an
    // (irrelevant to these mocks) manager.query — both mocked below.
    // getCase()'s reads and createCase()'s writes both resolve
    // manager.getRepository(LoanCase) to this same object, so one mock
    // carries all four methods real CasesService code calls on it.
    caseRepo = {
      findOneBy: jest.fn(),
      findOneByOrFail: jest.fn(),
      create: jest.fn((data: Partial<LoanCase>) => data as LoanCase),
      save: jest.fn().mockImplementation(async (loanCase) => ({
        id: CASE_ID,
        version: 1,
        createdAt: new Date('2026-06-28T12:00:00.000Z'),
        updatedAt: new Date('2026-06-28T12:00:00.000Z'),
        ...loanCase,
      })),
    };
    txOutboxRepo = {
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => data),
    };
    const manager = {
      query: jest.fn().mockResolvedValue(undefined),
      getRepository: jest.fn((entity: unknown) => {
        if (entity === LoanCase) return caseRepo;
        if (entity === OutboxEvent) return txOutboxRepo;
        throw new Error(`Unexpected repository requested: ${String(entity)}`);
      }),
    };
    dataSource = {
      transaction: jest.fn((cb: (m: unknown) => unknown) => cb(manager)),
    };
    configService = {
      get: jest.fn((_key: string, defaultValue: unknown) => defaultValue),
    };
    temporalClient = {
      startCaseConditionsWorkflow: jest.fn(),
      resolveCondition: jest.fn(),
      resumeInterruptedEvaluation: jest.fn(),
      getWorkflowStatus: jest.fn(),
      cancelCaseConditionsWorkflow: jest.fn(),
      recoverCaseConditionsWorkflow: jest.fn(),
    };
    caseTimelineService = { getTimeline: jest.fn() };
    consentService = {
      grantForCase: jest.fn().mockResolvedValue({ id: 'consent-record-1' }),
      revoke: jest.fn().mockResolvedValue({ id: 'consent-record-1' }),
    };
    policyChangeImpactService = { assessImpactForCase: jest.fn() };
    service = new CasesService(
      tenantRepo as never,
      jurisdictionRepo as never,
      dataSource as never,
      temporalClient as never,
      configService as never,
      caseTimelineService as never,
      consentService as never,
      policyChangeImpactService as never,
    );
  });

  describe('createCase', () => {
    it('throws NotFoundException when the tenant does not exist', async () => {
      tenantRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.createCase('key-1', TENANT_ID, BASE_DTO),
      ).rejects.toThrow(NotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the jurisdiction does not exist', async () => {
      tenantRepo.findOneBy.mockResolvedValue({ id: TENANT_ID } as Tenant);
      jurisdictionRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.createCase('key-1', TENANT_ID, BASE_DTO),
      ).rejects.toThrow(NotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('creates a new DRAFT case for a first-time idempotency key', async () => {
      tenantRepo.findOneBy.mockResolvedValue({ id: TENANT_ID } as Tenant);
      caseRepo.findOneBy.mockResolvedValue(null);

      const result = await service.createCase('key-1', TENANT_ID, BASE_DTO);

      expect(result.id).toBe(CASE_ID);
      expect(caseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          idempotencyKey: 'key-1',
          status: CaseStatus.DRAFT,
          statedMonthlyIncome: 9000,
          jurisdictionCode: 'US-CA',
        }),
      );
      expect(txOutboxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          caseId: CASE_ID,
          eventType: 'loan_case.created',
        }),
      );
      expect(txOutboxRepo.save).toHaveBeenCalled();
      // M5-005: every new case gets an implicit consent grant, matching
      // this codebase's existing behavior (a case has always processed
      // successfully with no separate consent step) — this is what
      // gives submitConsentAction()'s REVOKE something real to revoke.
      expect(consentService.grantForCase).toHaveBeenCalledWith(
        TENANT_ID,
        CASE_ID,
      );
    });

    it('returns the existing case instead of creating a duplicate for a repeated key', async () => {
      tenantRepo.findOneBy.mockResolvedValue({ id: TENANT_ID } as Tenant);
      const existing = { id: CASE_ID, idempotencyKey: 'key-1' } as LoanCase;
      caseRepo.findOneBy.mockResolvedValue(existing);

      const result = await service.createCase('key-1', TENANT_ID, BASE_DTO);

      expect(result).toBe(existing);
      // The idempotency check itself now goes through runInTenantContext
      // (M5-004), so dataSource.transaction is called once for that read
      // — what actually matters here is that no case was ever created.
      expect(caseRepo.save).not.toHaveBeenCalled();
    });

    it('resolves to the winning row when a concurrent duplicate loses the unique-constraint race', async () => {
      tenantRepo.findOneBy.mockResolvedValue({ id: TENANT_ID } as Tenant);
      caseRepo.findOneBy.mockResolvedValue(null);
      caseRepo.save.mockRejectedValue({ code: '23505' });
      const winner = { id: CASE_ID, idempotencyKey: 'key-1' } as LoanCase;
      caseRepo.findOneByOrFail.mockResolvedValue(winner);

      const result = await service.createCase('key-1', TENANT_ID, BASE_DTO);

      expect(result).toBe(winner);
    });

    it('propagates errors unrelated to a unique-constraint violation', async () => {
      tenantRepo.findOneBy.mockResolvedValue({ id: TENANT_ID } as Tenant);
      caseRepo.findOneBy.mockResolvedValue(null);
      caseRepo.save.mockRejectedValue(new Error('connection reset'));

      await expect(
        service.createCase('key-1', TENANT_ID, BASE_DTO),
      ).rejects.toThrow('connection reset');
    });
  });

  describe('getCase', () => {
    it('throws NotFoundException for an unknown case id', async () => {
      caseRepo.findOneBy.mockResolvedValue(null);
      await expect(service.getCase(TENANT_ID, CASE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the case row when found', async () => {
      const found = { id: CASE_ID } as LoanCase;
      caseRepo.findOneBy.mockResolvedValue(found);
      await expect(service.getCase(TENANT_ID, CASE_ID)).resolves.toBe(found);
    });

    it('queries scoped to the caller tenant, not the case id alone (Section 20 M5: cross-tenant fails closed)', async () => {
      caseRepo.findOneBy.mockResolvedValue({ id: CASE_ID } as LoanCase);

      await service.getCase(TENANT_ID, CASE_ID);

      expect(caseRepo.findOneBy).toHaveBeenCalledWith({
        id: CASE_ID,
        tenantId: TENANT_ID,
      });
    });

    it('404s for a case that belongs to a different tenant, the same response a nonexistent case gets — no separate 403 that would leak the case exists', async () => {
      // The mock stands in for what Postgres itself returns: a query
      // filtered on (id, tenantId) together finds nothing when the real
      // row's tenantId differs from the caller's, exactly like an
      // unknown id would.
      caseRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.getCase('99999999-9999-9999-9999-999999999999', CASE_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('startWorkflow', () => {
    it('starts the workflow using the case tenant/borrower and returns its identity', async () => {
      caseRepo.findOneBy.mockResolvedValue({
        id: CASE_ID,
        tenantId: TENANT_ID,
        borrowerId: 'borrower-1',
      } as LoanCase);
      temporalClient.startCaseConditionsWorkflow.mockResolvedValue({
        workflowId: `case-conditions-${CASE_ID}`,
        runId: 'run-1',
      });

      const result = await service.startWorkflow(TENANT_ID, CASE_ID);

      expect(temporalClient.startCaseConditionsWorkflow).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        caseId: CASE_ID,
        borrowerId: 'borrower-1',
      });
      expect(result).toEqual({
        workflowId: `case-conditions-${CASE_ID}`,
        runId: 'run-1',
      });
    });

    it('throws NotFoundException without contacting Temporal for an unknown case', async () => {
      caseRepo.findOneBy.mockResolvedValue(null);
      await expect(service.startWorkflow(TENANT_ID, CASE_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(temporalClient.startCaseConditionsWorkflow).not.toHaveBeenCalled();
    });
  });

  describe('getWorkflowRun', () => {
    beforeEach(() => {
      caseRepo.findOneBy.mockResolvedValue({ id: CASE_ID } as LoanCase);
    });

    it('returns the run status from TemporalClientService', async () => {
      temporalClient.getWorkflowStatus.mockResolvedValue({
        workflowId: `case-conditions-${CASE_ID}`,
        runId: 'run-1',
        status: 'RUNNING',
      });

      const result = await service.getWorkflowRun(TENANT_ID, CASE_ID, 'run-1');

      expect(temporalClient.getWorkflowStatus).toHaveBeenCalledWith(
        CASE_ID,
        'run-1',
      );
      expect(result.status).toBe('RUNNING');
    });

    it('translates WorkflowNotFoundError into a 404', async () => {
      temporalClient.getWorkflowStatus.mockRejectedValue(
        new WorkflowNotFoundError(
          'not found',
          `case-conditions-${CASE_ID}`,
          'run-1',
        ),
      );

      await expect(
        service.getWorkflowRun(TENANT_ID, CASE_ID, 'run-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('workflow operations', () => {
    beforeEach(() => {
      caseRepo.findOneBy.mockResolvedValue({
        id: CASE_ID,
        tenantId: TENANT_ID,
        borrowerId: 'borrower-1',
        status: CaseStatus.MANUAL_REVIEW,
      } as LoanCase);
    });

    it('cancels only a running exact workflow run', async () => {
      temporalClient.getWorkflowStatus.mockResolvedValue({
        workflowId: `case-conditions-${CASE_ID}`,
        runId: 'run-1',
        status: 'RUNNING',
      });

      await service.cancelWorkflow(TENANT_ID, CASE_ID, 'run-1');

      expect(temporalClient.cancelCaseConditionsWorkflow).toHaveBeenCalledWith(
        CASE_ID,
        'run-1',
      );
    });

    it('does not cancel a terminal run', async () => {
      temporalClient.getWorkflowStatus.mockResolvedValue({
        workflowId: `case-conditions-${CASE_ID}`,
        runId: 'run-1',
        status: 'CANCELLED',
      });

      await expect(
        service.cancelWorkflow(TENANT_ID, CASE_ID, 'run-1'),
      ).rejects.toThrow('cannot be cancelled');
      expect(
        temporalClient.cancelCaseConditionsWorkflow,
      ).not.toHaveBeenCalled();
    });

    it('recovers a cancelled execution with the original run id in workflow input', async () => {
      temporalClient.getWorkflowStatus.mockResolvedValue({
        workflowId: `case-conditions-${CASE_ID}`,
        runId: 'run-1',
        status: 'CANCELLED',
      });
      temporalClient.recoverCaseConditionsWorkflow.mockResolvedValue({
        workflowId: `case-conditions-${CASE_ID}`,
        runId: 'run-2',
      });

      await service.recoverWorkflow(TENANT_ID, CASE_ID, 'run-1');

      expect(temporalClient.recoverCaseConditionsWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          caseId: CASE_ID,
          borrowerId: 'borrower-1',
          recoveryOfRunId: 'run-1',
        }),
      );
    });

    it('does not recover an old terminal run after a later execution exists', async () => {
      temporalClient.getWorkflowStatus
        .mockResolvedValueOnce({
          workflowId: `case-conditions-${CASE_ID}`,
          runId: 'run-1',
          status: 'CANCELLED',
        })
        .mockResolvedValueOnce({
          workflowId: `case-conditions-${CASE_ID}`,
          runId: 'run-2',
          status: 'FAILED',
        });

      await expect(
        service.recoverWorkflow(TENANT_ID, CASE_ID, 'run-1'),
      ).rejects.toThrow('no longer the latest execution');
      expect(
        temporalClient.recoverCaseConditionsWorkflow,
      ).not.toHaveBeenCalled();
    });

    it('does not recover a completed execution', async () => {
      temporalClient.getWorkflowStatus.mockResolvedValue({
        workflowId: `case-conditions-${CASE_ID}`,
        runId: 'run-1',
        status: 'COMPLETED',
      });

      await expect(
        service.recoverWorkflow(TENANT_ID, CASE_ID, 'run-1'),
      ).rejects.toThrow('cannot be recovered');
      expect(
        temporalClient.recoverCaseConditionsWorkflow,
      ).not.toHaveBeenCalled();
    });
  });

  describe('submitReview', () => {
    beforeEach(() => {
      caseRepo.findOneBy.mockResolvedValue({ id: CASE_ID } as LoanCase);
    });

    const resolutionDto = {
      reviewType: 'CONDITION_RESOLUTION' as const,
      actorId: 'reviewer-1',
      resolution: 'SATISFIED' as const,
    };

    it('delivers the resolveCondition signal for a CONDITION_RESOLUTION review', async () => {
      temporalClient.resolveCondition.mockResolvedValue(undefined);

      await service.submitReview(TENANT_ID, CASE_ID, resolutionDto);

      expect(temporalClient.resolveCondition).toHaveBeenCalledWith(CASE_ID, {
        actorId: 'reviewer-1',
        resolution: 'SATISFIED',
        reason: undefined,
      });
      expect(temporalClient.resumeInterruptedEvaluation).not.toHaveBeenCalled();
    });

    it('translates WorkflowNotFoundError into a 404 for a CONDITION_RESOLUTION review', async () => {
      temporalClient.resolveCondition.mockRejectedValue(
        new WorkflowNotFoundError(
          'not found',
          `case-conditions-${CASE_ID}`,
          undefined,
        ),
      );

      await expect(
        service.submitReview(TENANT_ID, CASE_ID, resolutionDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('delivers the resumeInterruptedEvaluation signal for a RESUME_EVALUATION review', async () => {
      temporalClient.resumeInterruptedEvaluation.mockResolvedValue(undefined);
      const resumeDto = {
        reviewType: 'RESUME_EVALUATION' as const,
        actorId: 'reviewer-2',
        reason: 'coverage activated',
      };

      await service.submitReview(TENANT_ID, CASE_ID, resumeDto);

      expect(temporalClient.resumeInterruptedEvaluation).toHaveBeenCalledWith(
        CASE_ID,
        { actorId: 'reviewer-2', note: 'coverage activated' },
      );
      expect(temporalClient.resolveCondition).not.toHaveBeenCalled();
    });

    it('translates WorkflowNotFoundError into a 404 for a RESUME_EVALUATION review', async () => {
      temporalClient.resumeInterruptedEvaluation.mockRejectedValue(
        new WorkflowNotFoundError(
          'not found',
          `case-conditions-${CASE_ID}`,
          undefined,
        ),
      );

      await expect(
        service.submitReview(TENANT_ID, CASE_ID, {
          reviewType: 'RESUME_EVALUATION' as const,
          actorId: 'reviewer-2',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitConsentAction', () => {
    beforeEach(() => {
      caseRepo.findOneBy.mockResolvedValue({ id: CASE_ID } as LoanCase);
    });

    it('REVOKE delegates to ConsentService.revoke with the reason', async () => {
      const revoked = { id: 'consent-record-1', revokedAt: new Date() };
      consentService.revoke.mockResolvedValue(revoked);

      const result = await service.submitConsentAction(TENANT_ID, CASE_ID, {
        action: 'REVOKE',
        reason: 'borrower withdrew',
      });

      expect(consentService.revoke).toHaveBeenCalledWith(
        TENANT_ID,
        CASE_ID,
        'borrower withdrew',
      );
      expect(result).toBe(revoked);
    });

    it('GRANT delegates to ConsentService.grantForCase', async () => {
      const granted = { id: 'consent-record-2' };
      consentService.grantForCase.mockResolvedValue(granted);

      const result = await service.submitConsentAction(TENANT_ID, CASE_ID, {
        action: 'GRANT',
      });

      expect(consentService.grantForCase).toHaveBeenCalledWith(
        TENANT_ID,
        CASE_ID,
      );
      expect(result).toBe(granted);
    });

    it('404s for a case that belongs to a different tenant, without calling ConsentService', async () => {
      caseRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.submitConsentAction(TENANT_ID, CASE_ID, { action: 'REVOKE' }),
      ).rejects.toThrow(NotFoundException);
      expect(consentService.revoke).not.toHaveBeenCalled();
    });
  });

  describe('getTimeline', () => {
    it("delegates to CaseTimelineService with the case's own tenantId", async () => {
      caseRepo.findOneBy.mockResolvedValue({
        id: CASE_ID,
        tenantId: TENANT_ID,
      } as LoanCase);
      const entries = [
        {
          timestamp: '2026-01-01T00:00:00.000Z',
          kind: 'DOMAIN_EVENT',
          summary: 'x',
          detail: {},
        },
      ];
      caseTimelineService.getTimeline.mockResolvedValue(entries);

      const result = await service.getTimeline(TENANT_ID, CASE_ID);

      expect(caseTimelineService.getTimeline).toHaveBeenCalledWith(
        TENANT_ID,
        CASE_ID,
      );
      expect(result).toBe(entries);
    });

    it('throws 404 for a nonexistent case without calling CaseTimelineService', async () => {
      caseRepo.findOneBy.mockResolvedValue(null);

      await expect(service.getTimeline(TENANT_ID, CASE_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(caseTimelineService.getTimeline).not.toHaveBeenCalled();
    });
  });
});
