import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AgentBudgetReservation,
  AgentBudgetReservationStatus,
} from '../../database/entities/agent-budget-reservation.entity';
import {
  AgentBudgetReservationReceipt,
  AgentBudgetSnapshot,
} from '../agent-budget-ledger.service';

export class AgentBudgetUnitsDto {
  @ApiProperty()
  stepUnits!: number;

  @ApiProperty()
  tokenUnits!: number;

  @ApiProperty()
  providerCallUnits!: number;

  @ApiProperty()
  costMinorUnits!: number;
}

export class AgentBudgetSnapshotDto implements AgentBudgetSnapshot {
  @ApiProperty({ format: 'uuid' })
  ledgerId!: string;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  remainingSteps!: number;

  @ApiProperty()
  remainingTokens!: number;

  @ApiProperty()
  remainingProviderCalls!: number;

  @ApiProperty()
  remainingCostMinorUnits!: number;

  @ApiProperty()
  remainingDurationMs!: number;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ format: 'date-time' })
  startedAt!: string;

  @ApiProperty({ format: 'date-time' })
  deadlineAt!: string;

  @ApiProperty()
  closed!: boolean;
}

export class AgentBudgetReservationReceiptDto implements AgentBudgetReservationReceipt {
  @ApiProperty({ format: 'uuid' })
  reservationId!: string;

  @ApiProperty()
  idempotencyKey!: string;

  @ApiProperty({ enum: AgentBudgetReservationStatus })
  status!: AgentBudgetReservationStatus;

  @ApiProperty({ type: AgentBudgetUnitsDto })
  units!: AgentBudgetUnitsDto;

  @ApiPropertyOptional({ nullable: true })
  actualCostMinorUnits!: number | null;

  @ApiProperty()
  replayed!: boolean;

  @ApiProperty({ type: AgentBudgetSnapshotDto })
  ledger!: AgentBudgetSnapshotDto;
}

export class AgentBudgetReservationQueueItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  ledgerId!: string;

  @ApiProperty()
  idempotencyKey!: string;

  @ApiProperty({ type: AgentBudgetUnitsDto })
  units!: AgentBudgetUnitsDto;

  @ApiProperty({ enum: AgentBudgetReservationStatus })
  status!: AgentBudgetReservationStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static from(
    entity: AgentBudgetReservation,
  ): AgentBudgetReservationQueueItemDto {
    return {
      id: entity.id,
      ledgerId: entity.ledgerId,
      idempotencyKey: entity.idempotencyKey,
      units: {
        stepUnits: entity.stepUnits,
        tokenUnits: entity.tokenUnits,
        providerCallUnits: entity.providerCallUnits,
        costMinorUnits: entity.costMinorUnits,
      },
      status: entity.status,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
