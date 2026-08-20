/// <reference types="jest" />
import 'reflect-metadata';
require('dotenv').config();

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Connection, Client } from '@temporalio/client';
import { v4 as uuidv4 } from 'uuid';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Tenant } from '../src/database/entities/tenant.entity';
import { LoanCase } from '../src/database/entities/loan-case.entity';
import { ApiClient } from '../src/database/entities/api-client.entity';
import { ConsentRecord } from '../src/database/entities/consent-record.entity';
import { ApiClientService } from '../src/auth/api-client.service';
import { ApiClientRole } from '../src/database/enums/api-client.enum';

// Same "skip instead of failing" convention as loan.e2e-spec.ts and the
// Temporal workflow/activities suites — this exercises the real REST
// surface (Section 15.1, M2 scope: "REST workflow-start and status
// endpoints"; Section 20 M5's API-client authentication) against a real
// database and a real Temporal server, not mocks of either.
const REQUIRED_VARS = ['DATABASE_URL', 'TEMPORAL_ADDRESS'];
const missingVars = REQUIRED_VARS.filter((v) => !process.env[v]);

if (missingVars.length > 0) {
  console.warn(
    `\n[e2e] Skipping cases.e2e-spec — missing env vars: ${missingVars.join(', ')}\n`,
  );
}

const describeOrSkip = missingVars.length > 0 ? describe.skip : describe;

