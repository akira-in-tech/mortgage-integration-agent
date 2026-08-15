import 'reflect-metadata';
import {
  DecisionProvider,
  NodeEnvironment,
  validateEnvironment,
} from './env.validation';

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

  it('preserves environment variables outside this schema untouched', () => {
    const result = validateEnvironment(
      baseConfig({
        ANTHROPIC_API_KEY: 'unused-in-this-app',
        DEMO_MODE: 'true',
      }),
    ) as unknown as Record<string, unknown>;

    expect(result.ANTHROPIC_API_KEY).toBe('unused-in-this-app');
    expect(result.DEMO_MODE).toBe('true');
  });

  describe('agent decisioning (DECISION_PROVIDER / OLLAMA_*)', () => {
    it('defaults to rules with no model server configured', () => {
      const result = validateEnvironment(baseConfig());

      expect(result.DECISION_PROVIDER).toBe(DecisionProvider.Rules);
      expect(result.OLLAMA_BASE_URL).toBe('http://127.0.0.1:11434');
      expect(result.OLLAMA_MODEL).toBe('qwen3.5:9b');
      expect(result.OLLAMA_TIMEOUT_MS).toBe(60_000);
    });

    it('accepts an explicit ollama configuration, trimming and lowercasing DECISION_PROVIDER', () => {
      const result = validateEnvironment(
        baseConfig({
          DECISION_PROVIDER: '  Ollama  ',
          OLLAMA_BASE_URL: 'http://ollama.internal:11434/',
          OLLAMA_MODEL: 'qwen3.5:4b',
          OLLAMA_TIMEOUT_MS: '30000',
        }),
      );

      expect(result.DECISION_PROVIDER).toBe(DecisionProvider.Ollama);
      // Trailing slash stripped so `${OLLAMA_BASE_URL}/api/chat` never
      // ends up with a double slash.
      expect(result.OLLAMA_BASE_URL).toBe('http://ollama.internal:11434');
      expect(result.OLLAMA_MODEL).toBe('qwen3.5:4b');
      expect(result.OLLAMA_TIMEOUT_MS).toBe(30_000);
    });

    it('rejects a DECISION_PROVIDER that is neither rules nor ollama', () => {
      expect(() =>
        validateEnvironment(baseConfig({ DECISION_PROVIDER: 'unknown' })),
      ).toThrow(/DECISION_PROVIDER/);
    });

    it('rejects a non-http(s) OLLAMA_BASE_URL', () => {
      expect(() =>
        validateEnvironment(baseConfig({ OLLAMA_BASE_URL: 'not-a-url' })),
      ).toThrow(/OLLAMA_BASE_URL/);
    });

    it('rejects a non-positive OLLAMA_TIMEOUT_MS', () => {
      expect(() =>
        validateEnvironment(baseConfig({ OLLAMA_TIMEOUT_MS: '0' })),
      ).toThrow();
    });
  });

  describe('Temporal (TEMPORAL_ADDRESS / TEMPORAL_NAMESPACE)', () => {
    it('defaults to the local dev server and the default namespace', () => {
      const result = validateEnvironment(baseConfig());

      expect(result.TEMPORAL_ADDRESS).toBe('localhost:7233');
      expect(result.TEMPORAL_NAMESPACE).toBe('default');
    });

    it('accepts an explicit address and namespace', () => {
      const result = validateEnvironment(
        baseConfig({
          TEMPORAL_ADDRESS: 'temporal.internal:7233',
          TEMPORAL_NAMESPACE: 'mortgage-agent-staging',
        }),
      );

      expect(result.TEMPORAL_ADDRESS).toBe('temporal.internal:7233');
      expect(result.TEMPORAL_NAMESPACE).toBe('mortgage-agent-staging');
    });

    it('rejects an empty TEMPORAL_ADDRESS', () => {
      expect(() =>
        validateEnvironment(baseConfig({ TEMPORAL_ADDRESS: '' })),
      ).toThrow(/TEMPORAL_ADDRESS/);
    });
  });

  describe('Outbox signing (OUTBOX_SIGNING_SECRET)', () => {
    it('defaults to the local development secret', () => {
      const result = validateEnvironment(baseConfig());
      expect(result.OUTBOX_SIGNING_SECRET).toBe(
        'dev-outbox-signing-secret-change-me',
      );
    });

    it('accepts an explicit secret at least 16 characters long', () => {
      const result = validateEnvironment(
        baseConfig({
          OUTBOX_SIGNING_SECRET: 'a-real-32-character-long-secret',
        }),
      );
      expect(result.OUTBOX_SIGNING_SECRET).toBe(
        'a-real-32-character-long-secret',
      );
    });

    it('rejects a secret shorter than 16 characters', () => {
      expect(() =>
        validateEnvironment(baseConfig({ OUTBOX_SIGNING_SECRET: 'too-short' })),
      ).toThrow(/OUTBOX_SIGNING_SECRET/);
    });
  });
});
