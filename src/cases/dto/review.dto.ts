import { IsIn, IsOptional, Length, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ConditionResolutionKind } from '../../workflows/case-conditions.signals';

export type ReviewActionType = 'CONDITION_RESOLUTION' | 'RESUME_EVALUATION';

/**
 * Section 15.1's single `POST .../reviews` endpoint now backs two review
 * actions — resolving an open condition, and resuming an evaluation the
 * Agent run interrupted for policy-applicability ambiguity (Section 9.5).
 * `reviewType` discriminates which; `resolution` only applies to the
 * former.
 */
export class ReviewDto {
  @ApiProperty({ enum: ['CONDITION_RESOLUTION', 'RESUME_EVALUATION'] })
  @IsIn(['CONDITION_RESOLUTION', 'RESUME_EVALUATION'])
  reviewType!: ReviewActionType;

  @ApiProperty({ minLength: 1, maxLength: 200 })
  @Length(1, 200)
  actorId!: string;

  @ApiPropertyOptional({
    enum: ['SATISFIED', 'WAIVED'],
    description: 'Required when reviewType is CONDITION_RESOLUTION.',
  })
  @ValidateIf((dto: ReviewDto) => dto.reviewType === 'CONDITION_RESOLUTION')
  @IsIn(['SATISFIED', 'WAIVED'])
  resolution?: ConditionResolutionKind;

  @ApiPropertyOptional({ minLength: 1, maxLength: 2000 })
  @IsOptional()
  @Length(1, 2000)
  reason?: string;
}
