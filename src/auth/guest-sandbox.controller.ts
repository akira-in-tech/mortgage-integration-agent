import {
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
  ): Promise<GuestSandboxSummary> {
    return this.sandboxService.create(response);
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
}
