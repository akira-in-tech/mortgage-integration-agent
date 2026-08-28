import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tenant-configured monthly provider-call and cost authority with RLS. */
export class TenantAgentAggregateBudget1787178400000 implements MigrationInterface {
  name = 'TenantAgentAggregateBudget1787178400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants"
         ADD "agentMonthlyProviderCallLimit" integer,
         ADD "agentMonthlyCostLimitMinorUnits" integer,
         ADD "agentBudgetCurrency" character(3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD CONSTRAINT "CK_tenants_agent_aggregate_budget"
       CHECK (
         ("agentMonthlyProviderCallLimit" IS NULL
           AND "agentMonthlyCostLimitMinorUnits" IS NULL
           AND "agentBudgetCurrency" IS NULL)
         OR
         ("agentMonthlyProviderCallLimit" IS NOT NULL
           AND "agentMonthlyCostLimitMinorUnits" IS NOT NULL
           AND "agentBudgetCurrency" IS NOT NULL
           AND "agentMonthlyProviderCallLimit" >= 0
           AND "agentMonthlyCostLimitMinorUnits" >= 0
           AND "agentBudgetCurrency" ~ '^[A-Z]{3}$')
       )`,
    );
    await queryRunner.query(`
      CREATE TABLE "tenant_agent_budget_usage" (
        "tenantId" uuid NOT NULL,
        "windowStart" date NOT NULL,
        "providerCallUsed" integer NOT NULL DEFAULT 0 CHECK ("providerCallUsed" >= 0),
        "providerCallReserved" integer NOT NULL DEFAULT 0 CHECK ("providerCallReserved" >= 0),
        "costUsedMinorUnits" integer NOT NULL DEFAULT 0 CHECK ("costUsedMinorUnits" >= 0),
        "costReservedMinorUnits" integer NOT NULL DEFAULT 0 CHECK ("costReservedMinorUnits" >= 0),
        "currency" character(3) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenant_agent_budget_usage" PRIMARY KEY ("tenantId", "windowStart"),
        CONSTRAINT "FK_tenant_agent_budget_usage_tenant" FOREIGN KEY ("tenantId")
          REFERENCES "tenants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "agent_budget_reservations"
         ADD "aggregateWindowStart" date,
         ADD CONSTRAINT "FK_agent_budget_reservation_tenant_usage"
           FOREIGN KEY ("tenantId", "aggregateWindowStart")
           REFERENCES "tenant_agent_budget_usage"("tenantId", "windowStart")`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_agent_budget_usage" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_agent_budget_usage" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY "tenant_isolation" ON "tenant_agent_budget_usage"
       USING (
         current_setting('app.bypass_rls', true) = 'true'
         OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
       )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY "tenant_isolation" ON "tenant_agent_budget_usage"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_budget_reservations"
         DROP CONSTRAINT IF EXISTS "FK_agent_budget_reservation_tenant_usage",
         DROP COLUMN IF EXISTS "aggregateWindowStart"`,
    );
    await queryRunner.query(`DROP TABLE "tenant_agent_budget_usage"`);
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP CONSTRAINT IF EXISTS "CK_tenants_agent_aggregate_budget"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants"
         DROP COLUMN IF EXISTS "agentBudgetCurrency",
         DROP COLUMN IF EXISTS "agentMonthlyCostLimitMinorUnits",
         DROP COLUMN IF EXISTS "agentMonthlyProviderCallLimit"`,
    );
  }
}
