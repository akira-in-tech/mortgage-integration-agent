const DEFAULT_OTLP_ENDPOINT = 'http://127.0.0.1:4318';
const DEFAULT_METRIC_EXPORT_INTERVAL_MS = 15_000;
const DEFAULT_TRACE_SAMPLE_RATIO = 1;

/**
 * OpenTelemetry is opt-in so a missing Collector never changes the default
 * synthetic development path. Only the literal value `true` enables export;
 * ambiguous values remain disabled and are rejected later by env validation.
 */
export function isTelemetryEnabled(value = process.env.OTEL_ENABLED): boolean {
  return value?.trim().toLowerCase() === 'true';
}

export interface TelemetryBootstrapConfig {
  enabled: boolean;
  serviceName: string;
  otlpEndpoint: string;
  metricExportIntervalMs: number;
  traceSampleRatio: number;
}

function boundedNumber(
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

/** Reads the minimal bootstrap configuration before Nest loads application modules. */
export function readTelemetryBootstrapConfig(
  environment: NodeJS.ProcessEnv = process.env,
): TelemetryBootstrapConfig {
  return {
    enabled: isTelemetryEnabled(environment.OTEL_ENABLED),
    serviceName:
      environment.OTEL_SERVICE_NAME?.trim() || 'mortgage-integration-agent',
    otlpEndpoint:
      environment.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/+$/, '') ||
      DEFAULT_OTLP_ENDPOINT,
    metricExportIntervalMs: boundedNumber(
      environment.OTEL_METRIC_EXPORT_INTERVAL_MS,
      DEFAULT_METRIC_EXPORT_INTERVAL_MS,
      1_000,
      300_000,
    ),
    traceSampleRatio: boundedNumber(
      environment.OTEL_TRACE_SAMPLE_RATIO,
      DEFAULT_TRACE_SAMPLE_RATIO,
      0,
      1,
    ),
  };
}

/**
 * Retains HTTP routing value while removing query parameters and fragments,
 * which commonly carry borrower search terms, tokens, or provider signatures.
 */
export function sanitizeHttpTarget(target: string | undefined): string {
  if (!target) {
    return '/';
  }
  if (!target.startsWith('/') && !/^https?:\/\//i.test(target)) {
    return '/';
  }
  try {
    const parsed = new URL(target, 'http://telemetry.invalid');
    return parsed.pathname || '/';
  } catch {
    return '/';
  }
}

/** Keeps only the SQL verb; statement text and bound values never enter telemetry. */
export function normalizeSqlOperation(statement: string): string {
  const operation = statement.trim().match(/^[A-Za-z]+/)?.[0];
  return operation?.toUpperCase() || 'UNKNOWN';
}
