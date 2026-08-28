import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import {
  SanitizingSpanExporter,
  sanitizeTelemetryAttributes,
} from './sanitizing-span-exporter';

describe('telemetry exporter sanitization', () => {
  it('drops business identifiers, credentials, headers, and exception text', () => {
    expect(
      sanitizeTelemetryAttributes({
        temporalWorkflowId: 'case-conditions-borrower-123',
        run_id: 'run-123',
        'http.request.header.authorization': 'Bearer secret',
        'exception.message': 'SSN 000-00-0000',
        'service.name': 'mortgage-worker',
      }),
    ).toEqual({ 'service.name': 'mortgage-worker' });
  });

  it('removes HTTP query strings and reduces SQL to its verb', () => {
    expect(
      sanitizeTelemetryAttributes({
        'url.full': 'https://api.example/v1/cases?borrower=secret',
        'db.query.text': 'SELECT * FROM borrowers WHERE ssn = $1',
      }),
    ).toEqual({
      'url.full': '/v1/cases',
      'db.query.text': 'SELECT',
    });
  });

  it('preserves the complete readable-span contract for the delegate exporter', () => {
    let exported: ReadableSpan | undefined;
    const delegate: SpanExporter = {
      export: (spans, callback) => {
        exported = spans[0];
        callback({ code: 0 });
      },
      shutdown: async () => undefined,
    };
    const source = {
      name: 'pg.query:SELECT tenant_database',
      kind: SpanKind.CLIENT,
      spanContext: () => ({
        traceId: '1'.repeat(32),
        spanId: '2'.repeat(16),
        traceFlags: 1,
      }),
      parentSpanContext: undefined,
      startTime: [1, 0],
      endTime: [1, 1],
      status: { code: SpanStatusCode.ERROR, message: 'borrower secret' },
      attributes: { temporalWorkflowId: 'case-secret' },
      links: [],
      events: [],
      duration: [0, 1],
      ended: true,
      resource: resourceFromAttributes({}),
      instrumentationScope: { name: 'test' },
      droppedAttributesCount: 0,
      droppedEventsCount: 0,
      droppedLinksCount: 0,
    } as ReadableSpan;

    new SanitizingSpanExporter(delegate).export([source], () => undefined);

    expect(exported?.name).toBe('pg.query:SELECT');
    expect(exported?.spanContext()).toEqual(source.spanContext());
    expect(exported?.attributes).toEqual({});
    expect(exported?.status).toEqual({ code: SpanStatusCode.ERROR });
  });
});
