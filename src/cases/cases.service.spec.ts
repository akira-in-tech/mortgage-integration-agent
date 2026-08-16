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
  tenantId: TENANT_ID,
  borrowerId: 'borrower-1',
  requestedAmount: 300_000,
  loanType: LoanType.CONVENTIONAL,
  statedMonthlyIncome: 9000,
  jurisdictionCode: 'US-CA',
};

describe('CasesService', () => {
  let caseRepo: { findOneBy: jest.Mock; findOneByOrFail: jest.Mock };
  let tenantRepo: { findOneBy: jest.Mock };
  let jurisdictionRepo: { findOneBy: jest.Mock };
  let txCaseRepo: { create: jest.Mock; save: jest.Mock };
  let txOutboxRepo: { create: jest.Mock; save: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let configService: { get: jest.Mock };
  let temporalClient: {
    startCaseConditionsWorkflow: jest.Mock;
    resolveCondition: jest.Mock;
    getWorkflowStatus: jest.Mock;
  };
  let service: CasesService;

  beforeEach(() => {
    caseRepo = { findOneBy: jest.fn(), findOneByOrFail: jest.fn() };
    tenantRepo = { findOneBy: jest.fn() };
    jurisdictionRepo = { findOneBy: jest.fn() };
    jurisdictionRepo.findOneBy.mockResolvedValue({
      code: 'US-CA',
    } as Jurisdiction);
    // dataSource.transaction is mocked to actually invoke the callback
    // (not just record the call) so CasesService's real transaction body —
    // the case save, the outbox write, and the unique-violation catch —
    // runs for real against these manager-scoped repo mocks.
    txCaseRepo = {
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
      getRepository: jest.fn((entity: unknown) => {
        if (entity === LoanCase) return txCaseRepo;
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
      getWorkflowStatus: jest.fn(),
    };
    service = new CasesService(
      caseRepo as never,
      tenantRepo as never,
      jurisdictionRepo as never,
      dataSource as never,
      temporalClient as never,
      configService as never,
    );
  });

  describe('createCase', () => {
    it('throws NotFoundException when the tenant does not exist', async () => {
      tenantRepo.findOneBy.mockResolvedValue(null);

      await expect(service.createCase('key-1', BASE_DTO)).rejects.toThrow(
        NotFoundException,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the jurisdiction does not exist', async () => {
      tenantRepo.findOneBy.mockResolvedValue({ id: TENANT_ID } as Tenant);
      jurisdictionRepo.findOneBy.mockResolvedValue(null);

      await expect(service.createCase('key-1', BASE_DTO)).rejects.toThrow(
        NotFoundException,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('creates a new DRAFT case for a first-time idempotency key', async () => {
      tenantRepo.findOneBy.mockResolvedValue({ id: TENANT_ID } as Tenant);
      caseRepo.findOneBy.mockResolvedValue(null);

      const result = await service.createCase('key-1', BASE_DTO);

      expect(result.id).toBe(CASE_ID);
      expect(txCaseRepo.create).toHaveBeenCalledWith(
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
    });

    it('returns the existing case instead of creating a duplicate for a repeated key', async () => {
      tenantRepo.findOneBy.mockResolvedValue({ id: TENANT_ID } as Tenant);
      const existing = { id: CASE_ID, idempotencyKey: 'key-1' } as LoanCase;
      caseRepo.findOneBy.mockResolvedValue(existing);

      const result = await service.createCase('key-1', BASE_DTO);

      expect(result).toBe(existing);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('resolves to the winning row when a concurrent duplicate loses the unique-constraint race', async () => {
      tenantRepo.findOneBy.mockResolvedValue({ id: TENANT_ID } as Tenant);
      caseRepo.findOneBy.mockResolvedValue(null);
      txCaseRepo.save.mockRejectedValue({ code: '23505' });
      const winner = { id: CASE_ID, idempotencyKey: 'key-1' } as LoanCase;
      caseRepo.findOneByOrFail.mockResolvedValue(winner);

      const result = await service.createCase('key-1', BASE_DTO);

      expect(result).toBe(winner);
    });

    it('propagates errors unrelated to a unique-constraint violation', async () => {
      tenantRepo.findOneBy.mockResolvedValue({ id: TENANT_ID } as Tenant);
      caseRepo.findOneBy.mockResolvedValue(null);
      txCaseRepo.save.mockRejectedValue(new Error('connection reset'));

      await expect(service.createCase('key-1', BASE_DTO)).rejects.toThrow(
        'connection reset',
      );
    });
  });

  describe('getCase', () => {
    it('throws NotFoundException for an unknown case id', async () => {
      caseRepo.findOneBy.mockResolvedValue(null);
      await expect(service.getCase(CASE_ID)).rejects.toThrow(NotFoundException);
    });

    it('returns the case row when found', async () => {
      const found = { id: CASE_ID } as LoanCase;
      caseRepo.findOneBy.mockResolvedValue(found);
      await expect(service.getCase(CASE_ID)).resolves.toBe(found);
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

      const result = await service.startWorkflow(CASE_ID);

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
      await expect(service.startWorkflow(CASE_ID)).rejects.toThrow(
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

      const result = await service.getWorkflowRun(CASE_ID, 'run-1');

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

      await expect(service.getWorkflowRun(CASE_ID, 'run-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('resolveCondition', () => {
    beforeEach(() => {
      caseRepo.findOneBy.mockResolvedValue({ id: CASE_ID } as LoanCase);
    });

    const dto = { actorId: 'reviewer-1', resolution: 'SATISFIED' as const };

    it('delivers the signal via TemporalClientService', async () => {
      temporalClient.resolveCondition.mockResolvedValue(undefined);

      await service.resolveCondition(CASE_ID, dto);

      expect(temporalClient.resolveCondition).toHaveBeenCalledWith(
        CASE_ID,
        dto,
      );
    });

    it('translates WorkflowNotFoundError into a 404', async () => {
      temporalClient.resolveCondition.mockRejectedValue(
        new WorkflowNotFoundError(
          'not found',
          `case-conditions-${CASE_ID}`,
          undefined,
        ),
      );

      await expect(service.resolveCondition(CASE_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
