import { Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { InputType, Field } from '@nestjs/graphql';

/**
 * `POST .../escalate` (M5-023) — a human reviewer's own judgment call to
 * pause a case for review, `escalate_to_reviewer`'s (Section 9.4) first
 * real caller. `actorId` matches `ReviewDto`/`ApproveCommunicationMessageDto`'s
 * own convention: identifies which human made the call, distinct from
 * the API credential that authorized the request. `reason` is required,
 * matching `EscalateToReviewerArgs`'s own contract — unlike an approval
 * or a consent action, there is no default "why" for pausing a case that
 * would otherwise keep moving on its own.
 *
 * `@InputType()`/`@Field()` (M6-003) — reused as-is for `escalateCase`'s
 * GraphQL mutation input.
 */
@InputType()
export class EscalateDto {
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @Field()
  @Length(1, 200)
  actorId!: string;

  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @Field()
  @Length(1, 2000)
  reason!: string;
}
