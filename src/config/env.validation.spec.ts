import 'reflect-metadata';
import {
  DecisionProvider,
  NodeEnvironment,
  validateEnvironment,
} from './env.validation';

function baseConfig(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const config: Record<string, unknown> = {
    DATABASE_URL: 'postgresql://localhost:5432/mortgage_agent',
    ...overrides,
  };
  if (
    ['staging', 'production'].includes(String(overrides.NODE_ENV)) &&
    !Object.prototype.hasOwnProperty.call(overrides, 'APP_DATABASE_URL')
  ) {
    config.APP_DATABASE_URL =
      'postgresql://mortgage_app@localhost:5432/mortgage_agent';
  }
  if (
    ['staging', 'production'].includes(String(overrides.NODE_ENV)) &&
    !Object.prototype.hasOwnProperty.call(
      overrides,
      'PROVIDER_DATA_ENCRYPTION_KEYS',
    )
  ) {
    config.PROVIDER_DATA_ENCRYPTION_KEYS = `provider-v1:${'a'.repeat(64)}`;
  }
  return config;
}

describe('validateEnvironment', () => {
  it('accepts a minimal valid config and defaults NODE_ENV and PORT', () => {
    const result = validateEnvironment(baseConfig());

    expect(result.NODE_ENV).toBe(NodeEnvironment.Development);
    expect(result.PORT).toBe(3000);
    expect(result.DATABASE_URL).toBe(
      'postgresql://localhost:5432/mortgage_agent',
    );
    expect(result.SELF_SERVICE_SIGNUP_ENABLED).toBe(false);
    expect(result.GUEST_SANDBOX_TTL_SECONDS).toBe(3600);
  });

  it('bounds the anonymous sandbox lifetime', () => {
    expect(
      validateEnvironment(baseConfig({ GUEST_SANDBOX_TTL_SECONDS: '300' }))
        .GUEST_SANDBOX_TTL_SECONDS,
    ).toBe(300);
    expect(() =>
      validateEnvironment(baseConfig({ GUEST_SANDBOX_TTL_SECONDS: '299' })),
    ).toThrow(/GUEST_SANDBOX_TTL_SECONDS/);
    expect(() =>
      validateEnvironment(baseConfig({ GUEST_SANDBOX_TTL_SECONDS: '14401' })),
    ).toThrow(/GUEST_SANDBOX_TTL_SECONDS/);
  });

  it('requires OIDC when self-service signup is enabled', () => {
    expect(() =>
      validateEnvironment(baseConfig({ SELF_SERVICE_SIGNUP_ENABLED: 'true' })),
    ).toThrow(/OIDC_ISSUER_URL and OIDC_AUDIENCE/);

    expect(
      validateEnvironment(
        baseConfig({
          SELF_SERVICE_SIGNUP_ENABLED: 'true',
          OIDC_ISSUER_URL: 'https://identity.example.test',
          OIDC_AUDIENCE: 'mortgage-console',
        }),
      ).SELF_SERVICE_SIGNUP_ENABLED,
    ).toBe(true);
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

  describe('OpenTelemetry', () => {
    it('defaults to disabled local OTLP export', () => {
      const result = validateEnvironment(baseConfig());

      expect(result.OTEL_ENABLED).toBe(false);
      expect(result.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('http://127.0.0.1:4318');
      expect(result.OTEL_TRACE_SAMPLE_RATIO).toBe(1);
    });

    it('parses explicit exporter settings without treating false as true', () => {
      const result = validateEnvironment(
        baseConfig({
          OTEL_ENABLED: 'false',
          OTEL_SERVICE_NAME: 'mortgage-api',
          OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318/',
          OTEL_METRIC_EXPORT_INTERVAL_MS: '30000',
          OTEL_TRACE_SAMPLE_RATIO: '0.25',
        }),
      );

      expect(result.OTEL_ENABLED).toBe(false);
      expect(result.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('http://collector:4318');
      expect(result.OTEL_METRIC_EXPORT_INTERVAL_MS).toBe(30_000);
      expect(result.OTEL_TRACE_SAMPLE_RATIO).toBe(0.25);
    });

    it('rejects ambiguous enable flags and out-of-range sampling', () => {
      expect(() =>
        validateEnvironment(baseConfig({ OTEL_ENABLED: 'yes' })),
      ).toThrow(/OTEL_ENABLED/);
      expect(() =>
        validateEnvironment(baseConfig({ OTEL_TRACE_SAMPLE_RATIO: '1.1' })),
      ).toThrow(/OTEL_TRACE_SAMPLE_RATIO/);
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

  describe('App runtime database role (APP_DATABASE_URL, M5-003)', () => {
    it('is optional for local development', () => {
      const result = validateEnvironment(baseConfig());
      expect(result.APP_DATABASE_URL).toBeUndefined();
    });

    it('accepts an explicit postgres:// APP_DATABASE_URL', () => {
      const result = validateEnvironment(
        baseConfig({
          APP_DATABASE_URL:
            'postgresql://mortgage_app:secret@db.internal:5432/mortgage_agent',
        }),
      );
      expect(result.APP_DATABASE_URL).toBe(
        'postgresql://mortgage_app:secret@db.internal:5432/mortgage_agent',
      );
    });

    it('rejects an APP_DATABASE_URL with a non-Postgres scheme', () => {
      expect(() =>
        validateEnvironment(
          baseConfig({ APP_DATABASE_URL: 'mysql://localhost:3306/db' }),
        ),
      ).toThrow(/APP_DATABASE_URL/);
    });

    it('requires a separate restricted runtime credential in staging and production', () => {
      expect(() =>
        validateEnvironment(
          baseConfig({ NODE_ENV: 'staging', APP_DATABASE_URL: undefined }),
        ),
      ).toThrow(/APP_DATABASE_URL is required/);

      expect(() =>
        validateEnvironment(
          baseConfig({
            NODE_ENV: 'production',
            APP_DATABASE_URL: 'postgresql://localhost:5432/mortgage_agent',
          }),
        ),
      ).toThrow(/separate restricted runtime credential/);
    });
  });

  describe('OIDC server-side session boundary', () => {
    const oidcConfig = {
      OIDC_ISSUER_URL: 'https://identity.example.test/realms/lending',
      OIDC_AUDIENCE: 'lending-api',
      OIDC_CLIENT_ID: 'operations-console',
      OIDC_CALLBACK_URL:
        'https://console.example.test/v1/auth/session/callback',
      CONSOLE_ORIGIN: 'https://console.example.test',
    };

    it('accepts a complete development OIDC config with the local encryption-key policy', () => {
      const result = validateEnvironment(baseConfig(oidcConfig));
      expect(result.OIDC_CLIENT_ID).toBe('operations-console');
      expect(result.OIDC_SESSION_MAX_AGE_SECONDS).toBe(28_800);
    });

    it('requires issuer and audience together', () => {
      expect(() =>
        validateEnvironment(
          baseConfig({ OIDC_ISSUER_URL: oidcConfig.OIDC_ISSUER_URL }),
        ),
      ).toThrow(/OIDC_ISSUER_URL and OIDC_AUDIENCE/);
    });

    it('rejects partial OIDC client/session settings without an issuer', () => {
      expect(() =>
        validateEnvironment(
          baseConfig({ OIDC_CLIENT_SECRET: 'orphaned-client-secret' }),
        ),
      ).toThrow(/OIDC_ISSUER_URL and OIDC_AUDIENCE/);
    });

    it('requires a 32-byte encryption key when OIDC is enabled in production', () => {
      expect(() =>
        validateEnvironment(
          baseConfig({ ...oidcConfig, NODE_ENV: 'production' }),
        ),
      ).toThrow(/OIDC_SESSION_ENCRYPTION_KEY/);

      const result = validateEnvironment(
        baseConfig({
          ...oidcConfig,
          NODE_ENV: 'production',
          OIDC_SESSION_ENCRYPTION_KEY: 'a'.repeat(64),
        }),
      );
      expect(result.OIDC_SESSION_ENCRYPTION_KEY).toBe('a'.repeat(64));

      const keyRingResult = validateEnvironment(
        baseConfig({
          ...oidcConfig,
          NODE_ENV: 'production',
          OIDC_SESSION_ENCRYPTION_KEYS: `staging-v1:${'b'.repeat(64)}`,
        }),
      );
      expect(keyRingResult.OIDC_SESSION_ENCRYPTION_KEYS).toBe(
        `staging-v1:${'b'.repeat(64)}`,
      );
    });

    it('requires explicit HTTPS callback and console origins in production', () => {
      expect(() =>
        validateEnvironment(
          baseConfig({
            OIDC_ISSUER_URL: 'https://identity.example.test/realms/lending',
            OIDC_AUDIENCE: 'lending-api',
            NODE_ENV: 'production',
            OIDC_SESSION_ENCRYPTION_KEY: 'a'.repeat(64),
          }),
        ),
      ).toThrow(/OIDC_CALLBACK_URL[\s\S]*CONSOLE_ORIGIN/);

      expect(() =>
        validateEnvironment(
          baseConfig({
            ...oidcConfig,
            NODE_ENV: 'production',
            OIDC_SESSION_ENCRYPTION_KEY: 'a'.repeat(64),
            OIDC_CALLBACK_URL:
              'http://console.example.test/v1/auth/session/callback',
          }),
        ),
      ).toThrow(/OIDC_CALLBACK_URL must use HTTPS/);
    });

    it('applies the same explicit-key and HTTPS boundary to staging', () => {
      expect(() =>
        validateEnvironment(
          baseConfig({
            ...oidcConfig,
            NODE_ENV: 'staging',
          }),
        ),
      ).toThrow(/OIDC_SESSION_ENCRYPTION_KEY/);

      expect(() =>
        validateEnvironment(
          baseConfig({
            ...oidcConfig,
            NODE_ENV: 'staging',
            OIDC_SESSION_ENCRYPTION_KEY: 'a'.repeat(64),
            CONSOLE_ORIGIN: 'http://console.example.test',
          }),
        ),
      ).toThrow(/CONSOLE_ORIGIN must use HTTPS/);
    });

    it('rejects a CONSOLE_ORIGIN containing a path', () => {
      expect(() =>
        validateEnvironment(
          baseConfig({
            ...oidcConfig,
            CONSOLE_ORIGIN: 'https://console.example.test/app',
          }),
        ),
      ).toThrow(/scheme and authority/);
    });
  });

  describe('provider field encryption boundary', () => {
    it('requires a provider key ring in staging and production', () => {
      expect(() =>
        validateEnvironment(
          baseConfig({
            NODE_ENV: 'staging',
            PROVIDER_DATA_ENCRYPTION_KEYS: undefined,
          }),
        ),
      ).toThrow(/PROVIDER_DATA_ENCRYPTION_KEYS/);
    });

    it('validates a rotation key ring and backup-retention window', () => {
      const keyRing = `provider-v2:${'b'.repeat(64)},provider-v1:${'a'.repeat(64)}`;
      const result = validateEnvironment(
        baseConfig({
          PROVIDER_DATA_ENCRYPTION_KEYS: keyRing,
          BACKUP_RETENTION_HOURS: '48',
        }),
      );
      expect(result.PROVIDER_DATA_ENCRYPTION_KEYS).toBe(keyRing);
      expect(result.BACKUP_RETENTION_HOURS).toBe(48);
    });
  });

  describe('bounded local Agent planner', () => {
    it('validates the conservative planner token and output limits', () => {
      const result = validateEnvironment(
        baseConfig({
          AGENT_PLANNER_TOKEN_BUDGET: '2048',
          AGENT_PLANNER_MAX_OUTPUT_TOKENS: '256',
          AGENT_PLANNER_MIN_CONFIDENCE_BPS: '8500',
        }),
      );
      expect(result.AGENT_PLANNER_TOKEN_BUDGET).toBe(2048);
      expect(result.AGENT_PLANNER_MAX_OUTPUT_TOKENS).toBe(256);
      expect(result.AGENT_PLANNER_MIN_CONFIDENCE_BPS).toBe(8500);
    });

    it('rejects an output cap larger than the authoritative reservation', () => {
      expect(() =>
        validateEnvironment(
          baseConfig({
            AGENT_PLANNER_TOKEN_BUDGET: '256',
            AGENT_PLANNER_MAX_OUTPUT_TOKENS: '512',
          }),
        ),
      ).toThrow(/MAX_OUTPUT_TOKENS cannot exceed/);
    });

    it('rejects a confidence floor outside basis-point bounds', () => {
      expect(() =>
        validateEnvironment(
          baseConfig({ AGENT_PLANNER_MIN_CONFIDENCE_BPS: '10001' }),
        ),
      ).toThrow(/AGENT_PLANNER_MIN_CONFIDENCE_BPS/);
    });
  });
});
