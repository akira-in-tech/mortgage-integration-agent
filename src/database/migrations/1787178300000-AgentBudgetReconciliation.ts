import { MigrationInterface, QueryRunner } from 'typeorm';

/** Human-attributed resolution evidence and an efficient UNKNOWN work queue. */
export class AgentBudgetReconciliation1787178300000 implements MigrationInterface {
  name = 'AgentBudgetReconciliation1787178300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_budget_reservations"
       ADD "resolvedBy" varchar(200),
       ADD "resolutionNote" varchar(2000)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_agent_budget_reservations_unknown"
       ON "agent_budget_reservations" ("tenantId", "createdAt", "id")
       WHERE "status" = 'UNKNOWN'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_agent_budget_reservations_unknown"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_budget_reservations"
       DROP COLUMN "resolutionNote",
       DROP COLUMN "resolvedBy"`,
    );
  }
}
