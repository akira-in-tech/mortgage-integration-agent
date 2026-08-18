import { IsEnum, IsPositive, IsUUID, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LoanType } from '../../database/enums/loan-type.enum';

export class CreateCaseDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  tenantId!: string;

  @ApiProperty({ minLength: 1, maxLength: 100 })
  @Length(1, 100)
  borrowerId!: string;

  @ApiProperty({ minimum: 0, exclusiveMinimum: true })
  @IsPositive()
  requestedAmount!: number;

  @ApiProperty({ enum: LoanType })
  @IsEnum(LoanType)
  loanType!: LoanType;

  /** Borrower-declared monthly income (Section 10.7's `application.monthly_income`). */
  @ApiProperty({ minimum: 0, exclusiveMinimum: true })
  @IsPositive()
  statedMonthlyIncome!: number;

  /** Governing jurisdiction code, e.g. "US-CA" — must exist in the jurisdiction catalog. */
  @ApiProperty({ minLength: 1, maxLength: 20, example: 'US-CA' })
  @Length(1, 20)
  jurisdictionCode!: string;
}
