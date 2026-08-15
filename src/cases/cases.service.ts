import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowNotFoundError } from '@temporalio/client';
import { LoanCase, CaseStatus } from '../database/entities/loan-case.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { TemporalClientService } from '../workflows/temporal-client.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { ResolveConditionDto } from './dto/resolve-condition.dto';

const POSTGRES_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === POSTGRES_UNIQUE_VIOLATION
  );
}

export interface WorkflowRunStatus {
  workflowId: string;
  runId: string;
  status: string;
}

/**
 * REST-facing orchestration (Section 15.1: `/v1/loan-cases`). Owns case
 * creation and the mapping from Temporal's own errors/idempotency behavior
 * to HTTP-appropriate responses; `TemporalClientService` stays a faithful,
 * REST-agnostic wrapper around the Temporal client (Section 12.1's API/
 * worker boundary — this is the API side of it).
 */
@Injectable()
export class CasesService {
  constructor(
    @InjectRepository(LoanCase)
    private readonly caseRepository: Repository<LoanCase>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly temporalClient: TemporalClientService,
  ) {}

  /**
   * Idempotent on (tenantId, idempotencyKey): a retried request with the
   * same key returns the original case instead of creating a second one,
   * whether the original request already committed (checked up front) or
   * is committing concurrently (the unique-constraint race caught below).
   */
  async createCase(
    idempotencyKey: string,
    dto: CreateCaseDto,
  ): Promise<LoanCase> {
    const tenant = await this.tenantRepository.findOneBy({ id: dto.tenantId });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${dto.tenantId} not found`);
    }

    const existing = await this.caseRepository.findOneBy({
      tenantId: dto.tenantId,
      idempotencyKey,
    });
    if (existing) {
      return existing;
    }

    const loanCase = this.caseRepository.create({
      tenantId: dto.tenantId,
      idempotencyKey,
      borrowerId: dto.borrowerId,
      requestedAmount: dto.requestedAmount,
      loanType: dto.loanType,
      status: CaseStatus.DRAFT,
    });

    try {
      return await this.caseRepository.save(loanCase);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return await this.caseRepository.findOneByOrFail({
          tenantId: dto.tenantId,
          idempotencyKey,
        });
      }
      throw error;
    }
  }

  async getCase(caseId: string): Promise<LoanCase> {
    const loanCase = await this.caseRepository.findOneBy({ id: caseId });
    if (!loanCase) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }
    return loanCase;
  }

  async startWorkflow(
    caseId: string,
  ): Promise<{ workflowId: string; runId: string }> {
    const loanCase = await this.getCase(caseId);
    return this.temporalClient.startCaseConditionsWorkflow({
      tenantId: loanCase.tenantId,
      caseId: loanCase.id,
      borrowerId: loanCase.borrowerId,
    });
  }

  async getWorkflowRun(
    caseId: string,
    runId: string,
  ): Promise<WorkflowRunStatus> {
    await this.getCase(caseId);
    try {
      return await this.temporalClient.getWorkflowStatus(caseId, runId);
    } catch (error) {
      if (error instanceof WorkflowNotFoundError) {
        throw new NotFoundException(
          `Workflow run ${runId} not found for case ${caseId}`,
        );
      }
      throw error;
    }
  }

  async resolveCondition(
    caseId: string,
    dto: ResolveConditionDto,
  ): Promise<void> {
    await this.getCase(caseId);
    try {
      await this.temporalClient.resolveCondition(caseId, dto);
    } catch (error) {
      if (error instanceof WorkflowNotFoundError) {
        throw new NotFoundException(`No running workflow for case ${caseId}`);
      }
      throw error;
    }
  }
}
