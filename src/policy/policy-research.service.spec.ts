import { PolicyResearchRun } from '../database/entities/policy-research-run.entity';
import { PolicyResearchCitation } from '../database/entities/policy-research-citation.entity';
import { PolicySource } from '../database/entities/policy-source.entity';
import { PolicySourceRevision } from '../database/entities/policy-source-revision.entity';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import {
  PolicyResearchStatus,
  PolicyResearchTrigger,
} from '../database/enums/policy-research.enum';
import { PolicyResearchService } from './policy-research.service';

function createHarness(options?: {
  provider?: 'extractive' | 'ollama';
  httpClient?: typeof fetch;
}) {
  const savedRuns: PolicyResearchRun[] = [];
  const savedCitations: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const revisions = [
    {
      id: 'revision-1',
      policySourceId: 'source-1',
      checksum: 'sha256:synthetic-v2',
      content: {
        bulletinId: 'SYNTHETIC-2',
        summary:
          'Synthetic California income-verification policy bulletin changed its review wording.',
        sections: [
          'This synthetic source remains a demonstration and requires human legal review.',
          'Income verification applies only after a reviewed policy version is released.',
        ],
      },
    },
  ];
  const runRepository = {
    findOneBy: jest.fn(async ({ requestFingerprint }) =>
      savedRuns.find((run) => run.requestFingerprint === requestFingerprint),
    ),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => {
      const run = {
        id: `run-${savedRuns.length + 1}`,
        ...value,
      } as PolicyResearchRun;
      savedRuns.push(run);
      return run;
    }),
    // Mirrors what TypeORM's real Postgres driver returns for a raw UPDATE
    // (RETURNING included): `[rows, rowCount]`, not just `rows` -- see
    // node_modules/typeorm/driver/postgres/PostgresQueryRunner.js's own
    // `query()`, which wraps UPDATE/DELETE results in that tuple. A version
    // of this mock that returned `[next]` directly (matching the shape the
    // real driver gives a plain SELECT, not an UPDATE) let a real bug in
    // claimNextRun() pass every test while failing in production.
    query: jest.fn(async () => {
      const next = savedRuns.find(
        (run) => run.status === PolicyResearchStatus.QUEUED,
      );
      if (!next) return [[], 0];
      next.status = PolicyResearchStatus.PROCESSING;
      next.attempts += 1;
      return [[next], 1];
    }),
    update: jest.fn(async (_where, values) => {
      updates.push(values);
      return { affected: 1 };
    }),
  };
  const citationRepository = {
    delete: jest.fn(async () => ({ affected: 0 })),
    create: jest.fn((value) => value),
    save: jest.fn(async (values) => {
      savedCitations.push(...values);
      return values;
    }),
  };
  const revisionRepository = {
    findOneBy: jest.fn(async ({ id }) =>
      revisions.find((revision) => revision.id === id),
    ),
    createQueryBuilder: jest.fn(),
  };
  const sourceRepository = {
    find: jest.fn(async () => []),
  };
  const configService = {
    get: jest.fn((key: string, fallback: unknown) => {
      if (key === 'POLICY_RESEARCH_PROVIDER') {
        return options?.provider ?? 'extractive';
      }
      return fallback;
    }),
  };
  const service = new PolicyResearchService(
    runRepository as any,
    citationRepository as any,
    revisionRepository as any,
    sourceRepository as any,
    configService as any,
    options?.httpClient ?? fetch,
  );
  return { service, savedRuns, savedCitations, updates, runRepository };
}

