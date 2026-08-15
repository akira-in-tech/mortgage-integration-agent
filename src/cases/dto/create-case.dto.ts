import { IsEnum, IsPositive, IsUUID, Length } from 'class-validator';
import { LoanType } from '../../database/enums/loan-type.enum';

export class CreateCaseDto {
  @IsUUID()
  tenantId!: string;

  @Length(1, 100)
  borrowerId!: string;

  @IsPositive()
  requestedAmount!: number;

  @IsEnum(LoanType)
  loanType!: LoanType;
}
