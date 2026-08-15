import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { GqlThrottlerGuard } from './gql-throttler.guard';

function makeGraphQLExecutionContext(context: unknown): ExecutionContext {
  // Minimal stand-in for the parts GqlExecutionContext.create() reads:
  // it calls getType/getArgs/getClass/getHandler on whatever it's given.
  // Resolver args are the standard (root, args, context, info) tuple.
  return {
    getType: () => 'graphql',
    getArgs: () => [{}, {}, context, {}],
    getClass: () => class TestResolver {},
    getHandler: () => function testHandler() {},
  } as unknown as ExecutionContext;
}

function makeHttpExecutionContext(
  req: unknown,
  res: unknown,
): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

describe('GqlThrottlerGuard', () => {
  it('extracts req/res from the GraphQL resolver context, not the HTTP context', () => {
    const guard = new GqlThrottlerGuard(
      { throttlers: [] } as unknown as ThrottlerModuleOptions,
      undefined as never,
      undefined as never,
    );
    const req = { ip: '127.0.0.1' };
    const res = { setHeader: jest.fn() };

    const result = (
      guard as unknown as {
        getRequestResponse(context: ExecutionContext): {
          req: unknown;
          res: unknown;
        };
      }
    ).getRequestResponse(makeGraphQLExecutionContext({ req, res }));

    expect(result.req).toBe(req);
    expect(result.res).toBe(res);
  });

  // Guards against a regression this suite would previously have missed:
  // wired globally via APP_GUARD, this guard runs on every REST route too
  // (src/cases, /health) — treating every request as GraphQL crashed those
  // routes (GqlExecutionContext.getContext() does not return {req, res}
  // for a plain HTTP context), only ever caught by first exercising a
  // non-@SkipThrottle REST controller end-to-end.
  it('extracts req/res from the HTTP context for a plain REST route', () => {
    const guard = new GqlThrottlerGuard(
      { throttlers: [] } as unknown as ThrottlerModuleOptions,
      undefined as never,
      undefined as never,
    );
    const req = { ip: '127.0.0.1' };
    const res = { setHeader: jest.fn() };

    const result = (
      guard as unknown as {
        getRequestResponse(context: ExecutionContext): {
          req: unknown;
          res: unknown;
        };
      }
    ).getRequestResponse(makeHttpExecutionContext(req, res));

    expect(result.req).toBe(req);
    expect(result.res).toBe(res);
  });
});
