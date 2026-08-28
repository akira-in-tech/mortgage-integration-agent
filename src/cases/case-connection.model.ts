import { ObjectType, Field } from '@nestjs/graphql';
import { LoanCase } from '../database/entities/loan-case.entity';

/**
 * `cases(...)`'s own cursor-paginated result shape (Section 15.2, M6) —
 * the first list/search query this codebase has for `LoanCase` at all
 * (`case(caseId)` only ever fetches one, by id). A plain, concrete
 * connection type rather than a generic `Connection<T>` — this is the
 * only paginated query in this codebase so far; a shared generic would be
 * abstraction built for a second use case that doesn't exist yet.
 */
@ObjectType()
export class CaseEdge {
  @Field(() => LoanCase)
  node!: LoanCase;

  @Field()
  cursor!: string;
}

@ObjectType()
export class CasePageInfo {
  @Field()
  hasNextPage!: boolean;

  @Field(() => String, { nullable: true })
  endCursor!: string | null;
}

@ObjectType()
export class CaseConnection {
  @Field(() => [CaseEdge])
  edges!: CaseEdge[];

  @Field(() => CasePageInfo)
  pageInfo!: CasePageInfo;
}
