import {
  DataSource,
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
  ObjectLiteral,
} from 'typeorm';
import { runInTenantContext } from './tenant-context';
import { LoanCase } from './entities/loan-case.entity';
import { EvidenceFact } from './entities/evidence-fact.entity';
import { LoanCondition } from './entities/loan-condition.entity';
import { ConditionTransition } from './entities/condition-transition.entity';
import { OutboxEvent } from './entities/outbox-event.entity';
import { CasePolicyBinding } from './entities/case-policy-binding.entity';
import { CasePolicySnapshot } from './entities/case-policy-snapshot.entity';
import { AgentRun } from './entities/agent-run.entity';
import { AgentModelInvocation } from './entities/agent-model-invocation.entity';
import { AgentBudgetLedger } from './entities/agent-budget-ledger.entity';
import { AgentBudgetReservation } from './entities/agent-budget-reservation.entity';
import { TenantAgentBudgetUsage } from './entities/tenant-agent-budget-usage.entity';
import { ToolAttempt } from './entities/tool-attempt.entity';
import { EvaluationInputManifest } from './entities/evaluation-input-manifest.entity';
import { ConsentRecord } from './entities/consent-record.entity';
import { DataDispositionTask } from './entities/data-disposition-task.entity';
import { CommunicationMessage } from './entities/communication-message.entity';
import { ProviderOperationIntent } from './entities/provider-operation-intent.entity';
import { ProviderAuthorizationGrant } from './entities/provider-authorization-grant.entity';
import { PermissiblePurposeDecision } from './entities/permissible-purpose-decision.entity';
import { Tenant } from './entities/tenant.entity';

/**
 * Deletes every real row a synthetic, disposable tenant could have created —
 * in real foreign-key-safe order — then the tenant row itself. This is the
 * one place that logic lives; both `evaluation/runner.ts`'s
 * `cleanupEvaluationRun()` (a named corpus tenant, re-runnable without
 * replaying old rows) and `GuestSandboxService` (an expired public sandbox
 * tenant, M7-055) call this, rather than each hand-maintaining its own
 * partial, drifting copy of the same fragile ordering.
 *
 * `loan_cases.tenantId -> tenants` is the only real, DB-enforced foreign
 * key onto `tenants` itself anywhere in this schema (confirmed directly
 * against `information_schema.referential_constraints`, not assumed) —
 * most other tenant-scoped tables here use a plain `tenantId` column with
 * no FK at all, the same RLS-based-isolation-instead-of-FK pattern this
 * codebase uses throughout, and need an explicit delete below. A few real
 * `ON DELETE CASCADE` chains do exist and are relied on: deleting
 * `loan_cases` cascades `evidence_facts`/`loan_conditions` (and, from
 * `loan_conditions`, `condition_transitions`); deleting
 * `agent_budget_ledgers` cascades `agent_budget_reservations` (this
 * function still deletes reservations explicitly first anyway, the same
 * "explicit even where a cascade exists" choice made for
 * `AgentRun`/`ToolAttempt` below — a caller with a narrower entity list
 * shouldn't have to know which cascades exist to get correct behavior).
 * The delete order below also respects the two real RESTRICT constraints
 * this schema has (`case_policy_bindings.policySnapshotId ->
 * case_policy_snapshots`, `agent_runs.modelInvocationId ->
 * agent_model_invocations`).
 *
 * Every table except `LoanCase`/`Tenant` themselves is deleted through
 * `deleteIfKnown()`, which skips a table outright when the caller's own
 * `DataSource` never registered that entity — not every caller needs every
 * table (a narrow, scoped standalone script or spec's `DataSource` may only
 * declare the handful of entities it actually touches), and this function
 * has to stay callable by all of them without forcing every caller to widen
 * its own entity list just to satisfy this one shared helper.
 * `hasMetadata()` is a real registration check, not a guess.
 *
 * Every table this function touches except `Tenant` itself carries a real
 * `FORCE ROW LEVEL SECURITY` policy keyed on `app.current_tenant_id` (see
 * `database/tenant-context.ts`) — a role that isn't exempt from RLS (this
 * codebase's real staging/production runtime role, deliberately not a
 * superuser) sees zero rows on every one of those tables without it, so
 * every delete below silently matches nothing instead of erroring. This
 * was a real bug here through M7-055: every query ran on the bare
 * `DataSource`, so cleanup appeared to work against a local/CI Postgres
 * connected as an RLS-exempt superuser, then deleted nothing on real
 * staging and only surfaced when `Tenant.delete()` — the one unprotected
 * table — hit the real, still-there `loan_cases` row's FK. The whole
 * function now runs inside one `runInTenantContext()` transaction so
 * every delete below carries the tenant context RLS requires.
 *
 * Deliberately NOT deleted: `audit_events` (append-only by design — its own
 * migration's trigger rejects DELETE unconditionally, the same reason
 * `provider-kill-switch-drill.ts` can't clean up its own audit trail
 * either); `document_records`/`webhook_endpoints`/`webhook_deliveries`
 * (no route exists yet through which a guest-sandbox or evaluation-corpus
 * tenant could ever create one — see those subsystems' own entity
 * comments; adding a real, exercised route to either later means adding a
 * real delete here too, not before).
 */
