import { NodeEnvironment } from './env.validation';

export type CorsOrigin = boolean | RegExp | string[];

/**
 * Resolves the CORS `origin` option from the validated env. An explicit
 * CORS_ALLOWED_ORIGINS always wins. Without one, development allows any
 * localhost port (convenient for a local frontend dev server or the
 * GraphQL playground); every other environment fails closed — no
 * cross-origin browser access — until an allowlist is configured.
 */
export function resolveCorsOrigin(
  allowedOrigins: string | undefined,
  nodeEnv: NodeEnvironment,
): CorsOrigin {
  if (allowedOrigins) {
    return allowedOrigins.split(',').map((origin) => origin.trim());
  }

  return nodeEnv === NodeEnvironment.Development
    ? /^http:\/\/localhost:\d+$/
    : false;
}
