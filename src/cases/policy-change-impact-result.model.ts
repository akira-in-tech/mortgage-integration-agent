import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { PolicyChangeImpactKind } from '../database/enums/policy-change-impact.enum';

registerEnumType(PolicyChangeImpactKind, {
  name: 'PolicyChangeImpactKind',
});

/**
 * GraphQL's flattened counterpart to `CheckPolicyChangeImpactResult`
 * (`src/agent-runtime/tools/check-policy-change-impact.tool.ts`), a
 * TypeScript discriminated union (`{assessed: true, impact, details,
 * assessmentId} | {assessed: false, reason}`) — GraphQL has no
 * algebraic-type equivalent, so this is one object type with every
 * non-`assessed` field nullable, exactly matching the two real runtime
 * shapes the underlying result already takes. `assessed` alone tells a
 * client which of `impact`/`details`/`assessmentId` vs. `reason` is
 * actually populated, the same discrimination the TS type already
 * carries as its own `assessed` field.
 */
@ObjectType()
export class PolicyChangeImpactResult {
  @Field()
  assessed!: boolean;

  @Field(() => PolicyChangeImpactKind, { nullable: true })
  impact?: PolicyChangeImpactKind;

  @Field(() => String, { nullable: true })
  details?: string;

  @Field(() => ID, { nullable: true })
  assessmentId?: string;

  @Field(() => String, { nullable: true })
  reason?: string;
}
