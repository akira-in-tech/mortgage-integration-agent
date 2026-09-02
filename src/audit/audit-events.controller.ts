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
    summary: "Download the tenant's complete audit evidence as JSON.",
  })
  @ApiProduces('application/json')
  @Get('export')
  async export(
    @CurrentAuth() auth: AuthContext,
    @Res() response: Response,
  ): Promise<void> {
    // M7-055: this used to silently cap at 1,000 rows with no indication
    // in the downloaded file that anything was missing — a tenant with
    // more history than that got a quietly-incomplete export. listAll()
    // walks the tenant's real, complete history with keyset pagination
    // and only sets `truncated` when a real existence check past its own
    // (very large) safety cap actually finds more rows, not as a guess.
    const { events, truncated } = await this.auditEventService.listAll(
      auth.tenantId,
    );
    const generatedAt = new Date().toISOString();
    response
      .status(200)
      .setHeader('content-type', 'application/json; charset=utf-8')
      .setHeader(
        'content-disposition',
        'attachment; filename="audit-events.json"',
      )
      .send(
        JSON.stringify({
          generatedAt,
          tenantId: auth.tenantId,
          truncated,
          events,
        }),
      );
  }
}
