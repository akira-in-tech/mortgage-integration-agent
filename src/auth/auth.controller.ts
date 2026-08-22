import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { OidcIdentityContext } from './oidc-identity-context';
import { OidcIdentityGuard } from './oidc-identity.guard';
import { TenantMembershipDirectoryService } from './tenant-membership-directory.service';
import { OidcSessionService } from './oidc-session.service';

class TenantMembershipSummaryDto {
  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty()
  tenantName!: string;

  @ApiProperty({ enum: ApiClientRole })
  role!: ApiClientRole;
}

class OidcSessionStatusDto {
  @ApiProperty()
  authenticated!: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  userId?: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional()
  csrfToken?: string;

  @ApiProperty({ type: TenantMembershipSummaryDto, isArray: true })
  memberships!: TenantMembershipSummaryDto[];
}

class OidcLogoutResultDto {
  @ApiPropertyOptional()
  logoutUrl!: string | null;
}

/**
 * Pre-tenant identity endpoints. They are intentionally separate from every
 * `/v1/loan-cases` operation: authenticating a person is not authorization to
 * act in a tenant, and selecting a returned membership still leaves all
 * normal `TenantAuthGuard` checks in place.
 */
@ApiTags('identity')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly tenantDirectory: TenantMembershipDirectoryService,
    private readonly oidcSessionService: OidcSessionService,
  ) {}

  @Get('session/login')
  @ApiOperation({
    operationId: 'beginOidcSessionLogin',
    summary: 'Start server-side Authorization Code + PKCE login',
  })
  @ApiQuery({ name: 'returnTo', required: false })
  async beginSessionLogin(
    @Res() response: Response,
    @Query('returnTo') returnTo?: string,
  ): Promise<void> {
    const authorizationUrl = await this.oidcSessionService.beginLogin(
      response,
      returnTo,
    );
    response.redirect(302, authorizationUrl);
  }

  @Get('session/callback')
  @ApiOperation({
    operationId: 'completeOidcSessionLogin',
    summary: 'Complete OIDC login and issue an HttpOnly session',
  })
  async completeSessionLogin(
    @Req() request: Request,
    @Res() response: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
  ): Promise<void> {
    if (!code || !state) {
      throw new BadRequestException('OIDC callback requires code and state');
    }
    const returnUrl = await this.oidcSessionService.completeLogin(
      request,
      response,
      code,
      state,
    );
    response.redirect(302, returnUrl);
  }

  @Get('session')
  @ApiCookieAuth('meridian_session')
  @ApiOperation({
    operationId: 'getOidcSession',
    summary: 'Resolve and refresh the current HttpOnly OIDC session',
  })
  @ApiOkResponse({ type: OidcSessionStatusDto })
  async getSession(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OidcSessionStatusDto> {
    try {
      const identity = await this.oidcSessionService.authenticateCookie(
        request,
        response,
        false,
      );
      return {
        authenticated: true,
        userId: identity.user.id,
        email: identity.user.email,
        csrfToken: identity.csrfToken,
        memberships: await this.tenantDirectory.listForUser(identity.user.id),
      };
    } catch (error) {
      if (!(error instanceof UnauthorizedException)) throw error;
      return { authenticated: false, memberships: [] };
    }
  }

  @Post('session/logout')
  @ApiCookieAuth('meridian_session')
  @ApiOperation({
    operationId: 'endOidcSession',
    summary: 'Delete the server session and return the provider logout URL',
  })
  @ApiOkResponse({ type: OidcLogoutResultDto })
  async endSession(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OidcLogoutResultDto> {
    return {
      logoutUrl: await this.oidcSessionService.logout(request, response),
    };
  }

  @Get('me/tenants')
  @UseGuards(OidcIdentityGuard)
  @ApiBearerAuth()
  @ApiCookieAuth('meridian_session')
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
