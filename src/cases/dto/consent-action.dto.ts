import { IsIn, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InputType, Field } from '@nestjs/graphql';

export type ConsentActionType = 'GRANT' | 'REVOKE';

/**
 * Section 15.1's `POST .../consents`. `GRANT` is rarely needed directly —
 * `CasesService.createCase()` already grants an implicit consent record
 * for every new case — but stays a real, callable action for re-granting
 * after a revoke, or for a distinct purpose/scope beyond the default
 * (Section 14.1's fuller per-purpose model, not modeled by this endpoint
 * yet — see `ConsentRecord`'s own comment). `REVOKE` is the new real
 * capability this slice adds: Section 14.2, "Consent revocation...
 * stops new processing immediately."
 *
 * `@InputType()`/`@Field()` (M6-003) — reused as-is for
 * `submitConsentAction`'s GraphQL mutation input; see `ReviewDto`'s own
 * comment for why `action` stays a plain `String`, not a GraphQL enum.
 */
@InputType()
export class ConsentActionDto {
  @ApiProperty({ enum: ['GRANT', 'REVOKE'] })
  @Field()
  @IsIn(['GRANT', 'REVOKE'])
  action!: ConsentActionType;

  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 2000,
    description: 'Only meaningful for REVOKE — the revocation reason.',
  })
  @Field(() => String, { nullable: true })
  @IsOptional()
  @Length(1, 2000)
  reason?: string;
}
