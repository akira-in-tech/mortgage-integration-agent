import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard';

const executionContext = (value?: string): ExecutionContext =>
  ({
    getArgByIndex: () => ({ req: { headers: { 'x-api-key': value } } }),
  }) as unknown as ExecutionContext;

describe('ApiKeyGuard', () => {
  it('allows local demo mode without a key', () => {
    const config = {
      get: (name: string) => (name === 'NODE_ENV' ? 'test' : undefined),
    };
    const guard = new ApiKeyGuard(config as ConfigService);

    expect(guard.canActivate(executionContext())).toBe(true);
  });

  it('accepts the configured production key', () => {
    const config = {
      get: (name: string) =>
        name === 'NODE_ENV' ? 'production' : 'portfolio-test-key',
    };
    const guard = new ApiKeyGuard(config as ConfigService);

    expect(guard.canActivate(executionContext('portfolio-test-key'))).toBe(
      true,
    );
  });

  it('rejects a missing or incorrect production key', () => {
    const config = {
      get: (name: string) =>
        name === 'NODE_ENV' ? 'production' : 'portfolio-test-key',
    };
    const guard = new ApiKeyGuard(config as ConfigService);

    expect(() => guard.canActivate(executionContext())).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.canActivate(executionContext('wrong-key'))).toThrow(
      UnauthorizedException,
    );
  });
});
