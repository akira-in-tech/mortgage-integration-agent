import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
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
