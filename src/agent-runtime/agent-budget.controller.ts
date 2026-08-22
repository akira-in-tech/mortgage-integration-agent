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
import { AgentBudgetLedgerService } from './agent-budget-ledger.service';
import {
  AgentBudgetReservationQueueItemDto,
  AgentBudgetReservationReceiptDto,
} from './dto/agent-budget-response.dto';
import { TenantAuthGuard } from '../auth/tenant-auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { RequireRole } from '../auth/require-role.decorator';
import { ApiClientRole } from '../database/enums/api-client.enum';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { AuthContext } from '../auth/auth-context';
import { AuditEventService } from '../audit/audit-event.service';
import {
  AgentBudgetResolutionOutcome,
  ReconcileAgentBudgetReservationDto,
} from './dto/reconcile-agent-budget-reservation.dto';

/** Least-privilege queue and reviewer action for unresolved Agent capacity. */
@ApiTags('agent-budgets')
@ApiBearerAuth()
@UseGuards(TenantAuthGuard)
@Controller('v1/agent-budget-reservations')
export class AgentBudgetController {
  constructor(
    private readonly budgetService: AgentBudgetLedgerService,
    private readonly auditEventService: AuditEventService,
  ) {}

  @ApiOperation({
    operationId: 'listUnknownAgentBudgetReservations',
    summary: 'List outcome-unknown Agent budget reservations',
  })
  @ApiQuery({ name: 'limit', required: false, minimum: 1, maximum: 100 })
  @ApiOkResponse({
    description: 'Oldest unresolved reservations first.',
    type: AgentBudgetReservationQueueItemDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid credentials.' })
  @ApiForbiddenResponse({ description: 'REVIEWER role required.' })
  @Get('unknown')
  @UseGuards(RoleGuard)
  @RequireRole(ApiClientRole.REVIEWER)
  async listUnknown(
    @CurrentAuth() auth: AuthContext,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<AgentBudgetReservationQueueItemDto[]> {
    const reservations = await this.budgetService.listUnknown(
      auth.tenantId,
      limit,
    );
    return reservations.map(AgentBudgetReservationQueueItemDto.from);
  }

  @ApiOperation({
    operationId: 'reconcileAgentBudgetReservation',
    summary: 'Resolve an outcome-unknown Agent budget reservation',
  })
  @ApiParam({ name: 'reservationId', format: 'uuid' })
  @ApiOkResponse({
    description: 'The committed or released reservation.',
    type: AgentBudgetReservationReceiptDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid credentials.' })
  @ApiForbiddenResponse({ description: 'REVIEWER role required.' })
  @Post(':reservationId/reconcile')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard)
  @RequireRole(ApiClientRole.REVIEWER)
  async reconcile(
    @CurrentAuth() auth: AuthContext,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Body() dto: ReconcileAgentBudgetReservationDto,
  ): Promise<AgentBudgetReservationReceiptDto> {
    if (
      dto.outcome === AgentBudgetResolutionOutcome.Released &&
      dto.actualCostMinorUnits !== undefined
    ) {
      throw new BadRequestException(
        'actualCostMinorUnits is valid only for a COMMITTED outcome',
      );
    }

    const receipt =
      dto.outcome === AgentBudgetResolutionOutcome.Committed
        ? await this.budgetService.commit({
            tenantId: auth.tenantId,
            reservationId,
            actualCostMinorUnits: dto.actualCostMinorUnits,
            requireUnknown: true,
            resolvedBy: auth.actorId,
            resolutionNote: dto.resolutionNote,
          })
        : await this.budgetService.release(auth.tenantId, reservationId, {
            requireUnknown: true,
            resolvedBy: auth.actorId,
            resolutionNote: dto.resolutionNote,
          });

    await this.auditEventService.record({
      tenantId: auth.tenantId,
      actorId: auth.actorId,
      action: 'AGENT_BUDGET_RESERVATION_RECONCILED',
      resourceType: 'agent_budget_reservation',
      resourceId: reservationId,
      correlationId: auth.correlationId,
      reason: dto.resolutionNote,
      metadata: {
        outcome: receipt.status,
        actualCostMinorUnits: receipt.actualCostMinorUnits,
        ledgerVersion: receipt.ledger.version,
      },
    });
    return receipt;
  }
}
