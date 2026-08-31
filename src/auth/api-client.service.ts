import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiClient } from '../database/entities/api-client.entity';
import {
  ApiClientRole,
  ApiClientStatus,
} from '../database/enums/api-client.enum';
import {
  generateApiClientSecret,
  hashApiClientSecret,
} from './api-client-secret';

export interface CreateApiClientInput {
  tenantId: string;
  name: string;
  /** Defaults to `PARTNER` — the routine-integration role. Pass `REVIEWER` for a credential meant to submit review decisions (Section 6.3). */
  role?: ApiClientRole;
}

export interface CreateApiClientResult {
  client: ApiClient;
  /** The raw bearer token (`{id}.{secret}`) — generated once, never persisted, never retrievable again after this call returns. */
  token: string;
}

export interface RotateApiClientResult {
  client: ApiClient;
  /** The replacement raw bearer token, shown once and never persisted. */
  token: string;
}

/**
 * No REST endpoint creates an `ApiClient` — the same honest gap this
 * codebase already has for tenant creation itself (README: "seed one
 * directly via the tenants table for local use"). An endpoint that could
 * mint credentials would need its own authentication story first
 * (who's allowed to create API clients?), which is exactly the
 * administrative-duties/RBAC work this slice is not attempting — so
 * `npm run create-api-client` (a script, not an endpoint) is this
 * slice's honest answer, matching `evaluation-report.ts`/
 * `generate-openapi-spec.ts`'s own established script pattern.
 */
@Injectable()
export class ApiClientService {
  constructor(
    @InjectRepository(ApiClient)
    private readonly apiClientRepository: Repository<ApiClient>,
  ) {}

  async create(input: CreateApiClientInput): Promise<CreateApiClientResult> {
    const secret = generateApiClientSecret();
    const client = await this.apiClientRepository.save(
      this.apiClientRepository.create({
        tenantId: input.tenantId,
        name: input.name,
        hashedSecret: hashApiClientSecret(secret),
        status: ApiClientStatus.ACTIVE,
        role: input.role ?? ApiClientRole.PARTNER,
      }),
    );
    return { client, token: `${client.id}.${secret}` };
  }

  /**
   * Replaces one active client's secret atomically. The old bearer token
   * fails on the next request; callers needing an overlap create a second
   * client, switch the integration, and revoke the first explicitly.
   */
  async rotate(id: string): Promise<RotateApiClientResult> {
    const client = await this.apiClientRepository.findOneBy({ id });
    if (!client) {
      throw new NotFoundException(`API client ${id} not found`);
    }
    if (client.status !== ApiClientStatus.ACTIVE) {
      throw new ConflictException(`API client ${id} is not active`);
    }

    const secret = generateApiClientSecret();
    client.hashedSecret = hashApiClientSecret(secret);
    const rotated = await this.apiClientRepository.save(client);
    return { client: rotated, token: `${rotated.id}.${secret}` };
  }

  /**
   * Revocation preserves the identity and its historical audit references
   * while making every subsequent bearer-token verification fail closed.
   */
  async revoke(id: string): Promise<ApiClient> {
    const client = await this.apiClientRepository.findOneBy({ id });
    if (!client) {
      throw new NotFoundException(`API client ${id} not found`);
    }
    if (client.status === ApiClientStatus.REVOKED) {
      return client;
    }

    client.status = ApiClientStatus.REVOKED;
    return this.apiClientRepository.save(client);
  }
}
