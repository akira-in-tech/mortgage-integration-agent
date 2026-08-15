import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * The default ThrottlerGuard reads the request/response off the HTTP
 * execution context, which a GraphQL resolver's arguments don't populate
 * the same way. Without this override, rate limiting would silently stop
 * tracking the app's one real endpoint (GraphQL) while still working for
 * plain REST controllers such as /health. Requires GraphQLModule's context
 * factory to expose `req`/`res` (see app.module.ts).
 */
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext): {
    req: Record<string, unknown>;
    res: Record<string, unknown>;
  } {
    const gqlContext = GqlExecutionContext.create(context).getContext<{
      req: Record<string, unknown>;
      res: Record<string, unknown>;
    }>();
    return { req: gqlContext.req, res: gqlContext.res };
  }
}
