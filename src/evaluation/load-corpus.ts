import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EvaluationCaseFixture } from './types';

/**
 * Section 18.2's `evaluation/cases/` — one JSON fixture per file, loaded
 * in filename order so a report's case ordering is stable and diffable
 * across runs.
 */
export function loadCorpus(casesDir: string): EvaluationCaseFixture[] {
  const files = readdirSync(casesDir)
    .filter((name) => name.endsWith('.json'))
    .sort();
  return files.map((name) => {
    const raw = readFileSync(join(casesDir, name), 'utf-8');
    const fixture = JSON.parse(raw) as EvaluationCaseFixture;
    if (!fixture.id || !fixture.category || !fixture.expected) {
      throw new Error(
        `${name}: malformed fixture (missing id/category/expected)`,
      );
    }
    return fixture;
  });
}
