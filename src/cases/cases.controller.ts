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
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  CasesService,
  StartWorkflowRunResult,
  WorkflowRunStatus,
} from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { ReviewDto } from './dto/review.dto';
import { ConsentActionDto } from './dto/consent-action.dto';
import { EscalateDto } from './dto/escalate.dto';
import { CheckPolicyChangeImpactDto } from './dto/check-policy-change-impact.dto';
import { LoanCase } from '../database/entities/loan-case.entity';
import { ConsentRecord } from '../database/entities/consent-record.entity';
import { TimelineEntry } from './case-timeline.service';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { RoleGuard } from '../auth/role.guard';
import { RequireRole } from '../auth/require-role.decorator';
import { AuthTenantId } from '../auth/auth-tenant-id.decorator';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { AuthContext } from '../auth/auth-context';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { AuditEventService } from '../audit/audit-event.service';
import { CheckPolicyChangeImpactResult } from '../agent-runtime/tools/check-policy-change-impact.tool';

/**
 * M2 exit-evidence surface (Section 15.1, M2 scope: "REST workflow-start
 * and status endpoints"). Deliberately narrower than the full target
 * `/v1/loan-cases` contract in Section 15.1 — no idempotency-fingerprint
 * middleware or problem-details error format exist yet; those are
 * tracked as known gaps, not silently assumed done. `operationId`s below
 * are set explicitly (Section 15.3: "stable operation identifiers for SDK
 * generation") rather than left to NestJS Swagger's route-derived default,
 * which changes if a route path is ever refactored.
 *
 * `ApiKeyGuard` (Section 20 M5) resolves every request's tenant from its
 * bearer credential, never from a caller-suppliable field — `caseId`
 * lookups additionally verify the found case actually belongs to that
 * tenant (`CasesService` does this, returning 404 rather than a
 * tenant-revealing 403 on a mismatch). `CreateCaseDto` has no `tenantId`
 * field at all for the same reason: there is nothing left for a caller to
 * get right or wrong.
 */
