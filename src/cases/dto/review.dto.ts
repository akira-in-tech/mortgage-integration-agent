import { IsIn, IsOptional, Length, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InputType, Field } from '@nestjs/graphql';
import type { ConditionResolutionKind } from '../../workflows/case-conditions.signals';

export type ReviewActionType = 'CONDITION_RESOLUTION' | 'RESUME_EVALUATION';

/**
 * Section 15.1's single `POST .../reviews` endpoint now backs two review
 * actions — resolving an open condition, and resuming an evaluation the
 * Agent run interrupted for policy-applicability ambiguity (Section 9.5).
 * `reviewType` discriminates which; `resolution` only applies to the
 * former.
 *
 * `@InputType()`/`@Field()` (M6-003) reuse this same class as
 * `submitReview`'s GraphQL mutation input, the same dual-decoration
 * pattern this codebase already uses for entities — the global
 * `ValidationPipe` (`main.ts`) enforces the same class-validator rules
 * below on both transports, not a separate GraphQL-only check.
 * `reviewType`/`resolution` stay plain `String` fields (not a GraphQL
 * enum): both are string-literal unions, not real TypeScript `enum`s,
 * and `registerEnumType()` needs one — `@IsIn()` is what actually
 * enforces the allowed values either way.
 */
@InputType()
export class ReviewDto {
  @ApiProperty({ enum: ['CONDITION_RESOLUTION', 'RESUME_EVALUATION'] })
  @Field()
  @IsIn(['CONDITION_RESOLUTION', 'RESUME_EVALUATION'])
  reviewType!: ReviewActionType;

  @ApiProperty({ minLength: 1, maxLength: 200 })
  @Field()
  @Length(1, 200)
  actorId!: string;

  @ApiPropertyOptional({
    enum: ['SATISFIED', 'WAIVED'],
    description: 'Required when reviewType is CONDITION_RESOLUTION.',
  })
  @Field(() => String, { nullable: true })
  @ValidateIf((dto: ReviewDto) => dto.reviewType === 'CONDITION_RESOLUTION')
  @IsIn(['SATISFIED', 'WAIVED'])
  resolution?: ConditionResolutionKind;

  @ApiPropertyOptional({ minLength: 1, maxLength: 2000 })
  @Field(() => String, { nullable: true })
  @IsOptional()
  @Length(1, 2000)
  reason?: string;
}
