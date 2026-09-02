import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { DataDispositionService } from './data-disposition.service';
import {
  DataDispositionTaskQueueItemDto,
  ResolveDataDispositionTaskDto,
  VerifyBackupExpiryDto,
} from './dto/data-disposition-response.dto';
import { TenantAuthGuard } from '../auth/tenant-auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { RequireRole } from '../auth/require-role.decorator';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { AuthContext } from '../auth/auth-context';

/**
 * When a borrower revokes consent, the evidence collected under that
 * consent needs a real human decision: delete it, anonymize it, or keep
 * it because a legal hold requires that. This is where a reviewer makes
 * and records that decision. See DataDispositionService.resolve() for
 * the actual delete/anonymize/retain logic — including the
 * `AuditEventService` write (moved there in M7-028 so the
 * `resolve-data-disposition-task` script gets the same provenance this
 * controller does, instead of only the REST path).
 */
@ApiTags('data-disposition')
@ApiBearerAuth()
@UseGuards(TenantAuthGuard)
@Controller('v1/data-disposition-tasks')
export class DataDispositionController {
  constructor(private readonly dispositionService: DataDispositionService) {}

  @ApiOperation({
    operationId: 'listOpenDataDispositionTasks',
    summary: 'List data-disposition tasks still waiting on a decision',
  })
  @ApiQuery({ name: 'limit', required: false, minimum: 1, maximum: 100 })
  @ApiOkResponse({
    description: 'Oldest first.',
    type: DataDispositionTaskQueueItemDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid credentials.' })
  @ApiForbiddenResponse({ description: 'REVIEWER role required.' })
  @Get('open')
  @UseGuards(RoleGuard)
  @RequireRole(ApiClientRole.REVIEWER)
  async listOpen(
    @CurrentAuth() auth: AuthContext,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<DataDispositionTaskQueueItemDto[]> {
    const tasks = await this.dispositionService.listOpen(auth.tenantId, limit);
    return tasks.map(DataDispositionTaskQueueItemDto.from);
  }

  @ApiOperation({
    operationId: 'listDataDispositionTasksAwaitingBackupExpiry',
    summary: 'List tasks waiting for managed-backup retention expiry',
  })
  @Get('backup-expiry')
  @UseGuards(RoleGuard)
  @RequireRole(ApiClientRole.REVIEWER)
  async listAwaitingBackupExpiry(
    @CurrentAuth() auth: AuthContext,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<DataDispositionTaskQueueItemDto[]> {
    const tasks = await this.dispositionService.listAwaitingBackupExpiry(
      auth.tenantId,
      limit,
    );
    return tasks.map(DataDispositionTaskQueueItemDto.from);
  }

  @ApiOperation({
    operationId: 'resolveDataDispositionTask',
    summary: 'Delete, anonymize, or retain the evidence a task covers',
  })
  @ApiParam({ name: 'taskId', format: 'uuid' })
  @ApiOkResponse({
    description: 'The now-resolved task.',
    type: DataDispositionTaskQueueItemDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid credentials.' })
  @ApiForbiddenResponse({ description: 'REVIEWER role required.' })
  @Post(':taskId/resolve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard)
  @RequireRole(ApiClientRole.REVIEWER)
  async resolve(
    @CurrentAuth() auth: AuthContext,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: ResolveDataDispositionTaskDto,
  ): Promise<DataDispositionTaskQueueItemDto> {
    let resolved;
    try {
      resolved = await this.dispositionService.resolve(
        auth.tenantId,
        taskId,
        dto.action,
        auth.actorId,
        auth.correlationId,
      );
    } catch (error) {
      // resolve() already throws BadRequestException for a bad state or
      // an unresolvable legal-hold conflict — let that pass through as
      // its own real 400, only wrap anything unexpected.
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Could not resolve task.',
      );
    }

    return DataDispositionTaskQueueItemDto.from(resolved);
  }

  @ApiOperation({
    operationId: 'verifyDataDispositionBackupExpiry',
    summary: 'Verify backup expiry after the retention window closes',
  })
  @Post(':taskId/verify-backup-expiry')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard)
  @RequireRole(ApiClientRole.REVIEWER)
  async verifyBackupExpiry(
    @CurrentAuth() auth: AuthContext,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: VerifyBackupExpiryDto,
  ): Promise<DataDispositionTaskQueueItemDto> {
    const task = await this.dispositionService.verifyBackupExpiry(
      auth.tenantId,
      taskId,
      auth.actorId,
      dto.verificationReference,
    );
    return DataDispositionTaskQueueItemDto.from(task);
  }
}
