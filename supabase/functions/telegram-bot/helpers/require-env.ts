import { EnvKey, optionalEnv } from "../../_shared/env.ts";

export function requireEnv(
  keys: readonly string[],
): { ok: boolean; missing: string[] } {
  const missing = keys.filter((k) => !optionalEnv(k as EnvKey));
  return { ok: missing.length === 0, missing };
}

export function requireMiniAppEnv(): void {
  const hasUrl = !!optionalEnv("MINI_APP_URL");
  const hasShort = !!optionalEnv("MINI_APP_SHORT_NAME");
  if (!hasUrl && !hasShort) {
    throw new Error("MINI_APP_URL or MINI_APP_SHORT_NAME must be set");
  }
}
