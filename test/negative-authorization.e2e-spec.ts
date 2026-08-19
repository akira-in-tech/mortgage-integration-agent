/// <reference types="jest" />
import 'reflect-metadata';
require('dotenv').config();

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Tenant } from '../src/database/entities/tenant.entity';
import { LoanCase } from '../src/database/entities/loan-case.entity';
import { ApiClient } from '../src/database/entities/api-client.entity';
import { ApiClientService } from '../src/auth/api-client.service';
import { ApiClientRole } from '../src/database/enums/api-client.enum';
import { CommunicationMessageService } from '../src/communications/communication-message.service';
import { CommunicationMessage } from '../src/database/entities/communication-message.entity';

/**
 * Section 20 M5's own scope line: "threat-model tests and negative
 * authorization suite" (M5-020). This file has two jobs:
 *
 * 1. Real, new coverage for "forged tenant or role context" (Section
 *    16.4) — the one named threat scenario this whole M5 series had
 *    never directly tested, though it turns out to already be
 *    structurally impossible: every DTO in this codebase's REST surface
 *    deliberately has no `tenantId`/`role`/`apiClientId` field at all
 *    (`CreateCaseDto`'s own comment: "there is nothing left for a
 *    caller to get right or wrong"), and `main.ts`'s global
 *    `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`
 *    means any request body that tries to smuggle one in anyway is
 *    rejected outright with a clean 400, never silently ignored. The
 *    tests below prove that with a real request against a real running
 *    app, not just by reading the DTO source.
 *
 * 2. A single, honest index of every Section 16.4 threat scenario's
 *    real coverage status — consolidating what was previously scattered
 *    tribal knowledge across ~15 spec files built over this whole M5
 *    series into one place, so "is X actually tested?" has one real
 *    answer instead of requiring a fresh audit every time it's asked
 *    (the exact audit this slice's own predecessor, M5-017, had to do
 *    from scratch). Recorded as comments, deliberately not as fake
 *    `it()` stubs that would always pass regardless of whether the
 *    referenced coverage still exists — that would be exactly the kind
 *    of fabricated coverage this codebase's own standing conventions
 *    warn against. A stale reference here is a real risk (nothing
 *    forces this comment to stay in sync with the specs it points to),
 *    accepted as the honest cost of documentation over silence, not
 *    papered over with tests that don't actually re-verify the claim.
 *
 * ## Section 16.4 threat-scenario coverage index
 *
 * - cross-tenant object reference and query leakage — COVERED: eleven
 *   dedicated `*-tenant-isolation.spec.ts` files (webhooks M5-002,
 *   case-core M5-004, consent M5-005, evaluation-manifest M5-007,
 *   policy-change-impact-assessment M5-008, communications M5-009,
 *   case-policy M5-010, provider-platform M5-014, data-disposition
 *   M5-015, communication-approval M5-018, audit-event M5-019) plus
 *   cross-tenant 404 checks in `cases.e2e-spec.ts`/
 *   `webhooks.e2e-spec.ts`.
 * - forged tenant or role context — COVERED, this file (see above).
 * - webhook replay and signature confusion — COVERED:
 *   `src/webhooks/webhook-signer.spec.ts`,
 *   `src/database/outbox/outbox-signer.spec.ts`.
 * - idempotency-key reuse with a changed request — COVERED:
 *   `cases.e2e-spec.ts`'s own idempotency test, plus
 *   `provider-operation-intent.service.spec.ts`'s request-fingerprint
 *   tests.
 * - prompt injection embedded in documents or provider payloads — NOT
 *   APPLICABLE today: this codebase's Agent runtime
 *   (`src/agent-runtime/langgraph/`) makes no model/LLM calls at all
 *   (Section 9.2's own "LangGraph is an Agent runtime adapter" — every
 *   node is deterministic code, not a prompted model), so there is no
 *   real prompt-injection attack surface yet to test against. Revisit
 *   if/when a real model call is ever added.
 * - tool argument manipulation and privilege escalation — PARTIAL:
 *   `AGENT_ALLOWED_TOOLS`/`buildToolRegistry` (`agent-tool.types.ts`)
 *   only ever let a case's own graph invoke its own hard-coded,
 *   whitelisted tool calls with hard-coded arguments (Section 9.2: no
 *   ReAct-style "model decides what to call" loop exists) — there is no
 *   caller-suppliable tool-argument surface at all today, so this is
 *   structurally closed rather than defended by a dedicated test.
 * - SSRF through provider or webhook configuration — COVERED:
 *   `src/webhooks/webhook-url-guard.spec.ts` (M5-011), 42 tests.
 * - raw PII in logs, traces, model requests, or error messages — KNOWN
 *   GAP: no dedicated log-scanning/redaction test exists. Structurally
 *   reduced (evidence facts store computed/typed values, not raw
 *   documents; `ApiKeyGuard`'s own error messages are deliberately
 *   generic on every failure path) but not verified by a real test.
 * - stale policy or model version execution — COVERED:
 *   `EvaluationInputManifest`'s own immutability and exact-version
 *   binding tests (M3-014 area).
 * - early activation, jurisdiction mismatch, unresolved policy
 *   conflict, missed source update — COVERED for policy activation:
 *   `policy-activation.service.spec.ts` (self-approval rejection, stale
 *   activation). NOT APPLICABLE for provider activation — no provider-
 *   promotion governance subsystem exists (see below).
 * - missed parent-layer, new-overlay, coverage, resolver, or relevant-
 *   fact-selector invalidation — COVERED: the policy-applicability
 *   resolver's own cache-invalidation test suite (M3 era).
 * - evaluation reads evidence, consent, or case state newer than its
 *   recorded policy input — COVERED implicitly by
 *   `EvaluationInputManifest`'s own immutable-snapshot design plus
 *   M5-005's consent-status tests.
 * - provider timeout misclassified as failure and retried into a
 *   duplicate paid or consumer-impacting operation — COVERED:
 *   `SyntheticProviderTimeoutError`/`OUTCOME_UNKNOWN` classification
 *   tests, and `scenario-catalog.ts`'s own
 *   `transient-provider-failure`/`terminal-provider-failure` scenarios
 *   (M5-016) proving the real retry-vs-no-retry distinction end to end.
 * - self-approval, stale activation race, artifact mismatch, cross-
 *   provider fallback reuse, duplicate provider callbacks after
 *   cancellation (Section 11.8's provider-promotion governance
 *   scenarios) — NOT APPLICABLE: no provider-promotion-manifest/
 *   certification/activation subsystem exists anywhere in this
 *   codebase (confirmed by a fresh audit before M5-017; `ProviderMode`
 *   only ever has a real `SIMULATOR` implementation). Named, not
 *   silently assumed covered.
 * - malicious file content or decompression abuse — NOT APPLICABLE: no
 *   file/document upload subsystem exists; `DocumentService` is a
 *   verification-result simulator, never handles real file bytes.
 * - unauthorized review override — COVERED (M5-017): `RoleGuard`
 *   requires `REVIEWER` role on `submitReview`, proven both by unit
 *   spec and a real e2e negative test. Communication-message approval
 *   (M5-022, Section 6.4) is gated the same way — a real e2e negative
 *   test below, plus a real cross-tenant 404 proving RLS still hides an
 *   unapproved message from another tenant's own REVIEWER credential.
 * - audit tampering — COVERED (M5-019): `audit_events`' own append-only
 *   database trigger, proven to reject `UPDATE`/`DELETE` even as the
 *   Postgres superuser under `app.bypass_rls`.
 * - policy binding bypass, stale reuse, or a TOCTOU race — COVERED:
 *   M5-010's own concurrency-recovery test (a real unique-constraint
 *   race, not simulated).
 */
