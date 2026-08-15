import 'reflect-metadata';
import { NodeEnvironment, validateEnvironment } from './env.validation';

function baseConfig(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    DATABASE_URL: 'postgresql://localhost:5432/mortgage_agent',
    ...overrides,
  };
}

describe('validateEnvironment', () => {
  it('accepts a minimal valid config and defaults NODE_ENV and PORT', () => {
    const result = validateEnvironment(baseConfig());

    expect(result.NODE_ENV).toBe(NodeEnvironment.Development);
    expect(result.PORT).toBe(3000);
    expect(result.DATABASE_URL).toBe(
      'postgresql://localhost:5432/mortgage_agent',
    );
  });

  it('accepts an explicit, fully specified config', () => {
    const result = validateEnvironment(
      baseConfig({ NODE_ENV: 'production', PORT: '8080' }),
    );

    expect(result.NODE_ENV).toBe(NodeEnvironment.Production);
    expect(result.PORT).toBe(8080);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => validateEnvironment({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a DATABASE_URL with a non-Postgres scheme', () => {
    expect(() =>
      validateEnvironment(
        baseConfig({ DATABASE_URL: 'mysql://localhost:3306/db' }),
      ),
    ).toThrow(/DATABASE_URL/);
  });

  it('rejects an unrecognized NODE_ENV instead of silently disabling production guards', () => {
    expect(() =>
      validateEnvironment(baseConfig({ NODE_ENV: 'Production' })),
    ).toThrow(/NODE_ENV/);
  });

  it('rejects a PORT outside the valid TCP port range', () => {
    expect(() => validateEnvironment(baseConfig({ PORT: '99999' }))).toThrow();
  });

  it('rejects a non-numeric PORT', () => {
    expect(() =>
      validateEnvironment(baseConfig({ PORT: 'not-a-number' })),
    ).toThrow();
  });

  it('lists every problem at once when multiple variables are invalid', () => {
    expect(() =>
      validateEnvironment(baseConfig({ NODE_ENV: 'Production', PORT: 'nope' })),
    ).toThrow(/NODE_ENV[\s\S]*PORT|PORT[\s\S]*NODE_ENV/);
  });

  it('preserves unrelated environment variables untouched', () => {
    const result = validateEnvironment(
      baseConfig({ DECISION_PROVIDER: 'ollama', OLLAMA_MODEL: 'qwen3.5:9b' }),
    ) as unknown as Record<string, unknown>;

    expect(result.DECISION_PROVIDER).toBe('ollama');
    expect(result.OLLAMA_MODEL).toBe('qwen3.5:9b');
  });
});
