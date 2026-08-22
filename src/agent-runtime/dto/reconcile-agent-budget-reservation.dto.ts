import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export enum AgentBudgetResolutionOutcome {
  Committed = 'COMMITTED',
  Released = 'RELEASED',
}

/** Evidence-backed reviewer disposition for an outcome-unknown tool claim. */
export class ReconcileAgentBudgetReservationDto {
  @ApiProperty({ enum: AgentBudgetResolutionOutcome })
  @IsEnum(AgentBudgetResolutionOutcome)
  outcome!: AgentBudgetResolutionOutcome;

  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  resolutionNote!: string;

  @ApiPropertyOptional({
    description:
      'Trusted actual provider cost in integer minor units; COMMITTED only.',
    minimum: 0,
    maximum: 2_147_483_647,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  actualCostMinorUnits?: number;
}
