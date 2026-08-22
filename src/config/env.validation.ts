import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

// ─── Enums ──────────────────────────────────────────────────────────────────

/**
 * Deployment environments that production-safety checks branch on
 * (schema synchronization, GraphQL introspection). Kept as an explicit
 * enum — rather than a free-form string — so a typo such as "Production"
 * fails startup instead of silently leaving a production guard disabled.
 */
export enum NodeEnvironment {
  Development = 'development',
  Test = 'test',
  Staging = 'staging',
  Production = 'production',
}

/** Which underwriting decisioning backend AgentService uses (src/agent). */
export enum DecisionProvider {
  Rules = 'rules',
  Ollama = 'ollama',
}

// ─── Schema ─────────────────────────────────────────────────────────────────

export class EnvironmentVariables {
  @IsOptional()
  @IsEnum(NodeEnvironment, {
    message: `NODE_ENV must be one of: ${Object.values(NodeEnvironment).join(', ')}`,
  })
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @Matches(/^postgres(ql)?:\/\/\S+/, {
    message:
      'DATABASE_URL is required and must be a postgres:// or postgresql:// connection string',
  })
  DATABASE_URL!: string;

  // The application's own runtime connection in production (M5-003) — a
  // restricted, non-superuser role (see the AppRuntimeRole migration),
  // distinct from DATABASE_URL's migration/admin role. Unused outside
  // production; see createTypeOrmOptions for the fallback if unset there.
  @IsOptional()
  @Matches(/^postgres(ql)?:\/\/\S+/, {
    message:
      'APP_DATABASE_URL must be a postgres:// or postgresql:// connection string',
  })
  APP_DATABASE_URL?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  // Comma-separated http(s):// origins. Left unset, CORS falls back to a
  // localhost-only allowance in development and is disabled everywhere
  // else — see src/config/cors.ts.
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/\S+(\s*,\s*https?:\/\/\S+)*$/, {
    message:
      'CORS_ALLOWED_ORIGINS must be a comma-separated list of http(s):// origins',
  })
  CORS_ALLOWED_ORIGINS?: string;

  @IsOptional()
  @IsInt()
  @Min(1000)
  RATE_LIMIT_TTL_MS: number = 60_000;

  @IsOptional()
  @IsInt()
  @Min(1)
  RATE_LIMIT_MAX: number = 100;

  // ── Agent decisioning (src/agent/agent.service.ts) ──────────────────────
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEnum(DecisionProvider, {
    message: `DECISION_PROVIDER must be either "${DecisionProvider.Rules}" or "${DecisionProvider.Ollama}"`,
  })
  DECISION_PROVIDER: DecisionProvider = DecisionProvider.Rules;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\/+$/, '') : value,
  )
  @IsString()
  @Matches(/^https?:\/\/\S+$/, {
    message: 'OLLAMA_BASE_URL must be an http(s) URL',
  })
  OLLAMA_BASE_URL: string = 'http://127.0.0.1:11434';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  OLLAMA_MODEL: string = 'qwen3.5:9b';

  @IsOptional()
  @IsInt()
  @Min(1)
  OLLAMA_TIMEOUT_MS: number = 60_000;

  // ── Temporal (src/workflows, src/worker.ts) ─────────────────────────────
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  TEMPORAL_ADDRESS: string = 'localhost:7233';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  TEMPORAL_NAMESPACE: string = 'default';

  // ── Outbox event signing (src/database/outbox) ──────────────────────────
  // HMAC secret for the transactional outbox's signed status events
  // (Section 15.3). The default is fine for local development only — this
  // slice has no deployment target yet (see docs/DEVELOPMENT_LOG.md M2-006
  // Known gaps); a real deployment must set its own secret.
  @IsOptional()
  @IsString()
  @MinLength(16, {
    message: 'OUTBOX_SIGNING_SECRET must be at least 16 characters',
  })
  OUTBOX_SIGNING_SECRET: string = 'dev-outbox-signing-secret-change-me';

  // ── Webhook dispatch (src/webhooks, src/worker.ts) ──────────────────────
  // How often the Worker service polls for unpublished outbox events and
  // due webhook-delivery retries (Section 12.1: "webhook delivery").
  @IsOptional()
  @IsInt()
  @Min(100)
  WEBHOOK_DISPATCH_INTERVAL_MS: number = 5000;

  // ── Provider reconciliation (src/provider-platform, src/worker.ts) ──────
  // Section 11.5's reconciliation sweep (M5-027): how often the Worker
  // service scans for OUTCOME_UNKNOWN intents, and how long one must sit
  // in that state before being flagged RECONCILING for human review.
  @IsOptional()
  @IsInt()
  @Min(1000)
  PROVIDER_RECONCILIATION_INTERVAL_MS: number = 60_000;

  @IsOptional()
  @IsInt()
  @Min(1000)
  PROVIDER_RECONCILIATION_STALE_AFTER_MS: number = 300_000;

  // ── OIDC (src/auth/oidc.*, M5-024) ───────────────────────────────────────
  // Section 16.1: "OIDC/OAuth 2.0 for people" — a real OIDC issuer (this
  // codebase's own docker-compose.yml ships self-hosted Keycloak for local
  // use). Both unset means OidcGuard always fails closed with a clean 401;
  // ApiKeyGuard's machine-credential path is completely unaffected either
  // way, so a deployment that never needs human OIDC login can leave both
  // unset rather than being forced to stand up an identity provider.
  @IsOptional()
  @IsString()
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_tld: false,
    },
    {
      message: 'OIDC_ISSUER_URL must be an http(s) URL',
    },
  )
  OIDC_ISSUER_URL?: string;

  // The `aud` claim OidcService requires every verified token to carry —
  // this codebase's own Keycloak client id in the standard case.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  OIDC_AUDIENCE?: string;

  // OAuth client id defaults to OIDC_AUDIENCE. It is separate because some
  // providers issue an API audience that differs from the relying-party id.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  OIDC_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  OIDC_CLIENT_SECRET?: string;

  @IsOptional()
  @IsString()
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_tld: false,
    },
    {
      message: 'OIDC_CALLBACK_URL must be an http(s) URL',
    },
  )
  OIDC_CALLBACK_URL?: string;

  @IsOptional()
  @IsString()
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_tld: false,
    },
    {
      message: 'CONSOLE_ORIGIN must be an http(s) origin',
    },
  )
  CONSOLE_ORIGIN?: string;

  // 32-byte AES-256 key, hex encoded. A local-only default is selected by
  // OidcSessionService outside production; production must provide its own.
  @IsOptional()
  @IsString()
  @Matches(/^[0-9a-fA-F]{64}$/, {
    message:
      'OIDC_SESSION_ENCRYPTION_KEY must be exactly 64 hexadecimal characters',
  })
  OIDC_SESSION_ENCRYPTION_KEY?: string;

  @IsOptional()
  @IsInt()
  @Min(300)
  @Max(2_592_000)
  OIDC_SESSION_MAX_AGE_SECONDS: number = 28_800;

  // ── OpenTelemetry (src/instrumentation.ts) ──────────────────────────────
  // Export is opt-in and OTLP-only, keeping the runtime independent from a
  // specific hosted observability vendor or paid API key.
  @IsOptional()
  @Transform(({ obj }: { obj: Record<string, unknown> }) => {
    const value = obj.OTEL_ENABLED;
    if (typeof value !== 'string') return value;
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    return value;
  })
  @IsBoolean()
  OTEL_ENABLED: boolean = false;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  OTEL_SERVICE_NAME: string = 'mortgage-integration-agent';

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\/+$/, '') : value,
  )
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_tld: false,
    },
    { message: 'OTEL_EXPORTER_OTLP_ENDPOINT must be an http(s) URL' },
  )
  OTEL_EXPORTER_OTLP_ENDPOINT: string = 'http://127.0.0.1:4318';

  @IsOptional()
  @IsInt()
  @Min(1_000)
  @Max(300_000)
  OTEL_METRIC_EXPORT_INTERVAL_MS: number = 15_000;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  OTEL_TRACE_SAMPLE_RATIO: number = 1;
}

