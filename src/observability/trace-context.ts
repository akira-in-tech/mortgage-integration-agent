import { context, isSpanContextValid, trace } from '@opentelemetry/api';

export interface ActiveTraceFields {
  traceId: string;
  spanId: string;
}

/**
 * Returns opaque correlation identifiers only. Business identifiers and raw
 * request data stay in governed storage rather than being copied into logs.
 */
export function getActiveTraceFields(): ActiveTraceFields | undefined {
  const spanContext = trace.getSpan(context.active())?.spanContext();
  if (!spanContext || !isSpanContextValid(spanContext)) {
    return undefined;
  }
  return { traceId: spanContext.traceId, spanId: spanContext.spanId };
}
