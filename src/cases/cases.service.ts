import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WorkflowNotFoundError } from '@temporalio/client';
import { ApiProperty } from '@nestjs/swagger';
import { ObjectType, Field } from '@nestjs/graphql';
import { LoanCase, CaseStatus } from '../database/entities/loan-case.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import { TemporalClientService } from '../workflows/temporal-client.service';
import { writeOutboxEvent } from '../database/outbox/outbox-writer';
import { OutboxEventType } from '../database/outbox/outbox-event-types';
import { CreateCaseDto } from './dto/create-case.dto';
import { ReviewDto } from './dto/review.dto';
import { ConsentActionDto } from './dto/consent-action.dto';
import { EscalateDto } from './dto/escalate.dto';
import { CheckPolicyChangeImpactDto } from './dto/check-policy-change-impact.dto';
import { CaseTimelineService, TimelineEntry } from './case-timeline.service';
import { isUniqueViolation } from '../database/postgres-errors';
import { runInTenantContext } from '../database/tenant-context';
import { ConsentService } from '../consent/consent.service';
import { ConsentRecord } from '../database/entities/consent-record.entity';
import { PolicyChangeImpactService } from '../policy/policy-change-impact.service';
import {
  buildToolRegistry,
  invokeTool,
} from '../agent-runtime/agent-tool.types';
import {
  escalateToReviewerTool,
  EscalateToReviewerResult,
} from '../agent-runtime/tools/escalate-to-reviewer.tool';
import {
  checkPolicyChangeImpactTool,
  CheckPolicyChangeImpactResult,
} from '../agent-runtime/tools/check-policy-change-impact.tool';

/** Classes, not interfaces — `CasesController`'s methods return these directly, and `@nestjs/swagger`'s `DocumentBuilder` (main.ts) introspects a controller's return-type class via `@ApiProperty()`, which an interface has no runtime representation to carry. Object literals still satisfy these structurally; no constructor or `implements` clause needed. `@ObjectType()`/`@Field()` (M6-004) reuse the same class as `startWorkflowRun`'s GraphQL mutation return type. */
@ObjectType()
export class StartWorkflowRunResult {
  @ApiProperty()
  @Field()
  workflowId!: string;

  @ApiProperty()
  @Field()
  runId!: string;
}

export class WorkflowRunStatus {
  @ApiProperty()
  workflowId!: string;

  @ApiProperty()
  runId!: string;

