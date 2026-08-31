import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { AuditEventService } from './audit-event.service';
import { TenantAuthGuard } from '../auth/tenant-auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { RequireRole } from '../auth/require-role.decorator';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { AuthContext } from '../auth/auth-context';
import { AuditEvent } from '../database/entities/audit-event.entity';

/**
 * An export is an operational evidence read, not an audit mutation. REVIEWER
 * authority is required because this tenant-wide history can contain security
 * events unrelated to the caller's current case; query bounds prevent it from
 * becoming an unbounded database dump endpoint.
 */
@ApiTags('audit-events')
@ApiBearerAuth()
@UseGuards(TenantAuthGuard, RoleGuard)
@RequireRole(ApiClientRole.REVIEWER)
@Controller('v1/audit-events')
export class AuditEventsController {
  constructor(private readonly auditEventService: AuditEventService) {}

  @ApiOperation({
    operationId: 'listAuditEvents',
    summary: 'List recent tenant audit events.',
  })
  @ApiQuery({ name: 'limit', required: false, minimum: 1, maximum: 1000 })
  @ApiOkResponse({ type: AuditEvent, isArray: true })
  @Get()
  async list(
    @CurrentAuth() auth: AuthContext,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ): Promise<AuditEvent[]> {
    return this.auditEventService.list(auth.tenantId, limit);
  }

  @ApiOperation({
    operationId: 'exportAuditEvents',
    summary: 'Download bounded tenant audit evidence as JSON.',
  })
  @ApiQuery({ name: 'limit', required: false, minimum: 1, maximum: 1000 })
  @ApiProduces('application/json')
  @Get('export')
  async export(
    @CurrentAuth() auth: AuthContext,
    @Query('limit', new DefaultValuePipe(1000), ParseIntPipe) limit: number,
    @Res() response: Response,
  ): Promise<void> {
    const events = await this.auditEventService.list(auth.tenantId, limit);
    const generatedAt = new Date().toISOString();
    response
      .status(200)
      .setHeader('content-type', 'application/json; charset=utf-8')
      .setHeader(
        'content-disposition',
        'attachment; filename="audit-events.json"',
      )
      .send(JSON.stringify({ generatedAt, tenantId: auth.tenantId, events }));
  }
}
