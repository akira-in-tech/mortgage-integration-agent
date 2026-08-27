import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MinLength, MaxLength } from 'class-validator';
import { ProviderOperationIntent } from '../../database/entities/provider-operation-intent.entity';

// One row in the "needs reconciliation" list a reviewer sees. We only
// send the fields a reviewer actually needs to decide what happened —
// not every internal column on the real database row.
export class ProviderOperationIntentQueueItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  caseId!: string;

  @ApiProperty()
  providerId!: string;

  @ApiProperty()
  capability!: string;

  @ApiProperty()
  state!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static from(
    intent: ProviderOperationIntent,
  ): ProviderOperationIntentQueueItemDto {
    return {
      id: intent.id,
      caseId: intent.caseId,
      providerId: intent.providerId,
      capability: intent.capability,
      state: intent.state,
      createdAt: intent.createdAt.toISOString(),
    };
  }
}

// The three real outcomes a reviewer can record for a call whose result
// we never got a clear answer for. Matches
// ProviderOperationIntentService.resolveManually()'s own allowed values.
export enum ProviderOperationResolutionOutcome {
  Succeeded = 'SUCCEEDED',
  FailedFinal = 'FAILED_FINAL',
  Cancelled = 'CANCELLED',
}

// What a reviewer submits to close out one of these intents. resolvedBy
// is not part of this — the server fills that in from the signed-in
// reviewer's own identity, never from something the client could fake.
export class ResolveProviderOperationIntentDto {
  @ApiProperty({ enum: ProviderOperationResolutionOutcome })
  @IsEnum(ProviderOperationResolutionOutcome)
  outcome!: ProviderOperationResolutionOutcome;

  @ApiProperty({
    description: 'Why the reviewer picked this outcome.',
    minLength: 10,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  resolutionNote!: string;
}
