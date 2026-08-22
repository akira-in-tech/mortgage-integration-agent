import { sanitizeTelemetryAttributes } from './sanitizing-span-exporter';

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
});
