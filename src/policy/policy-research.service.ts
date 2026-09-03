import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolicyResearchCitation } from '../database/entities/policy-research-citation.entity';
import { PolicyResearchRun } from '../database/entities/policy-research-run.entity';
import { PolicySource } from '../database/entities/policy-source.entity';
import { PolicySourceRevision } from '../database/entities/policy-source-revision.entity';
import {
  PolicyResearchStatus,
  PolicyResearchTrigger,
} from '../database/enums/policy-research.enum';
import { PolicyResolutionContext } from './policy-resolution.types';

export type PolicyResearchProvider = 'extractive' | 'ollama';

export interface PolicyResearchRequest {
  trigger: PolicyResearchTrigger;
  jurisdictionCode: string;
  productCode?: string;
  lifecycleEvent?: string;
  unresolvedReasons: string[];
  policySourceId?: string;
  policySourceRevisionId?: string;
}

interface SourceExcerpt {
  policySourceRevisionId: string;
  sourceChecksum: string;
  location: string;
  excerpt: string;
  relevanceScore: number;
}

interface ResearchSynthesis {
  candidateSummary: string;
  changeSignals: string[];
  provider: PolicyResearchProvider;
}

interface OllamaChatResponse {
  message?: { content?: unknown };
}

const MAX_QUERY_CHARS = 1_500;
const MAX_EXCERPT_CHARS = 1_200;
const MAX_CITATIONS = 6;

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function tokenize(value: string): string[] {
  return [...new Set(value.toLowerCase().match(/[a-z0-9_]{2,}/g) ?? [])];
}

/**
 * Converts a source revision's structured payload into bounded passages while
 * retaining JSON paths. Retrieval has to preserve this provenance; treating a
 * whole revision as one prompt blob would make an apparently cited statement
 * impossible for a reviewer to locate or verify.
 */
function flattenContent(
  value: unknown,
  path = '$',
): Array<{ location: string; text: string }> {
  if (typeof value === 'string') return [{ location: path, text: value }];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      flattenContent(item, `${path}[${index}]`),
    );
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(
      ([key, nested]) => flattenContent(nested, `${path}.${key}`),
    );
  }
  return [];
}

function chunkText(text: string, maximumLength = MAX_EXCERPT_CHARS): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maximumLength) return normalized ? [normalized] : [];
  const chunks: string[] = [];
  for (let start = 0; start < normalized.length; start += maximumLength) {
    chunks.push(normalized.slice(start, start + maximumLength));
  }
  return chunks;
}

/**
 * Citation-bound policy research. It is intentionally outside the lending
 * evaluation path: input is restricted to policy context and resolver
 * reasons, output is always an advisory candidate, and no method here can
 * activate a version, mark coverage, or create a lending decision.
 */
@Injectable()
export class PolicyResearchService {
  private readonly logger = new Logger(PolicyResearchService.name);

  constructor(
    @InjectRepository(PolicyResearchRun)
    private readonly runRepository: Repository<PolicyResearchRun>,
    @InjectRepository(PolicyResearchCitation)
    private readonly citationRepository: Repository<PolicyResearchCitation>,
    @InjectRepository(PolicySourceRevision)
    private readonly revisionRepository: Repository<PolicySourceRevision>,
    @InjectRepository(PolicySource)
    private readonly sourceRepository: Repository<PolicySource>,
    private readonly configService: ConfigService,
    // The HTTP client is a test seam, not an application dependency. Marking
    // it with an explicit optional token prevents Nest from trying to resolve
    // the global `Function` constructor during normal AppModule bootstrap.
    @Optional()
    @Inject('POLICY_RESEARCH_HTTP_CLIENT')
    private readonly httpClient: typeof fetch = fetch,
  ) {}

