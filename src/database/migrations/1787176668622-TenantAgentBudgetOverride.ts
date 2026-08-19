import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M5-021's tenant-owned Agent run budget configuration — see `Tenant`'s
 * own class comment for the full "why budget, not the other four
 * configuration domains" reasoning. Both columns nullable with no
 * default: null means "use the platform default"
 * (`AGENT_RUN_STEP_BUDGET`/`AGENT_RUN_DURATION_BUDGET_MS`,
 * `case-conditions.activities.ts`), so every existing tenant's Agent
 * runs behave identically to before this migration until an operator
 * explicitly sets an override.
 */
export class TenantAgentBudgetOverride1787176668622 implements MigrationInterface {
  name = 'TenantAgentBudgetOverride1787176668622';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "agentRunStepBudgetOverride" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "agentRunDurationBudgetMsOverride" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN "agentRunDurationBudgetMsOverride"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN "agentRunStepBudgetOverride"`,
    );
  }
}
