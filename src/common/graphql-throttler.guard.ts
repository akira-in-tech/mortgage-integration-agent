import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class GraphqlThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext): {
    req: Record<string, unknown>;
    res: Record<string, unknown>;
  } {
    const graphql = GqlExecutionContext.create(context).getContext<{
      req: Record<string, unknown>;
      res: Record<string, unknown>;
    }>();
    return { req: graphql.req, res: graphql.res };
  }
}
