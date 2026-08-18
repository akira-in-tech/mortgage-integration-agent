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
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  CasesService,
  StartWorkflowRunResult,
  WorkflowRunStatus,
} from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { ReviewDto } from './dto/review.dto';
import { LoanCase } from '../database/entities/loan-case.entity';
import { TimelineEntry } from './case-timeline.service';

/**
 * M2 exit-evidence surface (Section 15.1, M2 scope: "REST workflow-start
 * and status endpoints"). Deliberately narrower than the full target
 * `/v1/loan-cases` contract in Section 15.1 — no auth/idempotency-fingerprint
 * middleware, problem-details error format, or pagination exist yet; those
 * are tracked as known gaps, not silently assumed done. `operationId`s below
 * are set explicitly (Section 15.3: "stable operation identifiers for SDK
 * generation") rather than left to NestJS Swagger's route-derived default,
 * which changes if a route path is ever refactored.
 */
@ApiTags('loan-cases')
@Controller('v1/loan-cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @ApiOperation({
    operationId: 'createCase',
    summary: 'Create a loan case (idempotent on Idempotency-Key)',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'A caller-generated key, unique per case creation attempt. A retried request with the same key returns the original case rather than creating a second one.',
  })
  @ApiCreatedResponse({ type: LoanCase })
  @ApiBadRequestResponse({
    description:
      'Missing Idempotency-Key header, or a request-body validation failure.',
  })
  @ApiNotFoundResponse({
    description: 'tenantId or jurisdictionCode does not exist.',
  })
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

  @ApiOperation({ operationId: 'getCase', summary: 'Get a loan case by id' })
  @ApiParam({ name: 'caseId', format: 'uuid' })
  @ApiOkResponse({ type: LoanCase })
  @ApiNotFoundResponse({ description: 'No case with this id.' })
  @Get(':caseId')
  async get(@Param('caseId', ParseUUIDPipe) caseId: string): Promise<LoanCase> {
    return this.casesService.getCase(caseId);
  }

  // Section 7.1's "display the full timeline"; Section 15.2 targets
  // GraphQL for this, but no GraphQL case resolvers exist yet — a plain
  // REST GET stands in, matching this controller's existing pattern.
  @ApiOperation({
    operationId: 'getCaseTimeline',
    summary: 'Get the chronological event/Agent-run timeline for a case',
  })
  @ApiParam({ name: 'caseId', format: 'uuid' })
  @ApiOkResponse({ type: TimelineEntry, isArray: true })
  @ApiNotFoundResponse({ description: 'No case with this id.' })
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
  @ApiOperation({
    operationId: 'startWorkflowRun',
    summary:
      'Start the case-conditions workflow for a case (idempotent per case)',
  })
  @ApiParam({ name: 'caseId', format: 'uuid' })
  @ApiAcceptedResponse({ type: StartWorkflowRunResult })
  @ApiNotFoundResponse({ description: 'No case with this id.' })
  @Post(':caseId/workflow-runs')
  @HttpCode(HttpStatus.ACCEPTED)
  async startWorkflow(
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ): Promise<StartWorkflowRunResult> {
    return this.casesService.startWorkflow(caseId);
  }

  @ApiOperation({
    operationId: 'getWorkflowRun',
    summary: 'Get the status of one workflow run',
  })
  @ApiParam({ name: 'caseId', format: 'uuid' })
  @ApiParam({ name: 'runId' })
  @ApiOkResponse({ type: WorkflowRunStatus })
  @ApiNotFoundResponse({
    description: 'No case with this id, or no such workflow run.',
  })
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
  @ApiOperation({
    operationId: 'submitReview',
    summary:
      'Submit a reviewer decision (condition resolution or evaluation resume)',
  })
  @ApiParam({ name: 'caseId', format: 'uuid' })
  @ApiAcceptedResponse({
    description: 'Signal delivered; the workflow applies it asynchronously.',
  })
  @ApiNotFoundResponse({
    description: 'No case with this id, or no running workflow for it.',
  })
  @Post(':caseId/reviews')
  @HttpCode(HttpStatus.ACCEPTED)
  async submitReview(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: ReviewDto,
  ): Promise<void> {
    await this.casesService.submitReview(caseId, dto);
  }
}
