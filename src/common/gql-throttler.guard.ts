import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * The default ThrottlerGuard reads the request/response off the HTTP
 * execution context, which a GraphQL resolver's arguments don't populate
 * the same way. Without this override, rate limiting would silently stop
 * tracking the app's GraphQL endpoint while still working for plain REST
 * controllers. Requires GraphQLModule's context factory to expose
 * `req`/`res` (see app.module.ts). Applied globally (APP_GUARD), so it must
 * also handle plain REST contexts (e.g. src/cases, /health) correctly —
 * `context.getType()` distinguishes the two instead of assuming every
 * request is a GraphQL one.
 */
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext): {
    req: Record<string, unknown>;
    res: Record<string, unknown>;
  } {
    if (context.getType<GqlContextType>() !== 'graphql') {
      const httpContext = context.switchToHttp();
      return {
        req: httpContext.getRequest(),
        res: httpContext.getResponse(),
      };
    }
    const gqlContext = GqlExecutionContext.create(context).getContext<{
      req: Record<string, unknown>;
      res: Record<string, unknown>;
    }>();
    return { req: gqlContext.req, res: gqlContext.res };
  }
}
