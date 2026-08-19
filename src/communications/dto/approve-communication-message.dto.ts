import { IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * `POST .../communication-messages/:messageId/approve` (M5-022) —
 * Section 6.4's exact human approval of a PROTECTED message's rendered
 * content. `actorId` matches `ReviewDto`'s own convention: the caller's
 * API credential (`AuthContext.apiClientId`) identifies *who is allowed*
 * to call this route (REVIEWER role, RoleGuard), but not *which human*
 * made the decision — that identity is a distinct field a shared
 * REVIEWER credential's caller supplies explicitly, same as reviewer
 * decisions on `/reviews`.
 */
export class ApproveCommunicationMessageDto {
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @Length(1, 200)
  actorId!: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 2000 })
  @IsOptional()
  @Length(1, 2000)
  reason?: string;
}