@ApiTags('loan-cases')
@ApiBearerAuth()
@UseGuards(ApiKeyGuard)
@Controller('v1/loan-cases')
export class CasesController {
  constructor(
    private readonly casesService: CasesService,
    private readonly auditEventService: AuditEventService,
  ) {}

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
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid API credentials.',
  })
  @ApiNotFoundResponse({ description: 'jurisdictionCode does not exist.' })
  @Post()
  async create(
    @AuthTenantId() tenantId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateCaseDto,
  ): Promise<LoanCase> {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    return this.casesService.createCase(idempotencyKey.trim(), tenantId, dto);
  }

  @ApiOperation({ operationId: 'getCase', summary: 'Get a loan case by id' })
  @ApiParam({ name: 'caseId', format: 'uuid' })
  @ApiOkResponse({ type: LoanCase })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid API credentials.',
  })
  @ApiNotFoundResponse({
    description: 'No case with this id owned by the authenticated tenant.',
  })
  @Get(':caseId')
  async get(
    @AuthTenantId() tenantId: string,
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ): Promise<LoanCase> {
    return this.casesService.getCase(tenantId, caseId);
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
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid API credentials.',
  })
  @ApiNotFoundResponse({
    description: 'No case with this id owned by the authenticated tenant.',
  })
  @Get(':caseId/timeline')
  async getTimeline(
    @AuthTenantId() tenantId: string,
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ): Promise<TimelineEntry[]> {
    return this.casesService.getTimeline(tenantId, caseId);
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
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid API credentials.',
  })
  @ApiNotFoundResponse({
    description: 'No case with this id owned by the authenticated tenant.',
  })
  @Post(':caseId/workflow-runs')
  @HttpCode(HttpStatus.ACCEPTED)
  async startWorkflow(
    @AuthTenantId() tenantId: string,
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ): Promise<StartWorkflowRunResult> {
    return this.casesService.startWorkflow(tenantId, caseId);
  }

  @ApiOperation({
    operationId: 'getWorkflowRun',
    summary: 'Get the status of one workflow run',
  })
  @ApiParam({ name: 'caseId', format: 'uuid' })
  @ApiParam({ name: 'runId' })
  @ApiOkResponse({ type: WorkflowRunStatus })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid API credentials.',
  })
  @ApiNotFoundResponse({
    description:
      'No case with this id owned by the authenticated tenant, or no such workflow run.',
  })
  @Get(':caseId/workflow-runs/:runId')
  async getWorkflowRun(
    @AuthTenantId() tenantId: string,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Param('runId') runId: string,
  ): Promise<WorkflowRunStatus> {
    return this.casesService.getWorkflowRun(tenantId, caseId, runId);
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
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid API credentials.',
  })
  @ApiNotFoundResponse({
    description:
      'No case with this id owned by the authenticated tenant, or no running workflow for it.',
  })
  @ApiForbiddenResponse({
    description:
      'The authenticated API client does not have the REVIEWER role (Section 6.3, M5-017).',
  })
  @Post(':caseId/reviews')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(RoleGuard)
  @RequireRole(ApiClientRole.REVIEWER)
  async submitReview(
    @CurrentAuth() auth: AuthContext,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: ReviewDto,
  ): Promise<void> {
    await this.casesService.submitReview(auth.tenantId, caseId, dto);
    await this.auditEventService.record({
      tenantId: auth.tenantId,
      actorId: dto.actorId,
      action: `REVIEW_${dto.reviewType}`,
      resourceType: 'loan_case',
      resourceId: caseId,
      correlationId: auth.correlationId,
      reason: dto.reason ?? null,
      metadata: { apiClientId: auth.apiClientId, resolution: dto.resolution },
    });
  }

  // Section 15.1's `POST .../consents` (M5-005). Synchronous, unlike
  // /reviews — a consent action is a plain database write, not a
  // Temporal signal, so the resulting record is returned directly rather
  // than 202-and-poll.
  @ApiOperation({
    operationId: 'submitConsentAction',
    summary: 'Grant or revoke consent for a case',
  })
  @ApiParam({ name: 'caseId', format: 'uuid' })
  @ApiCreatedResponse({ type: ConsentRecord })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid API credentials.',
  })
  @ApiNotFoundResponse({
    description:
      'No case with this id owned by the authenticated tenant, or (REVOKE) no active consent record for it.',
  })
  @Post(':caseId/consents')
  async submitConsentAction(
    @CurrentAuth() auth: AuthContext,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: ConsentActionDto,
  ): Promise<ConsentRecord> {
    const record = await this.casesService.submitConsentAction(
      auth.tenantId,
      caseId,
      dto,
    );
    await this.auditEventService.record({
      tenantId: auth.tenantId,
      actorId: auth.apiClientId,
      action: `CONSENT_${dto.action}`,
      resourceType: 'loan_case',
      resourceId: caseId,
      correlationId: auth.correlationId,
      reason: dto.reason ?? null,
      metadata: { consentRecordId: record.id },
    });
    return record;
  }

  // `escalate_to_reviewer`'s (Section 9.4) first real caller (M5-023) —
  // a human reviewer's own judgment call, since this codebase has no
  // real automatic detector to hand the decision to instead (see that
  // tool's own comment). Open to any authenticated role: escalating only
  // ever adds human scrutiny to a case, never removes it, so it carries
  // none of the approval-bypass risk `submitReview`'s REVIEWER gate
  // exists for.
  @ApiOperation({
    operationId: 'escalateCase',
    summary: 'Pause a case for human review (escalate_to_reviewer)',
  })
  @ApiParam({ name: 'caseId', format: 'uuid' })
  @ApiOkResponse({ description: 'Escalated.' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid API credentials.',
  })
  @ApiNotFoundResponse({
    description: 'No case with this id owned by the authenticated tenant.',
  })
  @ApiConflictResponse({
    description:
      'The case changed since it was last read, or is already at a status escalation cannot apply to (already WAITING_FOR_REVIEW, or a terminal status).',
  })
  @Post(':caseId/escalate')
  @HttpCode(HttpStatus.OK)
  async escalate(
    @CurrentAuth() auth: AuthContext,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: EscalateDto,
  ): Promise<void> {
    await this.casesService.escalate(auth.tenantId, caseId, dto);
    await this.auditEventService.record({
      tenantId: auth.tenantId,
      actorId: dto.actorId,
      action: 'CASE_ESCALATED',
      resourceType: 'loan_case',
      resourceId: caseId,
      correlationId: auth.correlationId,
      reason: dto.reason,
      metadata: { apiClientId: auth.apiClientId },
    });
  }

  // `check_policy_change_impact`'s (Section 9.4) first real caller
  // (M5-023) — an operator's own per-case advisory question, distinct
  // from PolicyActivationService.activate()'s existing automatic
  // catalog-wide scan. Advisory only (the tool's own approval boundary:
  // "cannot change case applicability"), so no RBAC restriction.
  @ApiOperation({
    operationId: 'checkPolicyChangeImpact',
    summary:
      "Check whether a policy version affects this case's own live binding",
  })
  @ApiParam({ name: 'caseId', format: 'uuid' })
  @ApiOkResponse({ description: 'Assessment result (advisory only).' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid API credentials.',
  })
  @ApiNotFoundResponse({
    description: 'No case with this id owned by the authenticated tenant.',
  })
  @Post(':caseId/policy-change-impact')
  @HttpCode(HttpStatus.OK)
  async checkPolicyChangeImpact(
    @AuthTenantId() tenantId: string,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: CheckPolicyChangeImpactDto,
  ): Promise<CheckPolicyChangeImpactResult> {
    return this.casesService.checkPolicyChangeImpact(tenantId, caseId, dto);
  }
}
