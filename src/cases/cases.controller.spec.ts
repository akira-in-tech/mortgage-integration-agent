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
    resolveCondition: jest.Mock;
  };
  let controller: CasesController;

  const dto: CreateCaseDto = {
    tenantId: '11111111-1111-1111-1111-111111111111',
    borrowerId: 'borrower-1',
    requestedAmount: 300_000,
    loanType: LoanType.CONVENTIONAL,
  };

  beforeEach(() => {
    casesService = {
      createCase: jest.fn(),
      getCase: jest.fn(),
      startWorkflow: jest.fn(),
      getWorkflowRun: jest.fn(),
      resolveCondition: jest.fn(),
    };
    controller = new CasesController(casesService as never);
  });

  describe('create', () => {
    it('rejects a request with no Idempotency-Key header', async () => {
      await expect(controller.create(undefined, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(casesService.createCase).not.toHaveBeenCalled();
    });

    it('rejects a request with a blank Idempotency-Key header', async () => {
      await expect(controller.create('   ', dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(casesService.createCase).not.toHaveBeenCalled();
    });

    it('trims the header and delegates to CasesService', async () => {
      casesService.createCase.mockResolvedValue({ id: 'case-1' });

      await controller.create('  key-1  ', dto);

      expect(casesService.createCase).toHaveBeenCalledWith('key-1', dto);
    });
  });

  describe('other routes', () => {
    it('get delegates to CasesService.getCase', async () => {
      casesService.getCase.mockResolvedValue({ id: 'case-1' });
      await controller.get('case-1');
      expect(casesService.getCase).toHaveBeenCalledWith('case-1');
    });

    it('startWorkflow delegates to CasesService.startWorkflow', async () => {
      casesService.startWorkflow.mockResolvedValue({
        workflowId: 'wf-1',
        runId: 'run-1',
      });
      await controller.startWorkflow('case-1');
      expect(casesService.startWorkflow).toHaveBeenCalledWith('case-1');
    });

    it('getWorkflowRun delegates to CasesService.getWorkflowRun', async () => {
      casesService.getWorkflowRun.mockResolvedValue({ status: 'RUNNING' });
      await controller.getWorkflowRun('case-1', 'run-1');
      expect(casesService.getWorkflowRun).toHaveBeenCalledWith(
        'case-1',
        'run-1',
      );
    });

    it('resolveCondition delegates to CasesService.resolveCondition', async () => {
      const resolveDto = {
        actorId: 'reviewer-1',
        resolution: 'SATISFIED' as const,
      };
      await controller.resolveCondition('case-1', resolveDto);
      expect(casesService.resolveCondition).toHaveBeenCalledWith(
        'case-1',
        resolveDto,
      );
    });
  });
});
