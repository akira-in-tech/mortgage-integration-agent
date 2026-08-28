import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { getRequestFromContext } from './get-request-from-context';

// Same minimal stand-ins gql-throttler.guard.spec.ts already established
// for what GqlExecutionContext.create() actually reads.
function makeGraphQLExecutionContext(context: unknown): ExecutionContext {
  return {
    getType: () => 'graphql',
    getArgs: () => [{}, {}, context, {}],
    getClass: () => class TestResolver {},
    getHandler: () => function testHandler() {},
  } as unknown as ExecutionContext;
}

function makeHttpExecutionContext(req: unknown): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('getRequestFromContext', () => {
  it('extracts req from the GraphQL resolver context, not the HTTP context', () => {
    const req = { headers: { authorization: 'Bearer x' } };
    const result = getRequestFromContext(
      makeGraphQLExecutionContext({ req, res: {} }),
    );
    expect(result).toBe(req);
  });

  it('extracts req from the HTTP context for a plain REST route', () => {
    const req = { headers: { authorization: 'Bearer y' } };
    const result = getRequestFromContext(makeHttpExecutionContext(req));
    expect(result).toBe(req);
  });
});