  /**
   * Enqueues one idempotent research request. This is safe to call from the
   * resolver because it performs no network I/O and cannot delay or alter its
   * fail-closed result.
   */
  async request(request: PolicyResearchRequest): Promise<PolicyResearchRun> {
    const normalizedReasons = [...new Set(request.unresolvedReasons)]
      .map((reason) => reason.slice(0, 500))
      .sort();
    const fingerprintInput = {
      trigger: request.trigger,
      jurisdictionCode: request.jurisdictionCode,
      productCode: request.productCode ?? null,
      lifecycleEvent: request.lifecycleEvent ?? null,
      sourceId: request.policySourceId ?? null,
      sourceRevisionId: request.policySourceRevisionId ?? null,
      unresolvedReasons: normalizedReasons,
    };
    const requestFingerprint = digest(fingerprintInput);
    const existing = await this.runRepository.findOneBy({ requestFingerprint });
    if (existing) return existing;

    const researchQuery = this.buildResearchQuery(fingerprintInput).slice(
      0,
      MAX_QUERY_CHARS,
    );
    try {
      return await this.runRepository.save(
        this.runRepository.create({
          ...fingerprintInput,
          policySourceId: request.policySourceId ?? null,
          policySourceRevisionId: request.policySourceRevisionId ?? null,
          requestFingerprint,
          unresolvedReasons: normalizedReasons,
          researchQuery,
          status: PolicyResearchStatus.QUEUED,
          candidateSummary: null,
          changeSignals: null,
          synthesisProvider: null,
          failureDetail: null,
          claimedAt: null,
          completedAt: null,
          attempts: 0,
        }),
      );
    } catch (error) {
      // A competing worker may have inserted the same idempotency key. Read
      // it back instead of turning a duplicate notification into an outage.
      const concurrent = await this.runRepository.findOneBy({
        requestFingerprint,
      });
      if (concurrent) return concurrent;
      throw error;
    }
  }

  /**
   * Classifies resolver failures into the four research triggers. Unknown
   * failures stay human-review-only rather than being mislabelled as a legal
   * research task just because their text happened to look similar.
   */
  async requestForUnresolvedResolution(
    context: PolicyResolutionContext,
    unresolvedReasons: string[],
  ): Promise<void> {
    const trigger = this.classifyTrigger(unresolvedReasons);
    if (!trigger) return;
    try {
      await this.request({
        trigger,
        jurisdictionCode: context.jurisdictionCode,
        productCode: context.productCode,
        lifecycleEvent: context.lifecycleEvent,
        unresolvedReasons,
      });
    } catch (error) {
      // Research is advisory and must never weaken the resolver's existing
      // fail-closed behavior if its own durable queue is unavailable.
      this.logger.error(
        `Could not queue ${trigger} policy research: ${this.errorDetail(error)}`,
      );
    }
  }

  async requestForNewRevision(
    source: PolicySource,
    revision: PolicySourceRevision,
  ): Promise<void> {
    try {
      await this.request({
        trigger: PolicyResearchTrigger.NEW_SOURCE_REVISION,
        jurisdictionCode: source.jurisdictionCode,
        unresolvedReasons: [
          `policy source "${source.name}" recorded a new candidate revision`,
        ],
        policySourceId: source.id,
        policySourceRevisionId: revision.id,
      });
    } catch (error) {
      this.logger.error(
        `Could not queue new-revision research for ${source.id}: ${this.errorDetail(error)}`,
      );
    }
  }

  /** Processes a bounded batch; called only by the worker's background loop. */
  async processPendingRuns(limit = 3): Promise<number> {
    let completed = 0;
    for (let index = 0; index < limit; index += 1) {
      const run = await this.claimNextRun();
      if (!run) break;
      await this.processClaimedRun(run);
      completed += 1;
    }
    return completed;
  }

  private async claimNextRun(): Promise<PolicyResearchRun | null> {
    // `SKIP LOCKED` means a second worker moves to another queued item rather
    // than double-sending the same source excerpts to the model.
    const rows = await this.runRepository.query(
      `WITH candidate AS (
         SELECT id FROM policy_research_runs
         WHERE status = $1
            OR (status = $2 AND "claimedAt" < now() - ($3::bigint * interval '1 millisecond'))
         ORDER BY "requestedAt" ASC, id ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE policy_research_runs AS run
       SET status = $2, "claimedAt" = now(), attempts = attempts + 1,
           "failureDetail" = NULL
       FROM candidate
       WHERE run.id = candidate.id
       RETURNING run.*`,
      [
        PolicyResearchStatus.QUEUED,
        PolicyResearchStatus.PROCESSING,
        this.configService.get<number>('POLICY_RESEARCH_LEASE_MS', 600_000),
      ],
    );
    const row = (rows as Array<Partial<PolicyResearchRun>>)[0];
    return row ? (this.runRepository.create(row) as PolicyResearchRun) : null;
  }

