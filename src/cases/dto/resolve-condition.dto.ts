import { IsIn, IsOptional, Length } from 'class-validator';
import type { ConditionResolutionKind } from '../../workflows/case-conditions.signals';

export class ResolveConditionDto {
  @Length(1, 200)
  actorId!: string;

  @IsIn(['SATISFIED', 'WAIVED'])
  resolution!: ConditionResolutionKind;

  @IsOptional()
  @Length(1, 2000)
  reason?: string;
}
