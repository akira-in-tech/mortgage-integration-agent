import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

/**
 * Section 14.1's `audit_events`: "Append-only actor, action, resource,
 * and security history" — and Section 20 M5's own exit evidence: "every
 * material mutation records actor, tenant, resource, correlation, and
 * reason provenance" (M5-019). `correlationId` is `ApiKeyGuard`'s own
 * fresh per-request id (`AuthContext.correlationId`) — the only real,
 * request-scoped trace unit this codebase has; there is no distributed
 * tracing system to integrate with instead.
 *
 * Append-only is enforced two ways, not just by convention: no service
 * anywhere in this codebase ever calls `.update()`/`.delete()` on this
 * repository, and the table's own migration adds a database trigger that
 * rejects any `UPDATE`/`DELETE` outright, even under `app.bypass_rls` —
 * a real guarantee a future bug (or a compromised/misconfigured caller)
 * cannot silently violate just by writing the wrong query.
 *
 * `@ObjectType()`/`@Field()` (M5-031) — this table's first real read
 * surface of any kind (M5-019's own Known Gap, "no read surface exists
 * yet," named it as explicitly deferred to M6 UI-milestone scope).
 */
@Entity('audit_events')
@ObjectType()
@Index('IDX_audit_events_tenant_created', ['tenantId', 'createdAt'])
export class AuditEvent {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  /** The bearer credential's own id for a machine-initiated action, or a caller-supplied human name (`ReviewDto.actorId`, etc.) — whichever this codebase actually has for the action being recorded. */
  @Field()
  @Column({ type: 'varchar', length: 200 })
  actorId!: string;

  @Field()
  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Field()
  @Column({ type: 'varchar', length: 100 })
  resourceType!: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 200, nullable: true })
  resourceId!: string | null;

  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  correlationId!: string | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 2000, nullable: true })
  reason!: string | null;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
