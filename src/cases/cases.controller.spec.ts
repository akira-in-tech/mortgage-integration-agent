import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { CasesController } from './cases.controller';
import { LoanType } from '../database/enums/loan-type.enum';
import { CreateCaseDto } from './dto/create-case.dto';

describe('CasesController', () => {
  let casesService: {
    createCase: jest.Mock;
    getCase: jest.Mock;
    startWorkflow: jest.Mock;
    getWorkflowRun: jest.Mock;
    submitReview: jest.Mock;
    getTimeline: jest.Mock;
  };
  let controller: CasesController;

  const TENANT_ID = '11111111-1111-1111-1111-111111111111';

  // No tenantId — Section 20 M5: the request body never carries a tenant
  // field to get right or wrong; ApiKeyGuard/AuthTenantId() supplies it.
  const dto: CreateCaseDto = {
    borrowerId: 'borrower-1',
    requestedAmount: 300_000,
    loanType: LoanType.CONVENTIONAL,
    statedMonthlyIncome: 9000,
    jurisdictionCode: 'US-CA',
  };

  beforeEach(() => {
    casesService = {
      createCase: jest.fn(),
      getCase: jest.fn(),
      startWorkflow: jest.fn(),
      getWorkflowRun: jest.fn(),
      submitReview: jest.fn(),
      getTimeline: jest.fn(),
    };
    controller = new CasesController(casesService as never);
  });

  describe('create', () => {
    it('rejects a request with no Idempotency-Key header', async () => {
      await expect(
        controller.create(TENANT_ID, undefined, dto),
      ).rejects.toThrow(BadRequestException);
      expect(casesService.createCase).not.toHaveBeenCalled();
    });

    it('rejects a request with a blank Idempotency-Key header', async () => {
      await expect(controller.create(TENANT_ID, '   ', dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(casesService.createCase).not.toHaveBeenCalled();
    });

    it('trims the header and delegates to CasesService with the authenticated tenantId', async () => {
      casesService.createCase.mockResolvedValue({ id: 'case-1' });

      await controller.create(TENANT_ID, '  key-1  ', dto);

      expect(casesService.createCase).toHaveBeenCalledWith(
        'key-1',
        TENANT_ID,
        dto,
      );
    });
  });

  describe('other routes', () => {
    it('get delegates to CasesService.getCase with the authenticated tenantId', async () => {
      casesService.getCase.mockResolvedValue({ id: 'case-1' });
      await controller.get(TENANT_ID, 'case-1');
      expect(casesService.getCase).toHaveBeenCalledWith(TENANT_ID, 'case-1');
    });

    it('startWorkflow delegates to CasesService.startWorkflow with the authenticated tenantId', async () => {
      casesService.startWorkflow.mockResolvedValue({
        workflowId: 'wf-1',
        runId: 'run-1',
      });
      await controller.startWorkflow(TENANT_ID, 'case-1');
      expect(casesService.startWorkflow).toHaveBeenCalledWith(
        TENANT_ID,
        'case-1',
      );
    });

    it('getWorkflowRun delegates to CasesService.getWorkflowRun with the authenticated tenantId', async () => {
      casesService.getWorkflowRun.mockResolvedValue({ status: 'RUNNING' });
      await controller.getWorkflowRun(TENANT_ID, 'case-1', 'run-1');
      expect(casesService.getWorkflowRun).toHaveBeenCalledWith(
        TENANT_ID,
        'case-1',
        'run-1',
      );
    });

    it('submitReview delegates to CasesService.submitReview with the authenticated tenantId', async () => {
      const reviewDto = {
        reviewType: 'CONDITION_RESOLUTION' as const,
        actorId: 'reviewer-1',
        resolution: 'SATISFIED' as const,
      };
      await controller.submitReview(TENANT_ID, 'case-1', reviewDto);
      expect(casesService.submitReview).toHaveBeenCalledWith(
        TENANT_ID,
        'case-1',
        reviewDto,
      );
    });

    it('getTimeline delegates to CasesService.getTimeline with the authenticated tenantId', async () => {
      const entries = [
        {
          timestamp: '2026-01-01T00:00:00.000Z',
          kind: 'DOMAIN_EVENT',
          summary: 'x',
          detail: {},
        },
      ];
      casesService.getTimeline.mockResolvedValue(entries);
      const result = await controller.getTimeline(TENANT_ID, 'case-1');
      expect(casesService.getTimeline).toHaveBeenCalledWith(
        TENANT_ID,
        'case-1',
      );
      expect(result).toBe(entries);
    });
  });
});