  private async processClaimedRun(run: PolicyResearchRun): Promise<void> {
    try {
      // A crash can occur after citations are stored but before the brief is
      // finalized. Rebuilding from immutable source content makes lease
      // recovery deterministic and avoids duplicate reviewer evidence.
      await this.citationRepository.delete({ policyResearchRunId: run.id });
      const excerpts = await this.retrieve(run);
      if (excerpts.length > 0) {
        await this.citationRepository.save(
          excerpts.map((excerpt, index) =>
            this.citationRepository.create({
              policyResearchRunId: run.id,
              policySourceRevisionId: excerpt.policySourceRevisionId,
              sourceChecksum: excerpt.sourceChecksum,
              location: excerpt.location,
              excerpt: excerpt.excerpt,
              excerptDigest: digest(excerpt.excerpt),
              rank: index + 1,
              relevanceScore: excerpt.relevanceScore.toFixed(6),
            }),
          ),
        );
      }
      const synthesis = await this.synthesize(run, excerpts);
      await this.runRepository.update(
        { id: run.id, status: PolicyResearchStatus.PROCESSING },
        {
          status: PolicyResearchStatus.COMPLETED,
          candidateSummary: synthesis.candidateSummary,
          changeSignals: synthesis.changeSignals,
          synthesisProvider: synthesis.provider,
          completedAt: new Date(),
        },
      );
      this.logger.log(
        `Completed advisory ${run.trigger} policy research ${run.id} with ${excerpts.length} citation(s); human review is still required.`,
      );
    } catch (error) {
      await this.runRepository.update(
        { id: run.id, status: PolicyResearchStatus.PROCESSING },
        {
          status: PolicyResearchStatus.FAILED,
          failureDetail: this.errorDetail(error).slice(0, 2_000),
          completedAt: new Date(),
        },
      );
      this.logger.error(
        `Policy research ${run.id} failed: ${this.errorDetail(error)}`,
      );
    }
  }

  private async retrieve(run: PolicyResearchRun): Promise<SourceExcerpt[]> {
    const revisions = await this.revisionsFor(run);
    const queryTerms = tokenize(run.researchQuery);
    const passages = revisions.flatMap((revision) =>
      flattenContent(revision.content).flatMap(({ location, text }) =>
        chunkText(text).map((excerpt, index) => ({
          policySourceRevisionId: revision.id,
          sourceChecksum: revision.checksum,
          location: `${location}#${index + 1}`,
          excerpt,
        })),
      ),
    );
    return passages
      .map((passage) => {
        const terms = new Set(tokenize(passage.excerpt));
        const matches = queryTerms.filter((term) => terms.has(term)).length;
        return {
          ...passage,
          relevanceScore:
            queryTerms.length === 0 ? 0 : matches / queryTerms.length,
        };
      })
      .sort(
        (left, right) =>
          right.relevanceScore - left.relevanceScore ||
          left.location.localeCompare(right.location),
      )
      .slice(0, this.maxCitations());
  }

  private async revisionsFor(
    run: PolicyResearchRun,
  ): Promise<PolicySourceRevision[]> {
    if (run.policySourceRevisionId) {
      const revision = await this.revisionRepository.findOneBy({
        id: run.policySourceRevisionId,
      });
      return revision ? [revision] : [];
    }
    const sources = await this.sourceRepository.find({
      where: { jurisdictionCode: run.jurisdictionCode },
    });
    if (sources.length === 0) return [];
    const revisions = await this.revisionRepository
      .createQueryBuilder('revision')
      .where('revision."policySourceId" IN (:...sourceIds)', {
        sourceIds: sources.map((source) => source.id),
      })
      .orderBy('revision."recordedAt"', 'DESC')
      .getMany();
    const latestBySource = new Map<string, PolicySourceRevision>();
    for (const revision of revisions) {
      if (!latestBySource.has(revision.policySourceId)) {
        latestBySource.set(revision.policySourceId, revision);
      }
    }
    return [...latestBySource.values()];
  }

  private async synthesize(
    run: PolicyResearchRun,
    excerpts: SourceExcerpt[],
  ): Promise<ResearchSynthesis> {
    const provider = this.configService.get<PolicyResearchProvider>(
      'POLICY_RESEARCH_PROVIDER',
      'extractive',
    );
    if (provider === 'ollama') return this.synthesizeWithOllama(run, excerpts);
    return {
      provider: 'extractive',
      candidateSummary:
        excerpts.length === 0
          ? 'No source passages are available for this policy research request. Coverage or source ownership must be reviewed by a human.'
          : `Retrieved ${excerpts.length} immutable source passage(s) for ${run.trigger}. This extractive brief is advisory; a reviewer must verify each citation and approve any compiled policy change.`,
      changeSignals:
        excerpts.length === 0
          ? ['NO_RETRIEVABLE_SOURCE_CONTENT']
          : ['CITATION_BOUND_REVIEW_REQUIRED'],
    };
  }

