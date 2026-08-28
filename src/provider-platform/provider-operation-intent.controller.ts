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
import { ProviderOperationIntentService } from './provider-operation-intent.service';
import { ProviderOperationIntentStatus } from '../database/enums/provider-platform.enum';
import {
  ProviderOperationIntentQueueItemDto,
  ProviderOperationResolutionOutcome,
  ResolveProviderOperationIntentDto,
} from './dto/provider-operation-intent-response.dto';
import { TenantAuthGuard } from '../auth/tenant-auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { RequireRole } from '../auth/require-role.decorator';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { AuthContext } from '../auth/auth-context';
import { AuditEventService } from '../audit/audit-event.service';

// Maps the DTO's outcome names onto the entity state resolveManually()
// expects. They're the same three real outcomes, just named separately
// on each side of the REST boundary.
const OUTCOME_TO_STATE: Record<
  ProviderOperationResolutionOutcome,
  | ProviderOperationIntentStatus.SUCCEEDED
  | ProviderOperationIntentStatus.FAILED_FINAL
  | ProviderOperationIntentStatus.CANCELLED
> = {
  [ProviderOperationResolutionOutcome.Succeeded]:
    ProviderOperationIntentStatus.SUCCEEDED,
  [ProviderOperationResolutionOutcome.FailedFinal]:
    ProviderOperationIntentStatus.FAILED_FINAL,
  [ProviderOperationResolutionOutcome.Cancelled]:
    ProviderOperationIntentStatus.CANCELLED,
};

/**
 * When a provider call's real outcome is unclear (the request timed out,
 * or the provider never sent a clear success/failure), this is where a
 * human reviewer looks at the provider's own records and tells the
 * system what actually happened. Nothing here guesses on its own —
 * see ProviderOperationIntentService.resolveManually() for why.
 */
@ApiTags('provider-operations')
@ApiBearerAuth()
@UseGuards(TenantAuthGuard)
@Controller('v1/provider-operation-intents')
export class ProviderOperationIntentController {
  constructor(
    private readonly intentService: ProviderOperationIntentService,
    private readonly auditEventService: AuditEventService,
  ) {}

  @ApiOperation({
    operationId: 'listProviderOperationIntentsNeedingReconciliation',
    summary: 'List provider calls whose outcome is still unclear',
  })
  @ApiQuery({ name: 'limit', required: false, minimum: 1, maximum: 100 })
  @ApiOkResponse({
    description: 'Oldest first.',
    type: ProviderOperationIntentQueueItemDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid credentials.' })
  @ApiForbiddenResponse({ description: 'REVIEWER role required.' })
  @Get('reconciling')
  @UseGuards(RoleGuard)
  @RequireRole(ApiClientRole.REVIEWER)
  async listReconciling(
    @CurrentAuth() auth: AuthContext,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<ProviderOperationIntentQueueItemDto[]> {
    const intents = await this.intentService.listNeedingReconciliation(
      auth.tenantId,
      limit,
    );
    return intents.map(ProviderOperationIntentQueueItemDto.from);
  }

  @ApiOperation({
    operationId: 'resolveProviderOperationIntent',
    summary: 'Record what actually happened for an unclear provider call',
  })
  @ApiParam({ name: 'intentId', format: 'uuid' })
  @ApiOkResponse({
    description: 'The now-resolved provider call.',
    type: ProviderOperationIntentQueueItemDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid credentials.' })
  @ApiForbiddenResponse({ description: 'REVIEWER role required.' })
  @Post(':intentId/resolve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard)
  @RequireRole(ApiClientRole.REVIEWER)
  async resolve(
    @CurrentAuth() auth: AuthContext,
    @Param('intentId', ParseUUIDPipe) intentId: string,
    @Body() dto: ResolveProviderOperationIntentDto,
  ): Promise<ProviderOperationIntentQueueItemDto> {
    const outcome = OUTCOME_TO_STATE[dto.outcome];

    let resolved;
    try {
      resolved = await this.intentService.resolveManually(
        auth.tenantId,
        intentId,
        outcome,
        auth.actorId,
        dto.resolutionNote,
      );
    } catch (error) {
      // resolveManually() throws a plain Error (not found, or not in a
      // resolvable state) — turn that into a normal 400 response instead
      // of an unhandled 500.
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Could not resolve intent.',
      );
    }

    await this.auditEventService.record({
      tenantId: auth.tenantId,
      actorId: auth.actorId,
      action: 'PROVIDER_OPERATION_INTENT_RESOLVED',
      resourceType: 'provider_operation_intent',
      resourceId: intentId,
      correlationId: auth.correlationId,
      reason: dto.resolutionNote,
      metadata: { outcome: dto.outcome },
    });

    return ProviderOperationIntentQueueItemDto.from(resolved);
  }
}
