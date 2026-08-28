import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
loadEnv();

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { buildOpenApiDocument } from './openapi.config';

const OUTPUT_PATH = join(process.cwd(), 'openapi', 'openapi.json');

/**
 * Section 15.3: "checked and published OpenAPI artifact." Writes the same
 * document `main.ts` would serve live in development to a checked-in file,
 * so `npm run generate:client` (openapi-typescript) has something to read
 * without a running server. Builds the full `AppModule` (needs a real
 * `DATABASE_URL` — `TypeOrmModule` connects during module init) rather than
 * hand-assembling just the `CasesModule`, so the generated document can
 * never diverge from what the live app actually serves.
 */
async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = buildOpenApiDocument(app);

  mkdirSync(join(process.cwd(), 'openapi'), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(document, null, 2) + '\n');
  console.log(`OpenAPI document written to ${OUTPUT_PATH}`);

  await app.close();
}

main().catch((error) => {
  console.error('OpenAPI generation failed:', error);
  process.exit(1);
});
