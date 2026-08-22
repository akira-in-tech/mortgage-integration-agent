import type { Attributes } from '@opentelemetry/api';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { normalizeSqlOperation, sanitizeHttpTarget } from './telemetry-config';

const DROPPED_ATTRIBUTE_KEYS = new Set([
  'temporalWorkflowId',
  'temporalActivityId',
  'temporalUpdateId',
  'run_id',
  'db.namespace',
  'db.statement',
  'exception.message',
  'exception.stacktrace',
  'user.id',
  'enduser.id',
]);

function shouldDropAttribute(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    DROPPED_ATTRIBUTE_KEYS.has(key) ||
    normalized.includes('.header.') ||
    normalized.includes('.cookie') ||
    normalized.includes('authorization') ||
    normalized.includes('graphql.document') ||
    normalized.includes('db.query.parameter') ||
    normalized.includes('db.operation.parameter')
  );
}

/** Defense-in-depth filtering at the final exporter boundary. */
export function sanitizeTelemetryAttributes(
  attributes: Attributes,
): Attributes {
  const sanitized: Attributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (shouldDropAttribute(key)) continue;
    if (key === 'url.full' || key === 'http.url') {
      sanitized[key] = sanitizeHttpTarget(String(value));
    } else if (key === 'db.query.text') {
      sanitized[key] = normalizeSqlOperation(String(value));
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function sanitizeSpanName(name: string): string {
  // PostgreSQL instrumentation appends the database namespace to the span
  // name. Keep the operation token and remove that deployment identifier.
  return name.startsWith('pg.query:') ? name.split(/\s+/, 1)[0] : name;
}

function sanitizeSpan(span: ReadableSpan): ReadableSpan {
  return {
    ...span,
    name: sanitizeSpanName(span.name),
    status: { code: span.status.code },
    attributes: sanitizeTelemetryAttributes(span.attributes),
    events: span.events.map((event) => ({
      ...event,
      attributes: sanitizeTelemetryAttributes(event.attributes ?? {}),
    })),
  };
}

/**
 * Wraps any OTLP-compatible exporter, keeping the backend replaceable while
 * enforcing one data-loss-prevention boundary for automatic and manual spans.
 */
export class SanitizingSpanExporter implements SpanExporter {
  constructor(private readonly delegate: SpanExporter) {}

  export(
    spans: ReadableSpan[],
    resultCallback: Parameters<SpanExporter['export']>[1],
  ): void {
    this.delegate.export(spans.map(sanitizeSpan), resultCallback);
  }

  forceFlush(): Promise<void> {
    return this.delegate.forceFlush?.() ?? Promise.resolve();
  }

  shutdown(): Promise<void> {
    return this.delegate.shutdown();
  }
}
