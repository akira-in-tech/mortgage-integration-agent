import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Section 7.5 names four independent checkpoints for the structural
 * command-class exclusion list — the provider capability registry, the
 * Agent tool registry, the promotion-manifest validator, and the
 * production router — "even when... an adapter is technically
 * certified." A real M4 audit (M7-028) found the promotion-manifest
 * validator had nothing to check: `ProviderPromotionManifest` never
 * carried a declared command class of its own, only `capability`
 * (INCOME/ASSET/CREDIT/IDENTITY/DOCUMENT — a verification *domain*, not a
 * command). This column is the same optional, human-attested field
 * `AgentTool`/`ProviderAdapter` already declare in code
 * (`structurallyExcludedCommandClass`) — nullable, since nothing today
 * declares one, the same honest default those two already establish.
 */
export class ProviderPromotionManifestDeclaredCommandClass1787178900000 implements MigrationInterface {
  name = 'ProviderPromotionManifestDeclaredCommandClass1787178900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "provider_promotion_manifests" ADD "declaredCommandClass" character varying(50)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "provider_promotion_manifests" DROP COLUMN "declaredCommandClass"`,
    );
  }
}
