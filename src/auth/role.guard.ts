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
import { AuditEventService } from '../audit/audit-event.service';
import { getRequestFromContext } from './get-request-from-context';

/**
 * M5-017's scoped RBAC (Section 20 M5's own scope line). Runs after
 * `ApiKeyGuard` (a route combining both always lists `ApiKeyGuard` first,
 * class-level; `RoleGuard` is method-level, via `@RequireRole(...)`) —
 * `request.authContext` is always already populated by the time this
 * guard reads it. A route with no `@RequireRole(...)` metadata allows
 * every authenticated role through unchanged.
 *
 * Records an `RBAC_REJECTED` audit event (M5-019) before throwing — a
 * rejected authorization attempt is exactly the kind of security-history
 * fact Section 14.1's `audit_events` names, and there is no successful
 * action here to record instead.
 */
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditEventService: AuditEventService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<ApiClientRole[] | undefined>(
      REQUIRED_ROLES_KEY,
      context.getHandler(),
    );
    if (!required || required.length === 0) {
      return true;
    }

    const request = getRequestFromContext(context) as Request & {
      authContext?: AuthContext;
    };
    if (!request.authContext) {
      // Programming error, not a caller-triggerable state — see
      // AuthTenantId's identical reasoning.
      throw new Error('RoleGuard used without TenantAuthGuard');
    }

    if (!required.includes(request.authContext.role)) {
      const { tenantId, actorId, correlationId, role } = request.authContext;
      await this.auditEventService.record({
        tenantId,
        actorId,
        action: 'RBAC_REJECTED',
        resourceType: 'route',
        resourceId: `${context.getClass().name}.${context.getHandler().name}`,
        correlationId,
        reason: `client role ${role} is not one of the required roles: ${required.join(', ')}`,
      });
      throw new ForbiddenException(
        `This action requires one of these roles: ${required.join(', ')}`,
      );
    }
    return true;
  }
}
