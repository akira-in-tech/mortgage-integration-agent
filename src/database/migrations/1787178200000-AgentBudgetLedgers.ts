import { MigrationInterface, QueryRunner } from 'typeorm';

/** Authoritative Agent budget ledgers, atomic reservations, and tenant RLS. */
export class AgentBudgetLedgers1787178200000 implements MigrationInterface {
  name = 'AgentBudgetLedgers1787178200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "agent_budget_ledgers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "caseId" uuid NOT NULL,
        "workflowRunId" varchar(200) NOT NULL,
        "stepLimit" integer NOT NULL CHECK ("stepLimit" >= 0),
        "stepUsed" integer NOT NULL DEFAULT 0 CHECK ("stepUsed" >= 0),
        "stepReserved" integer NOT NULL DEFAULT 0 CHECK ("stepReserved" >= 0),
        "tokenLimit" integer NOT NULL CHECK ("tokenLimit" >= 0),
        "tokenUsed" integer NOT NULL DEFAULT 0 CHECK ("tokenUsed" >= 0),
        "tokenReserved" integer NOT NULL DEFAULT 0 CHECK ("tokenReserved" >= 0),
        "providerCallLimit" integer NOT NULL CHECK ("providerCallLimit" >= 0),
        "providerCallUsed" integer NOT NULL DEFAULT 0 CHECK ("providerCallUsed" >= 0),
        "providerCallReserved" integer NOT NULL DEFAULT 0 CHECK ("providerCallReserved" >= 0),
        "costLimitMinorUnits" integer NOT NULL CHECK ("costLimitMinorUnits" >= 0),
        "costUsedMinorUnits" integer NOT NULL DEFAULT 0 CHECK ("costUsedMinorUnits" >= 0),
        "costReservedMinorUnits" integer NOT NULL DEFAULT 0 CHECK ("costReservedMinorUnits" >= 0),
        "currency" character(3) NOT NULL,
        "startedAt" timestamptz NOT NULL,
        "deadlineAt" timestamptz NOT NULL,
        "version" integer NOT NULL DEFAULT 1 CHECK ("version" > 0),
        "closedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agent_budget_ledgers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_agent_budget_ledgers_id_tenant" UNIQUE ("id", "tenantId"),
        CONSTRAINT "UQ_agent_budget_ledgers_workflow" UNIQUE ("tenantId", "workflowRunId"),
        CONSTRAINT "CK_agent_budget_ledgers_deadline" CHECK ("deadlineAt" > "startedAt")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_agent_budget_ledgers_case" ON "agent_budget_ledgers" ("tenantId", "caseId")`,
    );
    await queryRunner.query(
      `CREATE TYPE "agent_budget_reservations_status_enum" AS ENUM ('RESERVED', 'COMMITTED', 'RELEASED', 'UNKNOWN')`,
    );
    await queryRunner.query(`
      CREATE TABLE "agent_budget_reservations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "ledgerId" uuid NOT NULL,
        "idempotencyKey" varchar(200) NOT NULL,
        "stepUnits" integer NOT NULL DEFAULT 0 CHECK ("stepUnits" >= 0),
        "tokenUnits" integer NOT NULL DEFAULT 0 CHECK ("tokenUnits" >= 0),
        "providerCallUnits" integer NOT NULL DEFAULT 0 CHECK ("providerCallUnits" >= 0),
        "costMinorUnits" integer NOT NULL DEFAULT 0 CHECK ("costMinorUnits" >= 0),
        "actualCostMinorUnits" integer CHECK ("actualCostMinorUnits" >= 0),
        "status" "agent_budget_reservations_status_enum" NOT NULL,
        "resolvedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agent_budget_reservations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_agent_budget_reservations_key" UNIQUE ("ledgerId", "idempotencyKey"),
        CONSTRAINT "FK_agent_budget_reservations_ledger" FOREIGN KEY ("ledgerId", "tenantId")
          REFERENCES "agent_budget_ledgers"("id", "tenantId") ON DELETE CASCADE,
        CONSTRAINT "CK_agent_budget_reservations_nonzero" CHECK (
          "stepUnits" + "tokenUnits" + "providerCallUnits" + "costMinorUnits" > 0
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_agent_budget_reservations_tenant" ON "agent_budget_reservations" ("tenantId", "ledgerId")`,
    );

    for (const table of ['agent_budget_ledgers', 'agent_budget_reservations']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `CREATE POLICY "tenant_isolation" ON "${table}"
           USING (
             current_setting('app.bypass_rls', true) = 'true'
             OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
           )`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['agent_budget_reservations', 'agent_budget_ledgers']) {
      await queryRunner.query(`DROP POLICY "tenant_isolation" ON "${table}"`);
    }
    await queryRunner.query(
      `DROP INDEX "public"."IDX_agent_budget_reservations_tenant"`,
    );
    await queryRunner.query(`DROP TABLE "agent_budget_reservations"`);
    await queryRunner.query(
      `DROP TYPE "agent_budget_reservations_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_agent_budget_ledgers_case"`,
    );
    await queryRunner.query(`DROP TABLE "agent_budget_ledgers"`);
  }
}
