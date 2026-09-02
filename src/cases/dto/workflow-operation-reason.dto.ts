import { Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Reviewer-supplied operational context is required for cancellation and
 * recovery. The authenticated identity comes from the credential, never a
 * caller-controlled actor field in this body.
 */
export class WorkflowOperationReasonDto {
  @ApiProperty({ minLength: 10, maxLength: 1000 })
  @Length(10, 1000)
  reason!: string;
}
