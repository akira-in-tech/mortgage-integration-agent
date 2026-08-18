import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthContext } from './auth-context';

/**
 * The tenantId a controller method should ever act on — always the one
 * `ApiKeyGuard` resolved from the caller's own credentials, never one a
 * request body or query string supplies. This is what makes cross-tenant
 * access fail closed *by construction*: there is no `dto.tenantId` field
 * left for a caller to (correctly or maliciously) mismatch against their
 * own token.
 */
export const AuthTenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { authContext?: AuthContext }>();
    if (!request.authContext) {
      // ApiKeyGuard did not run — a route missing @UseGuards(ApiKeyGuard)
      // while still using this decorator is a programming error, not a
      // caller-triggerable state.
      throw new Error('AuthTenantId used without ApiKeyGuard');
    }
    return request.authContext.tenantId;
  },
);
