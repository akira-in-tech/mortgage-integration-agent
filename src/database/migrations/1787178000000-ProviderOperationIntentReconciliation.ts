import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Section 11.5's `RECONCILING` state (M5-027): the two columns a manual
 * resolution needs to record — who resolved a `RECONCILING`/
 * `OUTCOME_UNKNOWN` intent and why, mirroring `DataDispositionTask`'s own
 * `resolvedBy`/resolution-note precedent (M5-025) for the same real
 * "an operator investigated an ambiguous state out of band and is now
 * recording the real outcome" shape.
 */
export class ProviderOperationIntentReconciliation1787178000000 implements MigrationInterface {
  name = 'ProviderOperationIntentReconciliation1787178000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "provider_operation_intents" ADD "resolvedBy" character varying(200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_operation_intents" ADD "resolutionNote" character varying(2000)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "provider_operation_intents" DROP COLUMN "resolutionNote"`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_operation_intents" DROP COLUMN "resolvedBy"`,
    );
  }
}
