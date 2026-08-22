import {
  safeAgentToolLabel,
  safeTelemetryErrorType,
} from './operational-telemetry';

describe('operational telemetry label safety', () => {
  it('admits registered Agent tools and bounds unknown values', () => {
    expect(safeAgentToolLabel('evaluate_policy')).toBe('evaluate_policy');
    expect(safeAgentToolLabel('borrower-123-custom-tool')).toBe('unknown');
  });

  it('records an error class without copying its sensitive message', () => {
    const error = new Error('borrower SSN 000-00-0000');
    error.name = 'ProviderTimeoutError';

    expect(safeTelemetryErrorType(error)).toBe('ProviderTimeoutError');
    expect(safeTelemetryErrorType('borrower SSN 000-00-0000')).toBe('unknown');
  });

  it('bounds attacker-controlled error names', () => {
    const error = new Error('ignored');
    error.name = 'bad name containing borrower-123';

    expect(safeTelemetryErrorType(error)).toBe('Error');
  });
});