export async function purgeTenantData(
  dataSource: DataSource,
  tenantId: string,
): Promise<void> {
  await runInTenantContext(dataSource, tenantId, async (manager) => {
    await purgeTenantDataWithManager(dataSource, manager, tenantId);
  });
}

async function purgeTenantDataWithManager(
  dataSource: DataSource,
  manager: EntityManager,
  tenantId: string,
): Promise<void> {
  const deleteIfKnown = async <T extends ObjectLiteral>(
    entity: EntityTarget<T>,
    where: Record<string, unknown>,
  ): Promise<void> => {
    // `hasMetadata()` is schema introspection, not a query — it's the same
    // answer regardless of which manager/transaction asks, so this stays
    // on `dataSource` even though the actual delete below runs against
    // `manager` (the `runInTenantContext` transaction, so RLS-protected
    // tables actually see the tenant context they require).
    if (!dataSource.hasMetadata(entity)) return;
    // Every real call site below passes a plain {tenantId} (or similar)
    // object matching that entity's own real column — TypeORM's generic
    // `delete()` signature can't infer that from an unconstrained `T`,
    // so this cast states what's already true by construction rather
    // than working around a real type mismatch.
    await manager.getRepository(entity).delete(where as FindOptionsWhere<T>);
  };

  // Reservations first, explicitly — real `agent_budget_reservations`
  // rows do carry a composite FK to `agent_budget_ledgers(id, tenantId)
  // ON DELETE CASCADE`, so deleting the ledger below would clean these
  // up on its own; this explicit delete is deliberately redundant with
  // that cascade (matches this function's own established "explicit
  // even where a real cascade already exists" style for AgentRun/
  // ToolAttempt and LoanCase/EvidenceFact below) rather than depending
  // on a fact a caller with a narrower entity list might not have.
  await deleteIfKnown(AgentBudgetReservation, { tenantId });
  await deleteIfKnown(AgentBudgetLedger, { tenantId });
  await deleteIfKnown(TenantAgentBudgetUsage, { tenantId });

  if (dataSource.hasMetadata(AgentRun)) {
    const agentRuns = await manager
      .getRepository(AgentRun)
      .find({ where: { tenantId } });
    if (agentRuns.length && dataSource.hasMetadata(ToolAttempt)) {
      await manager
        .getRepository(ToolAttempt)
        .delete(agentRuns.map((r) => ({ agentRunId: r.id })));
    }
    await manager.getRepository(AgentRun).delete({ tenantId });
  }
  await deleteIfKnown(AgentModelInvocation, { tenantId });

  await deleteIfKnown(EvaluationInputManifest, { tenantId });
  await deleteIfKnown(ProviderOperationIntent, { tenantId });
  await deleteIfKnown(ProviderAuthorizationGrant, { tenantId });
  await deleteIfKnown(PermissiblePurposeDecision, { tenantId });
  await deleteIfKnown(OutboxEvent, { tenantId });
  await deleteIfKnown(EvidenceFact, { tenantId });
  await deleteIfKnown(CasePolicyBinding, { tenantId });
  await deleteIfKnown(CasePolicySnapshot, { tenantId });

  if (dataSource.hasMetadata(LoanCondition)) {
    const conditions = await manager
      .getRepository(LoanCondition)
      .find({ where: { tenantId } });
    if (conditions.length && dataSource.hasMetadata(ConditionTransition)) {
      await manager
        .getRepository(ConditionTransition)
        .delete(conditions.map((c) => ({ conditionId: c.id })));
    }
    if (conditions.length) {
      await manager
        .getRepository(LoanCondition)
        .delete(conditions.map((c) => ({ id: c.id })));
    }
  }

  await deleteIfKnown(DataDispositionTask, { tenantId });
  await deleteIfKnown(ConsentRecord, { tenantId });
  await deleteIfKnown(CommunicationMessage, { tenantId });
  // LoanCase and Tenant are the two tables every real caller of this
  // function must register — not guarded, deliberately: a caller with
  // neither has nothing for this function to do in the first place.
  await manager.getRepository(LoanCase).delete({ tenantId });
  await manager.getRepository(Tenant).delete({ id: tenantId });
}
