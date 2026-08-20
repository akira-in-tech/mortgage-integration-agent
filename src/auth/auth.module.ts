import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiClient } from '../database/entities/api-client.entity';
import { User } from '../database/entities/user.entity';
import { TenantMembership } from '../database/entities/tenant-membership.entity';
import { ApiClientService } from './api-client.service';
import { ApiKeyGuard } from './api-key.guard';
import { OidcService } from './oidc.service';
import { OidcGuard } from './oidc.guard';
import { TenantAuthGuard } from './tenant-auth.guard';
import { RoleGuard } from './role.guard';
import { AuditModule } from '../audit/audit.module';

/**
 * `@Global()`: `TenantAuthGuard` is applied via `@UseGuards(TenantAuthGuard)`
 * (a raw class reference) on every tenant-scoped controller — `CasesModule`,
 * `WebhooksModule`, and any future one. Making the module global means
 * every consumer resolves the exact same guard/service instances without
 * each one separately importing `AuthModule`, and avoids a real
 * module-instantiation-order failure Nest's testing module builder (but
 * not its production bootstrapper) surfaced when two independent feature
 * modules each imported `AuthModule` non-globally.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ApiClient, User, TenantMembership]),
    AuditModule,
  ],
  providers: [
    ApiClientService,
    ApiKeyGuard,
    OidcService,
    OidcGuard,
    TenantAuthGuard,
    RoleGuard,
  ],
  exports: [
    ApiClientService,
    ApiKeyGuard,
    OidcService,
    OidcGuard,
    TenantAuthGuard,
    RoleGuard,
  ],
})
export class AuthModule {}
