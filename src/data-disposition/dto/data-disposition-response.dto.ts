import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { DataDispositionTask } from '../../database/entities/data-disposition-task.entity';

// One row in the "needs a decision" list a reviewer sees.
export class DataDispositionTaskQueueItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  caseId!: string;

  @ApiProperty()
  taskType!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ description: 'Why this task was opened.' })
  reason!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  backupExpiryDueAt?: string;

  @ApiProperty({ type: Number })
  affectedProviderIntentCount!: number;

  static from(task: DataDispositionTask): DataDispositionTaskQueueItemDto {
    return {
      id: task.id,
      caseId: task.caseId,
      taskType: task.taskType,
      status: task.status,
      reason: task.reason,
      createdAt: task.createdAt.toISOString(),
      backupExpiryDueAt: task.backupExpiryDueAt?.toISOString(),
      affectedProviderIntentCount: task.affectedProviderIntentIds.length,
    };
  }
}

// What a reviewer submits to close out one of these tasks. Matches
// DataDispositionService.resolve()'s own allowed actions exactly.
export class ResolveDataDispositionTaskDto {
  @ApiProperty({ enum: ['DELETE', 'ANONYMIZE', 'RETAIN'] })
  @IsIn(['DELETE', 'ANONYMIZE', 'RETAIN'])
  action!: 'DELETE' | 'ANONYMIZE' | 'RETAIN';
}

export class VerifyBackupExpiryDto {
  @ApiProperty({
    description:
      'Non-sensitive operator or provider evidence reference proving backup expiry.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  verificationReference!: string;
}
