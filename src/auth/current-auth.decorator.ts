import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthContext } from './auth-context';

/** The full `AuthContext` `TenantAuthGuard` resolved — for call sites that need more than just `tenantId` (`AuthTenantId()` stays the narrower, more common case). Used by M5-019's audit-event call sites, which need `actorId`/`correlationId` too. */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { authContext?: AuthContext }>();
    if (!request.authContext) {
      throw new Error('CurrentAuth used without TenantAuthGuard');
    }
    return request.authContext;
  },
);
