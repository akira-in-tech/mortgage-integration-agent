import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { getRequestFromContext } from './get-request-from-context';
import { getResponseFromContext } from './get-response-from-context';
import { AuthContext } from './auth-context';
import { GuestSandboxService } from './guest-sandbox.service';

/** Applies the same tenant-scoped AuthContext contract to a temporary demo cookie. */
@Injectable()
export class GuestSandboxGuard implements CanActivate {
  constructor(private readonly sandboxService: GuestSandboxService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getRequestFromContext(context) as Request & {
      authContext?: AuthContext;
    };
    const method = request.method?.toUpperCase();
    request.authContext = await this.sandboxService.authenticate(
      request,
      getResponseFromContext(context),
      !['GET', 'HEAD', 'OPTIONS'].includes(method ?? ''),
    );
    return true;
  }
}
