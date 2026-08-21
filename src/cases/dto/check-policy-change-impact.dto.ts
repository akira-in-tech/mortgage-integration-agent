import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { InputType, Field, ID } from '@nestjs/graphql';

/**
 * `POST .../policy-change-impact` (M5-023) — `check_policy_change_impact`'s
 * (Section 9.4) first real caller: an operator asking "does this specific
 * open case need a fresh look after policy version X changed?" — distinct
 * from `PolicyActivationService.activate()`'s own automatic catalog-wide
 * scan (`PolicyChangeImpactService.assessImpact()`), which already covers
 * every open case, not just one.
 *
 * `@InputType()`/`@Field()` (M6-004) — reused as-is for
 * `checkPolicyChangeImpact`'s GraphQL mutation input.
 */
@InputType()
export class CheckPolicyChangeImpactDto {
  @ApiProperty({ format: 'uuid' })
  @Field(() => ID)
  @IsUUID()
  policyVersionId!: string;
}