  @ApiProperty()
  status!: string;
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
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Jurisdiction)
    private readonly jurisdictionRepository: Repository<Jurisdiction>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly temporalClient: TemporalClientService,
    private readonly configService: ConfigService,
    private readonly caseTimelineService: CaseTimelineService,
    private readonly consentService: ConsentService,
    private readonly policyChangeImpactService: PolicyChangeImpactService,
  ) {}

  private outboxSigningSecret(): string {
    return this.configService.get<string>(
      'OUTBOX_SIGNING_SECRET',
      'dev-outbox-signing-secret-change-me',
    );
  }

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
    tenantId: string,
    dto: CreateCaseDto,
  ): Promise<LoanCase> {
    const tenant = await this.tenantRepository.findOneBy({ id: tenantId });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const jurisdiction = await this.jurisdictionRepository.findOneBy({
      code: dto.jurisdictionCode,
    });
    if (!jurisdiction) {
      throw new NotFoundException(
        `Jurisdiction ${dto.jurisdictionCode} not found`,
      );
    }

    const existing = await runInTenantContext(
      this.dataSource,
      tenantId,
      (manager) =>
        manager.getRepository(LoanCase).findOneBy({ tenantId, idempotencyKey }),
    );
    if (existing) {
      return existing;
    }

    const outboxSigningSecret = this.configService.get<string>(
      'OUTBOX_SIGNING_SECRET',
      'dev-outbox-signing-secret-change-me',
    );

    try {
      const loanCase = await runInTenantContext(
        this.dataSource,
        tenantId,
        async (manager) => {
          const caseRepo = manager.getRepository(LoanCase);
          const created = await caseRepo.save(
            caseRepo.create({
              tenantId,
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
            tenantId,
            caseId: created.id,
            eventType: OutboxEventType.LoanCaseCreated,
            payload: {
              caseId: created.id,
              borrowerId: dto.borrowerId,
              requestedAmount: dto.requestedAmount,
              loanType: dto.loanType,
              statedMonthlyIncome: dto.statedMonthlyIncome,
              jurisdictionCode: dto.jurisdictionCode,
            },
          });
          return created;
        },
      );
      // M5-005: applying for a mortgage is itself the act of consenting
      // to the processing that evaluates it — implicit, real consent
      // from the moment a case exists, not a separate required step
      // that would break case creation for every existing caller.
      // Explicit revocation (submitConsentAction() below) is the new
      // capability; this is what it has something real to revoke.
      await this.consentService.grantForCase(tenantId, loanCase.id);
      return loanCase;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return await runInTenantContext(this.dataSource, tenantId, (manager) =>
          manager
            .getRepository(LoanCase)
            .findOneByOrFail({ tenantId, idempotencyKey }),
        );
      }
      throw error;
    }
  }

  /**
   * Section 20 M5's own exit evidence: "cross-tenant tests fail closed at
   * API... layers." `tenantId` is always the caller's own, resolved by
   * `ApiKeyGuard` from its credentials — a case owned by a different
   * tenant simply doesn't match this query and 404s, the same response a
   * genuinely nonexistent case gets. No separate 403 branch: a 403 would
   * confirm the case exists (just not yours), which is itself a
   * cross-tenant information leak this design avoids by construction.
   */
  async getCase(tenantId: string, caseId: string): Promise<LoanCase> {
    const loanCase = await runInTenantContext(
      this.dataSource,
      tenantId,
      (manager) =>
        manager.getRepository(LoanCase).findOneBy({ id: caseId, tenantId }),
    );
    if (!loanCase) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }
    return loanCase;
  }

  async startWorkflow(
    tenantId: string,
    caseId: string,
  ): Promise<StartWorkflowRunResult> {
    const loanCase = await this.getCase(tenantId, caseId);
    return this.temporalClient.startCaseConditionsWorkflow({
      tenantId: loanCase.tenantId,
      caseId: loanCase.id,
      borrowerId: loanCase.borrowerId,
    });
  }

  async getWorkflowRun(
    tenantId: string,
    caseId: string,
    runId: string,
  ): Promise<WorkflowRunStatus> {
    await this.getCase(tenantId, caseId);
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
  async submitReview(
    tenantId: string,
    caseId: string,
    dto: ReviewDto,
  ): Promise<void> {
    await this.getCase(tenantId, caseId);
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
   * Section 15.1's `POST .../consents` (M5-005). Tenant ownership is
   * checked the same way every other case-scoped method here does
   * (`getCase()` 404s on a cross-tenant or nonexistent case) before
   * either consent action runs.
   */
  async submitConsentAction(
    tenantId: string,
    caseId: string,
    dto: ConsentActionDto,
  ): Promise<ConsentRecord> {
    await this.getCase(tenantId, caseId);
    if (dto.action === 'REVOKE') {
      return this.consentService.revoke(tenantId, caseId, dto.reason);
    }
    return this.consentService.grantForCase(tenantId, caseId);
  }

  /** `GET .../consents` (M5-031) — the case's own full consent history, newest first. */
  async listConsents(
    tenantId: string,
    caseId: string,
  ): Promise<ConsentRecord[]> {
    await this.getCase(tenantId, caseId);
    return this.consentService.listForCase(tenantId, caseId);
  }

  /**
   * `POST .../escalate` (M5-023) — `escalate_to_reviewer`'s (Section 9.4)
   * first real caller: a human reviewer's own judgment call, since this
   * codebase's own honest self-count (`mandatory-review-triggers.ts`)
   * has no real automatic detector to hand this decision to instead (see
   * that tool's own updated comment). Goes through the actual registered
   * tool (`invokeTool`/`buildToolRegistry`), not a raw service call —
   * `escalate_to_reviewer` had no real invocation anywhere in this
   * codebase before this slice, so this is its first one, not a
   * bypass of it.
   */
  async escalate(
    tenantId: string,
    caseId: string,
    dto: EscalateDto,
  ): Promise<void> {
    const loanCase = await this.getCase(tenantId, caseId);
    const registry = buildToolRegistry([
      escalateToReviewerTool({
        dataSource: this.dataSource,
        outboxSigningSecret: this.outboxSigningSecret(),
      }),
    ]);
    const invocation = await invokeTool(
      registry,
      'escalate_to_reviewer',
      { tenantId, caseId },
      { reason: dto.reason, expectedCaseVersion: loanCase.version },
    );
    if (invocation.outcome === 'FAILURE') {
      throw new Error(`escalate_to_reviewer failed: ${invocation.error}`);
    }
    const result = invocation.result as EscalateToReviewerResult;
    if (result.outcome === 'STALE_CASE_VERSION') {
      throw new ConflictException(
        `case ${caseId} changed since it was last read — retry`,
      );
    }
    if (result.outcome === 'INVALID_STATUS') {
      throw new ConflictException(
        `case ${caseId} cannot be escalated from status ${result.currentStatus}`,
      );
    }
  }

  /**
   * `POST .../policy-change-impact` (M5-023) — `check_policy_change_impact`'s
   * (Section 9.4) first real caller: an operator's own per-case advisory
   * question, distinct from `PolicyActivationService.activate()`'s
   * existing automatic catalog-wide scan (see `CheckPolicyChangeImpactDto`'s
   * own comment). Advisory only — `assessed: false` is a legitimate,
   * non-error outcome (no live binding to compare against yet), not
   * mapped to any error status.
   */
  async checkPolicyChangeImpact(
    tenantId: string,
    caseId: string,
    dto: CheckPolicyChangeImpactDto,
  ): Promise<CheckPolicyChangeImpactResult> {
    await this.getCase(tenantId, caseId);
    const registry = buildToolRegistry([
      checkPolicyChangeImpactTool({
        policyChangeImpactService: this.policyChangeImpactService,
      }),
    ]);
    const invocation = await invokeTool(
      registry,
      'check_policy_change_impact',
      { tenantId, caseId },
      { policyVersionId: dto.policyVersionId },
    );
    if (invocation.outcome === 'FAILURE') {
      throw new Error(`check_policy_change_impact failed: ${invocation.error}`);
    }
    return invocation.result as CheckPolicyChangeImpactResult;
  }

  /**
   * Section 7.1's launch scenario (step 17) and Section 15.2's target
   * GraphQL "timelines" query — exposed as a plain REST GET here instead,
   * matching this codebase's existing pattern of a narrower REST slice
   * standing in for target surfaces not yet built (no GraphQL case
   * resolvers exist at all yet).
   */
  async getTimeline(
    tenantId: string,
    caseId: string,
  ): Promise<TimelineEntry[]> {
    const loanCase = await this.getCase(tenantId, caseId);
    return this.caseTimelineService.getTimeline(loanCase.tenantId, caseId);
  }
}