  private async synthesizeWithOllama(
    run: PolicyResearchRun,
    excerpts: SourceExcerpt[],
  ): Promise<ResearchSynthesis> {
    const controller = new AbortController();
    const timeoutMs = this.configService.get<number>(
      'POLICY_RESEARCH_TIMEOUT_MS',
      90_000,
    );
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.httpClient(
        `${this.configService.get<string>('OLLAMA_BASE_URL', 'http://127.0.0.1:11434')}/api/chat`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model: this.configService.get<string>('OLLAMA_MODEL', 'qwen3.5:9b'),
            stream: false,
            think: false,
            format: {
              type: 'object',
              properties: {
                candidateSummary: { type: 'string', maxLength: 1200 },
                changeSignals: {
                  type: 'array',
                  items: { type: 'string', maxLength: 160 },
                  maxItems: 8,
                },
              },
              required: ['candidateSummary', 'changeSignals'],
              additionalProperties: false,
            },
            messages: [
              {
                role: 'system',
                content:
                  'You produce a citation-bound, advisory policy research brief for a synthetic lending demo. Never make a credit decision, legal conclusion, policy activation recommendation, or claim that a source is authoritative. Use only supplied excerpts. State uncertainty when excerpts are absent. Return JSON only.',
              },
              {
                role: 'user',
                content: JSON.stringify({
                  query: run.researchQuery,
                  trigger: run.trigger,
                  citations: excerpts.map((excerpt, index) => ({
                    citationNumber: index + 1,
                    location: excerpt.location,
                    sourceChecksum: excerpt.sourceChecksum,
                    excerpt: excerpt.excerpt,
                  })),
                }),
              },
            ],
            options: { temperature: 0, num_predict: 384 },
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error(`Ollama returned HTTP ${response.status}`);
      }
      const payload = (await response.json()) as OllamaChatResponse;
      const content = payload.message?.content;
      if (typeof content !== 'string')
        throw new Error('Ollama returned no text');
      const parsed = JSON.parse(content) as unknown;
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        typeof (parsed as { candidateSummary?: unknown }).candidateSummary !==
          'string' ||
        !Array.isArray((parsed as { changeSignals?: unknown }).changeSignals) ||
        !(parsed as { changeSignals: unknown[] }).changeSignals.every(
          (signal) => typeof signal === 'string',
        )
      ) {
        throw new Error('Ollama returned an invalid research schema');
      }
      return {
        provider: 'ollama',
        candidateSummary: (
          parsed as { candidateSummary: string }
        ).candidateSummary.slice(0, 1200),
        changeSignals: (parsed as { changeSignals: string[] }).changeSignals
          .map((signal) => signal.slice(0, 160))
          .slice(0, 8),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private classifyTrigger(
    unresolvedReasons: string[],
  ): PolicyResearchTrigger | null {
    const reasons = unresolvedReasons.join(' ').toLowerCase();
    if (reasons.includes('overlapping released versions')) {
      return PolicyResearchTrigger.APPLICABILITY_CONFLICT;
    }
    if (reasons.includes('exceeded its freshness objective')) {
      return PolicyResearchTrigger.SOURCE_FRESHNESS_EXPIRED;
    }
    if (
      reasons.includes('does not have reviewed covered status') ||
      reasons.includes('has no registered policy source') ||
      reasons.includes('has no recorded revision')
    ) {
      return PolicyResearchTrigger.COVERAGE_GAP;
    }
    return null;
  }

  private buildResearchQuery(input: {
    trigger: PolicyResearchTrigger;
    jurisdictionCode: string;
    productCode: string | null;
    lifecycleEvent: string | null;
    unresolvedReasons: string[];
  }): string {
    return [
      `Policy research trigger: ${input.trigger}.`,
      `Jurisdiction: ${input.jurisdictionCode}.`,
      input.productCode ? `Product: ${input.productCode}.` : '',
      input.lifecycleEvent ? `Lifecycle event: ${input.lifecycleEvent}.` : '',
      `Resolver signals: ${input.unresolvedReasons.join('; ') || 'none'}.`,
      'Retrieve only source passages relevant to reviewing this governance issue.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  private maxCitations(): number {
    const configured = this.configService.get<number>(
      'POLICY_RESEARCH_MAX_CITATIONS',
      MAX_CITATIONS,
    );
    return Math.min(Math.max(configured, 1), MAX_CITATIONS);
  }

  private errorDetail(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