describeOrSkip(
  'Loan cases — REST workflow-start and status endpoints (e2e)',
  () => {
    let app: INestApplication;
    let tenantRepo: Repository<Tenant>;
    let caseRepo: Repository<LoanCase>;
    let apiClientRepo: Repository<ApiClient>;
    let consentRepo: Repository<ConsentRecord>;
    let apiClientService: ApiClientService;
    let tenantId: string;
    let authHeader: string;
    let otherTenantId: string;
    let otherAuthHeader: string;
    let temporalConnection: Connection;
    let temporalClient: Client;
    const startedWorkflowIds: string[] = [];
    const apiClientIds: string[] = [];

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await app.init();

      tenantRepo = moduleRef.get(getRepositoryToken(Tenant));
      caseRepo = moduleRef.get(getRepositoryToken(LoanCase));
      apiClientRepo = moduleRef.get(getRepositoryToken(ApiClient));
      consentRepo = moduleRef.get(getRepositoryToken(ConsentRecord));
      apiClientService = moduleRef.get(ApiClientService);

      const tenant = await tenantRepo.save(
        tenantRepo.create({ name: 'Cases E2E Tenant' }),
      );
      tenantId = tenant.id;
      const { client, token } = await apiClientService.create({
        tenantId,
        name: 'cases-e2e-client',
        // This suite submits reviews via the same shared client used for
        // everything else — REVIEWER role (M5-017), not the PARTNER
        // default, or every submitReview call below would now 403.
        role: ApiClientRole.REVIEWER,
      });
      apiClientIds.push(client.id);
      authHeader = `Bearer ${token}`;

      const otherTenant = await tenantRepo.save(
        tenantRepo.create({ name: 'Cases E2E Other Tenant' }),
      );
      otherTenantId = otherTenant.id;
      const otherCreated = await apiClientService.create({
        tenantId: otherTenantId,
        name: 'cases-e2e-other-client',
        // REVIEWER (M5-017), same as the primary client above: this
        // credential's whole purpose is proving cross-*tenant* isolation
        // on every endpoint including /reviews — giving it anything less
        // than REVIEWER would make that specific check 403 on role
        // grounds before ever reaching the tenant-ownership check the
        // test is actually about.
        role: ApiClientRole.REVIEWER,
      });
      apiClientIds.push(otherCreated.client.id);
      otherAuthHeader = `Bearer ${otherCreated.token}`;

      // Independent of TemporalClientService: used only to terminate
      // whatever workflows this suite starts, so a real (possibly shared)
      // Temporal server is not left with indefinitely-RUNNING orphans —
      // nothing in this suite runs a worker, so nothing would ever advance
      // them otherwise.
      temporalConnection = await Connection.connect({
        address: process.env.TEMPORAL_ADDRESS,
      });
      temporalClient = new Client({
        connection: temporalConnection,
        namespace: process.env.TEMPORAL_NAMESPACE ?? 'default',
      });
    }, 30_000);

    afterAll(async () => {
      for (const workflowId of startedWorkflowIds) {
        try {
          await temporalClient.workflow
            .getHandle(workflowId)
            .terminate('cases.e2e-spec cleanup');
        } catch {
          // Already completed/terminated — nothing to clean up.
        }
      }
      await temporalConnection?.close();

      if (apiClientIds.length > 0) {
        await apiClientRepo.delete(apiClientIds);
      }
      if (tenantId) {
        await consentRepo.delete({ tenantId });
        await caseRepo.delete({ tenantId });
        await tenantRepo.delete({ id: tenantId });
      }
      if (otherTenantId) {
        await consentRepo.delete({ tenantId: otherTenantId });
        await tenantRepo.delete({ id: otherTenantId });
      }
      await app?.close();
    }, 30_000);

    function createCasePayload() {
      return {
        borrowerId: `e2e-borrower-${uuidv4()}`,
        requestedAmount: 350_000,
        loanType: 'CONVENTIONAL',
        // Matches SeedIncomeDiscrepancyPolicy's seeded jurisdiction/
        // product; equal to the Plaid simulator's typical range so this
        // suite's cases don't incidentally trigger the income-discrepancy
        // condition when a workflow is started against them.
        statedMonthlyIncome: 9000,
        jurisdictionCode: 'US-CA',
      };
    }

    it('rejects case creation with no Idempotency-Key header', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Authorization', authHeader)
        .send(createCasePayload());

      expect(res.status).toBe(400);
    });

    it('rejects every route with no Authorization header', async () => {
      const created = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .send(createCasePayload());
      expect(created.status).toBe(401);

      const fetched = await request(app.getHttpServer()).get(
        `/v1/loan-cases/${uuidv4()}`,
      );
      expect(fetched.status).toBe(401);
    });

    it('rejects a malformed or unknown bearer token', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/loan-cases/${uuidv4()}`)
        .set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(401);
    });

    it('creates a DRAFT case and returns it again for a repeated idempotency key', async () => {
      const payload = createCasePayload();
      const idempotencyKey = `e2e-key-${uuidv4()}`;

      const first = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Authorization', authHeader)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      expect(first.status).toBe(201);
      expect(first.body.status).toBe('DRAFT');
      expect(first.body.tenantId).toBe(tenantId);
      expect(first.body.borrowerId).toBe(payload.borrowerId);

      const second = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Authorization', authHeader)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      // Same domain effect, not a duplicate case (M2 exit evidence: duplicate
      // command produces no duplicate domain effect).
      expect(second.status).toBe(201);
      expect(second.body.id).toBe(first.body.id);

      const rowCount = await caseRepo.count({
        where: { tenantId, idempotencyKey },
      });
      expect(rowCount).toBe(1);
    });

    it('returns 404 for GET on an unknown case id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/loan-cases/${uuidv4()}`)
        .set('Authorization', authHeader);
      expect(res.status).toBe(404);
    });

    it('GET returns the case that was created', async () => {
      const payload = createCasePayload();
      const created = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Authorization', authHeader)
        .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
        .send(payload);

      const fetched = await request(app.getHttpServer())
        .get(`/v1/loan-cases/${created.body.id}`)
        .set('Authorization', authHeader);

      expect(fetched.status).toBe(200);
      expect(fetched.body.id).toBe(created.body.id);
    });

    // Section 20 M5's own exit evidence: "cross-tenant tests fail closed
    // at API... layers." A different tenant's own valid, active credential
    // — not a missing/malformed one — gets the identical 404 an unknown
    // case id gets, never a 403 that would confirm the case exists.
    it("404s for another tenant's real, valid credential on someone else's case", async () => {
      const payload = createCasePayload();
      const created = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Authorization', authHeader)
        .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
        .send(payload);
      expect(created.status).toBe(201);

      const crossTenantGet = await request(app.getHttpServer())
        .get(`/v1/loan-cases/${created.body.id}`)
        .set('Authorization', otherAuthHeader);
      expect(crossTenantGet.status).toBe(404);

      const crossTenantTimeline = await request(app.getHttpServer())
        .get(`/v1/loan-cases/${created.body.id}/timeline`)
        .set('Authorization', otherAuthHeader);
      expect(crossTenantTimeline.status).toBe(404);

      const crossTenantStart = await request(app.getHttpServer())
        .post(`/v1/loan-cases/${created.body.id}/workflow-runs`)
        .set('Authorization', otherAuthHeader);
      expect(crossTenantStart.status).toBe(404);

      const crossTenantReview = await request(app.getHttpServer())
        .post(`/v1/loan-cases/${created.body.id}/reviews`)
        .set('Authorization', otherAuthHeader)
        .send({
          reviewType: 'CONDITION_RESOLUTION',
          actorId: 'cross-tenant-reviewer',
          resolution: 'SATISFIED',
        });
      expect(crossTenantReview.status).toBe(404);

      // The owning tenant's own credential still works on the same case —
      // proves the 404s above are real tenant scoping, not a broken route.
      const ownTenantGet = await request(app.getHttpServer())
        .get(`/v1/loan-cases/${created.body.id}`)
        .set('Authorization', authHeader);
      expect(ownTenantGet.status).toBe(200);
    });

    it('starts the workflow idempotently and exposes its status', async () => {
      const payload = createCasePayload();
      const created = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Authorization', authHeader)
        .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
        .send(payload);
      const caseId = created.body.id;

      const firstStart = await request(app.getHttpServer())
        .post(`/v1/loan-cases/${caseId}/workflow-runs`)
        .set('Authorization', authHeader);
      expect(firstStart.status).toBe(202);
      expect(firstStart.body.workflowId).toBe(`case-conditions-${caseId}`);
      startedWorkflowIds.push(firstStart.body.workflowId);

      // Duplicate start command — must resolve to the same execution, not a
      // second one (same M2 exit evidence as the idempotency-key test above,
      // exercised here at the workflow-start endpoint specifically).
      const secondStart = await request(app.getHttpServer())
        .post(`/v1/loan-cases/${caseId}/workflow-runs`)
        .set('Authorization', authHeader);
      expect(secondStart.status).toBe(202);
      expect(secondStart.body.runId).toBe(firstStart.body.runId);

      const status = await request(app.getHttpServer())
        .get(`/v1/loan-cases/${caseId}/workflow-runs/${firstStart.body.runId}`)
        .set('Authorization', authHeader);
      expect(status.status).toBe(200);
      expect(status.body.workflowId).toBe(`case-conditions-${caseId}`);
      expect(typeof status.body.status).toBe('string');
    }, 30_000);

    it('returns 404 for a workflow run on a case that never started one', async () => {
      const payload = createCasePayload();
      const created = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Authorization', authHeader)
        .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
        .send(payload);

      const res = await request(app.getHttpServer())
        .get(`/v1/loan-cases/${created.body.id}/workflow-runs/${uuidv4()}`)
        .set('Authorization', authHeader);
      expect(res.status).toBe(404);
    });

    it('accepts a condition resolution for a running workflow', async () => {
      const payload = createCasePayload();
      const created = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Authorization', authHeader)
        .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
        .send(payload);
      const caseId = created.body.id;

      const start = await request(app.getHttpServer())
        .post(`/v1/loan-cases/${caseId}/workflow-runs`)
        .set('Authorization', authHeader);
      startedWorkflowIds.push(start.body.workflowId);

      // No worker is running in this suite, so the workflow never actually
      // reaches its durable wait — this only proves the signal is accepted
      // and durably delivered by the server, which is exactly what the
      // worker-restart scenario in case-conditions.workflow.spec.ts depends
      // on and already verifies end-to-end with a live worker.
      const res = await request(app.getHttpServer())
        .post(`/v1/loan-cases/${caseId}/reviews`)
        .set('Authorization', authHeader)
        .send({
          reviewType: 'CONDITION_RESOLUTION',
          actorId: 'e2e-reviewer',
          resolution: 'SATISFIED',
        });

      expect(res.status).toBe(202);
    }, 30_000);

    it('accepts a RESUME_EVALUATION review for a running workflow', async () => {
      const payload = createCasePayload();
      const created = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Authorization', authHeader)
        .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
        .send(payload);
      const caseId = created.body.id;

      const start = await request(app.getHttpServer())
        .post(`/v1/loan-cases/${caseId}/workflow-runs`)
        .set('Authorization', authHeader);
      startedWorkflowIds.push(start.body.workflowId);

      const res = await request(app.getHttpServer())
        .post(`/v1/loan-cases/${caseId}/reviews`)
        .set('Authorization', authHeader)
        .send({
          reviewType: 'RESUME_EVALUATION',
          actorId: 'e2e-reviewer',
          reason: 'coverage activated',
        });

      expect(res.status).toBe(202);
    }, 30_000);

    it('returns 404 resolving a condition for a case with no workflow run', async () => {
      const payload = createCasePayload();
      const created = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Authorization', authHeader)
        .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
        .send(payload);

      const res = await request(app.getHttpServer())
        .post(`/v1/loan-cases/${created.body.id}/reviews`)
        .set('Authorization', authHeader)
        .send({
          reviewType: 'CONDITION_RESOLUTION',
          actorId: 'e2e-reviewer',
          resolution: 'SATISFIED',
        });

      expect(res.status).toBe(404);
    });

    it('rejects a review submitted by a PARTNER-role client with 403 (M5-017 RBAC)', async () => {
      const { client: partnerClient, token: partnerToken } =
        await apiClientService.create({
          tenantId,
          name: 'cases-e2e-partner-client',
          role: ApiClientRole.PARTNER,
        });
      apiClientIds.push(partnerClient.id);
      const partnerAuthHeader = `Bearer ${partnerToken}`;

      const payload = createCasePayload();
      const created = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Authorization', partnerAuthHeader)
        .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
        .send(payload);
      const caseId = created.body.id;

      const start = await request(app.getHttpServer())
        .post(`/v1/loan-cases/${caseId}/workflow-runs`)
        .set('Authorization', partnerAuthHeader);
      startedWorkflowIds.push(start.body.workflowId);

      const res = await request(app.getHttpServer())
        .post(`/v1/loan-cases/${caseId}/reviews`)
        .set('Authorization', partnerAuthHeader)
        .send({
          reviewType: 'CONDITION_RESOLUTION',
          actorId: 'e2e-partner-attempting-review',
          resolution: 'SATISFIED',
        });

      expect(res.status).toBe(403);

      // The same case, same review, through the REVIEWER-role client this
      // whole suite otherwise uses — proves the 403 above was genuinely
      // role-gated, not an unrelated failure the PARTNER client happened
      // to hit for some other reason.
      const reviewerRes = await request(app.getHttpServer())
        .post(`/v1/loan-cases/${caseId}/reviews`)
        .set('Authorization', authHeader)
        .send({
          reviewType: 'CONDITION_RESOLUTION',
          actorId: 'e2e-reviewer',
          resolution: 'SATISFIED',
        });
      expect(reviewerRes.status).toBe(202);
    }, 30_000);

    // Section 15.1's POST .../consents (M5-005).
    it('a new case gets an implicit GRANTED consent record automatically', async () => {
      const payload = createCasePayload();
      const created = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Authorization', authHeader)
        .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
        .send(payload);
      expect(created.status).toBe(201);

      const record = await consentRepo.findOneByOrFail({
        caseId: created.body.id,
      });
      expect(record.tenantId).toBe(tenantId);
      expect(record.revokedAt).toBeNull();
    });

    it('REVOKE marks the active consent record revoked with the given reason', async () => {
      const payload = createCasePayload();
      const created = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Authorization', authHeader)
        .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
        .send(payload);
      const caseId = created.body.id;

      const res = await request(app.getHttpServer())
        .post(`/v1/loan-cases/${caseId}/consents`)
        .set('Authorization', authHeader)
        .send({ action: 'REVOKE', reason: 'e2e borrower withdrew' });

      expect(res.status).toBe(201);
      expect(res.body.revokedAt).not.toBeNull();
      expect(res.body.revocationReason).toBe('e2e borrower withdrew');

      const record = await consentRepo.findOneByOrFail({ id: res.body.id });
      expect(record.revokedAt).not.toBeNull();
    });

    it('GRANT after a REVOKE creates a fresh active consent record', async () => {
      const payload = createCasePayload();
      const created = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Authorization', authHeader)
        .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
        .send(payload);
      const caseId = created.body.id;

      await request(app.getHttpServer())
        .post(`/v1/loan-cases/${caseId}/consents`)
        .set('Authorization', authHeader)
        .send({ action: 'REVOKE' });

      const res = await request(app.getHttpServer())
        .post(`/v1/loan-cases/${caseId}/consents`)
        .set('Authorization', authHeader)
        .send({ action: 'GRANT' });

      expect(res.status).toBe(201);
      expect(res.body.revokedAt).toBeNull();
    });

    it("404s for another tenant's real, valid credential revoking someone else's case consent", async () => {
      const payload = createCasePayload();
      const created = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Authorization', authHeader)
        .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
        .send(payload);

      const crossTenantRevoke = await request(app.getHttpServer())
        .post(`/v1/loan-cases/${created.body.id}/consents`)
        .set('Authorization', otherAuthHeader)
        .send({ action: 'REVOKE' });
      expect(crossTenantRevoke.status).toBe(404);

      // The real record is untouched.
      const record = await consentRepo.findOneByOrFail({
        caseId: created.body.id,
      });
      expect(record.revokedAt).toBeNull();
    });

    describe('escalate — escalate_to_reviewer real REST caller (M5-023)', () => {
      it('pauses a freshly created case for review', async () => {
        const created = await request(app.getHttpServer())
          .post('/v1/loan-cases')
          .set('Authorization', authHeader)
          .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
          .send(createCasePayload());
        const caseId = created.body.id;

        const res = await request(app.getHttpServer())
          .post(`/v1/loan-cases/${caseId}/escalate`)
          .set('Authorization', authHeader)
          .send({ actorId: 'e2e-reviewer', reason: 'suspicious pattern' });

        expect(res.status).toBe(200);
        const loanCase = await caseRepo.findOneByOrFail({ id: caseId });
        expect(loanCase.status).toBe('WAITING_FOR_REVIEW');
      });

      it('409s escalating a case that is already WAITING_FOR_REVIEW', async () => {
        const created = await request(app.getHttpServer())
          .post('/v1/loan-cases')
          .set('Authorization', authHeader)
          .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
          .send(createCasePayload());
        const caseId = created.body.id;

        await request(app.getHttpServer())
          .post(`/v1/loan-cases/${caseId}/escalate`)
          .set('Authorization', authHeader)
          .send({ actorId: 'e2e-reviewer', reason: 'first escalation' });

        const res = await request(app.getHttpServer())
          .post(`/v1/loan-cases/${caseId}/escalate`)
          .set('Authorization', authHeader)
          .send({ actorId: 'e2e-reviewer', reason: 'second escalation' });

        expect(res.status).toBe(409);
      });

      it("404s for another tenant's real, valid credential escalating someone else's case", async () => {
        const created = await request(app.getHttpServer())
          .post('/v1/loan-cases')
          .set('Authorization', authHeader)
          .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
          .send(createCasePayload());

        const res = await request(app.getHttpServer())
          .post(`/v1/loan-cases/${created.body.id}/escalate`)
          .set('Authorization', otherAuthHeader)
          .send({ actorId: 'e2e-other-reviewer', reason: 'irrelevant' });

        expect(res.status).toBe(404);
        const loanCase = await caseRepo.findOneByOrFail({
          id: created.body.id,
        });
        expect(loanCase.status).not.toBe('WAITING_FOR_REVIEW');
      });
    });

    describe('policy-change-impact — check_policy_change_impact real REST caller (M5-023)', () => {
      it('reports assessed:false for a case that has never been evaluated (no live binding yet)', async () => {
        const created = await request(app.getHttpServer())
          .post('/v1/loan-cases')
          .set('Authorization', authHeader)
          .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
          .send(createCasePayload());
        const caseId = created.body.id;

        const res = await request(app.getHttpServer())
          .post(`/v1/loan-cases/${caseId}/policy-change-impact`)
          .set('Authorization', authHeader)
          .send({ policyVersionId: uuidv4() });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          assessed: false,
          reason: 'case has no live policy binding to compare against',
        });
      });

      it('rejects a non-UUID policyVersionId with 400', async () => {
        const created = await request(app.getHttpServer())
          .post('/v1/loan-cases')
          .set('Authorization', authHeader)
          .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
          .send(createCasePayload());
        const caseId = created.body.id;

        const res = await request(app.getHttpServer())
          .post(`/v1/loan-cases/${caseId}/policy-change-impact`)
          .set('Authorization', authHeader)
          .send({ policyVersionId: 'not-a-uuid' });

        expect(res.status).toBe(400);
      });

      it("404s for another tenant's real, valid credential checking someone else's case", async () => {
        const created = await request(app.getHttpServer())
          .post('/v1/loan-cases')
          .set('Authorization', authHeader)
          .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
          .send(createCasePayload());

        const res = await request(app.getHttpServer())
          .post(`/v1/loan-cases/${created.body.id}/policy-change-impact`)
          .set('Authorization', otherAuthHeader)
          .send({ policyVersionId: uuidv4() });

        expect(res.status).toBe(404);
      });
    });
  },
);
