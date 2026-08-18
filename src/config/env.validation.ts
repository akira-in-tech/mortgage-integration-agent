import { plainToInstance, Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
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

  return validatedConfig;
}
