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

// Same "skip instead of failing" convention as loan.e2e-spec.ts and the
// Temporal workflow/activities suites — this exercises the real REST
// surface (Section 15.1, M2 scope: "REST workflow-start and status
// endpoints") against a real database and a real Temporal server, not
// mocks of either.
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
    let tenantId: string;
    let temporalConnection: Connection;
    let temporalClient: Client;
    const startedWorkflowIds: string[] = [];

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

      const tenant = await tenantRepo.save(
        tenantRepo.create({ name: 'Cases E2E Tenant' }),
      );
      tenantId = tenant.id;

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

      if (tenantId) {
        await caseRepo.delete({ tenantId });
        await tenantRepo.delete({ id: tenantId });
      }
      await app?.close();
    }, 30_000);

    function createCasePayload() {
      return {
        tenantId,
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
        .send(createCasePayload());

      expect(res.status).toBe(400);
    });

    it('creates a DRAFT case and returns it again for a repeated idempotency key', async () => {
      const payload = createCasePayload();
      const idempotencyKey = `e2e-key-${uuidv4()}`;

      const first = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      expect(first.status).toBe(201);
      expect(first.body.status).toBe('DRAFT');
      expect(first.body.borrowerId).toBe(payload.borrowerId);

      const second = await request(app.getHttpServer())
        .post('/v1/loan-cases')
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

    it('returns 404 for an unknown tenant', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
        .send({ ...createCasePayload(), tenantId: uuidv4() });

      expect(res.status).toBe(404);
    });

    it('returns 404 for GET on an unknown case id', async () => {
      const res = await request(app.getHttpServer()).get(
        `/v1/loan-cases/${uuidv4()}`,
      );
      expect(res.status).toBe(404);
    });

    it('GET returns the case that was created', async () => {
      const payload = createCasePayload();
      const created = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
        .send(payload);

      const fetched = await request(app.getHttpServer()).get(
        `/v1/loan-cases/${created.body.id}`,
      );

      expect(fetched.status).toBe(200);
      expect(fetched.body.id).toBe(created.body.id);
    });

    it('starts the workflow idempotently and exposes its status', async () => {
      const payload = createCasePayload();
      const created = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
        .send(payload);
      const caseId = created.body.id;

      const firstStart = await request(app.getHttpServer()).post(
        `/v1/loan-cases/${caseId}/workflow-runs`,
      );
      expect(firstStart.status).toBe(202);
      expect(firstStart.body.workflowId).toBe(`case-conditions-${caseId}`);
      startedWorkflowIds.push(firstStart.body.workflowId);

      // Duplicate start command — must resolve to the same execution, not a
      // second one (same M2 exit evidence as the idempotency-key test above,
      // exercised here at the workflow-start endpoint specifically).
      const secondStart = await request(app.getHttpServer()).post(
        `/v1/loan-cases/${caseId}/workflow-runs`,
      );
      expect(secondStart.status).toBe(202);
      expect(secondStart.body.runId).toBe(firstStart.body.runId);

      const status = await request(app.getHttpServer()).get(
        `/v1/loan-cases/${caseId}/workflow-runs/${firstStart.body.runId}`,
      );
      expect(status.status).toBe(200);
      expect(status.body.workflowId).toBe(`case-conditions-${caseId}`);
      expect(typeof status.body.status).toBe('string');
    }, 30_000);

    it('returns 404 for a workflow run on a case that never started one', async () => {
      const payload = createCasePayload();
      const created = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
        .send(payload);

      const res = await request(app.getHttpServer()).get(
        `/v1/loan-cases/${created.body.id}/workflow-runs/${uuidv4()}`,
      );
      expect(res.status).toBe(404);
    });

    it('accepts a condition resolution for a running workflow', async () => {
      const payload = createCasePayload();
      const created = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
        .send(payload);
      const caseId = created.body.id;

      const start = await request(app.getHttpServer()).post(
        `/v1/loan-cases/${caseId}/workflow-runs`,
      );
      startedWorkflowIds.push(start.body.workflowId);

      // No worker is running in this suite, so the workflow never actually
      // reaches its durable wait — this only proves the signal is accepted
      // and durably delivered by the server, which is exactly what the
      // worker-restart scenario in case-conditions.workflow.spec.ts depends
      // on and already verifies end-to-end with a live worker.
      const res = await request(app.getHttpServer())
        .post(`/v1/loan-cases/${caseId}/reviews`)
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
        .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
        .send(payload);
      const caseId = created.body.id;

      const start = await request(app.getHttpServer()).post(
        `/v1/loan-cases/${caseId}/workflow-runs`,
      );
      startedWorkflowIds.push(start.body.workflowId);

      const res = await request(app.getHttpServer())
        .post(`/v1/loan-cases/${caseId}/reviews`)
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
        .set('Idempotency-Key', `e2e-key-${uuidv4()}`)
        .send(payload);

      const res = await request(app.getHttpServer())
        .post(`/v1/loan-cases/${created.body.id}/reviews`)
        .send({
          reviewType: 'CONDITION_RESOLUTION',
          actorId: 'e2e-reviewer',
          resolution: 'SATISFIED',
        });

      expect(res.status).toBe(404);
    });
  },
);
