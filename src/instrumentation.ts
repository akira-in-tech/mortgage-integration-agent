import type { IncomingMessage } from 'node:http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { OpenTelemetryPlugin } from '@temporalio/interceptors-opentelemetry-v2';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import {
  normalizeSqlOperation,
  readTelemetryBootstrapConfig,
  sanitizeHttpTarget,
} from './observability/telemetry-config';
import { SanitizingSpanExporter } from './observability/sanitizing-span-exporter';

let sdk: NodeSDK | undefined;
let temporalPlugin: OpenTelemetryPlugin | undefined;

function requestTarget(request: IncomingMessage): string | undefined {
  return request.url;
}

/**
 * Starts before Nest, HTTP, Express, and PostgreSQL modules are loaded so the
 * instrumentation can patch them reliably. Export is deliberately fail-open:
 * observability degradation must never deny a lending-operations request.
 */
function startTelemetry(): void {
  const config = readTelemetryBootstrapConfig();
  if (!config.enabled) {
    return;
  }

  try {
    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
    });
    const spanProcessor = new BatchSpanProcessor(
      new SanitizingSpanExporter(
        new OTLPTraceExporter({
          url: `${config.otlpEndpoint}/v1/traces`,
        }),
      ),
    );
    sdk = new NodeSDK({
      resource,
      sampler: new ParentBasedSampler({
        root: new TraceIdRatioBasedSampler(config.traceSampleRatio),
      }),
      spanProcessors: [spanProcessor],
      metricReaders: [
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({
            url: `${config.otlpEndpoint}/v1/metrics`,
          }),
          exportIntervalMillis: config.metricExportIntervalMs,
        }),
      ],
      instrumentations: [
        new HttpInstrumentation({
          ignoreIncomingRequestHook: (request) =>
            sanitizeHttpTarget(request.url).startsWith('/health/'),
          applyCustomAttributesOnSpan: (span, request) => {
            const target =
              'url' in request
                ? requestTarget(request as IncomingMessage)
                : undefined;
            const sanitizedTarget = sanitizeHttpTarget(target);
            // Overwrite both current and legacy semantic attributes because
            // either may be emitted by a compatible instrumentation release.
            span.setAttribute('url.full', sanitizedTarget);
            span.setAttribute('http.url', sanitizedTarget);
          },
          redactedQueryParams: ['*'],
        }),
        new ExpressInstrumentation(),
        new PgInstrumentation({
          enhancedDatabaseReporting: false,
          addSqlCommenterCommentToQueries: false,
          enableTraceContextPropagation: false,
          requestHook: (span, queryInfo) => {
            // The library adds db.query.text before this hook. Replace it with
            // a bounded verb so SQL literals and schema details are not sent.
            span.setAttribute(
              'db.query.text',
              normalizeSqlOperation(queryInfo.query.text),
            );
          },
        }),
      ],
    });
    sdk.start();
    temporalPlugin = new OpenTelemetryPlugin({ resource, spanProcessor });
  } catch (error) {
    sdk = undefined;
    temporalPlugin = undefined;
    const reason = error instanceof Error ? error.name : 'unknown error';
    console.warn(`OpenTelemetry disabled after bootstrap failure (${reason})`);
  }
}

/** Shares the configured processor with Temporal's replay-safe interceptors. */
export function getTemporalTelemetryPlugins(): OpenTelemetryPlugin[] {
  return temporalPlugin ? [temporalPlugin] : [];
}

startTelemetry();

/** Flushes bounded telemetry during normal process shutdown. */
export async function shutdownTelemetry(): Promise<void> {
  const runningSdk = sdk;
  sdk = undefined;
  temporalPlugin = undefined;
  if (!runningSdk) {
    return;
  }
  try {
    await runningSdk.shutdown();
  } catch (error) {
    const reason = error instanceof Error ? error.name : 'unknown error';
    console.warn(`OpenTelemetry shutdown incomplete (${reason})`);
  }
}
