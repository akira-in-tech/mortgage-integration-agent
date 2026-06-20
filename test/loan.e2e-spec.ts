import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AgentService } from '../src/agent/agent.service';
import { AgentResult } from '../src/agent/agent.types';

/**
 * E2E tests for the mortgage loan evaluation pipeline.
 *
 * AgentService is mocked so the suite runs without live Anthropic API keys
 * or a running PostgreSQL instance. Database writes are also mocked via
 * TypeORM repository overrides in a separate test utility (not shown here).
 *
 * To run against real services: copy .env.example → .env, fill in credentials,
 * ensure Postgres is running, then: npm run test:e2e
 */

const MOCK_APPROVED_RESULT: AgentResult = {
  decision: 'APPROVED',
  confidence: 0.92,
  reasoning:
    'Strong credit score of 740, DTI of 32%, stable full-time employment, and all documents verified. Loan-to-income ratio of 3.1x is well within conventional guidelines.',
  conditions: [],
  incomeVerified: true,
  creditScore: 740,
  documentsValid: true,
  rawIntegrationData: {
    plaid: {
      monthlyIncome: 12000,
      employmentStatus: 'FULL_TIME',
      bankAccountAge: 84,
      incomeStability: 91,
    },
    credit: {
      creditScore: 740,
      debtToIncomeRatio: 0.32,
      paymentHistory: 'EXCELLENT',
      openAccounts: 6,
      derogatoryMarks: 0,
    },
    documents: {
      w2Valid: true,
      payStubValid: true,
      bankStatementValid: true,
      taxReturnValid: true,
      allDocumentsValid: true,
      failedDocuments: [],
    },
  },
};

const MOCK_CONDITIONAL_RESULT: AgentResult = {
  decision: 'CONDITIONAL',
  confidence: 0.71,
  reasoning:
    'Credit score of 655 is below the standard 700 threshold but within FHA program guidelines. DTI of 46% requires letter of explanation and compensating factor documentation.',
  conditions: [
    'Provide letter of explanation for credit score below 700',
    'Document compensating factors for DTI exceeding 43%',
    'Provide 12 months cancelled rent checks demonstrating on-time housing payment history',
  ],
  incomeVerified: true,
  creditScore: 655,
  documentsValid: false,
  rawIntegrationData: {
    plaid: {
      monthlyIncome: 7500,
      employmentStatus: 'FULL_TIME',
      bankAccountAge: 36,
      incomeStability: 78,
    },
    credit: {
      creditScore: 655,
      debtToIncomeRatio: 0.46,
      paymentHistory: 'FAIR',
      openAccounts: 9,
      derogatoryMarks: 1,
    },
    documents: {
      w2Valid: true,
      payStubValid: true,
      bankStatementValid: false,
      taxReturnValid: true,
      allDocumentsValid: false,
      failedDocuments: ['Bank Statement'],
    },
  },
};

describe('Loan Evaluation (e2e)', () => {
  let app: INestApplication;
  let agentService: AgentService;

  const EVALUATE_LOAN_QUERY = `
    query EvaluateLoan($input: EvaluateLoanInput!) {
      evaluateLoan(input: $input) {
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
  `;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AgentService)
      .useValue({
        runUnderwritingAgent: jest
          .fn()
          .mockResolvedValue(MOCK_APPROVED_RESULT),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    agentService = moduleFixture.get<AgentService>(AgentService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('evaluateLoan query', () => {
    it('returns APPROVED decision for qualified borrower', async () => {
      const variables = {
        input: {
          borrowerId: 'B001',
          requestedAmount: 450000,
          loanType: 'CONVENTIONAL',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send({ query: EVALUATE_LOAN_QUERY, variables })
        .expect(200);

      const { evaluateLoan } = response.body.data as {
        evaluateLoan: {
          applicationId: string;
          decision: string;
          confidence: number;
          reasoning: string;
          incomeVerified: boolean;
          creditScore: number;
          documentsValid: boolean;
          conditions: string[];
          createdAt: string;
        };
      };

      expect(evaluateLoan.decision).toBe('APPROVED');
      expect(evaluateLoan.confidence).toBeCloseTo(0.92);
      expect(evaluateLoan.incomeVerified).toBe(true);
      expect(evaluateLoan.creditScore).toBe(740);
      expect(evaluateLoan.documentsValid).toBe(true);
      expect(evaluateLoan.conditions).toHaveLength(0);
      expect(evaluateLoan.applicationId).toBeDefined();
      expect(evaluateLoan.createdAt).toBeDefined();
      expect(agentService.runUnderwritingAgent).toHaveBeenCalledWith(
        expect.objectContaining({ borrowerId: 'B001', requestedAmount: 450000 }),
      );
    });

    it('returns CONDITIONAL decision with conditions list', async () => {
      jest
        .spyOn(agentService, 'runUnderwritingAgent')
        .mockResolvedValueOnce(MOCK_CONDITIONAL_RESULT);

      const variables = {
        input: {
          borrowerId: 'B002',
          requestedAmount: 280000,
          loanType: 'FHA',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send({ query: EVALUATE_LOAN_QUERY, variables })
        .expect(200);

      const { evaluateLoan } = response.body.data as {
        evaluateLoan: { decision: string; conditions: string[]; creditScore: number };
      };

      expect(evaluateLoan.decision).toBe('CONDITIONAL');
      expect(evaluateLoan.conditions.length).toBeGreaterThan(0);
      expect(evaluateLoan.creditScore).toBe(655);
    });

    it('rejects invalid input — negative loan amount', async () => {
      const variables = {
        input: {
          borrowerId: 'B003',
          requestedAmount: -5000,
          loanType: 'CONVENTIONAL',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send({ query: EVALUATE_LOAN_QUERY, variables })
        .expect(200);

      expect(response.body.errors).toBeDefined();
    });

    it('rejects invalid input — empty borrowerId', async () => {
      const variables = {
        input: {
          borrowerId: '',
          requestedAmount: 300000,
          loanType: 'CONVENTIONAL',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send({ query: EVALUATE_LOAN_QUERY, variables })
        .expect(200);

      expect(response.body.errors).toBeDefined();
    });

    it('handles all loan types', async () => {
      const loanTypes = ['CONVENTIONAL', 'FHA', 'VA', 'JUMBO'];

      for (const loanType of loanTypes) {
        const variables = {
          input: { borrowerId: `B-${loanType}`, requestedAmount: 350000, loanType },
        };

        const response = await request(app.getHttpServer())
          .post('/graphql')
          .send({ query: EVALUATE_LOAN_QUERY, variables })
          .expect(200);

        expect(response.body.errors).toBeUndefined();
        expect(response.body.data.evaluateLoan).toBeDefined();
      }
    });
  });
});
