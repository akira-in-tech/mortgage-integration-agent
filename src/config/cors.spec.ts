import { resolveCorsOrigin } from './cors';
import { NodeEnvironment } from './env.validation';

describe('resolveCorsOrigin', () => {
  it('splits an explicit allowlist into trimmed origins', () => {
    expect(
      resolveCorsOrigin(
        'https://console.example.com, https://ops.example.com',
        NodeEnvironment.Production,
      ),
    ).toEqual(['https://console.example.com', 'https://ops.example.com']);
  });

  it('honors an explicit allowlist even in development', () => {
    expect(
      resolveCorsOrigin(
        'https://console.example.com',
        NodeEnvironment.Development,
      ),
    ).toEqual(['https://console.example.com']);
  });

  it('falls back to a localhost-only regex in development when unset', () => {
    const origin = resolveCorsOrigin(undefined, NodeEnvironment.Development);
    expect(origin).toBeInstanceOf(RegExp);
    expect((origin as RegExp).test('http://localhost:5173')).toBe(true);
    expect((origin as RegExp).test('https://evil.example.com')).toBe(false);
  });

  it.each([
    NodeEnvironment.Test,
    NodeEnvironment.Staging,
    NodeEnvironment.Production,
  ])('fails closed (no cross-origin access) in %s when unset', (nodeEnv) => {
    expect(resolveCorsOrigin(undefined, nodeEnv)).toBe(false);
  });
});
