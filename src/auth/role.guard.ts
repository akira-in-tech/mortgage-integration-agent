import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthContext } from './auth-context';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { REQUIRED_ROLES_KEY } from './require-role.decorator';

/**
 * M5-017's scoped RBAC (Section 20 M5's own scope line). Runs after
 * `ApiKeyGuard` (a route combining both always lists `ApiKeyGuard` first,
 * class-level; `RoleGuard` is method-level, via `@RequireRole(...)`) —
 * `request.authContext` is always already populated by the time this
 * guard reads it. A route with no `@RequireRole(...)` metadata allows
 * every authenticated role through unchanged.
 */
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<ApiClientRole[] | undefined>(
      REQUIRED_ROLES_KEY,
      context.getHandler(),
    );
    if (!required || required.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { authContext?: AuthContext }>();
    if (!request.authContext) {
      // Programming error, not a caller-triggerable state — see
      // AuthTenantId's identical reasoning.
      throw new Error('RoleGuard used without ApiKeyGuard');
    }

    if (!required.includes(request.authContext.role)) {
      throw new ForbiddenException(
        `This action requires one of these roles: ${required.join(', ')}`,
      );
    }
    return true;
  }
}
