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
import { ReviewDto } from './dto/review.dto';
import { LoanCase } from '../database/entities/loan-case.entity';
import { TimelineEntry } from './case-timeline.service';

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

  // Section 7.1's "display the full timeline"; Section 15.2 targets
  // GraphQL for this, but no GraphQL case resolvers exist yet — a plain
  // REST GET stands in, matching this controller's existing pattern.
  @Get(':caseId/timeline')
  async getTimeline(
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ): Promise<TimelineEntry[]> {
    return this.casesService.getTimeline(caseId);
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

  // The reviewer-decision endpoint in Section 15.1 (`POST .../reviews`) —
  // `dto.reviewType` picks which review action a signal encodes: resolving
  // an open condition, or resuming an evaluation the Agent run interrupted
  // for policy-applicability ambiguity. 202: delivers the signal and
  // returns; the workflow applies it asynchronously.
  @Post(':caseId/reviews')
  @HttpCode(HttpStatus.ACCEPTED)
  async submitReview(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: ReviewDto,
  ): Promise<void> {
    await this.casesService.submitReview(caseId, dto);
  }
}