const REQUIRED_VARS = ['DATABASE_URL', 'TEMPORAL_ADDRESS'];
const missingVars = REQUIRED_VARS.filter((v) => !process.env[v]);

if (missingVars.length > 0) {
  console.warn(
    `\n[e2e] Skipping negative-authorization.e2e-spec — missing env vars: ${missingVars.join(', ')}\n`,
  );
}

const describeOrSkip = missingVars.length > 0 ? describe.skip : describe;

describeOrSkip('Negative authorization suite (Section 16.4, M5-020)', () => {
  let app: INestApplication;
  let tenantRepo: Repository<Tenant>;
  let caseRepo: Repository<LoanCase>;
  let apiClientRepo: Repository<ApiClient>;
  let communicationMessageRepo: Repository<CommunicationMessage>;
  let communicationMessageService: CommunicationMessageService;
  let apiClientService: ApiClientService;
  let tenantId: string;
  let authHeader: string;
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
    communicationMessageRepo = moduleRef.get(
      getRepositoryToken(CommunicationMessage),
    );
    communicationMessageService = moduleRef.get(CommunicationMessageService);
    apiClientService = moduleRef.get(ApiClientService);

    const tenant = await tenantRepo.save(
      tenantRepo.create({ name: 'Negative Authorization E2E Tenant' }),
    );
    tenantId = tenant.id;
    const { client, token } = await apiClientService.create({
      tenantId,
      name: 'negative-authorization-e2e-client',
    });
    apiClientIds.push(client.id);
    authHeader = `Bearer ${token}`;
  }, 30_000);

  afterAll(async () => {
    if (apiClientIds.length > 0) {
      await apiClientRepo.delete(apiClientIds);
    }
    if (tenantId) {
      await caseRepo.delete({ tenantId });
      await tenantRepo.delete({ id: tenantId });
    }
    await app?.close();
  }, 30_000);

  function createCasePayload() {
    return {
      borrowerId: `neg-auth-e2e-borrower-${uuidv4()}`,
      requestedAmount: 350_000,
      loanType: 'CONVENTIONAL',
      statedMonthlyIncome: 9000,
      jurisdictionCode: 'US',
    };
  }

  describe('forged tenant or role context (Section 16.4)', () => {
    it('rejects a case-creation body that tries to smuggle a tenantId field, rather than silently ignoring it', async () => {
      const otherTenantId = uuidv4();
      const res = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Authorization', authHeader)
        .set('Idempotency-Key', `neg-auth-key-${uuidv4()}`)
        .send({ ...createCasePayload(), tenantId: otherTenantId });

      expect(res.status).toBe(400);
      // Confirms this really is whitelist rejection, not some unrelated
      // validation failure that happened to also return 400.
      expect(JSON.stringify(res.body)).toMatch(/tenantId/);

      const persisted = await caseRepo.find({
        where: { tenantId: otherTenantId },
      });
      expect(persisted).toHaveLength(0);
    });

    it('rejects a review-submission body that tries to smuggle a role/apiClientId override', async () => {
      // NestJS's own request lifecycle runs guards before pipes — a
      // PARTNER-role client would 403 on RoleGuard before ValidationPipe
      // ever inspects the body at all, which would prove RBAC works
      // (already covered, M5-017) but say nothing about whitelist
      // rejection specifically. A REVIEWER-role credential is required
      // here so the request actually reaches DTO validation, the layer
      // this test means to exercise.
      const { client: reviewerClient, token: reviewerToken } =
        await apiClientService.create({
          tenantId,
          name: 'neg-auth-e2e-reviewer-client',
          role: ApiClientRole.REVIEWER,
        });
      apiClientIds.push(reviewerClient.id);

      const res = await request(app.getHttpServer())
        .post(`/v1/loan-cases/${uuidv4()}/reviews`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({
          reviewType: 'CONDITION_RESOLUTION',
          actorId: 'neg-auth-actor',
          resolution: 'SATISFIED',
          role: 'REVIEWER',
          apiClientId: uuidv4(),
        });

      // 400 (whitelist rejection) takes precedence over 404 (unknown
      // case) here because ValidationPipe runs before the controller
      // method — and either way, no forged field was ever honored.
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/role|apiClientId/);
    });

    it("ignores an extra tenantId query-string parameter — only the bearer credential's own tenant is ever consulted", async () => {
      const created = await request(app.getHttpServer())
        .post('/v1/loan-cases')
        .set('Authorization', authHeader)
        .set('Idempotency-Key', `neg-auth-key-${uuidv4()}`)
        .send(createCasePayload());
      expect(created.status).toBe(201);

      const otherTenantId = uuidv4();
      const fetched = await request(app.getHttpServer())
        .get(`/v1/loan-cases/${created.body.id}?tenantId=${otherTenantId}`)
        .set('Authorization', authHeader);

      // The real tenant (from the credential) still finds its own case —
      // a query-string tenantId is not read by anything.
      expect(fetched.status).toBe(200);
      expect(fetched.body.tenantId).toBe(tenantId);
    });
  });

  describe('communication-message approval RBAC and cross-tenant isolation (M5-022)', () => {
    let otherTenantId: string;
    let otherReviewerToken: string;
    const messageIds: string[] = [];

    beforeAll(async () => {
      const otherTenant = await tenantRepo.save(
        tenantRepo.create({ name: 'Negative Authorization E2E Other Tenant' }),
      );
      otherTenantId = otherTenant.id;
      const { client, token } = await apiClientService.create({
        tenantId: otherTenantId,
        name: 'neg-auth-e2e-other-tenant-reviewer',
        role: ApiClientRole.REVIEWER,
      });
      apiClientIds.push(client.id);
      otherReviewerToken = `Bearer ${token}`;
    }, 30_000);

    afterAll(async () => {
      if (messageIds.length > 0) {
        await communicationMessageRepo.delete(messageIds);
      }
      if (otherTenantId) {
        await tenantRepo.delete({ id: otherTenantId });
      }
    }, 30_000);

    async function draftProtectedMessage(): Promise<string> {
      const message = await communicationMessageService.draft(
        tenantId,
        uuidv4(),
        {
          recipientRelationship: 'BORROWER',
          channel: 'EMAIL',
          locale: 'en-US',
          variables: {},
          freeformContent: 'Please clarify the discrepancy noted on your file.',
          hasAttachments: false,
        },
      );
      messageIds.push(message.id);
      return message.id;
    }

    it('rejects a PARTNER-role client approving a PROTECTED communication message with 403', async () => {
      const messageId = await draftProtectedMessage();
      const res = await request(app.getHttpServer())
        .post(
          `/v1/loan-cases/some-case/communication-messages/${messageId}/approve`,
        )
        .set('Authorization', authHeader)
        .send({ actorId: 'neg-auth-actor' });

      expect(res.status).toBe(403);
      const message = await communicationMessageRepo.findOneByOrFail({
        id: messageId,
      });
      expect(message.status).toBe('AWAITING_APPROVAL');
    });

    it("404s for another tenant's own REVIEWER credential approving a message it cannot see (RLS)", async () => {
      const messageId = await draftProtectedMessage();
      const res = await request(app.getHttpServer())
        .post(
          `/v1/loan-cases/some-case/communication-messages/${messageId}/approve`,
        )
        .set('Authorization', otherReviewerToken)
        .send({ actorId: 'neg-auth-actor-other-tenant' });

      expect(res.status).toBe(404);
      const message = await communicationMessageRepo.findOneByOrFail({
        id: messageId,
      });
      expect(message.status).toBe('AWAITING_APPROVAL');
    });
  });
});
