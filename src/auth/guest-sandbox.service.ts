import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { CookieOptions, Request, Response } from 'express';
import { DataSource, EntityManager, LessThan, Repository } from 'typeorm';
import { AuthContext } from './auth-context';
import { GuestSandboxSession } from '../database/entities/guest-sandbox-session.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { LoanCase, CaseStatus } from '../database/entities/loan-case.entity';
import { ConsentRecord } from '../database/entities/consent-record.entity';
import { LoanType } from '../database/enums/loan-type.enum';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { NodeEnvironment } from '../config/env.validation';
import { readCookie } from './http-cookie';
import { purgeTenantData } from '../database/purge-tenant-data';
import { CreateGuestSandboxSessionDto } from './dto/create-guest-sandbox-session.dto';

export const GUEST_SANDBOX_COOKIE = 'meridian_guest_sandbox';
export const GUEST_SANDBOX_CSRF_COOKIE = 'meridian_guest_sandbox_csrf';

export interface GuestSandboxSummary {
  authenticated: boolean;
  tenantId?: string;
  actorId?: string;
  csrfToken?: string;
  expiresAt?: string;
  caseId?: string;
}

/**
 * Creates the public portfolio's disposable workspace. All values are
 * synthetic and the tenant id is generated server-side; a browser can resume
 * only its own opaque session and never nominate another visitor's tenant.
 * A caller may optionally supply `requestedAmount`/`statedMonthlyIncome`
 * (M7-071) — bounded, validated hypothetical-scenario numbers, never a
 * route to real borrower data — so the same real evaluation responds to a
 * visitor's own input instead of always producing the identical seeded
 * outcome.
 *
 * `purgeExpiredSessions()` (M7-055) closes a real, previously-undisclosed
 * gap: the session row's own TTL was enforced, but the tenant/case/consent
 * rows a session's guided tour created were never deleted — every visit to
 * this public, unauthenticated endpoint permanently grew real staging RDS,
 * forever. Called from two places: opportunistically at the top of
 * `create()` (this service's own original cleanup point, kept as a
 * fallback for any environment not running the worker process), and on a
 * real interval from `worker.ts` (`GUEST_SANDBOX_CLEANUP_INTERVAL_MS`) —
 * the same "plain interval, not a Temporal workflow" pattern
 * `WebhookDispatchService`/`ProviderReconciliationService` already
 * established, so cleanup doesn't depend on traffic volume to keep up.
 */
