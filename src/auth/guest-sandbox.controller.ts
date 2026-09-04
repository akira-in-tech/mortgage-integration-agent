import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import {
  GuestSandboxService,
  GuestSandboxSummary,
} from './guest-sandbox.service';
import { CreateGuestSandboxSessionDto } from './dto/create-guest-sandbox-session.dto';

/** Public entry point for an isolated synthetic portfolio workspace. */
@ApiTags('portfolio-demo')
@Controller('v1/demo-sandbox')
export class GuestSandboxController {
  constructor(private readonly sandboxService: GuestSandboxService) {}

  @Post('session')
  // Creating a tenant has durable database cost, so this public endpoint is
  // intentionally stricter than the platform-wide request limit.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ operationId: 'createGuestSandboxSession' })
  create(
    @Res({ passthrough: true }) response: Response,
    @Body() scenario: CreateGuestSandboxSessionDto,
  ): Promise<GuestSandboxSummary> {
    return this.sandboxService.create(response, scenario);
  }

  @Get('session')
  @ApiOperation({ operationId: 'getGuestSandboxSession' })
  get(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<GuestSandboxSummary> {
    return this.sandboxService.getSession(request, response);
  }

  @Delete('session')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'deleteGuestSandboxSession' })
  async remove(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sandboxService.logout(request, response);
  }

  @Post('cases')
  // Lighter than session creation (no new tenant, no new database row
  // beyond the case/consent pair every real create-case call makes
  // anyway) but still a real, public, unauthenticated write -- a
  // generous but real ceiling.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ operationId: 'createGuestSandboxCase' })
  createCase(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() scenario: CreateGuestSandboxSessionDto,
  ): Promise<{ caseId: string }> {
    return this.sandboxService.createAdditionalCase(
      request,
      response,
      scenario,
    );
  }
}
