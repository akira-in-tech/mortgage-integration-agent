import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { PolicyResolutionStatus } from '../enums/policy-resolution-status.enum';
import { PolicyRuleDocument } from '../../policy/dsl/policy-rule.types';

registerEnumType(PolicyResolutionStatus, { name: 'PolicyResolutionStatus' });

/**
 * Immutable resolved-policy record for one case (Section 10.3, 14.1:
 * "Immutable resolved versions, source revisions, context hash, and
 * resolution reasons"). Written once per distinct resolution outcome by
 * `PolicyEvaluationService` — never updated in place. `versions` is a
 * denormalized snapshot of what `PolicyApplicabilityResolverService`
 * returned at `resolvedAt`, not a live reference — the whole point of a
 * snapshot is that it stays exactly what it was even if the underlying
 * policy catalog changes later. `@ObjectType()`/`@Field()` (M5-031) are
 * this entity's first exposure of any kind — no REST route has ever
 * read it either, so unlike `LoanCase`'s dual-decoration precedent, this
 * one is GraphQL-only.
 */
@Entity('case_policy_snapshots')
@ObjectType()
@Index('IDX_case_policy_snapshots_case', ['tenantId', 'caseId'])
export class CasePolicySnapshot {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Field(() => ID)
  @Column({ type: 'uuid' })
  caseId!: string;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  resolvedAt!: Date;

  /** Digest of the resolution context + outcome (see policy-digest.ts). */
  @Field()
  @Column({ type: 'varchar', length: 64 })
  contextHash!: string;

  /** Version tag for the resolver algorithm that produced this snapshot. */
  @Field()
  @Column({ type: 'varchar', length: 20 })
  resolverVersion!: string;

  @Field(() => PolicyResolutionStatus)
  @Column({ type: 'enum', enum: PolicyResolutionStatus })
  resolutionStatus!: PolicyResolutionStatus;

  /**
   * `rule` (the parsed DSL document) is stored here, not just referenced
   * by `policyVersionId`, so `PolicyEvaluationService`'s fast path
   * (Section 10.4) can reconstruct a full `PolicyResolutionResult` from
   * this snapshot alone — no `PolicyVersion` lookups needed — when
   * reusing a binding without re-running the resolver. Exposed as
   * `GraphQLJSON` (M5-031), not a modeled DSL-AST GraphQL type — the
   * parsed rule structure is inspectable, real data, not worth a second
   * full type system alongside the DSL's own.
   */
  @Field(() => GraphQLJSON)
  @Column({ type: 'jsonb' })
  versions!: Array<{
    policyVersionId: string;
    ruleId: string;
    version: string;
    rule: PolicyRuleDocument;
    effectiveFrom: string;
    effectiveTo: string | null;
  }>;

  @Field(() => [String])
  @Column({ type: 'jsonb' })
  unresolvedReasons!: string[];
}
