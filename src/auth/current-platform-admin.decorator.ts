import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { PlatformAdminContext } from './platform-admin-context';
import { getRequestFromContext } from './get-request-from-context';

/** The platform-admin equivalent of `CurrentAuth()` — reads what `PlatformAdminGuard` attached to the request. */
export const CurrentPlatformAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlatformAdminContext => {
    const request = getRequestFromContext(ctx) as Request & {
      platformAdminContext?: PlatformAdminContext;
    };
    if (!request.platformAdminContext) {
      throw new Error('CurrentPlatformAdmin used without PlatformAdminGuard');
    }
    return request.platformAdminContext;
  },
);
