/// <reference types="jest" />
import 'reflect-metadata';
// Load .env before anything else so process.env is populated for the skip check
require('dotenv').config();

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

const REQUIRED_VARS = ['ANTHROPIC_API_KEY', 'DATABASE_URL'];
const missingVars = REQUIRED_VARS.filter((v) => !process.env[v]);

if (missingVars.length > 0) {
  console.warn(
    `\n[e2e] Skipping — missing env vars: ${missingVars.join(', ')}\n` +
      `      Set them in .env or export them before running npm run test:e2e\n`,
  );
}

const describeOrSkip = missingVars.length > 0 ? describe.skip : describe;

describeOrSkip('Loan Evaluation — real Claude API (e2e)', () => {
  let app: INestApplication;

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
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('returns a structurally valid underwriting decision for a conventional loan', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .send({
        query: `
          mutation {
            evaluateLoan(input: {
              borrowerId: "e2e-conventional-001"
              requestedAmount: 450000
              loanType: CONVENTIONAL
            }) {
              applicationId
              decision
              confidence
              reasoning
              incomeVerified
              creditScore
              documentsValid
              conditions
              createdAt
            }
          }
        `,
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();

    const result = res.body.data?.evaluateLoan;
    expect(result).toBeDefined();
    expect(['APPROVED', 'CONDITIONAL', 'DENIED']).toContain(result.decision);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(typeof result.reasoning).toBe('string');
    expect(result.reasoning.length).toBeGreaterThan(10);
    expect(Array.isArray(result.conditions)).toBe(true);
    expect(typeof result.applicationId).toBe('string');
    expect(result.applicationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(typeof result.incomeVerified).toBe('boolean');
    expect(typeof result.documentsValid).toBe('boolean');
    expect(typeof result.creditScore).toBe('number');
    expect(result.createdAt).toBeDefined();

    // CONDITIONAL decisions must have at least one condition; APPROVED/DENIED must have none
    if (result.decision === 'CONDITIONAL') {
      expect(result.conditions.length).toBeGreaterThan(0);
    } else {
      expect(result.conditions).toHaveLength(0);
    }
  }, 45_000);

  it('returns a structurally valid decision for an FHA loan', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .send({
        query: `
          mutation {
            evaluateLoan(input: {
              borrowerId: "e2e-fha-001"
              requestedAmount: 285000
              loanType: FHA
            }) {
              applicationId
              decision
              confidence
              reasoning
              conditions
            }
          }
        `,
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();

    const result = res.body.data?.evaluateLoan;
    expect(result).toBeDefined();
    expect(['APPROVED', 'CONDITIONAL', 'DENIED']).toContain(result.decision);
    expect(typeof result.reasoning).toBe('string');
    expect(Array.isArray(result.conditions)).toBe(true);
  }, 45_000);

  it('returns a GraphQL error for a loan amount below the $10,000 minimum', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .send({
        query: `
          mutation {
            evaluateLoan(input: {
              borrowerId: "e2e-invalid-001"
              requestedAmount: 5000
              loanType: CONVENTIONAL
            }) {
              decision
            }
          }
        `,
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors.length).toBeGreaterThan(0);
  }, 15_000);

  it('returns a GraphQL error for an empty borrowerId', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .send({
        query: `
          mutation {
            evaluateLoan(input: {
              borrowerId: ""
              requestedAmount: 300000
              loanType: CONVENTIONAL
            }) {
              decision
            }
          }
        `,
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors.length).toBeGreaterThan(0);
  }, 15_000);
});
