import { ObjectType, Field, Int } from '@nestjs/graphql';
import { CaseStatus } from '../database/entities/loan-case.entity';

/**
 * `caseStatusCounts`'s own result shape (Section 15.2, M6) — the ops
 * console's first real aggregate query. Only statuses with at least one
 * real case for the tenant are present; a zero-count status is simply
 * absent rather than a fabricated `0` row, since a `GROUP BY` naturally
 * never produces one.
 */
@ObjectType()
export class CaseStatusCount {
  @Field(() => CaseStatus)
  status!: CaseStatus;

  @Field(() => Int)
  count!: number;
}
