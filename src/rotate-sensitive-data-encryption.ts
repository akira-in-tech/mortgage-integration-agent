import { config as loadEnv } from 'dotenv';
loadEnv();

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ProviderOperationIntent } from './database/entities/provider-operation-intent.entity';
import { ProviderOperationIntentService } from './provider-platform/provider-operation-intent.service';
import { SensitiveJsonCipher } from './provider-platform/sensitive-json-cipher';

interface EvidenceValueRow {
  id: string;
  value: unknown;
}

/**
 * Offline admin operation for legacy plaintext backfill and zero-downtime key
 * rotation. Output is counts only; borrower-derived content and ciphertext are
 * never written to logs.
 */
async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (!process.env.PROVIDER_DATA_ENCRYPTION_KEYS) {
    throw new Error('PROVIDER_DATA_ENCRYPTION_KEYS is required');
  }
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [ProviderOperationIntent],
  });
  await dataSource.initialize();
  try {
    const provider = await new ProviderOperationIntentService(
      dataSource,
    ).rotateSensitivePayloadEncryption();
    const cipher = new SensitiveJsonCipher();
    const evidenceRows = (await dataSource.query(
      `SELECT "id", "value" FROM "evidence_facts"`,
    )) as EvidenceValueRow[];
    let evidenceRewritten = 0;
    for (const row of evidenceRows) {
      const plaintext = cipher.isEnvelope(row.value)
        ? cipher.decrypt(row.value, 'evidence-facts:value')
        : row.value;
      const encrypted = cipher.encrypt(plaintext, 'evidence-facts:value');
      await dataSource.query(
        `UPDATE "evidence_facts" SET "value" = $1::jsonb WHERE "id" = $2`,
        [JSON.stringify(encrypted), row.id],
      );
      evidenceRewritten += 1;
    }
    console.log(
      `Sensitive data encryption rotation completed: providerScanned=${provider.scanned}, providerRewritten=${provider.rewritten}, evidenceScanned=${evidenceRows.length}, evidenceRewritten=${evidenceRewritten}`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
