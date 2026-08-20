import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { ApiClient } from '../database/entities/api-client.entity';
import { ApiClientStatus } from '../database/enums/api-client.enum';
import { verifyApiClientSecret } from './api-client-secret';
import { AuthContext } from './auth-context';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Section 20 M5's own exit evidence: "cross-tenant tests fail closed at
 * API, service, and database layers." This is the API layer — every
 * route it guards resolves a real, checked `AuthContext` (tenantId +
 * actorId) or the request never reaches the controller at all.
 * Deliberately generic on every failure path (missing header, malformed
 * token, unknown client, wrong secret, revoked client all return the
 * same 401 with the same message) — the same "don't leak which part
 * failed" reasoning `HealthController.ready()` already applies to
 * database-unreachable responses.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(ApiClient)
    private readonly apiClientRepository: Repository<ApiClient>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { authContext?: AuthContext }>();

    const header = request.headers['authorization'];
    const token =
      typeof header === 'string' && header.startsWith('Bearer ')
        ? header.slice('Bearer '.length).trim()
        : undefined;
    const [clientId, secret] = token?.split('.', 2) ?? [];
    // The UUID shape check runs before any query reaches Postgres — a
    // malformed clientId (not just an unknown one) must still fail closed
    // with a clean 401, not an unhandled 500 from the database rejecting
    // an invalid uuid literal.
    if (!clientId || !secret || !UUID_PATTERN.test(clientId)) {
      throw new UnauthorizedException('Invalid or missing API credentials');
    }

    const client = await this.apiClientRepository.findOneBy({ id: clientId });
    if (
      !client ||
      client.status !== ApiClientStatus.ACTIVE ||
      !verifyApiClientSecret(secret, client.hashedSecret)
    ) {
      throw new UnauthorizedException('Invalid or missing API credentials');
    }

    request.authContext = {
      tenantId: client.tenantId,
      actorId: client.id,
      role: client.role,
      correlationId: randomUUID(),
    };
    return true;
  }
}
