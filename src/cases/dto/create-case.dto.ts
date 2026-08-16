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

  /** Borrower-declared monthly income (Section 10.7's `application.monthly_income`). */
  @IsPositive()
  statedMonthlyIncome!: number;

  /** Governing jurisdiction code, e.g. "US-CA" — must exist in the jurisdiction catalog. */
  @Length(1, 20)
  jurisdictionCode!: string;
}
