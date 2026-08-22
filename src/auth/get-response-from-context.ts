import { ExecutionContext } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { Response } from 'express';

/** Express response counterpart to `getRequestFromContext`, used only when a refreshed BFF session rotates cookies. */
export function getResponseFromContext(context: ExecutionContext): Response {
  if (context.getType<GqlContextType>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext<{ res: Response }>()
      .res;
  }
  return context.switchToHttp().getResponse<Response>();
}
