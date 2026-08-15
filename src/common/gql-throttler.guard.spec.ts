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
});
