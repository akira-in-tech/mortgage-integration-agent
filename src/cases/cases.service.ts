import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WorkflowNotFoundError } from '@temporalio/client';
import { LoanCase, CaseStatus } from '../database/entities/loan-case.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import { TemporalClientService } from '../workflows/temporal-client.service';
import { writeOutboxEvent } from '../database/outbox/outbox-writer';
import { OutboxEventType } from '../database/outbox/outbox-event-types';
import { CreateCaseDto } from './dto/create-case.dto';
import { ReviewDto } from './dto/review.dto';
import { CaseTimelineService, TimelineEntry } from './case-timeline.service';

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
    @InjectRepository(Jurisdiction)
    private readonly jurisdictionRepository: Repository<Jurisdiction>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly temporalClient: TemporalClientService,
    private readonly configService: ConfigService,
    private readonly caseTimelineService: CaseTimelineService,
  ) {}

  /**
   * Idempotent on (tenantId, idempotencyKey): a retried request with the
   * same key returns the original case instead of creating a second one,
   * whether the original request already committed (checked up front) or
   * is committing concurrently (the unique-constraint race caught below).
   * The case row and its `loan_case.created` outbox event are written in
   * one transaction (Section 9.5: "COMMIT STATE AND OUTBOX EVENT").
   */
  async createCase(
    idempotencyKey: string,
    dto: CreateCaseDto,
  ): Promise<LoanCase> {
    const tenant = await this.tenantRepository.findOneBy({ id: dto.tenantId });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${dto.tenantId} not found`);
    }

    const jurisdiction = await this.jurisdictionRepository.findOneBy({
      code: dto.jurisdictionCode,
    });
    if (!jurisdiction) {
      throw new NotFoundException(
        `Jurisdiction ${dto.jurisdictionCode} not found`,
      );
    }

    const existing = await this.caseRepository.findOneBy({
      tenantId: dto.tenantId,
      idempotencyKey,
    });
    if (existing) {
      return existing;
    }

    const outboxSigningSecret = this.configService.get<string>(
      'OUTBOX_SIGNING_SECRET',
      'dev-outbox-signing-secret-change-me',
    );

    try {
      return await this.dataSource.transaction(async (manager) => {
        const caseRepo = manager.getRepository(LoanCase);
        const loanCase = await caseRepo.save(
          caseRepo.create({
            tenantId: dto.tenantId,
            idempotencyKey,
            borrowerId: dto.borrowerId,
            requestedAmount: dto.requestedAmount,
            loanType: dto.loanType,
            statedMonthlyIncome: dto.statedMonthlyIncome,
            jurisdictionCode: dto.jurisdictionCode,
            status: CaseStatus.DRAFT,
          }),
        );
        await writeOutboxEvent(manager, outboxSigningSecret, {
          tenantId: dto.tenantId,
          caseId: loanCase.id,
          eventType: OutboxEventType.LoanCaseCreated,
          payload: {
            caseId: loanCase.id,
            borrowerId: dto.borrowerId,
            requestedAmount: dto.requestedAmount,
            loanType: dto.loanType,
            statedMonthlyIncome: dto.statedMonthlyIncome,
            jurisdictionCode: dto.jurisdictionCode,
          },
        });
        return loanCase;
      });
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

  /**
   * `dto.reviewType` picks the signal: `CONDITION_RESOLUTION` resolves
   * the case's open condition; `RESUME_EVALUATION` tells the workflow a
   * reviewer has addressed whatever made policy applicability ambiguous
   * and it should re-run the evaluation (Section 9.5's "interrupt for
   * review", `case-conditions.workflow.ts`'s interrupt/resume loop).
   */
  async submitReview(caseId: string, dto: ReviewDto): Promise<void> {
    await this.getCase(caseId);
    try {
      if (dto.reviewType === 'RESUME_EVALUATION') {
        await this.temporalClient.resumeInterruptedEvaluation(caseId, {
          actorId: dto.actorId,
          note: dto.reason,
        });
      } else {
        await this.temporalClient.resolveCondition(caseId, {
          actorId: dto.actorId,
          resolution: dto.resolution!,
          reason: dto.reason,
        });
      }
    } catch (error) {
      if (error instanceof WorkflowNotFoundError) {
        throw new NotFoundException(`No running workflow for case ${caseId}`);
      }
      throw error;
    }
  }

  /**
   * Section 7.1's launch scenario (step 17) and Section 15.2's target
   * GraphQL "timelines" query — exposed as a plain REST GET here instead,
   * matching this codebase's existing pattern of a narrower REST slice
   * standing in for target surfaces not yet built (no GraphQL case
   * resolvers exist at all yet).
   */
  async getTimeline(caseId: string): Promise<TimelineEntry[]> {
    const loanCase = await this.getCase(caseId);
    return this.caseTimelineService.getTimeline(loanCase.tenantId, caseId);
  }
}