// ─── Validator ──────────────────────────────────────────────────────────────

/**
 * Wired into `ConfigModule.forRoot({ validate })`. Fails bootstrap with every
 * missing or malformed variable listed at once, instead of letting a bad
 * value surface later as an opaque database-connection or server error.
 */
export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });
  if (errors.length > 0) {
    const details = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .join('\n  - ');
    throw new Error(`Invalid environment configuration:\n  - ${details}`);
  }

  const productionLike =
    validatedConfig.NODE_ENV === NodeEnvironment.Production ||
    validatedConfig.NODE_ENV === NodeEnvironment.Staging;
  if (productionLike && !validatedConfig.APP_DATABASE_URL) {
    throw new Error(
      'Invalid environment configuration:\n  - APP_DATABASE_URL is required in staging and production',
    );
  }
  if (
    productionLike &&
    validatedConfig.APP_DATABASE_URL === validatedConfig.DATABASE_URL
  ) {
    throw new Error(
      'Invalid environment configuration:\n  - APP_DATABASE_URL must use a separate restricted runtime credential',
    );
  }

  const issuerConfigured = Boolean(validatedConfig.OIDC_ISSUER_URL);
  const audienceConfigured = Boolean(validatedConfig.OIDC_AUDIENCE);
  const oidcSupplementConfigured = Boolean(
    validatedConfig.OIDC_CLIENT_ID ||
    validatedConfig.OIDC_CLIENT_SECRET ||
    validatedConfig.OIDC_CALLBACK_URL ||
    validatedConfig.CONSOLE_ORIGIN ||
    validatedConfig.OIDC_SESSION_ENCRYPTION_KEY,
  );
  if (
    issuerConfigured !== audienceConfigured ||
    (oidcSupplementConfigured && !issuerConfigured)
  ) {
    throw new Error(
      'Invalid environment configuration:\n  - OIDC_ISSUER_URL and OIDC_AUDIENCE must be configured together',
    );
  }
  if (productionLike && issuerConfigured) {
    const productionErrors: string[] = [];
    if (!validatedConfig.OIDC_SESSION_ENCRYPTION_KEY) {
      productionErrors.push(
        'OIDC_SESSION_ENCRYPTION_KEY is required when OIDC is enabled in staging or production',
      );
    }
    if (!validatedConfig.OIDC_CALLBACK_URL) {
      productionErrors.push(
        'OIDC_CALLBACK_URL is required when OIDC is enabled in staging or production',
      );
    }
    if (!validatedConfig.CONSOLE_ORIGIN) {
      productionErrors.push(
        'CONSOLE_ORIGIN is required when OIDC is enabled in staging or production',
      );
    }
    for (const [name, value] of [
      ['OIDC_ISSUER_URL', validatedConfig.OIDC_ISSUER_URL],
      ['OIDC_CALLBACK_URL', validatedConfig.OIDC_CALLBACK_URL],
      ['CONSOLE_ORIGIN', validatedConfig.CONSOLE_ORIGIN],
    ] as const) {
      if (value && new URL(value).protocol !== 'https:') {
        productionErrors.push(
          `${name} must use HTTPS in staging or production`,
        );
      }
    }
    if (productionErrors.length > 0) {
      throw new Error(
        `Invalid environment configuration:\n  - ${productionErrors.join('\n  - ')}`,
      );
    }
  }

  if (validatedConfig.CONSOLE_ORIGIN) {
    const originUrl = new URL(validatedConfig.CONSOLE_ORIGIN);
    if (
      originUrl.origin !== validatedConfig.CONSOLE_ORIGIN ||
      originUrl.pathname !== '/'
    ) {
      throw new Error(
        'Invalid environment configuration:\n  - CONSOLE_ORIGIN must contain only scheme and authority',
      );
    }
  }

  return validatedConfig;
}
