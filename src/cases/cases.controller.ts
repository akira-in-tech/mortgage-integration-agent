import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CasesService, WorkflowRunStatus } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { ResolveConditionDto } from './dto/resolve-condition.dto';
import { LoanCase } from '../database/entities/loan-case.entity';

/**
 * M2 exit-evidence surface (Section 15.1, M2 scope: "REST workflow-start
 * and status endpoints"). Deliberately narrower than the full target
 * `/v1/loan-cases` contract in Section 15.1 — no auth/idempotency-fingerprint
 * middleware, problem-details error format, or pagination exist yet; those
 * are tracked as known gaps, not silently assumed done.
 */
@Controller('v1/loan-cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Post()
  async create(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateCaseDto,
  ): Promise<LoanCase> {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    return this.casesService.createCase(idempotencyKey.trim(), dto);
  }

  @Get(':caseId')
  async get(@Param('caseId', ParseUUIDPipe) caseId: string): Promise<LoanCase> {
    return this.casesService.getCase(caseId);
  }

  // 202: starting the workflow only enqueues durable execution — the case
  // is not yet in its post-workflow state when this responds (Section
  // 15.1: "long-running commands return 202 Accepted with stable status
  // URLs"), matching GET .../workflow-runs/{runId} below.
  @Post(':caseId/workflow-runs')
  @HttpCode(HttpStatus.ACCEPTED)
  async startWorkflow(
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ): Promise<{ workflowId: string; runId: string }> {
    return this.casesService.startWorkflow(caseId);
  }

  @Get(':caseId/workflow-runs/:runId')
  async getWorkflowRun(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Param('runId') runId: string,
  ): Promise<WorkflowRunStatus> {
    return this.casesService.getWorkflowRun(caseId, runId);
  }

  // Maps to the reviewer-decision endpoint in Section 15.1
  // (`POST .../reviews`) — resolving an open condition is this slice's
  // only implemented review action. 202: delivers the signal and returns;
  // the workflow applies it asynchronously.
  @Post(':caseId/reviews')
  @HttpCode(HttpStatus.ACCEPTED)
  async resolveCondition(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: ResolveConditionDto,
  ): Promise<void> {
    await this.casesService.resolveCondition(caseId, dto);
  }
}
