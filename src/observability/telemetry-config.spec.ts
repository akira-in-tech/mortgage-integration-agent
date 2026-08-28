import {
  isTelemetryEnabled,
  normalizeSqlOperation,
  readTelemetryBootstrapConfig,
  sanitizeHttpTarget,
} from './telemetry-config';

describe('telemetry configuration', () => {
  it('stays disabled unless explicitly enabled', () => {
    expect(isTelemetryEnabled(undefined)).toBe(false);
    expect(isTelemetryEnabled('false')).toBe(false);
    expect(isTelemetryEnabled('TRUE')).toBe(true);
  });

  it('uses bounded, deployment-neutral defaults', () => {
    expect(readTelemetryBootstrapConfig({})).toEqual({
      enabled: false,
      serviceName: 'mortgage-integration-agent',
      otlpEndpoint: 'http://127.0.0.1:4318',
      metricExportIntervalMs: 15_000,
      traceSampleRatio: 1,
    });
  });

  it('removes query strings and fragments from HTTP telemetry', () => {
    expect(sanitizeHttpTarget('/v1/cases?borrower=secret#application')).toBe(
      '/v1/cases',
    );
    expect(sanitizeHttpTarget('not a valid url %')).toBe('/');
  });

  it('reduces SQL statements to a non-sensitive operation label', () => {
    expect(normalizeSqlOperation(' SELECT * FROM borrower WHERE id = $1')).toBe(
      'SELECT',
    );
    expect(normalizeSqlOperation('')).toBe('UNKNOWN');
  });
});
