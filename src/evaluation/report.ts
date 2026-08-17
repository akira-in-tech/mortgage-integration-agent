import { execSync } from 'node:child_process';
import { DataSource } from 'typeorm';
import { PolicyVersion } from '../database/entities/policy-version.entity';
import { PolicyReleaseStatus } from '../database/enums/policy-version.enum';
import { RESOLVER_VERSION } from '../policy/policy-evaluation.service';
import {
  EvaluationCaseResult,
  EvaluationCategory,
  EvaluationReport,
} from './types';

function gitInfo(): { gitCommit: string | null; gitBranch: string | null } {
  try {
    return {
      gitCommit: execSync('git rev-parse HEAD').toString().trim(),
      gitBranch: execSync('git rev-parse --abbrev-ref HEAD').toString().trim(),
    };
  } catch {
    // Not a git checkout (e.g. a stripped deployment artifact) — omit
    // rather than fabricate a revision.
    return { gitCommit: null, gitBranch: null };
  }
}

const ALL_CATEGORIES: EvaluationCategory[] = [
  'normal',
  'boundary',
  'missing-data',
  'policy-coverage',
  'provider-failure',
];

export async function buildReport(
  dataSource: DataSource,
  corpusSource: string,
  results: EvaluationCaseResult[],
): Promise<EvaluationReport> {
  const releasedVersions = await dataSource.getRepository(PolicyVersion).find({
    where: { releaseStatus: PolicyReleaseStatus.RELEASED },
  });

  const byCategory = Object.fromEntries(
    ALL_CATEGORIES.map((category) => {
      const inCategory = results.filter((r) => r.category === category);
      return [
        category,
        {
          total: inCategory.length,
          passed: inCategory.filter((r) => r.passed).length,
        },
      ];
    }),
  ) as EvaluationReport['summary']['byCategory'];

  const expectedOpen = results.filter(
    (r) => r.expectedOutcome === 'CONDITION_OPENED',
  );
  const actuallyOpened = results.filter(
    (r) => r.actualOutcome === 'CONDITION_OPENED',
  );
  const conditionRecall =
    expectedOpen.length > 0
      ? expectedOpen.filter((r) => r.actualOutcome === 'CONDITION_OPENED')
          .length / expectedOpen.length
      : null;
  const conditionPrecision =
    actuallyOpened.length > 0
      ? actuallyOpened.filter((r) => r.expectedOutcome === 'CONDITION_OPENED')
          .length / actuallyOpened.length
      : null;

  return {
    generatedAt: new Date().toISOString(),
    codeRevision: gitInfo(),
    policyDataset: {
      resolverVersion: RESOLVER_VERSION,
      releasedPolicyVersionIds: releasedVersions.map((v) => v.id).sort(),
    },
    modelAndPromptRevisions: null,
    modelAndPromptRevisionsNote:
      'The M3 Agent runtime (lending-operations-agent-runtime.ts) makes no model calls — nothing to pin. Recorded explicitly, not omitted (Section 18.3).',
    corpus: { totalCases: results.length, source: corpusSource },
    results,
    summary: {
      totalCases: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      byCategory,
      conditionRecall,
      conditionPrecision,
    },
  };
}
