import {
  ObjectType,
  Field,
  InputType,
  registerEnumType,
  Float,
  ID,
} from '@nestjs/graphql';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

// ─── Enums ──────────────────────────────────────────────────────────────────

export enum LoanType {
  CONVENTIONAL = 'CONVENTIONAL',
  FHA = 'FHA',
  VA = 'VA',
  JUMBO = 'JUMBO',
}

export enum LoanDecisionStatus {
  APPROVED = 'APPROVED',
  CONDITIONAL = 'CONDITIONAL',
  DENIED = 'DENIED',
  PENDING = 'PENDING',
}

registerEnumType(LoanType, {
  name: 'LoanType',
  description: 'Supported mortgage loan programs',
});

registerEnumType(LoanDecisionStatus, {
  name: 'LoanDecisionStatus',
  description: 'Underwriting decision outcome',
});

// ─── Input ───────────────────────────────────────────────────────────────────

@InputType()
export class EvaluateLoanInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  borrowerId!: string;

  /** Requested loan amount in USD */
  @Field(() => Float)
  @IsNumber()
  @IsPositive()
  @Min(10_000)
  requestedAmount!: number;

  @Field(() => LoanType)
  @IsEnum(LoanType)
  loanType!: LoanType;
}

// ─── Response ────────────────────────────────────────────────────────────────

@ObjectType()
export class LoanEvaluationResult {
  @Field(() => ID)
  applicationId!: string;

  @Field(() => LoanDecisionStatus)
  decision!: LoanDecisionStatus;

  /** Underwriter confidence score, 0.0–1.0 */
  @Field(() => Float)
  confidence!: number;

  /** AI-generated plain-English explanation of the decision */
  @Field()
  reasoning!: string;

  @Field()
  incomeVerified!: boolean;

  @Field(() => Float)
  creditScore!: number;

  @Field()
  documentsValid!: boolean;

  /** Conditions the borrower must satisfy before final approval (CONDITIONAL decisions) */
  @Field(() => [String])
  conditions!: string[];

  @Field()
  createdAt!: Date;
}