@Injectable()
export class GuestSandboxService {
  private readonly secureCookies: boolean;

  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(GuestSandboxSession)
    private readonly sessionRepository: Repository<GuestSandboxSession>,
  ) {
    const environment = configService.get<NodeEnvironment>(
      'NODE_ENV',
      NodeEnvironment.Development,
    );
    this.secureCookies =
      environment === NodeEnvironment.Staging ||
      environment === NodeEnvironment.Production;
  }

  async create(
    response: Response,
    scenario?: CreateGuestSandboxSessionDto,
  ): Promise<GuestSandboxSummary> {
    await this.purgeExpiredSessions();
    const actorId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() +
        this.configService.get<number>('GUEST_SANDBOX_TTL_SECONDS', 3600) *
          1000,
    );
    const sessionToken = this.randomToken();
    const csrfToken = this.randomToken();
    const { tenant, seededCase } = await this.dataSource.transaction(
      async (manager) => {
        const tenantRepository = manager.getRepository(Tenant);
        const tenant = await tenantRepository.save(
          tenantRepository.create({
            name: `Portfolio sandbox ${randomUUID().slice(0, 8)}`,
          }),
        );
        // Tenant-scoped rows and the corresponding opaque session commit as
        // one unit. A failed seed cannot leave a reachable empty workspace.
        await manager.query(
          `SELECT set_config('app.current_tenant_id', $1, true)`,
          [tenant.id],
        );
        const seededCase = await this.seedCase(manager, tenant.id, scenario);
        const sessionRepository = manager.getRepository(GuestSandboxSession);
        await sessionRepository.save(
          sessionRepository.create({
            sessionTokenHash: this.hash(sessionToken),
            csrfTokenHash: this.hash(csrfToken),
            tenantId: tenant.id,
            actorId,
            expiresAt,
            lastUsedAt: now,
          }),
        );
        return { tenant, seededCase };
      },
    );
    this.setCookies(response, sessionToken, csrfToken, expiresAt);
    return {
      authenticated: true,
      tenantId: tenant.id,
      actorId,
      csrfToken,
      expiresAt: expiresAt.toISOString(),
      caseId: seededCase.id,
    };
  }

  async getSession(
    request: Request,
    response: Response,
  ): Promise<GuestSandboxSummary> {
    try {
      const { session, csrfToken } = await this.resolve(
        request,
        response,
        false,
      );
      return {
        authenticated: true,
        tenantId: session.tenantId,
        actorId: session.actorId,
        csrfToken,
        expiresAt: session.expiresAt.toISOString(),
      };
    } catch (error) {
      if (!(error instanceof UnauthorizedException)) throw error;
      return { authenticated: false };
    }
  }

  async authenticate(
    request: Request,
    response: Response,
    requireCsrf: boolean,
  ): Promise<AuthContext> {
    const { session } = await this.resolve(request, response, requireCsrf);
    return {
      tenantId: session.tenantId,
      actorId: session.actorId,
      // The sandbox is intentionally able to demonstrate reviewer decisions,
      // but only against its new synthetic tenant and simulator-only paths.
      role: ApiClientRole.REVIEWER,
      correlationId: randomUUID(),
    };
  }

  async logout(request: Request, response: Response): Promise<void> {
    const { session } = await this.resolve(request, response, true);
    await this.sessionRepository.delete({ id: session.id });
    this.clearCookies(response);
  }

  /**
   * Adds one more synthetic case to the caller's own existing sandbox
   * tenant (M7-074) — the guided walkthrough otherwise only ever seeds
   * exactly one case per visit, so trying a second scenario meant
   * abandoning the current session and starting over. Requires the same
   * cookie + CSRF pair every other sandbox mutation does; never creates a
   * new tenant or session, only a new case (and its paired consent
   * record) inside the tenant the caller already authenticated as.
   */
  async createAdditionalCase(
    request: Request,
    response: Response,
    scenario: CreateGuestSandboxSessionDto,
  ): Promise<{ caseId: string }> {
    const { tenantId } = await this.authenticate(request, response, true);
    const loanCase = await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `SELECT set_config('app.current_tenant_id', $1, true)`,
        [tenantId],
      );
      return this.seedCase(manager, tenantId, scenario);
    });
    return { caseId: loanCase.id };
  }

  /**
   * Every expired session's real tenant/case/evidence/condition/consent
   * footprint — everything the guided tour could have created — is
   * genuinely deleted here, not just the session row that used to be the
   * only thing this cleared. Each expired tenant is purged (and its own
   * session row removed) as an independent unit: one slow or failing purge
   * must not block every other expired session from being cleaned up.
   * Returns the number of tenants actually purged, for the worker's own
   * tick logging.
   */
  async purgeExpiredSessions(): Promise<number> {
    const expired = await this.sessionRepository.find({
      where: { expiresAt: LessThan(new Date()) },
      select: ['id', 'tenantId'],
    });
    let purged = 0;
    for (const session of expired) {
      await purgeTenantData(this.dataSource, session.tenantId);
      await this.sessionRepository.delete({ id: session.id });
      purged += 1;
    }
    return purged;
  }

  private async seedCase(
    manager: EntityManager,
    tenantId: string,
    scenario?: CreateGuestSandboxSessionDto,
  ): Promise<LoanCase> {
    const caseRepository = manager.getRepository(LoanCase);
    const loanCase = await caseRepository.save(
      caseRepository.create({
        tenantId,
        idempotencyKey: `portfolio-sandbox-${randomUUID()}`,
        borrowerId: `synthetic-borrower-${randomUUID().slice(0, 8)}`,
        requestedAmount: scenario?.requestedAmount ?? 425000,
        loanType: LoanType.CONVENTIONAL,
        // The default (no scenario supplied) is a deliberate mismatch that
        // routes the seeded policy pack to a visible income-review
        // condition after workflow start -- the guided walkthrough's own
        // documented behavior. A visitor-supplied statedMonthlyIncome is
        // real input to the same comparison: it may or may not open a
        // condition, depending on how it compares to the simulator's own
        // deterministically seeded "verified" income for this borrowerId.
        statedMonthlyIncome: scenario?.statedMonthlyIncome ?? 1,
        jurisdictionCode: 'US-CA',
        status: CaseStatus.DRAFT,
      }),
    );
    const consentRepository = manager.getRepository(ConsentRecord);
    await consentRepository.save(
      consentRepository.create({
        tenantId,
        caseId: loanCase.id,
        purpose: 'UNDERWRITING_EVIDENCE',
        scope: 'INCOME,CREDIT,DOCUMENT,ASSET,IDENTITY',
        // The workflow dispatches these exact, case-sensitive capabilities.
        // Keeping the fixture aligned proves consent gates instead of bypassing
        // them for a portfolio visitor.
        permittedPurposes: ['UNDERWRITING_EVIDENCE'],
        permittedDataClasses: [
          'INCOME',
          'CREDIT',
          'DOCUMENT',
          'ASSET',
          'IDENTITY',
        ],
        grantedAt: new Date(),
        expiresAt: null,
        revokedAt: null,
        revocationReason: null,
      }),
    );
    return loanCase;
  }

  private async resolve(
    request: Request,
    response: Response,
    requireCsrf: boolean,
  ): Promise<{ session: GuestSandboxSession; csrfToken: string }> {
    const rawToken = readCookie(request, GUEST_SANDBOX_COOKIE);
    if (!rawToken) throw this.unauthorized();
    const session = await this.sessionRepository.findOneBy({
      sessionTokenHash: this.hash(rawToken),
    });
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      this.clearCookies(response);
      throw this.unauthorized();
    }
    let csrfToken = readCookie(request, GUEST_SANDBOX_CSRF_COOKIE);
    if (!csrfToken || this.hash(csrfToken) !== session.csrfTokenHash) {
      if (requireCsrf) throw this.unauthorized();
      csrfToken = this.randomToken();
      session.csrfTokenHash = this.hash(csrfToken);
      await this.sessionRepository.save(session);
      response.cookie(
        GUEST_SANDBOX_CSRF_COOKIE,
        csrfToken,
        this.csrfCookieOptions(session.expiresAt),
      );
    }
    if (requireCsrf) {
      const header = request.headers['x-csrf-token'];
      if (
        typeof header !== 'string' ||
        !this.safeEqual(header, csrfToken) ||
        this.hash(header) !== session.csrfTokenHash
      ) {
        throw this.unauthorized();
      }
    }
    return { session, csrfToken };
  }

  private setCookies(
    response: Response,
    sessionToken: string,
    csrfToken: string,
    expiresAt: Date,
  ): void {
    response.cookie(GUEST_SANDBOX_COOKIE, sessionToken, {
      ...this.csrfCookieOptions(expiresAt),
      httpOnly: true,
    });
    response.cookie(
      GUEST_SANDBOX_CSRF_COOKIE,
      csrfToken,
      this.csrfCookieOptions(expiresAt),
    );
  }

  private clearCookies(response: Response): void {
    response.clearCookie(GUEST_SANDBOX_COOKIE, this.csrfCookieOptions());
    response.clearCookie(GUEST_SANDBOX_CSRF_COOKIE, this.csrfCookieOptions());
  }

  private csrfCookieOptions(expires?: Date): CookieOptions {
    return {
      httpOnly: false,
      secure: this.secureCookies,
      sameSite: 'lax',
      path: '/',
      ...(expires ? { expires } : {}),
    };
  }

  private randomToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private unauthorized(): UnauthorizedException {
    return new UnauthorizedException('Invalid or missing API credentials');
  }
}
