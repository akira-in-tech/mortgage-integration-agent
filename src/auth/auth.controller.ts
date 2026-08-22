import {
  Controller,
  Get,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { OidcIdentityContext } from './oidc-identity-context';
import { OidcIdentityGuard } from './oidc-identity.guard';
import { TenantMembershipDirectoryService } from './tenant-membership-directory.service';

class TenantMembershipSummaryDto {
  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty()
  tenantName!: string;

  @ApiProperty({ enum: ApiClientRole })
  role!: ApiClientRole;
}

/**
 * Pre-tenant identity endpoints. They are intentionally separate from every
 * `/v1/loan-cases` operation: authenticating a person is not authorization to
 * act in a tenant, and selecting a returned membership still leaves all
 * normal `TenantAuthGuard` checks in place.
 */
@ApiTags('identity')
@ApiBearerAuth()
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly tenantDirectory: TenantMembershipDirectoryService,
  ) {}

  @Get('me/tenants')
  @UseGuards(OidcIdentityGuard)
  @ApiOperation({
    operationId: 'listMyTenantMemberships',
    summary: "List the authenticated human user's tenant memberships",
  })
  @ApiOkResponse({ type: TenantMembershipSummaryDto, isArray: true })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or unprovisioned OIDC identity.',
  })
  listMyTenants(
    @Req()
    request: Request & { oidcIdentity?: OidcIdentityContext },
  ): Promise<TenantMembershipSummaryDto[]> {
    // The guard always attaches this context before the controller runs.
    // Fail-closed typing keeps a future direct invocation from substituting a
    // caller-supplied user id if the guard wiring is ever changed.
    if (!request.oidcIdentity) {
      throw new UnauthorizedException('Invalid or missing API credentials');
    }
    return this.tenantDirectory.listForUser(request.oidcIdentity.userId);
  }
}
