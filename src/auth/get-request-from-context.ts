import { ExecutionContext } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';

/**
 * Every auth guard/decorator (`ApiKeyGuard`/`OidcGuard`/`RoleGuard`/
 * `AuthTenantId`/`CurrentAuth`) needs the real Express request regardless
 * of whether it's invoked from a REST controller or a GraphQL resolver —
 * the identical real distinction `GqlThrottlerGuard`'s own comment
 * already documents (M2-ish): a GraphQL resolver's `ExecutionContext`
 * does not populate `switchToHttp()` the same way a plain HTTP route's
 * does. `GraphQLModule`'s own context factory (`app.module.ts`) exposes
 * `{ req, res }` specifically so this extraction works.
 */
export function getRequestFromContext(context: ExecutionContext): Request {
  if (context.getType<GqlContextType>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext<{ req: Request }>()
      .req;
  }
  return context.switchToHttp().getRequest<Request>();
}
