import type { CodegenConfig } from '@graphql-codegen/cli';

// Schema source is the real generated `src/schema.gql` the backend writes
// on boot (gitignored there — regenerated every server start, same as
// `client/generated/schema.d.ts`'s own OpenAPI equivalent generates from a
// live/booted instance). Re-run `npm run codegen` after any backend schema
// change; this generated output is committed so `npm install && npm run
// build` works with no live server or schema file required.
const config: CodegenConfig = {
  schema: '../src/schema.gql',
  documents: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/gql/**/*'],
  generates: {
    'src/gql/': {
      preset: 'client',
      presetConfig: {
        fragmentMasking: false,
      },
      config: {
        // Real wire behavior: NestJS GraphQL serializes DateTime as an ISO
        // string over JSON — every console formatter already expects a
        // string, not a Date object.
        scalars: {
          DateTime: 'string',
          JSON: 'unknown',
        },
      },
    },
  },
  ignoreNoDocuments: true,
};

export default config;