describe('PolicyResearchService', () => {
  it('boots through Nest DI without registering the test-only HTTP seam', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PolicyResearchService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: getRepositoryToken(PolicyResearchRun), useValue: {} },
        { provide: getRepositoryToken(PolicyResearchCitation), useValue: {} },
        { provide: getRepositoryToken(PolicySourceRevision), useValue: {} },
        { provide: getRepositoryToken(PolicySource), useValue: {} },
      ],
    }).compile();
    expect(moduleRef.get(PolicyResearchService)).toBeInstanceOf(
      PolicyResearchService,
    );
    await moduleRef.close();
  });

  it('queues the four named policy conditions once without case or borrower context', async () => {
    const { service, savedRuns } = createHarness();
    const context = {
      jurisdictionCode: 'US-CA',
      productCode: 'CONVENTIONAL_MORTGAGE',
      lifecycleEvent: 'UNDERWRITING_REVIEW',
      asOf: new Date('2026-01-02T00:00:00.000Z'),
    };

    await service.requestForUnresolvedResolution(context, [
      'policy source "CA source" exceeded its freshness objective at 2026-01-01T00:00:00.000Z',
    ]);
    await service.requestForUnresolvedResolution(context, [
      'jurisdiction "US-CA" does not have reviewed COVERED status',
    ]);
    await service.requestForUnresolvedResolution(context, [
      'jurisdiction "US-CA" has no registered policy source',
    ]);
    await service.requestForUnresolvedResolution(context, [
      'rule "income" has 2 overlapping released versions effective as of 2026-01-02T00:00:00.000Z',
    ]);
    // The same stale notification is idempotent rather than causing a model
    // call every time an evaluation retries against the same source version.
    await service.requestForUnresolvedResolution(context, [
      'policy source "CA source" exceeded its freshness objective at 2026-01-01T00:00:00.000Z',
    ]);

    expect(savedRuns.map((run) => run.trigger)).toEqual([
      PolicyResearchTrigger.SOURCE_FRESHNESS_EXPIRED,
      PolicyResearchTrigger.COVERAGE_GAP,
      PolicyResearchTrigger.COVERAGE_GAP,
      PolicyResearchTrigger.APPLICABILITY_CONFLICT,
    ]);
    expect(savedRuns).toHaveLength(4);
    for (const run of savedRuns) {
      expect(run.researchQuery).not.toMatch(/borrower|caseId|income amount/i);
      expect(run.status).toBe(PolicyResearchStatus.QUEUED);
    }
  });

  it('retrieves immutable revision passages and persists citations before its advisory brief', async () => {
    const { service, savedCitations, updates } = createHarness();
    await service.request({
      trigger: PolicyResearchTrigger.NEW_SOURCE_REVISION,
      jurisdictionCode: 'US-DEMO',
      policySourceId: 'source-1',
      policySourceRevisionId: 'revision-1',
      unresolvedReasons: ['a synthetic source revision was observed'],
    });

    expect(await service.processPendingRuns()).toBe(1);
    expect(savedCitations).toHaveLength(4);
    expect(savedCitations[0]).toMatchObject({
      policySourceRevisionId: 'revision-1',
      sourceChecksum: 'sha256:synthetic-v2',
      rank: 1,
    });
    expect(updates).toContainEqual(
      expect.objectContaining({
        status: PolicyResearchStatus.COMPLETED,
        synthesisProvider: 'extractive',
      }),
    );
  });

  it('uses Qwen only after retrieval and validates the candidate response shape', async () => {
    const httpClient = jest.fn(async (_url, request) => {
      const payload = JSON.parse(String(request?.body));
      expect(payload.messages[1].content).toContain('sha256:synthetic-v2');
      expect(payload.messages[1].content).not.toContain('borrower');
      return new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify({
              candidateSummary:
                'The synthetic revision changes review wording.',
              changeSignals: ['WORDING_CHANGED'],
            }),
          },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const { service, updates } = createHarness({
      provider: 'ollama',
      httpClient,
    });
    await service.request({
      trigger: PolicyResearchTrigger.NEW_SOURCE_REVISION,
      jurisdictionCode: 'US-DEMO',
      policySourceId: 'source-1',
      policySourceRevisionId: 'revision-1',
      unresolvedReasons: ['a synthetic source revision was observed'],
    });

    await service.processPendingRuns();
    expect(httpClient).toHaveBeenCalledTimes(1);
    expect(updates).toContainEqual(
      expect.objectContaining({
        candidateSummary: 'The synthetic revision changes review wording.',
        changeSignals: ['WORDING_CHANGED'],
        synthesisProvider: 'ollama',
      }),
    );
  });
});
