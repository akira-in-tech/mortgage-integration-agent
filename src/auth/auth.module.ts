import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiClient } from '../database/entities/api-client.entity';
import { User } from '../database/entities/user.entity';
import { TenantMembership } from '../database/entities/tenant-membership.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { ApiClientService } from './api-client.service';
import { ApiKeyGuard } from './api-key.guard';
import { OidcService } from './oidc.service';
import { OidcGuard } from './oidc.guard';
import { TenantAuthGuard } from './tenant-auth.guard';
import { RoleGuard } from './role.guard';
import { AuditModule } from '../audit/audit.module';
import { OidcIdentityGuard } from './oidc-identity.guard';
import { TenantMembershipDirectoryService } from './tenant-membership-directory.service';
import { AuthController } from './auth.controller';
import { OidcSession } from '../database/entities/oidc-session.entity';
import { OidcSessionService } from './oidc-session.service';
import { SelfServiceProvisioningService } from './self-service-provisioning.service';
import { GuestSandboxSession } from '../database/entities/guest-sandbox-session.entity';
import { GuestSandboxService } from './guest-sandbox.service';
import { GuestSandboxGuard } from './guest-sandbox.guard';
import { GuestSandboxController } from './guest-sandbox.controller';

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
    TypeOrmModule.forFeature([
      ApiClient,
      User,
      TenantMembership,
      Tenant,
      OidcSession,
      GuestSandboxSession,
    ]),
    AuditModule,
  ],
  providers: [
    ApiClientService,
    ApiKeyGuard,
    OidcService,
    OidcSessionService,
    OidcGuard,
    OidcIdentityGuard,
    TenantAuthGuard,
    RoleGuard,
    TenantMembershipDirectoryService,
    SelfServiceProvisioningService,
    GuestSandboxService,
    GuestSandboxGuard,
  ],
  controllers: [AuthController, GuestSandboxController],
  exports: [
    ApiClientService,
    ApiKeyGuard,
    OidcService,
    OidcSessionService,
    OidcGuard,
    OidcIdentityGuard,
    TenantAuthGuard,
    RoleGuard,
    TenantMembershipDirectoryService,
    SelfServiceProvisioningService,
    GuestSandboxService,
    GuestSandboxGuard,
  ],
})
export class AuthModule {}
